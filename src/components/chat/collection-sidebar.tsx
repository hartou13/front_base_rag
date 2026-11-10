"use client";

import { useState } from "react";
import { FolderOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DocumentsDialog } from "@/components/chat/documents-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Collection } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CollectionSidebar({
  collections,
  loading,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onCountChange,
}: {
  collections: Collection[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Resolves with the new collection so its documents can be managed right away. */
  onCreate: (name: string, description: string) => Promise<Collection>;
  onDelete: (id: string) => Promise<void>;
  onCountChange: (collectionId: string, count: number) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Collection | null>(null);
  const [managing, setManaging] = useState<Collection | null>(null);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await onCreate(name.trim(), description.trim());
      setCreateOpen(false);
      setName("");
      setDescription("");
      // A new collection is empty and can't answer anything yet: go straight to adding documents.
      setManaging(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the collection");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between pr-3 pl-4">
        <h2 className="text-sm font-semibold">Collections</h2>
        <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
          <Plus />
          New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading && <p className="px-2 py-2 text-sm text-muted-foreground">Loading collections</p>}
        {!loading && collections.length === 0 && (
          <div className="px-2 py-2 text-sm leading-relaxed text-muted-foreground">
            <p>A collection is a set of documents you can ask questions about.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
              <Plus />
              Create a collection
            </Button>
          </div>
        )}

        <ul role="radiogroup" aria-label="Collection to search" className="space-y-px">
          {collections.map((c) => {
            const selected = c.id === selectedId;
            return (
              <li key={c.id} className={cn("rounded-md transition-colors", selected ? "bg-white" : "hover:bg-sidebar-accent")}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(c.id)}
                  className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-[3px] flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-primary" : "border-ink/30",
                    )}
                  >
                    {selected && <span className="size-1.5 rounded-full bg-primary" />}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block truncate text-sm", selected ? "font-semibold text-ink" : "text-ink/85")}>
                      {c.name}
                    </span>
                    {c.description && (
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">
                        {c.description}
                      </span>
                    )}
                    <span
                      className={cn(
                        "mt-0.5 block text-xs",
                        c.file_count ? "text-muted-foreground" : "text-amber-700",
                      )}
                    >
                      {c.file_count === 0
                        ? "No documents yet"
                        : `${c.file_count} document${c.file_count === 1 ? "" : "s"}`}
                    </span>
                  </span>
                </button>

                {selected && (
                  <div className="px-2.5 pb-2.5 pl-8">
                    <div className="-ml-2 flex gap-1">
                      <Button size="xs" variant="outline" className="bg-white" onClick={() => setManaging(c)}>
                        <FolderOpen />
                        {c.file_count === 0 ? "Add documents" : "Documents"}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setToDelete(c)}
                      >
                        <Trash2 />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => !creating && setCreateOpen(o)}>
        <DialogContent>
          <form onSubmit={submitCreate} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>New collection</DialogTitle>
              <DialogDescription>Name the set of documents. You’ll add files to it in the next step.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                autoFocus
                required
                maxLength={255}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collection-description">Description (optional)</Label>
              <Textarea
                id="collection-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating && <Loader2 className="animate-spin" />}
                Create and add documents
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DocumentsDialog
        collection={managing}
        onOpenChange={(o) => !o && setManaging(null)}
        onCountChange={onCountChange}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this collection?"
        description={<>“{toDelete?.name}” and all its documents will be deleted. This can’t be undone.</>}
        confirmLabel="Delete collection"
        onConfirm={async () => {
          if (toDelete) await onDelete(toDelete.id);
        }}
      />
    </div>
  );
}
