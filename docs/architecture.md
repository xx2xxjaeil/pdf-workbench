# Architecture notes

## Product boundary

PDF Workbench edits an existing PDF by preserving the source and adding managed elements. It can also start from a blank A4 page. The source bytes remain local to the browser in this first version. The editor model is session-only: export creates an ordinary PDF, not a reusable project file, and reimporting it does not reconstruct managed elements.

This boundary is deliberate: PDF pages contain drawing commands, not a universal editable paragraph tree. A text element created by this app is editable in the app model. Text already painted into an imported PDF is not yet editable. The UI must never imply that visually covering a source region deletes the original text.

## Modules

```text
app/                   Route, metadata, global styles
features/editor/model/ Typed elements, commands, history
features/editor/pdf/   PDF.js viewer and pdf-lib exporter
features/editor/ui/    Workspace and element controls
public/fonts/          Embeddable Unicode fonts and license
```

## Coordinate invariant

Every managed element stores `x`, `y`, `width`, and `height` in PDF points, measured from the page's top-left. The preview scales that rectangle for CSS. The exporter converts y to PDF's bottom-left origin once. Page rotation and arbitrary crop boxes are not yet supported for placement, so the importer rejects them before editing.

## Editor invariants

- An edit command produces a new immutable document snapshot.
- Undo/redo stores document snapshots, not original PDF bytes.
- Text layout uses the embedded font's glyph widths and line spacing when exporting.
- Nanum Gothic is embedded without subsetting because the fontkit subset path dropped Korean glyphs during visual verification. Correct output takes priority over file size.
- Export reopens the created PDF during verification, and page count is checked.
- Unsupported or encrypted inputs are rejected with a readable error.

## Roadmap

1. First slice: import, add/edit managed elements, export, and verify output (complete).
2. Save/reopen an editable project file and improve preview/export text-layout parity.
3. AcroForm field editing and source-text inspection.
4. Narrow source-text replacement with explicit file support and visual verification.
5. Flow layout across pages and constrained AI edit suggestions with human approval.

AI is not present in the first slice. Any future AI output must be a validated edit command, and the reviewer decides whether it is applied.
