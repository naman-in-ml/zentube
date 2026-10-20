# Zentube

> **Local-first personal learning operating system built around YouTube.**

Zentube turns YouTube playlists, lectures, and educational content into an owned, distraction-free desktop learning environment. Download videos or full playlists with granular quality options, strip sponsors and promotions automatically, watch with advanced playback controls (up to 4x speed, CC, PiP, Audio-only), track your learning progress offline, and organize your studies into actionable Goals.

Available for **macOS**, **Windows**, and **Linux** with self-contained, auto-updating downloader tools.

---

## 💾 Downloads

Download the latest release for your platform from [GitHub Releases](https://github.com/naman-in-ml/zentube/releases/latest):

| Platform | Format | Architecture | Download |
|---|---|---|---|
| **macOS** | DMG Installer / ZIP | Apple Silicon (`arm64`) & Intel (`x64`) | [Download .dmg](https://github.com/naman-in-ml/zentube/releases/latest) |
| **Windows** | Setup Installer / Standalone Portable | 64-bit (`x64`) | [Download .exe](https://github.com/naman-in-ml/zentube/releases/latest) |
| **Linux** | AppImage / Debian Package | 64-bit (`x64`) | [Download .AppImage / .deb](https://github.com/naman-in-ml/zentube/releases/latest) |

> [!NOTE]
> **First-Time macOS Installation (Apple Gatekeeper Notice)**:  
> Because Zentube is a community open-source project without a paid Apple Developer certificate (\$99/yr), macOS Gatekeeper blocks downloaded apps by default with the message *"Apple could not verify Zentube.app..."*.  
> To open it on macOS, run this single terminal command:
> ```bash
> xattr -cr /Applications/Zentube.app
> ```
> Or go to **System Settings** → **Privacy & Security** → scroll to **Security** → click **Open Anyway**.

---

## ✨ Features at a Glance

### 🎯 Goals & Learning Dashboard
- **Continue Learning Hero Card**: Instantly resumes your most recent in-progress video with 1-click playback, timestamp display, and visual progress tracking.
- **Up Next Sequential Recommendations**: Dynamically identifies the next logical lesson from your active goal or course—no algorithmic rabbit holes.
- **Personal Goal Tracks**: Group playlists (e.g. "Full-Stack Development", "System Design") and standalone videos into structured targets with completion percentages.
- **Study Pulse Metrics**: Tracks minutes studied today, 7-day focus time, completed lessons, and total offline library volume.
- **Contextual Assignment**: Add courses or videos directly to goals from playlist cards with a single click.

### 📥 Smart Ingestion & Playlist Explorer
- **Playlist Explorer Drawer**: Paste any YouTube playlist link to inspect every video, title, and duration before downloading.
- **Granular Quality Selection**: Download in 1080p, 720p, 480p, Best available, or Audio-only format.
- **Batch Downloads**: Queue single tracks or click *Download All* to ingest complete playlists in one click.
- **SponsorBlock Integration**: Automatically skips sponsored segments, self-promos, and interaction reminders directly during acquisition.
- **Bundled & Auto-Updating Engine**: Bundles `yt-dlp` and `ffmpeg` out of the box with silent background updates so YouTube format changes never break downloads.

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
- **Ingestion Engine**: Bundled `yt-dlp` + static `ffmpeg` + SponsorBlock API + background auto-updater
- **Release & Updates**: Multi-platform matrix CI/CD (macOS, Windows, Linux) with in-app `electron-updater`

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)

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
Generates platform-native installers in the `release/` directory.

---

## 📄 License
MIT
