"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, ArrowUp, Library, Loader2, PanelLeft, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoredUser } from "@/lib/auth";
import type { ChatSource, Collection, Role } from "@/lib/types";
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

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-paper">
      <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:px-8">
        <Button size="icon-sm" variant="ghost" className="md:hidden" aria-label="Show conversations" onClick={onToggleLeft}>
          <PanelLeft />
        </Button>
        <div className="mx-auto w-full max-w-[46rem] min-w-0 md:px-8">
          <h1 className="truncate text-[0.9375rem] font-semibold">{title}</h1>
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
      {message.sources && message.sources.length > 0 && <Sources sources={message.sources} />}

      {waiting ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {message.sources ? "Writing the answer" : "Searching the documents"}
        </p>
      ) : (
        <div className="markdown text-ink">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          {message.status === "streaming" && (
            <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-[2px] animate-pulse bg-primary align-text-bottom" />
          )}
        </div>
      )}

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

/** Ranked passages the answer was drawn from, shown as footnotes. Lower distance = closer match. */
function Sources({ sources }: { sources: ChatSource[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const match = (d: number) => Math.max(0, Math.round((1 - d) * 100));

  return (
    <div className="mb-4">
      <ol className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem]">
        {sources.map((s, i) => (
          <li key={`${s.file_id ?? "src"}-${i}`}>
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className={cn(
                "group flex max-w-[16rem] items-center gap-1.5 rounded-sm text-left text-muted-foreground hover:text-foreground",
                open === i && "text-foreground",
              )}
              title={`${s.filename ?? "Unknown file"}: ${match(s.distance)}% match`}
            >
              <span
                className="source-chip inline-flex h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-[3px] px-1 text-[0.75rem] font-semibold text-ink tabular-nums"
                style={{ "--i": i } as React.CSSProperties}
              >
                {i + 1}
              </span>
              <span className="truncate underline-offset-2 group-hover:underline">{s.filename ?? "Unknown file"}</span>
            </button>
          </li>
        ))}
      </ol>

      {open !== null && sources[open] && (
        <figure className="mt-3 border-l-2 border-highlighter-strong pl-4">
          <blockquote className="font-reading text-[0.9375rem] leading-relaxed text-ink">
            <span className="excerpt-mark">{sources[open].text.trim()}</span>
          </blockquote>
          <figcaption className="mt-2 text-xs text-muted-foreground">
            {sources[open].filename ?? "Unknown file"}, {match(sources[open].distance)}% match with your question
          </figcaption>
        </figure>
      )}
    </div>
  );
}
