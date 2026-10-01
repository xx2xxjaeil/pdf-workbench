"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import {
  clampElementToPage,
  getElementName,
  type EditorElement,
  type PageSize,
  type TextElement,
} from "../model/document";
import { resizeElement, type ResizeHandle } from "../model/resize-element";

const RESIZE_HANDLES: { direction: ResizeHandle; label: string }[] = [
  { direction: "n", label: "위쪽" },
  { direction: "ne", label: "오른쪽 위" },
  { direction: "e", label: "오른쪽" },
  { direction: "se", label: "오른쪽 아래" },
  { direction: "s", label: "아래쪽" },
  { direction: "sw", label: "왼쪽 아래" },
  { direction: "w", label: "왼쪽" },
  { direction: "nw", label: "왼쪽 위" },
];

function textStyle(element: TextElement, scale: number): CSSProperties {
  return {
    fontSize: element.fontSize * scale,
    fontWeight: element.bold ? 700 : 400,
    fontStyle: element.italic ? "italic" : "normal",
    lineHeight: 1.35,
    color: element.color,
    textAlign: element.align,
    padding: 6 * scale,
  };
}

function PreviewElement({
  element,
  scale,
}: {
  element: EditorElement;
  scale: number;
}) {
  if (element.kind === "text") {
    return (
      <div className="preview-text" style={textStyle(element, scale)}>
        {element.text || <span className="placeholder-text">텍스트 입력</span>}
      </div>
    );
  }

  if (element.kind === "image") {
    return (
      <div
        className="preview-image"
        style={{ backgroundImage: `url(${element.dataUrl})` }}
        role="img"
        aria-label="추가한 이미지"
      />
    );
  }

  return (
    <div
      className="preview-table"
      style={{
        gridTemplateColumns: `repeat(${element.cells[0].length}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${element.cells.length}, minmax(0, 1fr))`,
      }}
    >
      {element.cells.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => (
          <div
            className="preview-cell"
            key={`${rowIndex}-${columnIndex}`}
            style={{
              borderColor: element.borderColor,
              color: element.color,
              fontSize: element.fontSize * scale,
            }}
          >
            {cell}
          </div>
        )),
      )}
    </div>
  );
}

interface PageElementProps {
  element: EditorElement;
  pageSize: PageSize;
  scale: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (element: EditorElement) => void;
}

export function PageElement({
  element,
  pageSize,
  scale,
  selected,
  onSelect,
  onChange,
}: PageElementProps) {
  const dragRef = useRef<{
    clientX: number;
    clientY: number;
    x: number;
    y: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const resizeRef = useRef<{
    clientX: number;
    clientY: number;
    handle: ResizeHandle;
    current: EditorElement;
  } | null>(null);
  const [resizePreview, setResizePreview] = useState<EditorElement | null>(
    null,
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    element.kind === "text" ? element.text : "",
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelEditRef = useRef(false);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [editing]);

  function finishEditing(save: boolean) {
    if (!editing || element.kind !== "text") return;
    if (save && !cancelEditRef.current && draft !== element.text) {
      onChange({ ...element, text: draft });
    }
    setEditing(false);
  }

  function startResizing(
    event: PointerEvent<HTMLButtonElement>,
    handle: ResizeHandle,
  ) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      handle,
      current: element,
    };
  }

  function handleResizeMove(event: PointerEvent<HTMLButtonElement>) {
    const resize = resizeRef.current;
    if (!resize) return;
    const next = resizeElement(
      element,
      pageSize,
      resize.handle,
      (event.clientX - resize.clientX) / scale,
      (event.clientY - resize.clientY) / scale,
    );
    resize.current = next;
    setResizePreview(next);
  }

  function handleResizeEnd(
    event: PointerEvent<HTMLButtonElement>,
    save: boolean,
  ) {
    const resize = resizeRef.current;
    if (!resize) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
    setResizePreview(null);
    if (save) onChange(resize.current);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || editing || resizeRef.current) return;
    event.stopPropagation();
    onSelect();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      x: element.x,
      y: element.y,
      currentX: element.x,
      currentY: element.y,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const x =
      dragRef.current.x + (event.clientX - dragRef.current.clientX) / scale;
    const y =
      dragRef.current.y + (event.clientY - dragRef.current.clientY) / scale;
    const clamped = clampElementToPage({ ...element, x, y }, pageSize);
    dragRef.current.currentX = clamped.x;
    dragRef.current.currentY = clamped.y;
    setDragPosition({ x: clamped.x, y: clamped.y });
  }

  function finishDragging(event: PointerEvent<HTMLDivElement>, save: boolean) {
    if (!dragRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (save) {
      onChange({
        ...element,
        x: dragRef.current.currentX,
        y: dragRef.current.currentY,
      });
    }
    dragRef.current = null;
    setDragPosition(null);
  }

  const visibleElement = resizePreview ?? element;
  const style: CSSProperties = {
    left: (dragPosition?.x ?? visibleElement.x) * scale,
    top: (dragPosition?.y ?? visibleElement.y) * scale,
    width: visibleElement.width * scale,
    height: visibleElement.height * scale,
  };

  return (
    <div
      className={`page-element ${selected ? "selected" : ""}`}
      style={style}
      role="group"
      tabIndex={editing ? -1 : 0}
      aria-label={`${getElementName(element)} 선택`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          onSelect();
        }
      }}
      onDoubleClick={(event) => {
        if (
          element.kind !== "text" ||
          (event.target instanceof HTMLElement &&
            event.target.closest(".resize-handle, .element-badge"))
        )
          return;
        event.stopPropagation();
        onSelect();
        cancelEditRef.current = false;
        setDraft(element.text);
        setEditing(true);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishDragging(event, true)}
      onPointerCancel={(event) => finishDragging(event, false)}
    >
      {editing && element.kind === "text" ? (
        <textarea
          ref={textareaRef}
          className="inline-text-editor"
          style={textStyle(element, scale)}
          aria-label="페이지에서 텍스트 수정"
          maxLength={10000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onBlur={() => finishEditing(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelEditRef.current = true;
              finishEditing(false);
            } else if (
              event.key === "Enter" &&
              (event.ctrlKey || event.metaKey)
            ) {
              event.preventDefault();
              finishEditing(true);
            }
          }}
        />
      ) : (
        <PreviewElement element={visibleElement} scale={scale} />
      )}
      {selected && <span className="element-badge">{element.kind}</span>}
      {selected &&
        element.kind === "text" &&
        !editing &&
        RESIZE_HANDLES.map(({ direction, label }) => (
          <button
            key={direction}
            type="button"
            className={`resize-handle resize-${direction}`}
            aria-label={`텍스트 크기 조절: ${label}`}
            title={`${label} 크기 조절`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => startResizing(event, direction)}
            onPointerMove={handleResizeMove}
            onPointerUp={(event) => handleResizeEnd(event, true)}
            onPointerCancel={(event) => handleResizeEnd(event, false)}
          />
        ))}
    </div>
  );
}
