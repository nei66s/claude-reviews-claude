# Projects in This Repository

This repository contains **two distinct projects**:

## 1. **Claude Reviews Claude** (Original Project)
📍 **Location**: `/architecture/` and root `/README.md`

**What it is**: A comprehensive architectural analysis where Claude (Anthropic's AI model) reviews and documents the source code of Claude Code (Anthropic's internal coding assistant).

**Contents**:
- 9-part deep-dive into Claude Code architecture
- Chinese translation available
- Analysis of: QueryEngine, Tool System, Coordinator, Plugins, Hooks, Bash Engine, Permission Pipeline, Agent Swarms, Session Persistence

**Status**: Complete documentation series (01-09)

---

## 2. **Chocks** — LLM Agent Server
📍 **Location**: `/agent-ts/`

**What it is**: A production-ready TypeScript server for running Claude 3.5 Sonnet locally with a web UI, designed for small internal teams (2-5 people).

**Status**:
- ✅ **Fase 1** (MVP): Complete
- 🚀 **Fase 2** (Permissions + Hooks): In Progress
- 📋 **Fases 3-6**: Planned

### Chocks Features

| Feature | Status | Details |
|---------|--------|---------|
| Chat interface | ✅ | Real-time streaming, localStorage state |
| File operations | ✅ | Preview, edit, copy, duplicate, delete, move |
| Permissions | ✅ | ask/auto/read_only modes per conversation |
| Workflows | ✅ | Per-chat planning, step tracking, archive |
| Permission Pipeline | 🚀 | 7-step gauntlet (deny → ask → execute → audit) |
| Hook System | 🚀 | 20 event types for extensibility |
| Audit Logging | 🚀 | Track tool executions, denials, approvals |
| Bash Security | 📋 | AST parsing + sandbox (planned Phase 3) |
| Plugins | 📋 | Extensible tools (planned Phase 4) |
| QueryEngine | 📋 | Token budgeting + auto-compaction (Phase 5) |
| Coordinator | 📋 | Multi-agent orchestration (Phase 6) |

### Quick Start (Chocks)

```bash
cd agent-ts
npm install
npm run build
npm run dev
# Open http://localhost:3000
```

### Documentation (Chocks)

- **Overview**: [agent-ts/README.md](agent-ts/README.md)
- **Fase 1 Delivery**: [docs/progress/PHASE_1_COMPLETE.md](docs/progress/PHASE_1_COMPLETE.md)
- **Fase 2 Progress**: [docs/progress/PHASE_2_PROGRESS.md](docs/progress/PHASE_2_PROGRESS.md)
- **Roadmap**: [docs/roadmap/IMPLEMENTATION_ROADMAP.md](docs/roadmap/IMPLEMENTATION_ROADMAP.md)
- **Structure Guide**: [README_STRUCTURE.md](README_STRUCTURE.md)

---

## Which Project Am I Looking For?

### 🔍 "Claude Reviews Claude" (Architectural Analysis)
→ Read the original **[README.md](README.md)** and explore `/architecture/` folder

**Ideal for**:
- Understanding Claude Code internals
- Learning LLM system design patterns
- Reference architecture for building agents

### 🛠️ "Chocks" (Active Development)  
→ Start with **[agent-ts/README.md](agent-ts/README.md)** or [README_STRUCTURE.md](README_STRUCTURE.md)

**Ideal for**:
- Running your own local Claude assistant
- Building on top of Chocks
- Contributing to Phase 2+ features
- Understanding TypeScript + Postgres + Express patterns

---

## Directory Map

```
.
├── README.md                      # Claude Reviews Claude (original)
├── README_STRUCTURE.md            # 👈 Repository organization guide
├── README_PROJECTS.md             # 👈 You are here (this file)
│
├── agent-ts/                      # ⭐ Chocks (active project)
│   ├── src/
│   ├── public/
│   ├── PHASE_1_COMPLETE.md
│   ├── PHASE_2_PROGRESS.md
│   └── README.md
│
├── prototype-ts/                  # Archive (legacy code)
│
├── architecture/                  # Claude Code analysis (01-09)
│   ├── 01-query-engine.md
│   ├── ... files 2-9 ...
│   └── zh-CN/                     # Chinese translations
│
├── docs/
│   ├── roadmap/
│   │   └── IMPLEMENTATION_ROADMAP.md   # Fases 1-6 plan
│   ├── progress/
│   │   ├── PHASE_1_COMPLETE.md
│   │   ├── PHASE_2_PROGRESS.md
│   │   └── PHASE_2_SESSION_1.md
│   └── architecture/              # Symlink to root /architecture/
│
└── .github/
    ├── copilot-instructions.md    # Development preferences
    └── AGENTS.md
```

---

## Contributing

### To Chocks (Recommended)
1. Fork `agent-ts/`
2. Create feature branch
3. Submit PR against `main`

See `agent-ts/NEXT_STEPS.md` for priority features.

### To Architecture Analysis
The original "Claude Reviews Claude" project is complete. Enhancements/corrections welcome via issues.

---

## License

- **Claude Reviews Claude** (analysis docs): See [LICENSE](LICENSE)
- **Chocks** (agent-ts code): Same LICENSE

---

**Last Updated**: 3 Apr 2026  
**Chocks Status**: Fase 1 ✅ | Fase 2 🚀  
**Next Milestone**: 10 Apr 2026 (Phase 2 UI integration)
