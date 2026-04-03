# Chocks — Repository Structure

## Overview

Project: **Chocks** — TypeScript LLM agent server with local-first web UI, designed for internal team use (2-5 people).

**Status**: Fase 1 (MVP) ✅ Complete | Fase 2 (Permissions + Hooks) 🚀 In Progress

---

## Directory Structure

```
claude-reviews-claude/
├── agent-ts/                    # ⭐ MAIN PROJECT (active development)
│   ├── src/
│   │   ├── server.ts            # Express server + API routes
│   │   ├── llm.ts               # LLM loop + streaming
│   │   ├── tools.ts             # Tool definitions + execution
│   │   ├── store.ts             # Database layer (Postgres)
│   │   ├── db.ts                # Database initialization
│   │   ├── moderation.ts        # Content moderation
│   │   ├── hooks/               # Hook system (Fase 2)
│   │   ├── permissions/         # Permission pipeline (Fase 2)
│   │   └── audit/               # Audit logging (Fase 2)
│   ├── public/
│   │   └── index.html           # Single-page UI (~5K lines)
│   ├── dist/                    # Built JavaScript (generated)
│   ├── PHASE_1_COMPLETE.md      # Fase 1 delivery notes
│   ├── PHASE_2_PROGRESS.md      # Fase 2 status + architecture
│   ├── PHASE_2_SESSION_1.md     # Week 1 checkpoint
│   ├── NEXT_STEPS.md            # Detailed feature roadmap
│   ├── README.md                # Project-specific docs
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── prototype-ts/                # 🗃️ Archive (old prototype)
│   └── [legacy code]
│
├── docs/                        # 📚 Documentation Hub
│   ├── roadmap/
│   │   └── IMPLEMENTATION_ROADMAP.md    # 6-phase plan (Fases 1-6)
│   ├── progress/                        # Session checkpoints
│   │   ├── PHASE_1_COMPLETE.md
│   │   ├── PHASE_2_PROGRESS.md
│   │   └── PHASE_2_SESSION_1.md
│   └── architecture/                    # Architecture docs
│       ├── 01-query-engine.md
│       ├── 02-tool-system.md
│       ├── 03-coordinator.md
│       ├── ... (01-09)
│       └── zh-CN/                       # Chinese translations
│
├── .github/
│   ├── copilot-instructions.md  # Agent preferences
│   └── AGENTS.md                # Custom agents (if any)
│
├── .env                         # Local config (secrets)
├── .gitignore
├── LICENSE
├── README.md                    # 👈 You are here (repo overview)
└── DISCLAIMER.md                # Legal/usage terms
```

---

## Quick Start

```bash
cd agent-ts
npm install
npm run build
npm run dev
# Server on http://localhost:3000
```

---

## Key Files by Purpose

### Running Chocks
- **Main**: `agent-ts/src/server.ts` (API + startup)
- **UI**: `agent-ts/public/index.html` (entire frontend)
- **Tools**: `agent-ts/src/tools.ts` (20+ built-in tools)
- **LLM**: `agent-ts/src/llm.ts` (chat loop + streaming)

### Configuration & Secrets
- **Environment**: `agent-ts/.env` (OPENAI_API_KEY, DATABASE_URL, etc.)
- **Build**: `agent-ts/tsconfig.json`, `package.json`

### Documentation
- **Roadmap**: `docs/roadmap/IMPLEMENTATION_ROADMAP.md` (6-phase plan)
- **Progress**: `docs/progress/PHASE_*.md` (delivery notes + checkpoints)
- **Architecture**: `docs/architecture/01-09-*.md` (design docs)

### Features & Design
- **Fase 1**: File preview, actions, workflows, permissions UI ✅
- **Fase 2**: Permission pipeline, hook system, audit logging 🚀
- **Fase 3-6**: Bash security, plugins, queryengine, coordinator (planned)

---

## Development Workflow

### Build & Test
```bash
cd agent-ts
npm run build           # Compile TypeScript
npm run dev            # Start with file watching
```

### Code Structure
- **Backend**: `src/*.ts` (server, tools, LLM, storage)
- **Frontend**: `public/index.html` (all UI code, ~5K lines)
- **Permissions**: `src/permissions/` + `src/hooks/` + `src/audit/`

### Type Safety
- 100% TypeScript
- No external UI frameworks (vanilla JS + HTML)
- Postgres for persistence

---

## Fase Status

| Phase | Goal | Status | Files |
|-------|------|--------|-------|
| **1** | MVP chatbot | ✅ Complete | `PHASE_1_COMPLETE.md` |
| **2** | Permissions + hooks | 🚀 In Progress | `PHASE_2_PROGRESS.md` |
| **3** | Bash security | 📋 Planned | `IMPLEMENTATION_ROADMAP.md` |
| **4** | Plugin system | 📋 Planned | ↑ |
| **5** | QueryEngine | 📋 Planned | ↑ |
| **6** | Coordinator | 🔮 Future | ↑ |

---

## Architecture Highlights

### Fase 1: MVP
- Single-page HTML/JS frontend
- Express.js backend with streaming chat
- Postgres for persistence
- 20+ local tools (file ops, bash, web, workflows, todos)
- Permission modes: ask/auto/read_only

### Fase 2: Permission Pipeline (Active)
```
Request → [Deny rules] → [Ask rules] → [Content checks] 
        → [Safety checks] → [Audit log] → Execute
```
- Hook system: 20 event types
- Audit trail: tool executions, denials, approvals
- Default rules: file_delete, bash_exec, web_fetch

### Fases 3-6: Planned
See `docs/roadmap/IMPLEMENTATION_ROADMAP.md` for detailed timeline.

---

## Key Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/chat/stream` | Chat with streaming responses |
| POST | `/tools/run` | Execute a tool (with permission check) |
| GET | `/tools/status` | List enabled tools |
| GET | `/audit/recent` | Query audit log |
| GET | `/audit/stats` | Audit statistics |
| GET/PUT/PATCH/DELETE | `/conversations/*` | Conversation CRUD |
| GET | `/workflow/status` | Active workflow for chat |
| GET | `/files/raw` | File preview (inline) |

---

## Environment Setup

Required variables (`agent-ts/.env`):
```bash
OPENAI_API_KEY=sk-...              # OpenAI chat/moderation
DATABASE_URL=postgresql://...       # Postgres connection
ALLOW_BASH_EXEC=false              # Enable shell execution
ALLOW_WEB_FETCH=false              # Enable web requests
MAX_FILE_BYTES=524288              # File size limit (512KB)
WEB_FETCH_ALLOWLIST=github.com     # Allowed domains
```

---

## References

- **Roadmap**: [docs/roadmap/IMPLEMENTATION_ROADMAP.md](./docs/roadmap/IMPLEMENTATION_ROADMAP.md)
- **Progress**: [docs/progress/](./docs/progress/) — checkpoint files
- **Architecture**: [docs/architecture/](./docs/architecture/) — deep dive docs
- **Project README**: [agent-ts/README.md](./agent-ts/README.md)

---

**Last Updated**: 3 Apr 2026
**Next Checkpoint**: 6-10 Apr 2026 (Fase 2b: UI integration + database persistence)
