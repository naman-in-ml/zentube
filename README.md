# Zentube

> **Local-first personal learning operating system built around YouTube.**

Zentube transforms YouTube playlists and educational videos into durable, structured local courses. It allows you to download playlists with granular quality options, organizes videos into sequential courses with progress tracking, logs every watch session, and provides a distraction-free offline desktop player.

---

## Objective

The goal of Zentube is to turn online video content into an owned, goal-driven personal learning environment:
- **Offline First**: Media, metadata, and watch records reside entirely on your machine in SQLite.
- **Playlist & Course Ingestion**: Paste any YouTube playlist or video link to download with quality selection (1080p, 720p, 480p, Best, or Audio-only).
- **Structured Learning**: Playlists are automatically organized as courses with track ordering and completion progress.
- **Watch History & Activity Log**: Automatically tracks playback intervals ("watched from timestamp X to Y"), enabling instant session resume.
- **Distraction-Free**: No recommendation algorithms, comments, or ads.

---

## Tech Stack

- **Desktop Shell**: Electron, TypeScript, Node.js
- **Database**: SQLite (`better-sqlite3` in WAL mode)
- **Ingestion**: `yt-dlp` + `ffmpeg` for stream resolution, quality merging, and thumbnail extraction
- **Frontend**: React 19, TypeScript, Lucide Icons, Vite
- **Updates**: In-app self-updating via `electron-updater` and GitHub Releases

---

## Getting Started

### Prerequisites

Ensure you have:
- [Node.js](https://nodejs.org/) (v18+)
- [ffmpeg](https://ffmpeg.org/) (for video/audio stream merging)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) in your system PATH

### Development

```bash
npm install
npm run dev
```

### Run Tests

```bash
npm test
```

### Package Application

```bash
npm run build
npm run dist
```
The packaged Linux `.AppImage` will be generated in the `release/` directory.

---

## License

MIT
