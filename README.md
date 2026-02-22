# Camera Workflow (Raycast Extension)

**Camera Workflow helps you prepare your camera library for cloud backup**: shrink file size, organize media by date, and keep originals safe.

Built on top of [`GoMediaMinify`](https://github.com/Azilone/GoMediaMinify).

## Product Positioning

- **What it is:** a backup-preparation toolkit for personal photo/video libraries.
- **What it is not:** a professional RAW archival/pixel-perfect workflow.
- **Primary outcome:** a lighter, cleaner, cloud-ready media library (Google Photos first).

## Core Promise

> Prepare your camera library for cloud backup: shrink files, organize by date, keep originals safe.

## Terminology (Copywriting Rules)

Use these terms consistently across UI and docs:

- **Prepare** (not "convert" in user-facing copy)
- **Prepared Library** (not "output")
- **Backup Report** (not "run summary")
- **Space Reduction** (not "compression" in user-facing copy)
- **Backup Preparation Run** (not generic "run")

## Rules

- English only (UI, docs, command labels, commit messages when possible).
- Safe defaults first (`dry-run` enabled by default).
- Never overwrite originals unless explicitly requested.
- Keep naming user-centric and outcome-oriented.
- Every major UX/copy decision must be documented here.

## Core Principles

- Idempotent by design: rerunning should never duplicate or reprocess completed work.
- Safe defaults first: preview before write operations whenever possible.
- Traceability: each run should produce clear logs and report metrics.
- Practical 80/20 delivery: prioritize high-impact workflows before advanced automation.

## Current Scope (V1)

- 80/20 focus: ship a practical MVP first, then iterate.
- Prepare media via GoMediaMinify from a Raycast form.
- Source detection + manual source picker.
- Local destination folder only (cloud targets later).
- Configure core options (preset, codec/format, quality, jobs, dry-run).
- Show live process output and a backup report.

## Commands (User-Facing)

- **Prepare Library for Backup**
- **Check System Setup**
- **View Last Backup Report**
- **Open Prepared Library**

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
- Stabilize "Prepare Library for Backup" UX.
- Add setup checks with actionable recovery guidance.
- Keep presets simple and useful for non-technical users.

### Milestone 2 — Workflow Suite
- SD Card ingest workflow (copy + organize by date).
- Backup workflow (local/NAS profile templates).
- Duplicate detection workflow.

### Milestone 3 — Power Features
- Batch profiles (save/load named workflow configs).
- Multi-step workflow chaining.
- Optional cloud export integrations.

## Quick Handoff (for any new contributor)

### Context
- Project: **Camera Workflow** (Raycast extension)
- Goal: make media libraries cloud-ready (smaller files + clean date-based structure + safe originals)
- Engine: uses `media-converter` from GoMediaMinify

### Current Status
- Core V1 commands are implemented and renamed for end-users.
- Focus remains: local-first workflow, safe defaults, idempotent behavior.

### Continue Development
1. Pick one item from TODO.
2. Implement with user-facing naming (Prepare / Prepared Library / Backup Report).
3. Keep `dry-run` and safety checks as default behavior.
4. Update this README if UX, naming, or scope changes.

### Test on macOS (simple)
1. Install dependencies:
   - Raycast
   - `media-converter` in PATH
   - `ffmpeg`, `ffprobe`, `magick`
2. In repo:
   ```bash
   npm install --include=dev
   npm run dev
   ```
3. In Raycast, run commands in this order:
   - **Check System Setup**
   - **Prepare Library for Backup** (start with dry-run)
   - **View Last Backup Report**
   - **Open Prepared Library**

### Done Criteria (before commit)
- Command works end-to-end on Mac.
- Copy is clear for non-technical users.
- No regression on existing commands.
- README updated if behavior changed.

## Development

```bash
npm install --include=dev
npm run dev
```

## Requirements

- Raycast (macOS)
- `media-converter` binary available in PATH
- `ffmpeg`, `ffprobe`, and ImageMagick (`magick`)
