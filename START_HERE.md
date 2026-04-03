# 🚀 START HERE

This repository contains **two projects**. Choose which one you want to explore:

---

## 📖 1. **Claude Reviews Claude** — Architecture Analysis
**What**: A complete breakdown of Claude Code's internal architecture, written by Claude itself.

👉 **[Read the Analysis →](README.md)**

**Includes**:
- 9-part architectural series (QueryEngine, Tools, Coordinator, Plugins, Hooks, Bash, Permissions, Swarms, Sessions)
- Chinese translations available
- ~50K lines of documentation

**Best for**: Learning how LLM assistants work internally.

---

## 🛠️ 2. **Chocks** — Production LLM Server (Active Development)
**What**: A ready-to-deploy TypeScript agent server with web UI. Run Claude locally for your team.

### Quick Start

```bash
cd agent-ts
npm install
npm run build
npm run dev
# Open http://localhost:3000
```

### What Works
- ✅ **Chat**: Real-time streaming responses
- ✅ **Files**: Preview, edit, copy, rename, delete
- ✅ **Permissions**: Ask/auto/read_only modes
- ✅ **Workflows**: Per-chat planning & tracking
- 🚀 **Permissions Pipeline**: 7-step authorization (Phase 2)
- 🚀 **Hooks**: 20 event types for extensibility

### Documentation
- **[Project README](agent-ts/README.md)** — API, tools, configuration
- **[Structure Guide](README_STRUCTURE.md)** — Directory organization
- **[Phase 1 Complete](docs/progress/PHASE_1_COMPLETE.md)** — What's built
- **[Phase 2 Progress](docs/progress/PHASE_2_PROGRESS.md)** — What's in progress
- **[Roadmap](docs/roadmap/IMPLEMENTATION_ROADMAP.md)** — Phases 1-6 plan

---

## 📊 Project Status

| Project | Status | Start | Go To |
|---------|--------|-------|-------|
| Claude Reviews Claude | ✅ Complete | Read | [README.md](README.md) |
| Chocks MVP | ✅ Complete | Try it | [agent-ts/](agent-ts/) |
| Chocks Phase 2 | 🚀 In progress | Contribute | [agent-ts/](agent-ts/) |

---

## 🎯 Navigation

### For Architects & Researchers
→ [Claude Reviews Claude](README.md) — Deep dive into LLM system design

### For Developers & Teams  
→ [Chocks Project](agent-ts/) — Deploy and extend your own assistant

### For Repository Navigation
→ [README_STRUCTURE.md](README_STRUCTURE.md) — Full directory guide
→ [README_PROJECTS.md](README_PROJECTS.md) — Project comparison

---

## 💡 Next Steps

### Option 1: Read Architecture Analysis
Start with [01-query-engine.md](architecture/01-query-engine.md) and follow the series.

### Option 2: Set Up Chocks
```bash
cd agent-ts
cp .env.example .env
# Edit .env with your OPENAI_API_KEY and DATABASE_URL
npm install
npm run dev
```

### Option 3: Contribute to Phase 2
- Review [PHASE_2_PROGRESS.md](docs/progress/PHASE_2_PROGRESS.md)
- Check NEXT_STEPS in [agent-ts/NEXT_STEPS.md](agent-ts/NEXT_STEPS.md)
- See [docs/roadmap/IMPLEMENTATION_ROADMAP.md](docs/roadmap/IMPLEMENTATION_ROADMAP.md) for full plan

---

## ❓ Questions?

- **About the architecture analysis?** → See [README.md](README.md)
- **About Chocks setup?** → See [agent-ts/README.md](agent-ts/README.md)
- **About development?** → See [agent-ts/NEXT_STEPS.md](agent-ts/NEXT_STEPS.md)
- **About what's built vs. planned?** → See roadmap files

---

**Last Updated**: 3 Apr 2026 | Chocks Phase 1 ✅ | Phase 2 🚀
