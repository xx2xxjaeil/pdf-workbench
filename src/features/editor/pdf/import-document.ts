import { PDFDocument } from "pdf-lib";
import type { PageSize } from "../model/document";

export interface ImportedDocument {
  bytes: Uint8Array;
  pageSizes: PageSize[];
  name: string;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function importPdf(file: File): Promise<ImportedDocument> {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("PDF 파일을 선택해 주세요.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("25MB 이하의 PDF만 열 수 있습니다.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const document = await PDFDocument.load(bytes);
    const pages = document.getPages();

    if (pages.length === 0) {
      throw new Error("페이지가 없는 PDF는 열 수 없습니다.");
    }

    // 편집 요소는 페이지 좌측 상단 기준 좌표를 사용한다. 회전·잘림 페이지는 별도 변환 없이는
    // 미리보기와 내보내기 위치가 어긋나므로 현재는 가져오기를 제한한다.
    const pageSizes = pages.map((page) => {
      const media = page.getMediaBox();
      const crop = page.getCropBox();
      const rotation = page.getRotation().angle % 360;

      if (
        rotation !== 0 ||
        media.x !== 0 ||
        media.y !== 0 ||
        crop.x !== media.x ||
        crop.y !== media.y ||
        crop.width !== media.width ||
        crop.height !== media.height
      ) {
        throw new Error("회전되거나 잘린 페이지는 아직 편집할 수 없습니다.");
      }

      return { width: media.width, height: media.height };
    });

    return { bytes, pageSizes, name: file.name };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.endsWith("편집할 수 없습니다.")
    ) {
      throw error;
    }
    throw new Error(
      "PDF를 열 수 없습니다. 암호화되었거나 손상된 파일인지 확인해 주세요.",
    );
  }
}
