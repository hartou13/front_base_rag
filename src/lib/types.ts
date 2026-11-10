// TypeScript mirrors of base_rag_api DTOs.

export interface LoginResponse {
  token: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  language: string;
}

export interface Session {
  id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
}

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  created_at: string | null;
}

export interface SessionDetail extends Session {
  messages: Message[];
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  file_count: number;
}

export type FileStatus = "indexing" | "ready" | "failed";

export interface CollectionFile {
  id: string;
  filename: string;
  status: FileStatus;
  chunk_count: number;
  error: string | null;
  content_type: string | null;
  size: number;
  created_at: string | null;
}

export interface ChatSource {
  file_id: string | null;
  filename: string | null;
  text: string;
  distance: number;
}

export interface ChatRequest {
  session_id: string;
  collection_id: string;
  question: string;
}

export type ChatEvent =
  | { type: "sources"; sources: ChatSource[] }
  | { type: "token"; content: string }
  | { type: "done" }
  | { type: "error"; detail: string };
