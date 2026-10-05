import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  A4_PAGE,
  type EditorElement,
} from "../src/features/editor/model/document";
import {
  createProjectFile,
  openProjectFile,
} from "../src/features/editor/model/project-file";
import { importPdf } from "../src/features/editor/pdf/import-document";

const textElement: EditorElement = {
  id: "text-1",
  kind: "text",
  pageIndex: 0,
  x: 60,
  y: 80,
  width: 260,
  height: 90,
  text: "저장한 한글 텍스트",
  fontSize: 18,
  bold: false,
  italic: false,
  color: "#1f2937",
  align: "left",
};

function projectFile(bytes: Uint8Array, name = "draft.pdfw") {
  return {
    name,
    size: bytes.length,
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  };
}

test("blank-page project restores editable elements", async () => {
  const bytes = createProjectFile({ source: null, elements: [textElement] });
  const restored = await openProjectFile(projectFile(bytes));

  assert.equal(restored.source, null);
  assert.deepEqual(restored.elements, [textElement]);
});

test("imported PDF project retains source bytes and page placement", async () => {
  const document = await PDFDocument.create();
  document.addPage([A4_PAGE.width, A4_PAGE.height]);
  document.addPage([400, 600]);
  const pdfBytes = await document.save();
  const source = await importPdf({
    name: "source.pdf",
    size: pdfBytes.length,
    arrayBuffer: async () => Uint8Array.from(pdfBytes).buffer,
  });
  const secondPageElement = { ...textElement, pageIndex: 1 };
  const bytes = createProjectFile({
    source,
    elements: [secondPageElement],
  });
  const restored = await openProjectFile(projectFile(bytes));

  assert.deepEqual(restored.source?.bytes, pdfBytes);
  assert.deepEqual(restored.source?.pageSizes[1], { width: 400, height: 600 });
  assert.deepEqual(restored.elements, [secondPageElement]);
});

test("project rejects unsupported versions and malformed files", async () => {
  const bytes = createProjectFile({ source: null, elements: [] });
  const payload = JSON.parse(new TextDecoder().decode(bytes));

  await assert.rejects(
    openProjectFile(projectFile(new TextEncoder().encode("not json"))),
    /프로젝트 파일을 읽을 수 없습니다/,
  );
  await assert.rejects(
    openProjectFile(
      projectFile(
        new TextEncoder().encode(JSON.stringify({ ...payload, version: 2 })),
      ),
    ),
    /지원하지 않는 프로젝트 버전/,
  );
  await assert.rejects(
    openProjectFile(projectFile(bytes, "draft.pdf")),
    /\.pdfw 프로젝트 파일/,
  );
});

test("project rejects duplicate IDs and out-of-page elements", async () => {
  assert.throws(
    () =>
      createProjectFile({
        source: null,
        elements: [textElement, { ...textElement }],
      }),
    /중복된 요소/,
  );

  const bytes = createProjectFile({ source: null, elements: [textElement] });
  const payload = JSON.parse(new TextDecoder().decode(bytes));
  payload.elements[0].x = 9999;
  await assert.rejects(
    openProjectFile(
      projectFile(new TextEncoder().encode(JSON.stringify(payload))),
    ),
    /페이지 바깥의 요소/,
  );
});
