# Camera Workflow (Raycast Extension)

Camera Workflow is a Raycast extension that wraps [`GoMediaMinify`](https://github.com/Azilone/GoMediaMinify) and evolves into a complete toolkit for camera/media workflows.

## Vision

Turn repetitive camera management tasks into fast, reliable, one-command workflows.

## Rules

- English only (UI, docs, command labels, commit messages when possible).
- Keep workflows safe by default (`dry-run` first whenever relevant).
- Never overwrite originals unless explicitly requested.
- Every major change should be documented in this README roadmap.
- Prefer small, iterative releases over large rewrites.

## Core Principles

- Idempotent by design: rerunning the same workflow should not duplicate or reprocess completed work.
- Safe defaults first: preview before write operations whenever possible.
- Traceability: each run should produce clear logs and summaries.
- Practical 80/20 delivery: prioritize high-impact workflows before advanced automation.

## Current Scope (V1)

- 80/20 focus: ship a practical MVP first, then iterate.
- Run GoMediaMinify conversion from a Raycast form.
- Source detection + manual source picker.
- Local destination folder only (cloud targets later).
- Configure core options (photo format, video codec, jobs, dry-run).

## TODO

- [x] Add dependency diagnostics command (`media-converter`, `ffmpeg`, `ffprobe`, `magick`).
- [x] Add conversion presets (Google Photos, High Quality, Max Compression).
- [x] Add progress/log output view in Raycast.
- [x] Add safer input validation (existing paths, write permissions).
- [x] Add post-run summary (files processed, saved space, duration).
- [x] Add command to open latest output folder.
- [ ] Add optional SD-card auto-detection helper command.
- [ ] Add destination profile templates (Local-only in V1, cloud in V2).

## Roadmap

### Milestone 1 — Solid Foundation
- Stabilize the conversion command UX.
- Add dependency checks and actionable errors.
- Add presets and persistent preferences.

### Milestone 2 — Workflow Suite
- SD Card Ingest workflow (copy + organize by date).
- Backup workflow (local/NAS target profiles).
- Duplicate detection workflow.

### Milestone 3 — Power Features
- Batch profiles (save/load named workflow configs).
- Multi-step workflow chaining.
- Optional notifications and post-processing hooks.

## Development

```bash
npm install
npm run dev
```

## Requirements

- Raycast
- `media-converter` binary available in PATH
- `ffmpeg`, `ffprobe`, and ImageMagick (`magick`)
