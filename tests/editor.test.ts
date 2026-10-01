import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import {
  A4_PAGE,
  clampElementToPage,
  type EditorElement,
} from "../src/features/editor/model/document";
import {
  editorHistoryReducer,
  initialHistory,
} from "../src/features/editor/model/history";
import { resizeElement } from "../src/features/editor/model/resize-element";
import { exportDocument } from "../src/features/editor/pdf/export-document";
import { importPdf } from "../src/features/editor/pdf/import-document";

const textElement: EditorElement = {
  id: "text-1",
  kind: "text",
  pageIndex: 0,
  x: 60,
  y: 80,
  width: 260,
  height: 90,
  text: "한글 PDF 테스트",
  fontSize: 18,
  bold: true,
  italic: false,
  color: "#1f2937",
  align: "left",
};

function asFile(bytes: Uint8Array, name = "source.pdf") {
  return {
    name,
    size: bytes.length,
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  } as File;
}

test("elements stay within page bounds", () => {
  const moved = clampElementToPage({ ...textElement, x: 999, y: -30 }, A4_PAGE);
  assert.equal(moved.x, A4_PAGE.width - textElement.width);
  assert.equal(moved.y, 0);
});

test("edge and corner resize keep the opposite side fixed", () => {
  const wider = resizeElement(textElement, A4_PAGE, "e", 70, 0);
  assert.equal(wider.x, textElement.x);
  assert.equal(wider.width, textElement.width + 70);

  const fromLeft = resizeElement(textElement, A4_PAGE, "w", 40, 0);
  assert.equal(fromLeft.x, textElement.x + 40);
  assert.equal(fromLeft.x + fromLeft.width, textElement.x + textElement.width);

  const corner = resizeElement(textElement, A4_PAGE, "nw", -999, -999);
  assert.equal(corner.x, 0);
  assert.equal(corner.y, 0);
  assert.equal(corner.x + corner.width, textElement.x + textElement.width);
  assert.equal(corner.y + corner.height, textElement.y + textElement.height);

  const minimum = resizeElement(textElement, A4_PAGE, "se", -999, -999);
  assert.equal(minimum.width, 20);
  assert.equal(minimum.height, 20);
});

test("undo and redo retain immutable snapshots", () => {
  const added = editorHistoryReducer(initialHistory, {
    type: "add",
    element: textElement,
  });
  const changed = editorHistoryReducer(added, {
    type: "update",
    element: { ...textElement, text: "수정됨" },
  });
  assert.deepEqual(added.present[0], textElement);
  assert.equal(changed.present[0].kind, "text");

  const undone = editorHistoryReducer(changed, { type: "undo" });
  assert.deepEqual(undone.present, [textElement]);
  assert.equal(undone.future.length, 1);

  const redone = editorHistoryReducer(undone, { type: "redo" });
  assert.deepEqual(redone.present, changed.present);
});

test("PDF import reads page sizes and rejects unsupported rotation", async () => {
  const source = await PDFDocument.create();
  source.addPage([A4_PAGE.width, A4_PAGE.height]);
  source.addPage([400, 600]);
  const bytes = await source.save();
  const imported = await importPdf(asFile(bytes));

  assert.equal(imported.pageSizes.length, 2);
  assert.deepEqual(imported.pageSizes[1], { width: 400, height: 600 });
  assert.deepEqual(imported.bytes, bytes);

  source.getPage(0).setRotation(degrees(90));
  await assert.rejects(
    importPdf(asFile(await source.save())),
    /회전되거나 잘린 페이지/,
  );
});

test("PDF export preserves the source page and embeds edited content", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const fontName = String(input).split("/").at(-1);
    const bytes = await readFile(
      path.join(process.cwd(), "public", "fonts", fontName ?? ""),
    );
    return new Response(bytes, { status: 200 });
  };

  try {
    const source = await PDFDocument.create();
    const page = source.addPage([A4_PAGE.width, A4_PAGE.height]);
    const sourceFont = await source.embedFont(StandardFonts.Helvetica);
    page.drawText("SOURCE", { x: 30, y: 760, font: sourceFont, size: 12 });
    const sourceBytes = await source.save();
    const sourceSnapshot = Uint8Array.from(sourceBytes);
    const table: EditorElement = {
      id: "table-1",
      kind: "table",
      pageIndex: 0,
      x: 60,
      y: 210,
      width: 300,
      height: 120,
      cells: [
        ["항목", "내용"],
        ["첫째", "둘째"],
      ],
      fontSize: 11,
      color: "#1f2937",
      borderColor: "#94a3b8",
    };
    const image: EditorElement = {
      id: "image-1",
      kind: "image",
      pageIndex: 0,
      x: 60,
      y: 380,
      width: 32,
      height: 32,
      mime: "image/png",
      dataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlYhY4AAAAASUVORK5CYII=",
    };

    const output = await exportDocument({
      sourceBytes,
      pageSizes: [A4_PAGE],
      elements: [textElement, table, image],
    });
    const parsed = await PDFDocument.load(output);
    assert.equal(parsed.getPageCount(), 1);
    assert.ok(output.length > sourceBytes.length);
    assert.deepEqual(sourceBytes, sourceSnapshot);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
