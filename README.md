# Caméra Workflow (Raycast Extension)

Caméra Workflow est une extension Raycast pour piloter [`GoMediaMinify`](https://github.com/Azilone/GoMediaMinify) et, à terme, centraliser plusieurs workflows photo/vidéo.

## Planned features

- Launch conversion with form inputs (source, destination, codec, quality)
- Quick presets (Google Photos, Max Quality, Dry Run)
- Dependency checks (`ffmpeg`, `ffprobe`, `magick`, `media-converter`)
- Live logs + notifications

## Local dev

```bash
npm install
npm run dev
```

## Requirements

- Raycast
- `media-converter` binary installed and available in PATH
- `ffmpeg`, `ffprobe`, `ImageMagick`
