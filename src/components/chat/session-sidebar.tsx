"use client";

import { useState } from "react";
import { Check, LogOut, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StoredUser } from "@/lib/auth";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SessionSidebar({
  sessions,
  loading,
  activeId,
  user,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onLogout,
}: {
  sessions: Session[];
  loading: boolean;
  activeId: string | null;
  user: StoredUser | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLogout: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [toDelete, setToDelete] = useState<Session | null>(null);

  function startEdit(s: Session) {
    setEditingId(s.id);
    setDraft(s.title);
  }

  async function commitEdit() {
    const id = editingId;
    const title = draft.trim();
    setEditingId(null);
    if (!id || !title) return;
    const current = sessions.find((s) => s.id === id);
    if (current && current.title !== title) await onRename(id, title);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Wordmark />
      </div>

      <div className="px-3 pb-3">
        <Button className="w-full justify-start" variant="outline" onClick={onNew}>
          <Plus />
          New conversation
        </Button>
      </div>

      <nav aria-label="Conversations" className="flex-1 overflow-y-auto px-3 pb-3">
        {loading && <p className="px-2 py-2 text-sm text-muted-foreground">Loading conversations</p>}
        {!loading && sessions.length === 0 && (
          <p className="px-2 py-2 text-sm leading-relaxed text-muted-foreground">
            Your conversations will be listed here.
          </p>
        )}
        <ul className="space-y-px">
          {sessions.map((s) =>
            editingId === s.id ? (
              <li key={s.id}>
                <form
                  className="flex items-center gap-1 py-0.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void commitEdit();
                  }}
                >
                  <Input
                    autoFocus
                    aria-label="Conversation title"
                    value={draft}
                    maxLength={255}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                    className="h-8 bg-white"
                  />
                  <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save title">
                    <Check />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel renaming" onClick={() => setEditingId(null)}>
                    <X />
                  </Button>
                </form>
              </li>
            ) : (
              <li
                key={s.id}
                className={cn(
                  "group relative flex items-center rounded-md text-sm transition-colors",
                  s.id === activeId ? "bg-white text-ink" : "text-ink/80 hover:bg-sidebar-accent",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-current={s.id === activeId ? "page" : undefined}
                  className="min-w-0 flex-1 truncate rounded-md px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={s.title}
                >
                  {s.title}
                </button>
                <div className="flex shrink-0 pr-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button size="icon-xs" variant="ghost" aria-label={`Rename ${s.title}`} onClick={() => startEdit(s)}>
                    <Pencil />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label={`Delete ${s.title}`} onClick={() => setToDelete(s)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      </nav>

      <div className="flex items-center gap-2 border-t border-sidebar-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {user ? `${user.first_name} ${user.last_name}` : "Signed in"}
          </p>
          {user && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Log out" title="Log out" onClick={onLogout}>
          <LogOut />
        </Button>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this conversation?"
        description={<>“{toDelete?.title}” and all its messages will be deleted. This can’t be undone.</>}
        confirmLabel="Delete conversation"
        onConfirm={async () => {
          if (toDelete) await onDelete(toDelete.id);
        }}
      />
    </div>
  );
}
