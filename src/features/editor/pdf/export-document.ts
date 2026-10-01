import fontkit from "@pdf-lib/fontkit";
import { degrees, PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  editorElementSchema,
  type EditorElement,
  type PageSize,
} from "../model/document";

interface ExportOptions {
  sourceBytes: Uint8Array | null;
  pageSizes: PageSize[];
  elements: EditorElement[];
}

function hexColor(value: string) {
  return rgb(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
  );
}

async function loadFont(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("내장 한글 폰트를 불러오지 못했습니다.");
  return new Uint8Array(await response.arrayBuffer());
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const result: string[] = [];

  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const character of paragraph) {
      const candidate = line + character;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        result.push(line.trimEnd());
        line = character === " " ? "" : character;
      } else {
        line = candidate;
      }
    }
    result.push(line.trimEnd());
  }

  return result;
}

function drawTextElement(
  page: PDFPage,
  element: Extract<EditorElement, { kind: "text" }>,
  regular: PDFFont,
  bold: PDFFont,
) {
  const font = element.bold ? bold : regular;
  const inset = 6;
  const lineHeight = element.fontSize * 1.35;
  const lines = wrapText(
    element.text,
    font,
    element.fontSize,
    element.width - inset * 2,
  );

  if (lines.length * lineHeight + inset * 2 > element.height + 0.01) {
    throw new Error(
      "텍스트 상자의 높이가 부족합니다. 오른쪽 패널에서 높이를 늘려 주세요.",
    );
  }

  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, element.fontSize);
    const alignOffset =
      element.align === "center"
        ? (element.width - lineWidth) / 2
        : element.align === "right"
          ? element.width - inset - lineWidth
          : inset;

    // 편집기는 좌측 상단, PDF는 좌측 하단이 원점이므로 Y좌표를 뒤집어 그린다.
    page.drawText(line, {
      x: element.x + alignOffset,
      y:
        page.getHeight() -
        element.y -
        inset -
        element.fontSize -
        index * lineHeight,
      size: element.fontSize,
      font,
      color: hexColor(element.color),
      xSkew: element.italic ? degrees(12) : undefined,
    });
  });
}

function drawTableElement(
  page: PDFPage,
  element: Extract<EditorElement, { kind: "table" }>,
  font: PDFFont,
) {
  const rowCount = element.cells.length;
  const columnCount = element.cells[0].length;
  if (element.cells.some((row) => row.length !== columnCount)) {
    throw new Error("표의 열 개수가 맞지 않습니다.");
  }

  const cellWidth = element.width / columnCount;
  const cellHeight = element.height / rowCount;
  const lineHeight = element.fontSize * 1.25;

  element.cells.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      const x = element.x + columnIndex * cellWidth;
      const y = page.getHeight() - element.y - (rowIndex + 1) * cellHeight;
      page.drawRectangle({
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        borderColor: hexColor(element.borderColor),
        borderWidth: 0.7,
      });

      const lines = wrapText(cell, font, element.fontSize, cellWidth - 10);
      if (lines.length * lineHeight + 10 > cellHeight + 0.01) {
        throw new Error("표 셀의 높이가 부족합니다. 표의 높이를 늘려 주세요.");
      }

      lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: x + 5,
          y: y + cellHeight - 5 - element.fontSize - lineIndex * lineHeight,
          size: element.fontSize,
          font,
          color: hexColor(element.color),
        });
      });
    });
  });
}

function imageBytes(dataUrl: string) {
  const encoded = dataUrl.split(",")[1];
  if (!encoded) throw new Error("이미지 데이터가 올바르지 않습니다.");
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

export async function exportDocument({
  sourceBytes,
  pageSizes,
  elements,
}: ExportOptions) {
  const parsedElements = editorElementSchema.array().parse(elements);
  const document = sourceBytes
    ? await PDFDocument.load(sourceBytes.slice())
    : await PDFDocument.create();

  if (!sourceBytes) {
    pageSizes.forEach(({ width, height }) => document.addPage([width, height]));
  }

  if (document.getPageCount() !== pageSizes.length) {
    throw new Error("PDF 페이지 수가 변경되었습니다. 문서를 다시 열어 주세요.");
  }

  document.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    loadFont("/fonts/NanumGothic-Regular.ttf"),
    loadFont("/fonts/NanumGothic-Bold.ttf"),
  ]);
  const [regular, bold] = await Promise.all([
    document.embedFont(regularBytes),
    document.embedFont(boldBytes),
  ]);

  for (const element of parsedElements) {
    const page = document.getPages()[element.pageIndex];
    if (!page) throw new Error("존재하지 않는 페이지의 요소가 있습니다.");
    const { width, height } = page.getSize();
    if (
      element.x < 0 ||
      element.y < 0 ||
      element.x + element.width > width + 0.01 ||
      element.y + element.height > height + 0.01
    ) {
      throw new Error("페이지 바깥에 놓인 요소가 있습니다.");
    }

    if (element.kind === "text") {
      drawTextElement(page, element, regular, bold);
    } else if (element.kind === "table") {
      drawTableElement(page, element, regular);
    } else {
      const bytes = imageBytes(element.dataUrl);
      const embedded =
        element.mime === "image/png"
          ? await document.embedPng(bytes)
          : await document.embedJpg(bytes);
      page.drawImage(embedded, {
        x: element.x,
        y: height - element.y - element.height,
        width: element.width,
        height: element.height,
      });
    }
  }

  const result = await document.save();
  // 다운로드 전에 결과를 다시 열어 PDF 손상과 페이지 수 불일치를 확인한다.
  const verified = await PDFDocument.load(result);
  if (verified.getPageCount() !== pageSizes.length) {
    throw new Error("내보낸 PDF의 페이지 수가 예상과 다릅니다.");
  }
  return result;
}
