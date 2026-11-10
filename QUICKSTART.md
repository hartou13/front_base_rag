# Base RAG front end - Quickstart

## Prerequisites

- **Node.js 20.9 or later** (Next.js 16 requires it), with npm.
- **base_rag_api running**, by default on `http://localhost:8000`. Follow [../base_rag_api/QUICKSTART.md](../base_rag_api/QUICKSTART.md). The API needs MySQL with its migrations applied, and Ollama for indexing and answers.

  Check that the API is up:

  ```bash
  curl http://localhost:8000/health-check
  # {"message":"MyAuxilium OK"}
  ```

## Install and run

1. Install the dependencies, from the `front_base_rag` folder:

   ```bash
   npm install
   ```

2. Create your local settings from the example.

   **macOS and Linux:**

   ```bash
   cp .env.local.example .env.local
   ```

   **Windows (PowerShell):**

   ```powershell
   Copy-Item .env.local.example .env.local
   ```

   The file contains a single setting:

   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

   Change it if the API runs elsewhere.

   `NEXT_PUBLIC_*` values are built into the browser code. Restart `npm run dev` after changing it, or rebuild for production.

3. Start the development server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## First use

1. **Sign up** at `/signup`. You're logged in straight away and taken to the chat screen.
2. **Create a collection:** click **New** in the Collections panel on the right. The document manager opens next.
3. **Add documents:** use **Add documents** or drop PDF, `.txt` or `.md` files on the window. Wait until each file shows **Ready**. A file marked **Failed** shows the reason and can be retried. A common cause is Ollama not running.
4. **Ask a question** in the message box. The answer streams in, with its numbered sources above it. Click a source to see the passage it came from.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload, on port 3000 |
| `npm run build` | Production build (also type-checks) |
| `npm start` | Serves the production build (run `npm run build` first) |
| `npm run lint` | ESLint |

To use another port, pass it to Next.js: `npm run dev -- -p 3001`.

## Troubleshooting

- **"Cannot reach the API at http://localhost:8000":** the API isn't running, or `NEXT_PUBLIC_API_URL` points to the wrong address.
  - Check `/health-check`.
  - If you changed `.env.local`, restart the dev server.
- **Every action sends you back to the login page:** the API rejects the token. This happens when the token has expired (it lasts one day), you logged out in another tab, or the API's `JWT_SECRET` changed. Log in again.
- **"Collection has no indexed files yet" when asking:** the collection has no file marked Ready. Open **Documents** and add a file, or retry a failed one.
- **The document manager shows "Not found":** the API is older than the document-management endpoints. Update base_rag_api and restart it.
- **Answers fail with an error after the sources appear:** the API couldn't generate the answer. Check its `OLLAMA_API_KEY` and the API's console output. Failed answers aren't saved, so send the question again.

## Adding UI components

shadcn/ui components are copied into `src/components/ui/`. To add one:

```bash
npx shadcn@latest add <component>
```

This project uses the `base-nova` style, built on Base UI rather than Radix. Customise a component with its `render` prop instead of `asChild`.
