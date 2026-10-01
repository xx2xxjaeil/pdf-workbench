# PDF Workbench

A browser-based PDF editing workbench. Open an existing PDF or start with an A4 page, add text, tables, and images, then export the edited PDF.

## What works in the first slice

- Open an existing PDF and navigate its pages.
- Add editable text, image, and table elements to a page.
- Change text size, style, color, position, and box width; edit table cells.
- Undo and redo document changes.
- Export a PDF built from the original file plus the editor's elements.

The original PDF is preserved under the added elements. Existing AcroForm fields and arbitrary source text are not editable in this first slice. Covering old text with a new element is not redaction and does not remove that text from the PDF. The next engine milestone will address source content editing explicitly.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Quality gates are `npm run check` and `npm run build`.

## Design

The editor uses PDF points as its coordinate system, with the top-left corner as the app's origin. PDF.js renders imported pages. A typed document model owns added elements and undo/redo history. The exporter draws those elements onto the original bytes with pdf-lib, translating coordinates at the export boundary. This makes the preview and exported placement share the same source values.

See [architecture notes](docs/architecture.md) for invariants and the source-text editing roadmap.

## Fonts and assets

The included Nanum Gothic Regular and Bold fonts are from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/nanumgothic) under the SIL Open Font License. Their license is included in `public/fonts/OFL.txt`. The PDF.js worker is copied from the pinned `pdfjs-dist` npm dependency.
