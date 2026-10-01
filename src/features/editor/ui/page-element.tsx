"use client";

import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import {
  clampElementToPage,
  getElementName,
  type EditorElement,
  type PageSize,
} from "../model/document";

function PreviewElement({
  element,
  scale,
}: {
  element: EditorElement;
  scale: number;
}) {
  if (element.kind === "text") {
    return (
      <div
        className="preview-text"
        style={{
          fontSize: element.fontSize * scale,
          fontWeight: element.bold ? 700 : 400,
          fontStyle: element.italic ? "italic" : "normal",
          lineHeight: 1.35,
          color: element.color,
          textAlign: element.align,
          padding: 6 * scale,
        }}
      >
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
  onMove: (element: EditorElement) => void;
}

export function PageElement({
  element,
  pageSize,
  scale,
  selected,
  onSelect,
  onMove,
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

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
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

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onMove({
      ...element,
      x: dragRef.current.currentX,
      y: dragRef.current.currentY,
    });
    dragRef.current = null;
    setDragPosition(null);
  }

  const style: CSSProperties = {
    left: (dragPosition?.x ?? element.x) * scale,
    top: (dragPosition?.y ?? element.y) * scale,
    width: element.width * scale,
    height: element.height * scale,
  };

  return (
    <div
      className={`page-element ${selected ? "selected" : ""}`}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`${getElementName(element)} 선택`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <PreviewElement element={element} scale={scale} />
      {selected && <span className="element-badge">{element.kind}</span>}
    </div>
  );
}
