"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  FileText,
  ImagePlus,
  Layers3,
  Redo2,
  Table2,
  Type,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  A4_PAGE,
  clampElementToPage,
  getElementName,
  type EditorElement,
} from "../model/document";
import { editorHistoryReducer, initialHistory } from "../model/history";
import { exportDocument } from "../pdf/export-document";
import { importPdf, type ImportedDocument } from "../pdf/import-document";
import { PdfPage } from "../pdf/pdf-page";
import { ElementInspector } from "./element-inspector";
import { PageElement } from "./page-element";

const ZOOM_LEVELS = [0.7, 0.85, 1, 1.15, 1.3];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "작업을 완료하지 못했습니다.";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function imageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("이미지 형식을 확인해 주세요."));
    image.src = dataUrl;
  });
}

export function EditorWorkspace() {
  const [history, dispatch] = useReducer(editorHistoryReducer, initialHistory);
  const [source, setSource] = useState<ImportedDocument | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const pageSizes = source?.pageSizes ?? [A4_PAGE];
  const pageSize = pageSizes[pageIndex];
  const scale = ZOOM_LEVELS[zoomIndex];
  const selectedElement =
    history.present.find((element) => element.id === history.selectedId) ??
    null;
  const pageElements = useMemo(
    () => history.present.filter((element) => element.pageIndex === pageIndex),
    [history.present, pageIndex],
  );
  const handleRenderError = useCallback(
    (message: string) => setNotice(message),
    [],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select") || target.isContentEditable)
      ) {
        return;
      }

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        history.selectedId
      ) {
        dispatch({ type: "remove", id: history.selectedId });
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history.selectedId]);

  function addElement(element: EditorElement) {
    dispatch({ type: "add", element: clampElementToPage(element, pageSize) });
    setNotice(null);
  }

  async function handlePdfFile(file: File | undefined) {
    if (!file) return;
    if (
      history.present.length > 0 &&
      !window.confirm("현재 편집 내용을 지우고 새 PDF를 여시겠습니까?")
    ) {
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const imported = await importPdf(file);
      setSource(imported);
      setPageIndex(0);
      dispatch({ type: "reset" });
      setNotice(
        "원본 PDF 내용은 그대로 유지됩니다. 새로 추가한 요소만 편집할 수 있습니다.",
      );
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  async function handleDemo() {
    if (
      history.present.length > 0 &&
      !window.confirm("현재 편집 내용을 지우고 예제 PDF를 여시겠습니까?")
    ) {
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/demo.pdf");
      if (!response.ok) throw new Error("예제 PDF를 불러오지 못했습니다.");
      const file = new File([await response.arrayBuffer()], "sample.pdf", {
        type: "application/pdf",
      });
      const imported = await importPdf(file);
      setSource(imported);
      setPageIndex(0);
      dispatch({ type: "reset" });
      setNotice(
        "원본 PDF 내용은 그대로 유지됩니다. 새로 추가한 요소만 편집할 수 있습니다.",
      );
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleImageFile(file: File | undefined) {
    if (!file) return;
    try {
      if (
        !["image/png", "image/jpeg"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      ) {
        throw new Error("5MB 이하의 PNG 또는 JPG 이미지를 선택해 주세요.");
      }
      const dataUrl = await fileToDataUrl(file);
      const dimensions = await imageDimensions(dataUrl);
      const width = Math.min(220, pageSize.width - 80);
      const height = Math.min(
        width * (dimensions.height / dimensions.width),
        pageSize.height - 80,
      );
      addElement({
        id: crypto.randomUUID(),
        kind: "image",
        pageIndex,
        x: 60,
        y: 80,
        width,
        height,
        dataUrl,
        mime: file.type as "image/png" | "image/jpeg",
      });
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function newDocument() {
    if (
      history.present.length > 0 &&
      !window.confirm("현재 편집 내용을 지우고 새 문서를 만드시겠습니까?")
    ) {
      return;
    }
    setSource(null);
    setPageIndex(0);
    dispatch({ type: "reset" });
    setNotice(null);
  }

  async function handleExport() {
    setBusy(true);
    setNotice(null);
    try {
      const bytes = await exportDocument({
        sourceBytes: source?.bytes ?? null,
        pageSizes,
        elements: history.present,
      });
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = source
        ? source.name.replace(/\.pdf$/i, "-edited.pdf")
        : "untitled.pdf";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice("PDF를 내보냈습니다. 원본 파일은 변경되지 않았습니다.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace">
      <input
        ref={pdfInputRef}
        className="visually-hidden"
        type="file"
        accept=".pdf,application/pdf"
        aria-label="PDF 파일 선택"
        onChange={(event) => void handlePdfFile(event.target.files?.[0])}
      />
      <input
        ref={imageInputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg"
        aria-label="이미지 파일 선택"
        onChange={(event) => void handleImageFile(event.target.files?.[0])}
      />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Layers3 size={19} strokeWidth={2.2} />
          </div>
          <div>
            <strong>PDF Workbench</strong>
            <span>문서를 만드는 새로운 작업대</span>
          </div>
        </div>
        <div className="topbar-center">
          <span className="document-name">
            {source?.name ?? "제목 없는 문서"}
          </span>
          <span className="document-meta">
            {pageSizes.length} page{pageSizes.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="button-ghost"
            onClick={() => void handleDemo()}
            disabled={busy}
          >
            <FileText size={16} /> 예제 열기
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={newDocument}
            disabled={busy}
          >
            <FilePlus2 size={16} /> 새 문서
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => pdfInputRef.current?.click()}
            disabled={busy}
          >
            <Upload size={16} /> PDF 열기
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={() => void handleExport()}
            disabled={busy}
          >
            <Download size={16} /> {busy ? "처리 중…" : "PDF 내보내기"}
          </button>
        </div>
      </header>

      <div className="editor-layout">
        <aside className="left-sidebar" aria-label="문서 도구">
          <div className="sidebar-block">
            <span className="eyebrow">DOCUMENT</span>
            <h2>페이지</h2>
            <div className="page-list">
              {pageSizes.map((size, index) => (
                <button
                  type="button"
                  key={index}
                  className={`page-list-item ${pageIndex === index ? "active" : ""}`}
                  onClick={() => {
                    setPageIndex(index);
                    dispatch({ type: "select", id: null });
                  }}
                >
                  <span className="page-mini">
                    <FileText size={20} />
                  </span>
                  <span>
                    <strong>페이지 {index + 1}</strong>
                    <small>
                      {Math.round(size.width)} × {Math.round(size.height)} pt
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-block element-list-block">
            <span className="eyebrow">LAYERS</span>
            <h2>
              현재 페이지 요소 <small>{pageElements.length}</small>
            </h2>
            {pageElements.length === 0 ? (
              <p className="sidebar-empty">아직 추가된 요소가 없습니다.</p>
            ) : (
              <div className="layer-list">
                {[...pageElements].reverse().map((element) => (
                  <button
                    type="button"
                    className={`layer-item ${history.selectedId === element.id ? "active" : ""}`}
                    key={element.id}
                    onClick={() => dispatch({ type: "select", id: element.id })}
                  >
                    {element.kind === "text" ? (
                      <Type size={15} />
                    ) : element.kind === "table" ? (
                      <Table2 size={15} />
                    ) : (
                      <ImagePlus size={15} />
                    )}
                    <span>{getElementName(element)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="sidebar-footnote">
            파일은 브라우저에서 처리됩니다.
            <br />
            AI API 키는 필요하지 않습니다.
          </div>
        </aside>

        <main className="main-area">
          <div className="toolstrip" aria-label="편집 도구">
            <div className="toolstrip-group">
              <span className="toolstrip-label">추가</span>
              <button
                type="button"
                className="tool-button"
                onClick={() =>
                  addElement({
                    id: crypto.randomUUID(),
                    kind: "text",
                    pageIndex,
                    x: 64,
                    y: 80,
                    width: 260,
                    height: 94,
                    text: "새 텍스트",
                    fontSize: 18,
                    bold: false,
                    italic: false,
                    color: "#1f2937",
                    align: "left",
                  })
                }
              >
                <Type size={17} /> 텍스트
              </button>
              <button
                type="button"
                className="tool-button"
                onClick={() =>
                  addElement({
                    id: crypto.randomUUID(),
                    kind: "table",
                    pageIndex,
                    x: 64,
                    y: 210,
                    width: 390,
                    height: 120,
                    cells: [
                      ["항목", "내용"],
                      ["", ""],
                    ],
                    fontSize: 11,
                    color: "#1f2937",
                    borderColor: "#94a3b8",
                  })
                }
              >
                <Table2 size={17} /> 표
              </button>
              <button
                type="button"
                className="tool-button"
                onClick={() => imageInputRef.current?.click()}
              >
                <ImagePlus size={17} /> 이미지
              </button>
            </div>
            <div className="toolstrip-group history-buttons">
              <button
                type="button"
                className="icon-button"
                title="실행 취소"
                aria-label="실행 취소"
                disabled={history.past.length === 0}
                onClick={() => dispatch({ type: "undo" })}
              >
                <Undo2 size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                title="다시 실행"
                aria-label="다시 실행"
                disabled={history.future.length === 0}
                onClick={() => dispatch({ type: "redo" })}
              >
                <Redo2 size={17} />
              </button>
            </div>
          </div>

          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="알림 닫기"
              >
                ×
              </button>
            </div>
          )}

          <div className="canvas-scroller">
            <div className="canvas-heading">
              <div>
                <span className="eyebrow">
                  WORKSPACE / PAGE {pageIndex + 1}
                </span>
                <h1>
                  {source ? "PDF에 요소 추가하기" : "빈 페이지에서 시작하기"}
                </h1>
              </div>
              <span className="canvas-tip">
                드래그 이동 · 텍스트 더블클릭 편집 · 가장자리 크기 조절
              </span>
            </div>
            <div className="page-stage">
              <div
                className="page-surface"
                style={{
                  width: pageSize.width * scale,
                  height: pageSize.height * scale,
                }}
                onClick={() => dispatch({ type: "select", id: null })}
                aria-label={`${pageIndex + 1}페이지 편집 영역`}
              >
                {source && (
                  <PdfPage
                    bytes={source.bytes}
                    pageIndex={pageIndex}
                    scale={scale}
                    onError={handleRenderError}
                  />
                )}
                {pageElements.map((element) => (
                  <PageElement
                    key={element.id}
                    element={element}
                    pageSize={pageSize}
                    scale={scale}
                    selected={history.selectedId === element.id}
                    onSelect={() =>
                      dispatch({ type: "select", id: element.id })
                    }
                    onChange={(updated) =>
                      dispatch({ type: "update", element: updated })
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="bottom-bar">
            <div className="page-navigation">
              <button
                type="button"
                className="icon-button"
                aria-label="이전 페이지"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex(pageIndex - 1)}
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                {pageIndex + 1} / {pageSizes.length}
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label="다음 페이지"
                disabled={pageIndex === pageSizes.length - 1}
                onClick={() => setPageIndex(pageIndex + 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <div className="zoom-controls">
              <button
                type="button"
                className="icon-button"
                aria-label="축소"
                disabled={zoomIndex === 0}
                onClick={() => setZoomIndex(zoomIndex - 1)}
              >
                <ZoomOut size={17} />
              </button>
              <span>{Math.round(scale * 100)}%</span>
              <button
                type="button"
                className="icon-button"
                aria-label="확대"
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                onClick={() => setZoomIndex(zoomIndex + 1)}
              >
                <ZoomIn size={17} />
              </button>
            </div>
          </div>
        </main>

        <aside className="right-sidebar" aria-label="요소 속성">
          <ElementInspector
            element={selectedElement}
            onChange={(element) =>
              dispatch({
                type: "update",
                element: clampElementToPage(
                  element,
                  pageSizes[element.pageIndex],
                ),
              })
            }
            onDelete={() =>
              selectedElement &&
              dispatch({ type: "remove", id: selectedElement.id })
            }
          />
        </aside>
      </div>
    </div>
  );
}
