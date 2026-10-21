import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";

const targetPlatform = process.argv[2] || process.platform;
const targetArch = process.argv[3] || process.arch;

const resourcesBinDir = path.resolve("resources", "bin");
if (!fs.existsSync(resourcesBinDir)) {
  fs.mkdirSync(resourcesBinDir, { recursive: true });
}

console.log(`[fetch-binaries] Fetching binaries for platform: ${targetPlatform}, arch: ${targetArch}`);

const isWin = targetPlatform === "win32";

// 1. Resolve yt-dlp URL
let ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
let ytDlpFilename = isWin ? "yt-dlp.exe" : "yt-dlp";

if (isWin) {
  ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
} else if (targetPlatform === "darwin") {
  // Universal macOS binary (x86_64 + arm64)
  ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
} else if (targetPlatform === "linux") {
  ytDlpUrl = targetArch === "arm64"
    ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64"
    : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
}

// 2. Resolve ffmpeg URL (from eugeneware/ffmpeg-static b6.1.1)
const ffmpegVersion = "b6.1.1";
let ffmpegAssetKey = `${targetPlatform}-${targetArch}`;
if (targetPlatform === "darwin" && targetArch !== "arm64") {
  ffmpegAssetKey = "darwin-x64";
} else if (targetPlatform === "win32") {
  ffmpegAssetKey = "win32-x64";
} else if (targetPlatform === "linux" && targetArch !== "arm64") {
  ffmpegAssetKey = "linux-x64";
}

const ffmpegUrl = `https://github.com/eugeneware/ffmpeg-static/releases/download/${ffmpegVersion}/ffmpeg-${ffmpegAssetKey}.gz`;
const ffmpegFilename = isWin ? "ffmpeg.exe" : "ffmpeg";

async function downloadFile(url, destPath, isGzip = false) {
  console.log(`Downloading ${url} -> ${destPath}...`);
  const res = await fetch(url, { headers: { "User-Agent": "Zentube-Build" } });
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  const fileStream = fs.createWriteStream(destPath);
  if (isGzip) {
    const gunzip = zlib.createGunzip();
    // @ts-ignore
    await pipeline(res.body, gunzip, fileStream);
  } else {
    // @ts-ignore
    await pipeline(res.body, fileStream);
  }

  if (!isWin) {
    fs.chmodSync(destPath, 0o755);
  }
  console.log(`Successfully saved ${path.basename(destPath)}`);
}

async function main() {
  const ytDlpDest = path.join(resourcesBinDir, ytDlpFilename);
  const ffmpegDest = path.join(resourcesBinDir, ffmpegFilename);

  // Download yt-dlp
  if (!fs.existsSync(ytDlpDest) || process.env.FORCE_FETCH === "1") {
    await downloadFile(ytDlpUrl, ytDlpDest, false);
  } else {
    console.log(`yt-dlp already exists at ${ytDlpDest}, skipping (use FORCE_FETCH=1 to overwrite).`);
  }

  // Download ffmpeg
  if (!fs.existsSync(ffmpegDest) || process.env.FORCE_FETCH === "1") {
    await downloadFile(ffmpegUrl, ffmpegDest, true);
  } else {
    console.log(`ffmpeg already exists at ${ffmpegDest}, skipping (use FORCE_FETCH=1 to overwrite).`);
  }

  console.log("[fetch-binaries] Binaries ready in resources/bin!");
}

main().catch((err) => {
  console.error("[fetch-binaries] Error:", err);
  process.exit(1);
});
