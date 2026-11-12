"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, ArrowUp, ChevronDown, FileText, Library, Loader2, PanelLeft, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoredUser } from "@/lib/auth";
import type { ChatSource, Collection, Role } from "@/lib/types";
import { safeMarkdownComponents, safeUrlTransform } from "@/lib/safe-markdown";
import { cn } from "@/lib/utils";

export interface UiMessage {
  id: string;
  role: Role;
  content: string;
  sources?: ChatSource[];
  status?: "streaming" | "error" | "stopped";
  error?: string;
}

/** Pair each question with the answer that follows it, so the transcript reads as exchanges. */
function toExchanges(messages: UiMessage[]) {
  const out: { question?: UiMessage; answer?: UiMessage; key: string }[] = [];
  for (const m of messages) {
    if (m.role === "user") out.push({ question: m, key: m.id });
    else {
      const last = out[out.length - 1];
      if (last && !last.answer && last.question) last.answer = m;
      else out.push({ answer: m, key: m.id });
    }
  }
  return out;
}

/** Every chunk cited in the conversation, once, with the number of answers that cite it. */
function collectSources(messages: UiMessage[]) {
  const byId = new Map<string, { source: ChatSource; count: number }>();
  for (const m of messages) {
    for (const s of m.sources ?? []) {
      const entry = byId.get(s.id);
      if (entry) entry.count += 1;
      else byId.set(s.id, { source: s, count: 1 });
    }
  }
  return [...byId.values()];
}

export function ChatPanel({
  title,
  messages,
  loading,
  streaming,
  collection,
  user,
  onSend,
  onStop,
  onToggleLeft,
  onToggleRight,
}: {
  title: string;
  messages: UiMessage[];
  loading: boolean;
  streaming: boolean;
  collection: Collection | null;
  user: StoredUser | null;
  onSend: (question: string) => void;
  onStop: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Grow the composer with its content, up to a limit.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const canSend = !!collection && !streaming && input.trim().length > 0;

  function submit() {
    if (!canSend) return;
    onSend(input.trim());
    setInput("");
  }

  const exchanges = toExchanges(messages);
  const globalSources = useMemo(() => collectSources(messages), [messages]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-paper">
      <header className="relative flex h-14 shrink-0 items-center gap-2 px-3 md:px-8">
        <Button size="icon-sm" variant="ghost" className="md:hidden" aria-label="Show conversations" onClick={onToggleLeft}>
          <PanelLeft />
        </Button>
        <div className="mx-auto flex w-full max-w-[46rem] min-w-0 items-center gap-3 md:px-8">
          <h1 className="min-w-0 truncate text-[0.9375rem] font-semibold">{title}</h1>
          {!loading && globalSources.length > 0 && <GlobalSources items={globalSources} />}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[46rem] px-5 pb-10 md:px-8">
          {loading ? (
            <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Opening conversation
            </div>
          ) : exchanges.length === 0 ? (
            <EmptyState collection={collection} onChooseCollection={onToggleRight} />
          ) : (
            <ol>
              {exchanges.map((ex) => (
                <li key={ex.key} className="pt-8 first:pt-6">
                  {ex.question && (
                    <div className="mb-6 flex items-end justify-end gap-2.5">
                      <p className="question-slip max-w-[80%] whitespace-pre-wrap md:max-w-[72%]">
                        <span className="sr-only">You asked: </span>
                        {ex.question.content}
                      </p>
                      <UserAvatar user={user} />
                    </div>
                  )}
                  {ex.answer && (
                    <div className="flex items-start gap-2.5">
                      <AssistantAvatar />
                      <Answer message={ex.answer} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 md:px-8 md:pb-6">
        <form
          className="mx-auto w-full max-w-[46rem] rounded-[14px] border border-input bg-white transition-shadow focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="question" className="sr-only">
            Your question
          </label>
          <textarea
            id="question"
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={collection ? "Ask a question" : "Choose a collection before asking"}
            disabled={!collection}
            rows={1}
            className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[0.9375rem] leading-relaxed outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          <div className="flex items-center gap-2 px-2.5 pb-2.5">
            <button
              type="button"
              onClick={onToggleRight}
              className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground lg:pointer-events-none"
            >
              <Library className="size-3.5 shrink-0" />
              <span className="truncate">
                {collection ? (
                  <>
                    Searching <span className="font-medium text-foreground">{collection.name}</span>
                  </>
                ) : (
                  "No collection chosen"
                )}
              </span>
            </button>
            <div className="ml-auto">
              {streaming ? (
                <Button type="button" size="icon" variant="outline" aria-label="Stop answering" onClick={onStop}>
                  <Square className="fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send question"
                  title="Send (Enter). Shift+Enter adds a line."
                  disabled={!canSend}
                >
                  <ArrowUp />
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function GlobalSources({ items }: { items: { source: ChatSource; count: number }[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Group the unique chunks by file so the list reads as "documents, then passages".
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; chunks: typeof items }>();
    for (const it of items) {
      const key = it.source.file_id ?? it.source.filename ?? "unknown";
      const g = map.get(key) ?? { name: it.source.filename ?? "Unknown file", chunks: [] };
      g.chunks.push(it);
      map.set(key, g);
    }
    return [...map.entries()];
  }, [items]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="global-sources"
        className={cn(
          "flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border bg-white px-3 text-[0.8125rem] font-medium outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/30",
          open ? "border-highlighter-strong" : "border-input hover:border-ring",
        )}
      >
        <FileText aria-hidden className="size-3.5" />
        Sources
        <span className="tabular-nums text-muted-foreground">{items.length}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          id="global-sources"
          className="absolute inset-x-3 top-full z-20 mx-auto max-h-[60vh] max-w-[46rem] overflow-y-auto rounded-lg border border-input bg-white text-[0.8125rem] shadow-lg md:inset-x-8"
        >
          <p className="border-b border-input px-3.5 py-2 text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "passage" : "passages"} from {groups.length}{" "}
            {groups.length === 1 ? "document" : "documents"} in this conversation
          </p>
          {groups.map(([key, g]) => (
            <div key={key} className="border-b border-input last:border-b-0">
              <p className="flex items-center gap-2 bg-muted/50 px-3.5 py-1.5 text-xs font-semibold text-foreground">
                <FileText aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{g.name}</span>
              </p>
              <ul>
                {g.chunks.map(({ source, count }) => {
                  const isOpen = expanded.has(source.id);
                  return (
                    <li key={source.id} className="px-3.5 py-2">
                      <button
                        type="button"
                        onClick={() => toggle(source.id)}
                        aria-expanded={isOpen}
                        className="block w-full cursor-pointer rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-primary/30"
                      >
                        <span
                          className={cn(
                            "block font-reading text-[0.875rem] leading-relaxed text-ink",
                            !isOpen && "line-clamp-2",
                          )}
                        >
                          {isOpen ? <span className="excerpt-mark">{source.text.trim()}</span> : source.text.trim()}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {count === 1 ? "cited once" : `cited ${count} times`} · {isOpen ? "show less" : "show more"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function EmptyState({
  collection,
  onChooseCollection,
}: {
  collection: Collection | null;
  onChooseCollection: () => void;
}) {
  if (!collection) {
    return (
      <div className="max-w-[34rem] pt-[14vh]">
        <p className="font-reading text-[2rem] leading-[1.15] text-ink md:text-[2.5rem]">
          Choose which documents to ask.
        </p>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
          Pick a collection from the list on the right, or create one and upload PDF, text or Markdown files. Answers
          only draw on the collection you choose.
        </p>
        <Button variant="outline" className="mt-6 lg:hidden" onClick={onChooseCollection}>
          <Library />
          Choose a collection
        </Button>
      </div>
    );
  }
  return (
    <div className="max-w-[34rem] pt-[14vh]">
      <p className="font-reading text-[2rem] leading-[1.15] text-ink md:text-[2.5rem]">
        What do you want to find in {collection.name}?
      </p>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
        Each answer lists the passages it was drawn from, so you can check it against the source.
      </p>
    </div>
  );
}

/** The user's initials on a cobalt disc: round, like a person. */
function UserAvatar({ user }: { user: StoredUser | null }) {
  const initials =
    `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";
  return (
    <span
      aria-hidden
      title={user ? `${user.first_name} ${user.last_name}`.trim() : undefined}
      className="avatar avatar-user"
    >
      {initials}
    </span>
  );
}

/** The assistant: the wordmark's serif B on an ink tile, square like a book spine label. */
function AssistantAvatar() {
  return (
    <span aria-hidden title="Base RAG" className="avatar avatar-assistant">
      B
    </span>
  );
}

function Answer({ message }: { message: UiMessage }) {
  const waiting = message.status === "streaming" && !message.content;
  return (
    <div className="answer-bubble min-w-0 flex-1">
      <span className="sr-only">Answer: </span>

      {waiting ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {message.sources ? "Writing the answer" : "Searching the documents"}
        </p>
      ) : (
        <div className="markdown text-ink">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={safeMarkdownComponents}
            urlTransform={safeUrlTransform}
          >
            {message.content}
          </ReactMarkdown>
          {message.status === "streaming" && (
            <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-[2px] animate-pulse bg-primary align-text-bottom" />
          )}
        </div>
      )}

      {message.sources && message.sources.length > 0 && !waiting && <Sources sources={message.sources} />}

      {message.status === "error" && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{message.error ?? "The answer could not be generated."} This question was not saved; send it again to retry.</span>
        </p>
      )}
      {message.status === "stopped" && (
        <p className="mt-3 text-sm text-muted-foreground">Stopped. This question was not saved.</p>
      )}
    </div>
  );
}

/** Ranked passages the answer was drawn from, behind a button. Lower distance = closer match. */
function Sources({ sources }: { sources: ChatSource[] }) {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const pct = (d: number | null) => (d == null ? null : Math.max(0, Math.round((1 - d) * 100)));
  const listId = useId();

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-expanded={shown}
        aria-controls={listId}
        className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-input bg-white px-3 text-[0.8125rem] font-medium text-muted-foreground outline-none transition-colors duration-150 hover:border-ring hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30"
      >
        <FileText aria-hidden className="size-3.5" />
        Sources
        <span className="tabular-nums">{sources.length}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", shown && "rotate-180")}
        />
      </button>

      {shown && (
        <div id={listId} className="mt-3">
          <ol className="flex flex-wrap gap-2 text-[0.8125rem]">
            {sources.map((s, i) => {
              const active = open === i;
              const match = pct(s.distance);
              return (
                <li key={`${s.id}-${i}`} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setOpen(active ? null : i)}
                    aria-expanded={active}
                    className={cn(
                      "flex min-h-9 max-w-[15rem] cursor-pointer items-center gap-2 rounded-full border bg-white py-1 pr-3 pl-1.5 text-left outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/30",
                      active
                        ? "border-highlighter-strong text-foreground"
                        : "border-input text-muted-foreground hover:border-ring hover:text-foreground",
                    )}
                    title={`${s.filename ?? "Unknown file"}${match != null ? `: ${match}% match` : ""}`}
                  >
                    <span
                      className="source-chip inline-flex size-[1.4rem] shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold text-ink tabular-nums"
                      style={{ "--i": i } as React.CSSProperties}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate">{s.filename ?? "Unknown file"}</span>
                    {match != null && <span className="shrink-0 text-xs tabular-nums opacity-70">{match}%</span>}
                  </button>
                </li>
              );
            })}
          </ol>

          {open !== null && sources[open] && (
            <figure className="mt-3 border-l-2 border-highlighter-strong pl-4">
              <blockquote className="font-reading text-[0.9375rem] leading-relaxed text-ink">
                <span className="excerpt-mark">{sources[open].text.trim()}</span>
              </blockquote>
              <figcaption className="mt-2 text-xs text-muted-foreground">
                {sources[open].filename ?? "Unknown file"}
                {pct(sources[open].distance) != null && `, ${pct(sources[open].distance)}% match with your question`}
              </figcaption>
            </figure>
          )}
        </div>
      )}
    </div>
  );
}
