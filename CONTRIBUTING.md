# Contributing

## Automatic versioning (recommended)

This repo uses **Release Please** (GitHub Actions) to automatically:

- open a release PR that bumps versions in `package.json` / `package-lock.json`
- update `CHANGELOG.md`
- create tags and GitHub releases when the release PR is merged

It relies on **Conventional Commits** in the commit messages merged to `main`.

## Conventional Commits

Use one of these prefixes:

- `feat:` → minor bump
- `fix:` → patch bump
- `perf:` → patch bump
- `refactor:` / `docs:` / `test:` / `chore:` → no version bump by default

Breaking changes:

- put `!` in the type (example: `feat!: ...`) **or**
- add `BREAKING CHANGE:` in the commit body

Examples:

- `feat: add conversation duplication`
- `fix: prevent postgres pool leaks on restart`
- `feat!: change workflow payload format`

