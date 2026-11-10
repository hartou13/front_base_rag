# Base RAG front end

A Next.js web app for [`base_rag_api`](../base_rag_api). Users sign up, build collections of documents, and ask questions answered only from the selected collection. Each answer lists the passages it was drawn from.

To install and run the project, see [QUICKSTART.md](QUICKSTART.md).

## Stack

- **Framework:** Next.js 16 (App Router) with React 19 and TypeScript. All pages are client components that call the API directly from the browser. There is no Next.js server code or proxy.
- **UI:** Tailwind CSS 4 and shadcn/ui (`base-nova` style, built on Base UI), with `lucide-react` icons and `sonner` toasts.
- **Markdown:** answers are rendered with `react-markdown` and `remark-gfm`.
- **Fonts:** Hanken Grotesk for the interface and Newsreader for answers, loaded with `next/font`.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Redirects to `/chat` if a token is stored, otherwise to `/login`. |
| `/login` | Email and password login. |
| `/signup` | Creates an account (first name, last name, email, password and language) and logs in. |
| `/chat` | The main screen. Opening it without a token redirects to `/login`. |

### The chat screen

- **Left: conversations.**
  - Start, open, rename and delete conversations.
  - Log out from the bottom of the panel.
  - The open conversation is kept in the URL (`/chat?session=<id>`), so reloading keeps it open.
- **Centre: the transcript.**
  - Each exchange shows the question, then the answer as it streams in.
  - The passages the answer was drawn from appear as numbered sources above it, ranked by match. Clicking one shows the highlighted excerpt and its file name.
  - A Stop button cancels an answer.
  - Sending a first message creates the conversation and names it after the question.
- **Right: collections.**
  - Select, create and delete collections. Each one shows its document count.
  - The selected collection's **Documents** button opens the document manager.
  - The collection chosen for each conversation is remembered.

On narrow screens both side panels slide in: the left from the header button, the right from the collection line in the message box.

### The document manager

- Lists every file in the collection with its size, date added and status: Ready (with its passage count), Indexing or Failed (with the reason).
- Files can be filtered by name and sorted by name, size or date.
- Add PDF, `.txt` or `.md` files with **Add documents** or by dropping them on the window. Indexing happens before the upload request returns, so a long PDF can take a few minutes.
- Each file can be opened in a new tab, downloaded, re-indexed if indexing failed (**Retry**), or deleted.

## How it talks to the API

- **Base URL:** set with `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). The API allows any origin through CORS, but not credentials, so requests carry a bearer header and never use cookies.
- **Auth:** login and signup return a JWT. The token and the user's name and email are kept in `localStorage`.
- **Expired or revoked token:** any `401` from a protected endpoint clears the token and redirects to `/login?next=<current page>`. After login, the user returns to that page.
- **Errors:** the API returns either `{message}` (from its auth middleware) or `{detail}` (from routes, including 422 validation lists). Both are turned into one readable message.
- **Chat stream:** `POST /chat` returns server-sent events: `sources`, then a `token` for each piece of the answer, then `done` or `error`. `EventSource` can't send a POST body or an `Authorization` header, so the stream is read with `fetch` and a stream reader.
- **Files:** opening or downloading a file needs the bearer header, so the file is fetched as a blob and then opened or saved locally.

### Endpoints used

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/login`, `POST /auth/sign-up`, `DELETE /auth/logout` |
| Conversations | `GET`/`POST /sessions`, `GET`/`PUT`/`DELETE /sessions/{id}` |
| Collections | `GET`/`POST /collections`, `DELETE /collections/{id}` |
| Documents | `GET`/`POST /collections/{id}/files`, `GET /files/{id}/content`, `POST /files/{id}/reindex`, `DELETE /files/{id}` |
| Chat | `POST /chat` (server-sent events) |

`GET /collections/{id}/files`, `GET /files/{id}/content`, `POST /files/{id}/reindex` and the `file_count`, `size`, `content_type` and `created_at` fields were added to the API for this front end. An API older than these changes doesn't support the document manager.

## Project structure

```text
src/
  app/
    layout.tsx              fonts, metadata, toasts
    globals.css             colour and font tokens, answer (markdown) and source styles
    page.tsx                redirect to /chat or /login
    login/page.tsx
    signup/page.tsx
    chat/page.tsx           chat screen; owns all chat state
  components/
    auth-guard.tsx          redirects to /login when there is no token
    auth-shell.tsx          layout shared by login and signup
    confirm-dialog.tsx      confirmation used for every delete
    wordmark.tsx
    chat/
      session-sidebar.tsx   conversations (left)
      chat-panel.tsx        transcript, sources, message box (centre)
      collection-sidebar.tsx collections (right)
      documents-dialog.tsx  document manager
    ui/                     shadcn/ui components (generated; edit with care)
  lib/
    api.ts                  fetch wrapper, 401 redirect, one function per endpoint
    sse.ts                  chat stream reader
    auth.ts                 token and user storage, login redirect
    types.ts                TypeScript versions of the API's DTOs
    hooks.ts, utils.ts
```

## Design

- **Colours:** dark navy text on a cool pale-grey page, with slightly darker grey side panels. Cobalt marks buttons and selection.
- **Highlighter yellow** is reserved for text taken from the user's documents: source numbers and quoted excerpts.
- **Fonts:** answers are set in Newsreader at a comfortable reading width. Everything else uses Hanken Grotesk.
- **Where to change it:** the tokens are at the top of `:root` in `src/app/globals.css`, and the answer and source styles are at the end of that file.

## Known limits

- **Failed or stopped answers aren't saved:** the API stores a question and its answer only when the answer completes. The transcript marks these as not saved.
- **Sources aren't stored:** the API doesn't keep an answer's sources, so they appear only on answers given since the page was opened, not on reopened conversations.
- **Token storage:** the token is in `localStorage`. That is simple but readable by any script on the page. An `HttpOnly` cookie would be safer, but it needs the API to accept credentials.
- **Language and theme:** the interface is in English only. There is no dark mode.
