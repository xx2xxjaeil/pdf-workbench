"use client";

import { useEffect, useRef, useState } from "react";

interface PdfPageProps {
  bytes: Uint8Array;
  pageIndex: number;
  scale: number;
  onError: (message: string) => void;
}

export function PdfPage({ bytes, pageIndex, scale, onError }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let disposed = false;
    let renderTask:
      { cancel: () => void; promise: Promise<unknown> } | undefined;
    let loadingTask: { destroy: () => Promise<void> } | undefined;

    async function render() {
      setRendering(true);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        // PDF.js 워커가 버퍼의 소유권을 가져갈 수 있으므로 원본 바이트를 복사해 내보내기용으로 보존한다.
        const task = pdfjs.getDocument({ data: bytes.slice() });
        loadingTask = task;
        const document = await task.promise;
        if (disposed) return;
        const page = await document.getPage(pageIndex + 1);
        if (disposed) return;

        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * pixelRatio });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        canvas.style.width = `${viewport.width / pixelRatio}px`;
        canvas.style.height = `${viewport.height / pixelRatio}px`;
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!disposed) setRendering(false);
      } catch (error) {
        if (
          disposed ||
          (error instanceof Error &&
            error.name === "RenderingCancelledException")
        ) {
          return;
        }
        onError("PDF 페이지를 표시하지 못했습니다.");
        setRendering(false);
      }
    }

    void render();

    return () => {
      // 페이지를 바꾸거나 화면을 떠날 때 이전 렌더링을 중단해 늦은 결과가 화면을 덮지 않게 한다.
      disposed = true;
      renderTask?.cancel();
      void loadingTask?.destroy();
    };
  }, [bytes, pageIndex, scale, onError]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label={`${pageIndex + 1}페이지 PDF 미리보기`}
      />
      {rendering && <div className="page-loading">페이지 렌더링 중…</div>}
    </>
  );
}
