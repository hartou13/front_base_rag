"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  Eye,
  File as FileIcon,
  FileText,
  FileType2,
  Loader2,
  RotateCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import type { Collection, CollectionFile } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALLOWED = [".pdf", ".txt", ".md"];

type Row = CollectionFile & { pending?: boolean };
type SortKey = "name" | "size" | "added";

const extOf = (name: string) => {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function formatSize(bytes: number) {
  if (!bytes) return "–";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
function formatDate(iso: string | null) {
  if (!iso) return "Just now";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : dateFmt.format(d);
}

let tmpCounter = 0;

export function DocumentsDialog({
  collection,
  onOpenChange,
  onCountChange,
}: {
  collection: Collection | null;
  onOpenChange: (open: boolean) => void;
  onCountChange: (collectionId: string, count: number) => void;
}) {
  return (
    <Dialog open={!!collection} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {collection && <DocumentsManager key={collection.id} collection={collection} onCountChange={onCountChange} />}
      </DialogContent>
    </Dialog>
  );
}

function DocumentsManager({
  collection,
  onCountChange,
}: {
  collection: Collection;
  onCountChange: (collectionId: string, count: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "added", dir: -1 });
  const [busy, setBusy] = useState<Record<string, "open" | "download" | "reindex">>({});
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [dragging, setDragging] = useState(false);

  const load = () =>
    api
      .listFiles(collection.id)
      .then((list) => {
        setFiles(list);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load the documents"));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per collection (component is keyed by id)
  }, []);

  // Keep the count shown in the sidebar in step with what is stored.
  const storedCount = files?.filter((f) => !f.pending).length;
  useEffect(() => {
    if (storedCount !== undefined) onCountChange(collection.id, storedCount);
  }, [storedCount, collection.id, onCountChange]);

  const visible = useMemo(() => {
    if (!files) return [];
    const q = query.trim().toLowerCase();
    const list = q ? files.filter((f) => f.filename.toLowerCase().includes(q)) : [...files];
    const val = (f: Row): string | number =>
      sort.key === "name" ? f.filename.toLowerCase() : sort.key === "size" ? f.size : f.created_at ?? "￿";
    // Uploads in progress always stay on top.
    return list.sort((a, b) => {
      if (!!a.pending !== !!b.pending) return a.pending ? -1 : 1;
      const va = val(a);
      const vb = val(b);
      return va < vb ? -sort.dir : va > vb ? sort.dir : 0;
    });
  }, [files, query, sort]);

  const stored = files?.filter((f) => !f.pending) ?? [];
  const totalSize = stored.reduce((s, f) => s + (f.size || 0), 0);
  const failedCount = stored.filter((f) => f.status === "failed").length;
  const uploadingCount = files?.filter((f) => f.pending).length ?? 0;

  const patchRow = (id: string, next: Partial<Row>) =>
    setFiles((prev) => prev?.map((f) => (f.id === id ? { ...f, ...next } : f)) ?? prev);

  // ---- add ----
  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const picked = Array.from(list);
    const bad = picked.filter((f) => !ALLOWED.includes(extOf(f.name)));
    const good = picked.filter((f) => ALLOWED.includes(extOf(f.name)));
    if (bad.length) {
      toast.error(`Can’t add ${bad.map((f) => f.name).join(", ")}. Only PDF, text (.txt) and Markdown (.md) files are supported.`);
    }
    if (inputRef.current) inputRef.current.value = "";
    if (!good.length) return;

    const temps: Row[] = good.map((f) => ({
      id: `tmp-${Date.now()}-${tmpCounter++}`,
      filename: f.name,
      status: "indexing",
      chunk_count: 0,
      error: null,
      content_type: f.type || null,
      size: f.size,
      created_at: null,
      pending: true,
    }));
    const tempIds = new Set(temps.map((t) => t.id));
    setFiles((prev) => [...temps, ...(prev ?? [])]);

    api
      .uploadFiles(collection.id, good)
      .then((res) => {
        setFiles((prev) => [...res, ...(prev ?? []).filter((f) => !tempIds.has(f.id))]);
        const failed = res.filter((f) => f.status === "failed").length;
        if (failed) toast.warning(`${failed} of ${plural(res.length, "document")} could not be indexed. You can retry them from the list.`);
        else toast.success(`Added ${plural(res.length, "document")} to ${collection.name}`);
      })
      .catch((err) => {
        setFiles((prev) => (prev ?? []).filter((f) => !tempIds.has(f.id)));
        toast.error(err instanceof Error ? err.message : "Could not add the documents");
      });
  }

  // ---- open / download ----
  const clearBusy = (id: string) =>
    setBusy((b) => {
      const next = { ...b };
      delete next[id];
      return next;
    });

  /** Fetch the original file; resolves false (after a toast) if it couldn't be fetched. */
  async function withBlob(f: Row, kind: "open" | "download", handle: (blob: Blob) => void): Promise<boolean> {
    setBusy((b) => ({ ...b, [f.id]: kind }));
    try {
      let blob = await api.fetchFileBlob(f.id);
      // Show text and Markdown as readable text instead of triggering a download.
      if (kind === "open" && [".txt", ".md"].includes(extOf(f.filename))) {
        blob = new Blob([blob], { type: "text/plain;charset=utf-8" });
      }
      handle(blob);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not get the file");
      return false;
    } finally {
      clearBusy(f.id);
    }
  }

  function openFile(f: Row) {
    // Open the tab synchronously so the browser doesn't treat it as a pop-up, then point it at the file.
    const tab = window.open("", "_blank");
    void withBlob(f, "open", (blob) => {
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }).then((ok) => {
      if (!ok) tab?.close();
    });
  }

  async function downloadFile(f: Row) {
    setBusy((b) => ({ ...b, [f.id]: "download" }));
    try {
      // Signed, short-lived URL: the browser downloads it directly, no blob held in memory.
      const url = await api.getDownloadUrl(f.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not get the file");
    } finally {
      clearBusy(f.id);
    }
  }

  // ---- retry ----
  async function reindex(f: Row) {
    setBusy((b) => ({ ...b, [f.id]: "reindex" }));
    const before = { status: f.status, error: f.error, chunk_count: f.chunk_count };
    patchRow(f.id, { status: "indexing", error: null });
    try {
      const updated = await api.reindexFile(f.id);
      patchRow(f.id, updated);
      if (updated.status === "ready") toast.success(`Indexed ${f.filename}`);
      else toast.error(`${f.filename} still could not be indexed`);
    } catch (err) {
      patchRow(f.id, before);
      toast.error(err instanceof Error ? err.message : "Could not retry indexing");
    } finally {
      clearBusy(f.id);
    }
  }

  // ---- delete ----
  async function remove(f: Row) {
    await api.deleteFile(f.id);
    setFiles((prev) => prev?.filter((x) => x.id !== f.id) ?? prev);
    toast.success(`Deleted ${f.filename}`);
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));
  }

  const summary = loadError
    ? "Documents could not be loaded"
    : files
    ? [
        plural(stored.length, "document"),
        totalSize ? formatSize(totalSize) : null,
        failedCount ? `${failedCount} failed` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "Loading";

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-col gap-4 border-b px-5 pt-5 pb-4 sm:flex-row sm:items-start sm:justify-between sm:pr-12">
        <div className="min-w-0">
          <DialogTitle className="truncate text-lg font-semibold">{collection.name}</DialogTitle>
          <DialogDescription className="mt-1">{summary}</DialogDescription>
        </div>
        <Button onClick={() => inputRef.current?.click()} className="self-start">
          <Upload />
          Add documents
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files && files.length > 0 && (
        <div className="border-b px-5 py-2.5">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Filter documents by name"
              placeholder="Filter by name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 bg-white pl-8"
            />
          </div>
        </div>
      )}

      <div className="min-h-[16rem] flex-1 overflow-y-auto">
        {loadError ? (
          <div className="flex flex-col items-start gap-3 px-5 py-8 text-sm">
            <p className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-4" /> {loadError}
            </p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RotateCw /> Try again
            </Button>
          </div>
        ) : files === null ? (
          <p className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading documents
          </p>
        ) : files.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="m-5 flex w-[calc(100%-2.5rem)] flex-col items-center gap-2 rounded-lg border border-dashed border-input px-6 py-12 text-center text-sm transition-colors hover:bg-muted/60"
          >
            <Upload className="size-5 text-muted-foreground" />
            <span className="font-medium">This collection has no documents yet</span>
            <span className="text-muted-foreground">Choose files or drop them here. PDF, text and Markdown are supported.</span>
          </button>
        ) : visible.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">No document names match “{query}”.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-popover text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <SortHeader label="Name" k="name" sort={sort} onSort={toggleSort} className="pl-5" />
                <SortHeader label="Size" k="size" sort={sort} onSort={toggleSort} className="hidden w-20 sm:table-cell" />
                <SortHeader label="Added" k="added" sort={sort} onSort={toggleSort} className="hidden w-28 md:table-cell" />
                <th scope="col" className="w-32 px-3 py-2 font-medium">
                  Status
                </th>
                <th scope="col" className="w-0 py-2 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  busy={busy[f.id]}
                  onOpen={() => openFile(f)}
                  onDownload={() => downloadFile(f)}
                  onRetry={() => void reindex(f)}
                  onDelete={() => setToDelete(f)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t bg-muted/50 px-5 py-3 text-xs text-muted-foreground">
        {uploadingCount > 0
          ? `Adding ${plural(uploadingCount, "document")}. Long PDFs can take a few minutes to index; you can close this window meanwhile.`
          : "Drop files anywhere in this window to add them. Answers only use documents marked Ready."}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-white/90 text-sm font-medium text-primary">
          <Upload className="size-6" />
          Drop to add to {collection.name}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this document?"
        description={<>“{toDelete?.filename}” will be removed from {collection.name} and no longer used in answers.</>}
        confirmLabel="Delete document"
        onConfirm={async () => {
          if (toDelete) await remove(toDelete);
        }}
      />
    </div>
  );
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
  className,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2 font-medium", className)}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("inline-flex items-center gap-1 rounded-sm hover:text-foreground", active && "text-foreground")}
      >
        {label}
        <span aria-hidden className={cn("text-[0.65rem]", !active && "invisible")}>
          {sort.dir === 1 ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

function FileRow({
  file: f,
  busy,
  onOpen,
  onDownload,
  onRetry,
  onDelete,
}: {
  file: Row;
  busy?: "open" | "download" | "reindex";
  onOpen: () => void;
  onDownload: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const ext = extOf(f.filename);
  const Icon = ext === ".pdf" ? FileType2 : ext === ".md" || ext === ".txt" ? FileText : FileIcon;
  const locked = f.pending || f.status === "indexing";

  return (
    <tr className={cn("group align-top", f.pending && "text-muted-foreground")}>
      <td className="max-w-0 py-2.5 pr-3 pl-5">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            {f.pending ? (
              <span className="block truncate">{f.filename}</span>
            ) : (
              <button
                type="button"
                onClick={onOpen}
                className="block max-w-full truncate text-left font-medium text-ink underline-offset-2 hover:underline"
                title={`Open ${f.filename}`}
              >
                {f.filename}
              </button>
            )}
            {f.status === "failed" && f.error && (
              <p className="mt-0.5 line-clamp-2 text-xs text-destructive" title={f.error}>
                {f.error}
              </p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{formatSize(f.size)}</p>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-2.5 whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
        {formatSize(f.size)}
      </td>
      <td className="hidden px-3 py-2.5 whitespace-nowrap text-muted-foreground md:table-cell">
        {f.pending ? "Uploading" : formatDate(f.created_at)}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <StatusCell file={f} />
      </td>
      <td className="py-1.5 pr-4">
        <div className="flex justify-end gap-0.5">
          {f.status === "failed" && !f.pending && (
            <Button size="sm" variant="outline" onClick={onRetry} disabled={!!busy}>
              <RotateCw />
              Retry
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Open ${f.filename}`}
            title="Open"
            onClick={onOpen}
            disabled={!!f.pending || !!busy}
          >
            {busy === "open" ? <Loader2 className="animate-spin" /> : <Eye />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Download ${f.filename}`}
            title="Download"
            onClick={onDownload}
            disabled={!!f.pending || !!busy}
          >
            {busy === "download" ? <Loader2 className="animate-spin" /> : <Download />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Delete ${f.filename}`}
            title="Delete"
            className="hover:text-destructive"
            onClick={onDelete}
            disabled={locked || !!busy}
          >
            <Trash2 />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function StatusCell({ file: f }: { file: Row }) {
  if (f.status === "indexing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {f.pending ? "Uploading" : "Indexing"}
      </span>
    );
  }
  if (f.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-600" />
        Ready
      </span>
      <span className="pl-3 text-xs text-muted-foreground">{plural(f.chunk_count, "passage")}</span>
    </span>
  );
}
