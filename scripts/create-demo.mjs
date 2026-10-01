import { writeFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const document = await PDFDocument.create();
const regular = await document.embedFont(StandardFonts.Helvetica);
const bold = await document.embedFont(StandardFonts.HelveticaBold);

function addDemoPage(number, heading, description) {
  const page = document.addPage([595.28, 841.89]);
  const { height } = page.getSize();
  page.drawRectangle({
    x: 0,
    y: height - 205,
    width: 595.28,
    height: 205,
    color: rgb(0.94, 0.95, 1),
  });
  page.drawText(`PAGE 0${number} / SOURCE PDF`, {
    x: 52,
    y: height - 62,
    size: 11,
    font: bold,
    color: rgb(0.29, 0.35, 0.72),
  });
  page.drawText(heading, {
    x: 52,
    y: height - 113,
    size: 28,
    font: bold,
    color: rgb(0.1, 0.16, 0.29),
  });
  page.drawText(description, {
    x: 52,
    y: height - 147,
    size: 12,
    font: regular,
    color: rgb(0.36, 0.42, 0.54),
  });
  page.drawText(
    "This original content stays in the PDF when you export your edits.",
    {
      x: 52,
      y: height - 258,
      size: 12,
      font: regular,
      color: rgb(0.35, 0.41, 0.52),
    },
  );
  page.drawRectangle({
    x: 52,
    y: height - 430,
    width: 491,
    height: 120,
    borderColor: rgb(0.79, 0.82, 0.9),
    borderWidth: 1,
  });
  page.drawText("Add a text box, table, or image in this area.", {
    x: 70,
    y: height - 371,
    size: 13,
    font: regular,
    color: rgb(0.54, 0.59, 0.69),
  });
  page.drawText("PDF WORKBENCH  /  SAMPLE DOCUMENT", {
    x: 52,
    y: 35,
    size: 9,
    font: regular,
    color: rgb(0.65, 0.69, 0.76),
  });
}

addDemoPage(
  1,
  "Review the original",
  "Open an existing PDF and keep every source page intact.",
);
addDemoPage(
  2,
  "Add your edits",
  "Place managed elements on any page, then export a new PDF.",
);

await writeFile(
  new URL("../public/demo.pdf", import.meta.url),
  await document.save(),
);
