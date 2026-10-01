"use client";

import type { EditorElement } from "../model/document";

interface ElementInspectorProps {
  element: EditorElement | null;
  onChange: (element: EditorElement) => void;
  onDelete: () => void;
}

function NumberField({
  label,
  value,
  min = 0,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={Math.round(value * 10) / 10}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (
            Number.isFinite(next) &&
            next >= min &&
            (max === undefined || next <= max)
          ) {
            onChange(next);
          }
        }}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function ElementInspector({
  element,
  onChange,
  onDelete,
}: ElementInspectorProps) {
  if (!element) {
    return (
      <div className="inspector-empty">
        <div className="empty-icon">✳</div>
        <h3>요소를 선택해 주세요</h3>
        <p>
          페이지에서 텍스트, 표, 이미지를 클릭하면 속성을 조정할 수 있습니다.
        </p>
      </div>
    );
  }

  const title =
    element.kind === "text"
      ? "텍스트"
      : element.kind === "table"
        ? "표"
        : "이미지";

  return (
    <div className="inspector-content">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">SELECTED ELEMENT</span>
          <h2>{title} 속성</h2>
        </div>
        <button type="button" className="text-danger" onClick={onDelete}>
          삭제
        </button>
      </div>

      <section className="inspector-section">
        <h3>
          위치와 크기 <small>pt</small>
        </h3>
        <div className="field-grid">
          <NumberField
            label="X"
            value={element.x}
            onChange={(x) => onChange({ ...element, x })}
          />
          <NumberField
            label="Y"
            value={element.y}
            onChange={(y) => onChange({ ...element, y })}
          />
          <NumberField
            label="너비"
            value={element.width}
            min={20}
            onChange={(width) => onChange({ ...element, width })}
          />
          <NumberField
            label="높이"
            value={element.height}
            min={20}
            onChange={(height) => onChange({ ...element, height })}
          />
        </div>
      </section>

      {element.kind === "text" && (
        <>
          <section className="inspector-section">
            <h3>내용</h3>
            <label className="field">
              <span>텍스트</span>
              <textarea
                rows={6}
                maxLength={10000}
                value={element.text}
                onChange={(event) =>
                  onChange({ ...element, text: event.target.value })
                }
              />
            </label>
          </section>
          <section className="inspector-section">
            <h3>서식</h3>
            <div className="field-grid">
              <NumberField
                label="글자 크기"
                value={element.fontSize}
                min={6}
                max={96}
                onChange={(fontSize) => onChange({ ...element, fontSize })}
              />
              <ColorField
                label="글자 색"
                value={element.color}
                onChange={(color) => onChange({ ...element, color })}
              />
            </div>
            <div className="toggle-row">
              <button
                type="button"
                className={element.bold ? "toggle active" : "toggle"}
                aria-pressed={element.bold}
                onClick={() => onChange({ ...element, bold: !element.bold })}
              >
                <strong>B</strong> 굵게
              </button>
              <button
                type="button"
                className={element.italic ? "toggle active" : "toggle"}
                aria-pressed={element.italic}
                onClick={() =>
                  onChange({ ...element, italic: !element.italic })
                }
              >
                <em>I</em> 기울임
              </button>
            </div>
            <label className="field">
              <span>정렬</span>
              <select
                value={element.align}
                onChange={(event) =>
                  onChange({
                    ...element,
                    align: event.target.value as typeof element.align,
                  })
                }
              >
                <option value="left">왼쪽</option>
                <option value="center">가운데</option>
                <option value="right">오른쪽</option>
              </select>
            </label>
          </section>
        </>
      )}

      {element.kind === "table" && (
        <>
          <section className="inspector-section">
            <h3>표 구성</h3>
            <div className="toggle-row">
              <button
                type="button"
                className="button-subtle"
                onClick={() =>
                  onChange({
                    ...element,
                    cells: [...element.cells, element.cells[0].map(() => "")],
                  })
                }
              >
                + 행 추가
              </button>
              <button
                type="button"
                className="button-subtle"
                onClick={() =>
                  onChange({
                    ...element,
                    cells: element.cells.map((row) => [...row, ""]),
                  })
                }
              >
                + 열 추가
              </button>
            </div>
            <div className="toggle-row">
              <button
                type="button"
                className="button-subtle"
                disabled={element.cells.length <= 1}
                onClick={() =>
                  onChange({ ...element, cells: element.cells.slice(0, -1) })
                }
              >
                − 마지막 행
              </button>
              <button
                type="button"
                className="button-subtle"
                disabled={element.cells[0].length <= 1}
                onClick={() =>
                  onChange({
                    ...element,
                    cells: element.cells.map((row) => row.slice(0, -1)),
                  })
                }
              >
                − 마지막 열
              </button>
            </div>
            <div className="cell-editor">
              {element.cells.map((row, rowIndex) =>
                row.map((cell, columnIndex) => (
                  <label className="field" key={`${rowIndex}-${columnIndex}`}>
                    <span>{`${rowIndex + 1}행 ${columnIndex + 1}열`}</span>
                    <input
                      value={cell}
                      onChange={(event) =>
                        onChange({
                          ...element,
                          cells: element.cells.map(
                            (currentRow, currentRowIndex) =>
                              currentRow.map(
                                (currentCell, currentColumnIndex) =>
                                  currentRowIndex === rowIndex &&
                                  currentColumnIndex === columnIndex
                                    ? event.target.value
                                    : currentCell,
                              ),
                          ),
                        })
                      }
                    />
                  </label>
                )),
              )}
            </div>
          </section>
          <section className="inspector-section">
            <h3>표 서식</h3>
            <div className="field-grid">
              <NumberField
                label="글자 크기"
                value={element.fontSize}
                min={6}
                max={36}
                onChange={(fontSize) => onChange({ ...element, fontSize })}
              />
              <ColorField
                label="글자 색"
                value={element.color}
                onChange={(color) => onChange({ ...element, color })}
              />
              <ColorField
                label="테두리 색"
                value={element.borderColor}
                onChange={(borderColor) =>
                  onChange({ ...element, borderColor })
                }
              />
            </div>
          </section>
        </>
      )}

      {element.kind === "image" && (
        <section className="inspector-section">
          <h3>이미지</h3>
          <p className="helper-text">
            PNG 또는 JPG 이미지입니다. 너비와 높이를 독립적으로 조절할 수
            있습니다.
          </p>
        </section>
      )}
    </div>
  );
}
