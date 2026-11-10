"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { ChatPanel, type UiMessage } from "@/components/chat/chat-panel";
import { CollectionSidebar } from "@/components/chat/collection-sidebar";
import { SessionSidebar } from "@/components/chat/session-sidebar";
import * as api from "@/lib/api";
import { clearAuth, getUser } from "@/lib/auth";
import { streamChat } from "@/lib/sse";
import type { Collection, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_TITLE = "New chat";
const NEW_KEY = "__new__";
const COLLECTION_MAP_KEY = "rag.collectionBySession";
const LAST_COLLECTION_KEY = "rag.lastCollection";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

const errMsg = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const isAbort = (err: unknown) => err instanceof DOMException && err.name === "AbortError";
const makeTitle = (q: string) => {
  const oneLine = q.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}…` : oneLine;
};
let tmpCounter = 0;
const tmpId = () => `tmp-${Date.now()}-${tmpCounter++}`;

function ChatView() {
  const router = useRouter();
  const params = useSearchParams();
  const [user] = useState(getUser);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(() => params.get("session"));
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(() => !!params.get("session"));
  const [streaming, setStreaming] = useState(false);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [collectionMap, setCollectionMap] = useState<Record<string, string>>(() =>
    readJson(COLLECTION_MAP_KEY, {}),
  );
  const [lastCollection, setLastCollection] = useState<string | null>(() => readJson(LAST_COLLECTION_KEY, null));

  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const loadSeq = useRef(0);

  // ---- derived ----
  const rawSelected = collectionMap[activeId ?? NEW_KEY] ?? lastCollection;
  const selectedCollection = collections.find((c) => c.id === rawSelected) ?? null;
  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  // ---- loaders (state is only set inside promise callbacks, so they are safe to start from effects) ----
  const refreshSessions = useCallback(
    () =>
      api
        .listSessions()
        .then(setSessions)
        .catch((err) => toast.error(errMsg(err, "Could not load sessions")))
        .finally(() => setSessionsLoading(false)),
    [],
  );

  const fetchMessages = useCallback(
    (id: string) => {
      const seq = ++loadSeq.current;
      const current = () => seq === loadSeq.current;
      return api
        .getSession(id)
        .then((detail) => {
          if (!current()) return;
          setMessages(detail.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })));
        })
        .catch((err) => {
          if (!current()) return;
          setMessages([]);
          toast.error(errMsg(err, "Could not load conversation"));
          if (err instanceof api.ApiError && err.status === 404) {
            setActiveId(null);
            router.replace("/chat");
          }
        })
        .finally(() => {
          if (current()) setMessagesLoading(false);
        });
    },
    [router],
  );

  useEffect(() => {
    void refreshSessions();
    api
      .listCollections()
      .then(setCollections)
      .catch((err) => toast.error(errMsg(err, "Could not load collections")))
      .finally(() => setCollectionsLoading(false));
    const initial = params.get("session");
    if (initial) void fetchMessages(initial);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // ---- navigation ----
  function setUrlSession(id: string | null) {
    router.replace(id ? `/chat?session=${encodeURIComponent(id)}` : "/chat", { scroll: false });
  }

  function stopStream() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  function selectSession(id: string) {
    setLeftOpen(false);
    if (id === activeId) return;
    stopStream();
    setActiveId(id);
    setMessages([]);
    setMessagesLoading(true);
    setUrlSession(id);
    void fetchMessages(id);
  }

  function newChat() {
    setLeftOpen(false);
    stopStream();
    loadSeq.current++;
    setActiveId(null);
    setMessages([]);
    setMessagesLoading(false);
    setUrlSession(null);
  }

  // ---- collection selection (remembered per session) ----
  function persistSelection(key: string, collectionId: string) {
    setCollectionMap((prev) => {
      const next = { ...prev, [key]: collectionId };
      writeJson(COLLECTION_MAP_KEY, next);
      return next;
    });
    setLastCollection(collectionId);
    writeJson(LAST_COLLECTION_KEY, collectionId);
  }

  function selectCollection(id: string) {
    persistSelection(activeId ?? NEW_KEY, id);
    setRightOpen(false);
  }

  // ---- chat ----
  async function send(question: string) {
    if (!selectedCollection || streaming) return;
    const collectionId = selectedCollection.id;
    setStreaming(true);

    let sessionId = activeId;
    try {
      if (!sessionId) {
        const created = await api.createSession(makeTitle(question));
        sessionId = created.id;
        setSessions((prev) => [created, ...prev]);
        setActiveId(created.id);
        setUrlSession(created.id);
        persistSelection(created.id, collectionId);
      } else if (activeSession?.title === DEFAULT_TITLE) {
        const id = sessionId;
        api
          .renameSession(id, makeTitle(question))
          .then((s) => setSessions((prev) => prev.map((p) => (p.id === id ? { ...p, ...s } : p))))
          .catch(() => {});
      }
    } catch (err) {
      setStreaming(false);
      toast.error(errMsg(err, "Could not create the conversation"));
      return;
    }

    const assistantId = tmpId();
    setMessages((prev) => [
      ...prev,
      { id: tmpId(), role: "user", content: question },
      { id: assistantId, role: "assistant", content: "", status: "streaming" },
    ]);
    const patch = (fn: (m: UiMessage) => UiMessage) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat(
        { session_id: sessionId, collection_id: collectionId, question },
        {
          onSources: (sources) => patch((m) => ({ ...m, sources })),
          onToken: (t) => patch((m) => ({ ...m, content: m.content + t })),
          onDone: () => {
            patch((m) => ({ ...m, status: undefined }));
            void refreshSessions();
          },
          onError: (detail) => {
            patch((m) => ({ ...m, status: "error", error: detail }));
            toast.error(detail);
          },
        },
        controller.signal,
      );
    } catch (err) {
      if (isAbort(err)) {
        patch((m) => ({ ...m, status: "stopped" }));
      } else {
        const msg = errMsg(err, "Chat request failed");
        patch((m) => ({ ...m, status: "error", error: msg }));
        toast.error(msg);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(false);
    }
  }

  // ---- session CRUD ----
  async function renameSession(id: string, title: string) {
    try {
      const s = await api.renameSession(id, title);
      setSessions((prev) => prev.map((p) => (p.id === id ? { ...p, ...s } : p)));
    } catch (err) {
      toast.error(errMsg(err, "Could not rename"));
    }
  }

  async function deleteSession(id: string) {
    await api.deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setCollectionMap((prev) => {
      const next = { ...prev };
      delete next[id];
      writeJson(COLLECTION_MAP_KEY, next);
      return next;
    });
    if (id === activeId) newChat();
  }

  // ---- collection CRUD ----
  async function createCollection(name: string, description: string) {
    const c = await api.createCollection(name, description);
    const created = { ...c, file_count: c.file_count ?? 0 };
    setCollections((prev) => [created, ...prev]);
    selectCollection(created.id);
    toast.success(`Created “${created.name}”`);
    return created;
  }

  async function deleteCollection(id: string) {
    await api.deleteCollection(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  }

  const updateFileCount = useCallback((collectionId: string, count: number) => {
    setCollections((prev) =>
      prev.some((c) => c.id === collectionId && c.file_count !== count)
        ? prev.map((c) => (c.id === collectionId ? { ...c, file_count: count } : c))
        : prev,
    );
  }, []);

  async function logout() {
    stopStream();
    try {
      await api.logout();
    } catch {
      /* token may already be invalid */
    }
    clearAuth();
    router.replace("/login");
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
      {(leftOpen || rightOpen) && (
        <button
          type="button"
          aria-label="Close panel"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => {
            setLeftOpen(false);
            setRightOpen(false);
          }}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-sidebar-border bg-sidebar transition-transform md:static md:z-auto md:w-64 md:translate-x-0",
          leftOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SessionSidebar
          sessions={sessions}
          loading={sessionsLoading}
          activeId={activeId}
          user={user}
          onSelect={selectSession}
          onNew={newChat}
          onRename={renameSession}
          onDelete={deleteSession}
          onLogout={logout}
        />
      </aside>

      <ChatPanel
        title={activeSession?.title ?? (activeId ? "" : "New conversation")}
        messages={messages}
        loading={messagesLoading}
        streaming={streaming}
        collection={selectedCollection}
        onSend={send}
        onStop={stopStream}
        onToggleLeft={() => setLeftOpen((o) => !o)}
        onToggleRight={() => setRightOpen((o) => !o)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 w-80 border-l border-sidebar-border bg-sidebar transition-transform lg:static lg:z-auto lg:w-72 lg:translate-x-0",
          rightOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <CollectionSidebar
          collections={collections}
          loading={collectionsLoading}
          selectedId={selectedCollection?.id ?? null}
          onSelect={selectCollection}
          onCreate={createCollection}
          onDelete={deleteCollection}
          onCountChange={updateFileCount}
        />
      </aside>
    </div>
  );
}

export default function ChatPage() {
  return (
    <AuthGuard>
      <Suspense>
        <ChatView />
      </Suspense>
    </AuthGuard>
  );
}
