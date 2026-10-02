import { lazy, Suspense, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fileKind, fileKindLabel } from "@/lib/study";

const PdfCanvasView = lazy(() => import("@/components/pdf-canvas-view"));

type Props = {
  url: string;
  fileName: string;
  label: string;
};

const spinner = (
  <div className="flex h-full items-center justify-center">
    <Loader2 className="size-6 animate-spin text-muted-foreground" />
  </div>
);

/** Renders the stored file inline when we can, otherwise offers a download. */
export function FilePreview({ url, fileName, label }: Props) {
  const kind = fileKind(fileName);

  if (kind === "pdf") {
    return (
      <ClientOnly fallback={spinner}>
        <Suspense fallback={spinner}>
          <PdfCanvasView url={url} label={label} />
        </Suspense>
      </ClientOnly>
    );
  }

  if (kind === "image") {
    return (
      <div className="h-full overflow-auto p-3">
        <img src={url} alt={label} className="mx-auto max-w-full rounded-md bg-white shadow-sm" />
      </div>
    );
  }

  if (kind === "text") return <TextPreview url={url} />;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <FileText className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {fileKindLabel(fileName)} files can't be previewed in the browser — download it to open in
        your document app.
      </p>
      <Button size="sm" variant="outline" asChild>
        <a href={url} download={fileName}>
          Download {fileName}
        </a>
      </Button>
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; text: string }>({
    status: "loading",
    text: "",
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", text: "" });
    fetch(url, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setState({ status: "ready", text });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", text: "" });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.status === "loading") return spinner;
  if (state.status === "error") {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Couldn't load this file.{" "}
        <a className="text-primary underline" href={url} target="_blank" rel="noreferrer">
          Open it in a new tab
        </a>
        .
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-card p-4">
      <pre className="text-sm whitespace-pre-wrap text-foreground">{state.text}</pre>
    </div>
  );
}
