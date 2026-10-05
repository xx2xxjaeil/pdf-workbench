import { z } from "zod";
import { A4_PAGE, editorElementSchema, type EditorElement } from "./document";
import { importPdf, type ImportedDocument } from "../pdf/import-document";

const PROJECT_FORMAT = "pdf-workbench-project";
const PROJECT_VERSION = 1;
const MAX_PROJECT_BYTES = 80 * 1024 * 1024;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const BASE64_CHUNK_BYTES = 24 * 1024;

const projectSchema = z.strictObject({
  format: z.literal(PROJECT_FORMAT),
  version: z.literal(PROJECT_VERSION),
  source: z
    .strictObject({
      name: z
        .string()
        .min(1)
        .max(255)
        .regex(/\.pdf$/i),
      base64: z.string().max(Math.ceil(MAX_SOURCE_BYTES / 3) * 4),
    })
    .nullable(),
  elements: z.array(editorElementSchema).max(1000),
});

export interface EditableProject {
  source: ImportedDocument | null;
  elements: EditorElement[];
}

function encodeBase64(bytes: Uint8Array) {
  const chunks: string[] = [];

  // 청크 크기를 3의 배수로 유지해야 이어 붙인 Base64가 하나의 유효한 문자열이 된다.
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) {
    chunks.push(
      btoa(
        String.fromCharCode(
          ...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES),
        ),
      ),
    );
  }

  return chunks.join("");
}

function decodeBase64(value: string) {
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    throw new Error("프로젝트에 포함된 PDF 데이터가 올바르지 않습니다.");
  }

  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodedLength(value: string) {
  return (
    (value.length / 4) * 3 -
    (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0)
  );
}

function validateElements(
  elements: EditorElement[],
  pageSizes: { width: number; height: number }[],
) {
  const ids = new Set<string>();

  for (const element of elements) {
    if (ids.has(element.id)) {
      throw new Error("프로젝트에 중복된 요소가 있습니다.");
    }
    ids.add(element.id);

    const page = pageSizes[element.pageIndex];
    if (
      !page ||
      element.x < 0 ||
      element.y < 0 ||
      element.x + element.width > page.width + 0.01 ||
      element.y + element.height > page.height + 0.01
    ) {
      throw new Error("프로젝트에 페이지 바깥의 요소가 있습니다.");
    }

    if (element.kind === "image") {
      const prefix = `data:${element.mime};base64,`;
      const encoded = element.dataUrl.startsWith(prefix)
        ? element.dataUrl.slice(prefix.length)
        : "";
      if (
        !encoded ||
        decodedLength(encoded) > MAX_IMAGE_BYTES ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
          encoded,
        )
      ) {
        throw new Error("프로젝트에 포함된 이미지 데이터가 올바르지 않습니다.");
      }
    }
  }
}

export function createProjectFile({ source, elements }: EditableProject) {
  const parsedElements = editorElementSchema.array().max(1000).parse(elements);
  if (source && source.bytes.length > MAX_SOURCE_BYTES) {
    throw new Error("25MB 이하의 원본 PDF만 프로젝트에 저장할 수 있습니다.");
  }
  validateElements(parsedElements, source?.pageSizes ?? [A4_PAGE]);

  const bytes = new TextEncoder().encode(
    JSON.stringify({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      source: source
        ? { name: source.name, base64: encodeBase64(source.bytes) }
        : null,
      elements: parsedElements,
    }),
  );
  if (bytes.length > MAX_PROJECT_BYTES) {
    throw new Error("프로젝트 파일은 80MB 이하로 저장할 수 있습니다.");
  }
  return bytes;
}

export async function openProjectFile(
  file: Pick<File, "name" | "size" | "arrayBuffer">,
): Promise<EditableProject> {
  if (!file.name.toLowerCase().endsWith(".pdfw")) {
    throw new Error(".pdfw 프로젝트 파일을 선택해 주세요.");
  }
  if (file.size > MAX_PROJECT_BYTES) {
    throw new Error("80MB 이하의 프로젝트 파일만 열 수 있습니다.");
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new Error("프로젝트 파일을 읽을 수 없습니다.");
  }
  if (buffer.byteLength > MAX_PROJECT_BYTES) {
    throw new Error("80MB 이하의 프로젝트 파일만 열 수 있습니다.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(buffer),
    );
  } catch {
    throw new Error("프로젝트 파일을 읽을 수 없습니다.");
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "version" in payload &&
    payload.version !== PROJECT_VERSION
  ) {
    throw new Error("지원하지 않는 프로젝트 버전입니다.");
  }

  const parsed = projectSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("프로젝트 파일 형식이 올바르지 않습니다.");
  }

  let source: ImportedDocument | null = null;
  if (parsed.data.source) {
    if (decodedLength(parsed.data.source.base64) > MAX_SOURCE_BYTES) {
      throw new Error("25MB 이하의 원본 PDF만 프로젝트에서 열 수 있습니다.");
    }
    const bytes = decodeBase64(parsed.data.source.base64);
    source = await importPdf({
      name: parsed.data.source.name,
      size: bytes.length,
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    });
  }
  validateElements(parsed.data.elements, source?.pageSizes ?? [A4_PAGE]);
  return { source, elements: parsed.data.elements };
}
