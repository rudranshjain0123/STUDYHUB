import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  url: string;
  label: string;
};

/**
 * Renders a PDF to canvases with pdf.js so it works everywhere —
 * desktop, iOS/Android browsers and installed PWAs, where native
 * <object>/<iframe> PDF embedding is unsupported.
 */
export default function PdfCanvasView({ url, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    setStatus("loading");
    setMessage("");

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        // Fetch the bytes ourselves: pdf.js' own ranged fetching intermittently
        // fails against signed storage URLs (range/CORS/expiry), which is what
        // caused the sporadic "couldn't be rendered" state.
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(
            response.status === 400 || response.status === 403
              ? "This link expired — close and reopen the file."
              : `Could not download the file (${response.status}).`,
          );
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;

        const loadedDoc = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelled) return;

        const width = container.clientWidth || 640;

        for (let pageNumber = 1; pageNumber <= loadedDoc.numPages; pageNumber += 1) {
          const page = await loadedDoc.getPage(pageNumber);
          if (cancelled) return;

          const base = page.getViewport({ scale: 1 });
          const scale = Math.min((width - 16) / base.width, 3);
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: scale * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.className = "mx-auto mb-3 max-w-full rounded-md bg-white shadow-sm";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${label} — page ${pageNumber}`);

          const context = canvas.getContext("2d");
          if (!context) continue;
          container.appendChild(canvas);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          if (cancelled) return;
          if (pageNumber === 1) setStatus("ready");
        }
        if (!cancelled) setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "Couldn't render this PDF here.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, label, attempt]);

  return (
    <div className="relative h-full overflow-y-auto p-2">
      <div ref={containerRef} />
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {status === "error" ? (
        <div className="space-y-3 p-6 text-sm text-muted-foreground">
          <p>{message || "Couldn't render this PDF here."}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={retry}>
              <RefreshCw className="size-4" />
              Try again
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                Open in a new tab
              </a>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
