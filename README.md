# GoMediaMinify Raycast Extension

Raycast extension to run [`GoMediaMinify`](https://github.com/Azilone/GoMediaMinify) from a friendly UI.

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
