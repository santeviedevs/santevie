"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

type RowError = { row: number; errors: string[] };

type PreviewResult = {
  totalRows: number;
  willCreate: number;
  willUpdate: number;
  willReject: number;
  errors: RowError[];
};

type CommitResult = {
  totalRows: number;
  created: number;
  updated: number;
  rejected: number;
  errors: RowError[];
  linkWarnings: RowError[];
};

type Stage = "idle" | "previewing" | "previewed" | "importing" | "done";

type ImportWizardProps = {
  entity: "territories" | "clients" | "products";
  backHref: string;
  dict: Dictionary["importPage"];
};

async function postForm(url: string, formData: FormData): Promise<Response> {
  return fetch(url, { method: "POST", body: formData });
}

type UploadResponse = { ok: boolean; status: number; body: unknown };

type StreamEvent =
  | { type: "progress"; done: number; total: number }
  | { type: "result"; data: unknown }
  | { type: "error"; message: string };

// XMLHttpRequest, not fetch, for two reasons: `xhr.upload.onprogress` is the
// only way to track bytes actually sent (fetch has no upload-progress
// event), and — the part that matters here — `xhr.responseText` keeps
// growing as the server streams its NDJSON body, so `xhr.onprogress` (on
// the request itself, not `.upload`) lets us read and parse each completed
// line as it arrives instead of waiting for the whole response like
// `fetch().then(r => r.json())` would. That's what turns "upload done, now
// wait" into a live row-by-row percentage.
function uploadForm(
  url: string,
  formData: FormData,
  onUploadProgress: (percent: number) => void,
  onServerProgress: (done: number, total: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    let consumed = 0;
    let result: unknown = null;
    let serverError: string | null = null;

    function consumeNewLines() {
      const text: string = xhr.responseText;
      const lastNewline = text.lastIndexOf("\n");
      if (lastNewline < consumed) return;
      const chunk = text.slice(consumed, lastNewline);
      consumed = lastNewline + 1;
      for (const line of chunk.split("\n")) {
        if (!line) continue;
        let event: StreamEvent;
        try {
          event = JSON.parse(line) as StreamEvent;
        } catch {
          continue;
        }
        if (event.type === "progress") onServerProgress(event.done, event.total);
        else if (event.type === "result") result = event.data;
        else if (event.type === "error") serverError = event.message;
      }
    }

    xhr.onprogress = consumeNewLines;
    xhr.onload = () => {
      consumeNewLines();
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300 && serverError === null,
        status: xhr.status,
        body: serverError !== null ? { error: serverError } : result,
      });
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

async function downloadBlob(response: Response, fallbackName: string): Promise<void> {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  anchor.download = match?.[1] ?? fallbackName;
  anchor.click();
  URL.revokeObjectURL(url);
}

// One shared wizard for territories/clients/products (S2-05) — download a
// template, upload a filled one, preview what it would do, then confirm.
// The file is kept in state and re-sent unchanged on confirm rather than
// held server-side between requests, since the whole app stays stateless
// between calls otherwise.
export function ImportWizard({ entity, backHref, dict }: ImportWizardProps) {
  const apiUrl = `/api/admin/import/${entity}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  // Uploading a small Excel file reaches 100% almost instantly — it's the
  // server's row-by-row resolve/write work afterward that actually takes
  // time on a large file. `serverBusy` marks that second phase so the bar
  // switches from "upload %" to "rows processed %" instead of freezing at
  // 100% with nothing left to show.
  const [serverBusy, setServerBusy] = useState(false);

  function reset() {
    setFile(null);
    setStage("idle");
    setPreview(null);
    setResult(null);
    setError(null);
    setProgress(null);
    setServerBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleUploadProgress(percent: number) {
    setProgress(percent);
  }

  function handleServerProgress(done: number, total: number) {
    setServerBusy(true);
    setProgress(total > 0 ? Math.round((done / total) * 100) : 100);
  }

  async function handlePreview() {
    if (!file) return;
    setStage("previewing");
    setError(null);
    setProgress(0);
    setServerBusy(false);
    try {
      const formData = new FormData();
      formData.set("mode", "preview");
      formData.set("file", file);
      const response = await uploadForm(
        apiUrl,
        formData,
        handleUploadProgress,
        handleServerProgress,
      );
      if (!response.ok) {
        const body = response.body as { error?: string } | null;
        setError(body?.error ?? dict.genericError);
        setStage("idle");
        return;
      }
      setPreview(response.body as PreviewResult);
      setStage("previewed");
    } catch {
      setError(dict.genericError);
      setStage("idle");
    } finally {
      setProgress(null);
      setServerBusy(false);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setStage("importing");
    setError(null);
    setProgress(0);
    setServerBusy(false);
    try {
      const formData = new FormData();
      formData.set("mode", "commit");
      formData.set("file", file);
      const response = await uploadForm(
        apiUrl,
        formData,
        handleUploadProgress,
        handleServerProgress,
      );
      if (!response.ok) {
        const body = response.body as { error?: string } | null;
        setError(body?.error ?? dict.genericError);
        setStage("previewed");
        return;
      }
      setResult(response.body as CommitResult);
      setStage("done");
    } catch {
      setError(dict.genericError);
      setStage("previewed");
    } finally {
      setProgress(null);
      setServerBusy(false);
    }
  }

  async function handleDownloadErrors(errors: RowError[]) {
    const formData = new FormData();
    formData.set("mode", "error-report");
    formData.set("errors", JSON.stringify(errors));
    const response = await postForm(apiUrl, formData);
    if (response.ok) await downloadBlob(response, "import-errors.xlsx");
  }

  const isBusy = stage === "previewing" || stage === "importing";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" render={<a href={apiUrl} download />}>
          {dict.downloadTemplate}
        </Button>
        <Button variant="outline" render={<Link href={backHref} />}>
          {dict.backToList}
        </Button>
      </div>

      {stage === "done" && result ? (
        <div className="flex flex-col gap-4 rounded-md border border-border p-4">
          <h2 className="font-semibold">{dict.resultHeading}</h2>
          <div className="flex gap-6 text-sm">
            <span>
              {dict.created}: {result.created}
            </span>
            <span>
              {dict.updated}: {result.updated}
            </span>
            <span>
              {dict.rejected}: {result.rejected}
            </span>
          </div>
          {result.errors.length > 0 ? (
            <ErrorTable
              dict={dict}
              errors={result.errors}
              onDownload={() => handleDownloadErrors(result.errors)}
            />
          ) : null}
          {result.linkWarnings.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                {dict.linkWarningsHeading}
              </p>
              <ErrorTable dict={dict} errors={result.linkWarnings} onDownload={undefined} />
            </div>
          ) : null}
          <Button onClick={reset} className="w-fit">
            {dict.startOver}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50",
              isBusy && "pointer-events-none opacity-50",
            )}
          >
            <Upload className="size-8 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium">{file ? file.name : dict.chooseFile}</span>
            {!file ? (
              <span className="text-xs text-muted-foreground">{dict.noFileChosen}</span>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              disabled={isBusy}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setStage("idle");
              }}
              className="sr-only"
            />
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {isBusy && progress !== null ? (
            <div className="flex flex-col gap-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {serverBusy
                  ? dict.processingFile
                  : stage === "previewing"
                    ? dict.previewing
                    : dict.importing}{" "}
                {progress}%
              </span>
            </div>
          ) : null}

          {(stage === "previewed" || stage === "importing") && preview ? (
            <div className="flex flex-col gap-4 rounded-md border border-border p-4">
              <div className="flex gap-6 text-sm">
                <span>
                  {dict.totalRows}: {preview.totalRows}
                </span>
                <span>
                  {dict.willCreate}: {preview.willCreate}
                </span>
                <span>
                  {dict.willUpdate}: {preview.willUpdate}
                </span>
                <span>
                  {dict.willReject}: {preview.willReject}
                </span>
              </div>
              {preview.errors.length > 0 ? (
                <ErrorTable
                  dict={dict}
                  errors={preview.errors}
                  onDownload={() => handleDownloadErrors(preview.errors)}
                />
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button disabled={!file || isBusy} onClick={handlePreview}>
              {stage === "previewing" ? dict.previewing : dict.preview}
            </Button>
            {stage === "previewed" || stage === "importing" ? (
              <Button disabled={isBusy} onClick={handleCommit}>
                {stage === "importing" ? dict.importing : dict.confirmImport}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorTable({
  dict,
  errors,
  onDownload,
}: {
  dict: Dictionary["importPage"];
  errors: RowError[];
  onDownload: (() => void) | undefined;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{dict.errorsHeading}</p>
        {onDownload ? (
          <Button variant="outline" size="sm" onClick={onDownload}>
            {dict.downloadErrorReport}
          </Button>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{dict.rowColumn}</TableHead>
            <TableHead>{dict.errorsColumn}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {errors.map((entry) => (
            <TableRow key={entry.row}>
              <TableCell>{entry.row}</TableCell>
              <TableCell>{entry.errors.join("; ")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
