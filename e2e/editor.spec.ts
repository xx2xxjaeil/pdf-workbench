import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test("blank document: edit, resize, undo, and export a valid PDF", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "텍스트", exact: true }).click();

  const newText = page.getByRole("group", { name: "새 텍스트 선택" });
  await expect(newText).toBeVisible();
  await newText.dblclick();
  const inlineEditor = page.getByRole("textbox", {
    name: "페이지에서 텍스트 수정",
  });
  await inlineEditor.fill("E2E로 수정한 텍스트");
  await inlineEditor.press("ControlOrMeta+Enter");

  const editedText = page.getByRole("group", {
    name: "E2E로 수정한 텍스트 선택",
  });
  await expect(editedText).toBeVisible();

  const widthField = page.getByRole("spinbutton", { name: "너비" });
  await expect(widthField).toHaveValue("260");
  const rightHandle = page.getByRole("button", {
    name: "텍스트 크기 조절: 오른쪽",
    exact: true,
  });
  await rightHandle.scrollIntoViewIfNeeded();
  const box = await rightHandle.boundingBox();
  if (!box) throw new Error("텍스트 크기 조절 핸들의 위치를 찾지 못했습니다.");

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 60, centerY, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await widthField.inputValue()))
    .toBeGreaterThan(260);

  await page.getByRole("button", { name: "실행 취소" }).click();
  await editedText.click();
  await expect(widthField).toHaveValue("260");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF 내보내기" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("untitled.pdf");
  const outputPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(outputPath);
  const pdf = await PDFDocument.load(await readFile(outputPath));
  expect(pdf.getPageCount()).toBe(1);
});

test("import an existing PDF, navigate pages, and export two pages", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "PDF 열기" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles("public/demo.pdf");

  await expect(page.getByText("demo.pdf", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "다음 페이지" }).click();
  await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "표", exact: true }).click();
  await expect(page.getByRole("group", { name: "Table 선택" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF 내보내기" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("demo-edited.pdf");
  const outputPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(outputPath);
  const pdf = await PDFDocument.load(await readFile(outputPath));
  expect(pdf.getPageCount()).toBe(2);
});
