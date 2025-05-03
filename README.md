# browser-ide

A collaborative in-browser code editor with real-time multi-user editing, sandboxed Docker code execution, and AI-assisted completions via OpenAI streaming.

## Features

- **Monaco Editor** — VS Code's editor engine, in the browser
- **Live Collaboration** — WebSocket-based multi-user editing with cursor presence
- **Sandboxed Execution** — Docker-isolated code runs (JS, TS, Python, Bash)
- **AI Completions** — Streaming GPT-4o mini suggestions with LRU caching
- **Auth + Persistence** — JWT auth, SQLite-backed file and session storage
- **Room Sharing** — Share a URL to invite collaborators

## Prerequisites

- Node.js 20+
- Docker (Desktop or Engine) — must be running
- An OpenAI API key

## Quick Start (Dev)

```bash
# 1. Clone and install
git clone <your-repo>
cd browser-ide
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY and a strong JWT_SECRET

# 3. Build the sandbox Docker image (one-time)
docker build -t browser-ide-sandbox ./docker/sandbox

# 4. Create the SQLite data directory
mkdir -p packages/server/data

# 5. Start dev servers (client + server concurrently)
npm run dev
```

Open http://localhost:5173

## Production (Docker Compose)

```bash
cp .env.example .env
# Edit .env

docker build -t browser-ide-sandbox ./docker/sandbox
docker-compose up --build
```

Open http://localhost:5173

## Project Structure

```
browser-ide/
├── packages/
│   ├── client/                  # React + Vite + Monaco
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── context/
│   │   │   │   └── EditorContext.tsx   # Global IDE state
│   │   │   ├── hooks/
│   │   │   │   ├── useCollaboration.ts # WebSocket collab
│   │   │   │   └── useAICompletions.ts # SSE streaming AI
│   │   │   └── components/
│   │   │       ├── IDELayout.tsx
│   │   │       ├── AuthModal.tsx
│   │   │       ├── FileTree.tsx
│   │   │       ├── EditorTabs.tsx
│   │   │       ├── MonacoEditorPane.tsx
│   │   │       ├── TerminalOutput.tsx
│   │   │       ├── AIPanel.tsx
│   │   │       └── SettingsPanel.tsx
│   └── server/                  # Node.js + Express + WebSockets
│       └── src/
│           ├── index.ts         # Entry point
│           ├── db.ts            # SQLite setup
│           ├── ws/
│           │   └── collab.ts    # WebSocket collaboration server
│           ├── execution/
│           │   └── runner.ts    # Docker sandbox runner
│           └── routes/
│               ├── auth.ts      # Register/login + JWT middleware
│               ├── rooms.ts     # Room + file CRUD
│               ├── execute.ts   # Code execution endpoint
│               └── ai.ts        # AI completions (SSE)
├── docker/
│   └── sandbox/
│       └── Dockerfile           # Isolated execution environment
├── docker-compose.yml
├── package.json                 # npm workspaces root
└── tsconfig.base.json
```

## API Reference

### Auth
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | `{username, password}` | Create account, returns JWT |
| POST | `/api/auth/login` | `{username, password}` | Login, returns JWT |

### Rooms
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/rooms` | Create room with starter files |
| GET | `/api/rooms/:id` | Get room + all files |
| GET | `/api/rooms/:id/files` | List files |
| PUT | `/api/rooms/:id/files/:fileId` | Save file content |

### Execution
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/execute` | `{code, language}` | Run code in Docker sandbox |

Supported languages: `javascript`, `typescript`, `python`, `bash`

### AI
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/ai/complete` | `{code, language, cursorLine, cursorCol}` | SSE stream of completions |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server uptime check |

## WebSocket Protocol

Connect to `ws://localhost:3001/ws`

**Client → Server:**
```json
{ "type": "join",   "roomId": "...", "username": "..." }
{ "type": "edit",   "roomId": "...", "fileId": "...", "delta": {...}, "fullContent": "..." }
{ "type": "cursor", "roomId": "...", "position": { "line": 10, "col": 5 } }
```

**Server → Client:**
```json
{ "type": "connected", "clientId": "..." }
{ "type": "users",     "users": [{ "clientId": "...", "username": "..." }] }
{ "type": "edit",      "fileId": "...", "delta": {...}, "clientId": "..." }
{ "type": "cursor",    "clientId": "...", "username": "...", "position": {...} }
{ "type": "cursor_leave", "clientId": "..." }
```

## Extending

### Add a new language
1. Add to `LANG_CONFIG` in `packages/server/src/execution/runner.ts`
2. Install runtime in `docker/sandbox/Dockerfile`
3. Add icon in `packages/client/src/components/FileTree.tsx`
4. Rebuild the sandbox image: `docker build -t browser-ide-sandbox ./docker/sandbox`

### Swap AI model
Edit `packages/server/src/routes/ai.ts` — change `model: 'gemini-2.0-flash'` to any Gemini model (e.g. `gemini-1.5-pro` for higher quality, `gemini-2.5-flash` if available on your key).

### Persistent rooms
Currently rooms live until the server restarts (SQLite file). For production, mount the SQLite file as a Docker volume or swap `better-sqlite3` for PostgreSQL.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key |
| `JWT_SECRET` | Yes | Secret for signing JWTs (use a long random string) |
| `PORT` | No | Server port (default: 3001) |

## Security Notes

- Docker containers run with `NetworkDisabled: true`, 128MB memory cap, 10s timeout
- JWT tokens expire after 7 days
- All execution and AI routes require a valid JWT
- Never expose `/var/run/docker.sock` publicly — keep the server behind a reverse proxy
