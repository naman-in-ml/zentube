# Zentube

> **Local-first personal learning operating system built around YouTube.**

Zentube turns YouTube playlists, lectures, and educational content into an owned, distraction-free desktop learning environment. Download videos or full playlists with granular quality options, strip sponsors and promotions automatically, watch with advanced playback controls (up to 4x speed, CC, PiP, Audio-only), and track your learning progress offline.

---

## ✨ Features at a Glance

### 📥 Smart Ingestion & Playlist Explorer
- **Playlist Explorer Drawer**: Paste any YouTube playlist link to inspect every video, title, and duration before downloading.
- **Granular Quality Selection**: Download in 1080p, 720p, 480p, Best available, or Audio-only format.
- **Batch Downloads**: Queue single tracks or click *Download All* to ingest complete playlists in one click.
- **SponsorBlock Integration**: Automatically skips sponsored segments, self-promos, and interaction reminders directly during acquisition.
- **Real-Time Sidebar Badge**: Live indicator tracks active and queued downloads in real time.

### 📺 Advanced Distraction-Free Player
- **Extended Speed Controls**: Playback speed from `0.25x` up to `4.0x` with instant shortcut cycling.
- **Closed Captions (CC)**: Automatic sibling subtitle detection (`.vtt` / `.srt`) with one-click toggles and persistent preferences.
- **Picture-in-Picture & Mini-Player**: Native PiP with automatic fallback to a docked in-app floating mini-player.
- **Audio-Only Mode (`A`)**: Cuts GPU/CPU video decoding for maximum battery efficiency; presents album artwork with an animated equalizer.
- **Rich Keyboard Navigation**: Standard hotkeys for seek (`J`/`L`, arrows), fullscreen (`F`), captions (`C`), PiP (`P`), and audio mode (`A`).

### 📚 Course Library & Watch Logs
- **Structured Courses**: Groups downloaded playlists into organized, sequential courses with track progression.
- **Watch Session Logging**: Records exact playback intervals (`watched from timestamp X to Y`) for resume capability and study tracking.
- **Local SQLite Storage**: Fast, offline metadata and history stored entirely on your device via WAL-mode SQLite.

### ⚡ Queue & Library Management
- **Queue Control**: Pause, resume, retry, or cancel ongoing download tasks.
- **Video File Deletion**: Delete downloaded media directly from the UI to reclaim disk space with synchronized database cleanup.
- **Zero Distractions**: No algorithmic recommendations, comment sections, or banner ads.

---

## 🛠️ Tech Stack

- **Desktop Shell**: Electron, TypeScript, Node.js
- **Frontend**: React 19, Vite, Tailwind-style dark design system, Lucide Icons
- **Database**: SQLite (`better-sqlite3` in WAL mode)
- **Ingestion Engine**: `yt-dlp` + `ffmpeg` + SponsorBlock API
- **Release & Updates**: GitHub Actions CI/CD with in-app `electron-updater`

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [ffmpeg](https://ffmpeg.org/) (for video & audio stream merging)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and in your system `PATH`

### Development
```bash
npm install
npm run dev
```

### Run Tests
```bash
npm test
```

### Build & Package
```bash
npm run build
npm run dist
```
Generates a portable Linux `.AppImage` in the `release/` directory.

---

## 📄 License
MIT
