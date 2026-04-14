# Repository Structure

## Top Level

```text
claude-reviews-claude/
|-- app/                     # Current Next.js application
|-- public/                  # Public assets for the Next.js app
|-- agent-ts/                # Legacy or parallel TypeScript agent project
|-- prototype-ts/            # Older prototype kept for reference
|-- architecture/            # Analysis documents
|-- docs/project/            # Project planning, notes, migration docs
|-- scripts/                 # Utility scripts
|-- README.md                # Main analysis entry point
|-- START_HERE.md            # Human-friendly entry point
|-- package.json             # Next.js app package
```

## docs/project

```text
docs/project/
|-- README.md
|-- README_PROJECTS.md
|-- README_STRUCTURE.md
|-- IMPLEMENTATION_ROADMAP.md
|-- CHOKITO_MIGRATION.md
|-- ORGANIZATION.md
|-- progress/
|   |-- PHASE_1_COMPLETE.md
|   |-- PHASE_2_PROGRESS.md
|   `-- PHASE_2_SESSION_1.md
`-- notes/
    |-- NEXT_STEPS.md
    `-- UI_NOTES.md
```

## Working Rule

- Keep entry-point docs in the root.
- Keep support documentation in `docs/project/`.
- Keep runnable app code in `app/`, `public/`, and related config files.
- Keep archived or experimental code in its own folder instead of mixing it into the root.
