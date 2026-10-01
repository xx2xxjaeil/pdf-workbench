import { z } from "zod";

export interface PageSize {
  width: number;
  height: number;
}

export const A4_PAGE: PageSize = { width: 595.28, height: 841.89 };

const baseElementSchema = z.object({
  id: z.string().min(1),
  pageIndex: z.number().int().nonnegative(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const textElementSchema = baseElementSchema.extend({
  kind: z.literal("text"),
  text: z.string().max(10000),
  fontSize: z.number().min(6).max(96),
  bold: z.boolean(),
  italic: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  align: z.enum(["left", "center", "right"]),
});

const imageElementSchema = baseElementSchema.extend({
  kind: z.literal("image"),
  dataUrl: z.string().startsWith("data:image/"),
  mime: z.enum(["image/png", "image/jpeg"]),
});

const tableElementSchema = baseElementSchema.extend({
  kind: z.literal("table"),
  cells: z.array(z.array(z.string().max(2000)).min(1)).min(1),
  fontSize: z.number().min(6).max(36),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  borderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const editorElementSchema = z.discriminatedUnion("kind", [
  textElementSchema,
  imageElementSchema,
  tableElementSchema,
]);

export type EditorElement = z.infer<typeof editorElementSchema>;
export type TextElement = Extract<EditorElement, { kind: "text" }>;
export type ImageElement = Extract<EditorElement, { kind: "image" }>;
export type TableElement = Extract<EditorElement, { kind: "table" }>;

export function clampElementToPage<T extends EditorElement>(
  element: T,
  page: PageSize,
): T {
  const width = Math.min(element.width, page.width);
  const height = Math.min(element.height, page.height);

  return {
    ...element,
    width,
    height,
    x: Math.max(0, Math.min(element.x, page.width - width)),
    y: Math.max(0, Math.min(element.y, page.height - height)),
  };
}

export function getElementName(element: EditorElement) {
  if (element.kind === "text") {
    return element.text.trim().slice(0, 24) || "Text";
  }

  return element.kind === "image" ? "Image" : "Table";
}
