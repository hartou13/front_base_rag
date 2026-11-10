import { getToken, redirectToLogin } from "./auth";
import type {
  Collection,
  CollectionFile,
  LoginResponse,
  Session,
  SessionDetail,
  SignupPayload,
} from "./types";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

/** Endpoints where a 401 means "bad credentials", not "session expired". */
const PUBLIC_PATHS = ["/auth/login", "/auth/sign-up"];

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The backend returns `{message}` from middleware and `{detail}` from routes (string or 422 array). */
export function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const b = body as { detail?: unknown; message?: unknown };
    if (typeof b.detail === "string") return b.detail;
    if (Array.isArray(b.detail)) {
      const msgs = b.detail
        .map((d) => {
          if (d && typeof d === "object" && "msg" in d) {
            const loc = Array.isArray((d as { loc?: unknown }).loc)
              ? ((d as { loc: unknown[] }).loc.filter((l) => l !== "body").join("."))
              : "";
            return loc ? `${loc}: ${(d as { msg: string }).msg}` : (d as { msg: string }).msg;
          }
          return null;
        })
        .filter(Boolean);
      if (msgs.length) return msgs.join("\n");
    }
    if (typeof b.message === "string") return b.message;
  }
  return fallback;
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Throws ApiError for non-OK responses; redirects to /login on 401 for protected endpoints. */
export async function ensureOk(res: Response, path: string): Promise<Response> {
  if (res.ok) return res;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }
  const message = extractErrorMessage(body, `${res.status} ${res.statusText}`);
  if (res.status === 401 && !PUBLIC_PATHS.includes(path)) {
    redirectToLogin();
  }
  throw new ApiError(res.status, message);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(authHeaders())) headers.set(k, v);
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, `Cannot reach the API at ${API_URL}`);
  }
  await ensureOk(res, path);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const json = (body: unknown) => JSON.stringify(body);

// ---- Auth ----
export const login = (email: string, password: string) =>
  apiFetch<LoginResponse>("/auth/login", { method: "POST", body: json({ email, password }) });

export const signup = (payload: SignupPayload) =>
  apiFetch<LoginResponse>("/auth/sign-up", { method: "POST", body: json(payload) });

export const logout = () => apiFetch<{ message: string }>("/auth/logout", { method: "DELETE" });

// ---- Sessions ----
export const listSessions = () => apiFetch<Session[]>("/sessions");

export const createSession = (title?: string) =>
  apiFetch<Session>("/sessions", { method: "POST", body: json(title ? { title } : {}) });

export const getSession = (id: string) => apiFetch<SessionDetail>(`/sessions/${id}`);

export const renameSession = (id: string, title: string) =>
  apiFetch<Session>(`/sessions/${id}`, { method: "PUT", body: json({ title }) });

export const deleteSession = (id: string) =>
  apiFetch<{ message: string }>(`/sessions/${id}`, { method: "DELETE" });

// ---- Collections ----
export const listCollections = () => apiFetch<Collection[]>("/collections");

export const createCollection = (name: string, description?: string) =>
  apiFetch<Collection>("/collections", {
    method: "POST",
    body: json({ name, description: description || null }),
  });

export const deleteCollection = (id: string) =>
  apiFetch<{ message: string }>(`/collections/${id}`, { method: "DELETE" });

export const uploadFiles = (collectionId: string, files: File[]) => {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  return apiFetch<CollectionFile[]>(`/collections/${collectionId}/files`, {
    method: "POST",
    body: form,
  });
};

export const listFiles = (collectionId: string) =>
  apiFetch<CollectionFile[]>(`/collections/${collectionId}/files`);

export const deleteFile = (fileId: string) =>
  apiFetch<{ message: string }>(`/files/${fileId}`, { method: "DELETE" });

export const reindexFile = (fileId: string) =>
  apiFetch<CollectionFile>(`/files/${fileId}/reindex`, { method: "POST" });

/** The original file needs the bearer header, so it is fetched as a blob rather than linked directly. */
export async function fetchFileBlob(fileId: string): Promise<Blob> {
  const path = `/files/${fileId}/content`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  } catch {
    throw new ApiError(0, `Cannot reach the API at ${API_URL}`);
  }
  await ensureOk(res, path);
  return res.blob();
}
