import { API_URL, ApiError, authHeaders, ensureOk } from "./api";
import type { ChatEvent, ChatRequest, ChatSource } from "./types";

export interface StreamHandlers {
  onSources?: (sources: ChatSource[]) => void;
  onToken?: (token: string) => void;
  onDone?: () => void;
  onError?: (detail: string) => void;
}

/**
 * POST /chat and consume the `text/event-stream` response.
 * EventSource can't send a POST body or an Authorization header, so we read the stream manually.
 * HTTP errors before the stream starts (404/409/502/401) are thrown as ApiError.
 */
export async function streamChat(
  body: ChatRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...authHeaders() },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, `Cannot reach the API at ${API_URL}`);
  }
  await ensureOk(res, "/chat");
  if (!res.body) throw new ApiError(0, "Empty response stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  const dispatch = (raw: string) => {
    const data = raw
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data) return;
    let event: ChatEvent;
    try {
      event = JSON.parse(data) as ChatEvent;
    } catch {
      return;
    }
    switch (event.type) {
      case "sources":
        handlers.onSources?.(event.sources ?? []);
        break;
      case "token":
        handlers.onToken?.(event.content ?? "");
        break;
      case "done":
        finished = true;
        handlers.onDone?.();
        break;
      case "error":
        finished = true;
        handlers.onError?.(event.detail || "Generation failed");
        break;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const chunk = buffer.slice(0, idx);
      const sep = buffer.slice(idx).match(/^\r?\n\r?\n/)![0];
      buffer = buffer.slice(idx + sep.length);
      dispatch(chunk);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) dispatch(buffer);
  if (!finished) handlers.onError?.("The stream ended unexpectedly");
}
