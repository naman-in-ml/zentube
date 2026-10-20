import { app, net } from "electron";
import { chmodSync, existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const isWin = process.platform === "win32";

export function getBinaryPaths(): { ytDlpPath: string; ffmpegPath: string } {
  // 1. Env override
  let ytDlpPath = process.env.ZENTUBE_YTDLP_BIN;
  let ffmpegPath = process.env.ZENTUBE_FFMPEG_BIN;

  const ytBinaryName = isWin ? "yt-dlp.exe" : "yt-dlp";
  const ffmpegBinaryName = isWin ? "ffmpeg.exe" : "ffmpeg";

  // 2. Check updated binary in userData
  if (!ytDlpPath) {
    try {
      const userDataBin = path.join(app.getPath("userData"), "bin", ytBinaryName);
      if (existsSync(userDataBin)) {
        ytDlpPath = userDataBin;
      }
    } catch {
      // app.getPath might fail in early bootstrap or tests
    }
  }

  // 3. Check bundled resources (production)
  if (!ytDlpPath && process.resourcesPath) {
    const bundledYt = path.join(process.resourcesPath, "bin", ytBinaryName);
    if (existsSync(bundledYt)) {
      ytDlpPath = bundledYt;
    }
  }

  if (!ffmpegPath && process.resourcesPath) {
    const bundledFfmpeg = path.join(process.resourcesPath, "bin", ffmpegBinaryName);
    if (existsSync(bundledFfmpeg)) {
      ffmpegPath = bundledFfmpeg;
    }
  }

  // 4. Check local project directory (development)
  try {
    const appDir = app.getAppPath();
    const devYt = path.join(appDir, "resources", "bin", ytBinaryName);
    if (!ytDlpPath && existsSync(devYt)) {
      ytDlpPath = devYt;
    }

    const devFfmpeg = path.join(appDir, "resources", "bin", ffmpegBinaryName);
    if (!ffmpegPath && existsSync(devFfmpeg)) {
      ffmpegPath = devFfmpeg;
    }
  } catch {
    // ignore
  }

  // 5. Fallback probing for macOS / Linux standard locations if PATH is minimal in GUI
  if (!isWin) {
    const commonYtPaths = ["/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp", "/usr/bin/yt-dlp"];
    if (!ytDlpPath) {
      for (const p of commonYtPaths) {
        if (existsSync(p)) {
          ytDlpPath = p;
          break;
        }
      }
    }

    const commonFfmpegPaths = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"];
    if (!ffmpegPath) {
      for (const p of commonFfmpegPaths) {
        if (existsSync(p)) {
          ffmpegPath = p;
          break;
        }
      }
    }
  }

  // 6. Final fallback: rely on system PATH invocation
  return {
    ytDlpPath: ytDlpPath ?? ytBinaryName,
    ffmpegPath: ffmpegPath ?? ffmpegBinaryName
  };
}

/**
 * Spawns yt-dlp with resolved binary and environment
 */
export function getEnhancedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const { ffmpegPath } = getBinaryPaths();
  if (ffmpegPath && path.isAbsolute(ffmpegPath)) {
    const ffmpegDir = path.dirname(ffmpegPath);
    env.PATH = env.PATH ? `${ffmpegDir}${path.delimiter}${env.PATH}` : ffmpegDir;
  }
  return env;
}

/**
 * Checks tools availability and versions
 */
export function checkResolvedTools(): {
  ytDlp: boolean;
  ytDlpVersion: string | null;
  ytDlpPath: string;
  ffmpeg: boolean;
  ffmpegPath: string;
} {
  const { ytDlpPath, ffmpegPath } = getBinaryPaths();
  const env = getEnhancedEnv();

  const ytDlp = spawnSync(ytDlpPath, ["--version"], { timeout: 10000, encoding: "utf8", env });
  const ffmpeg = spawnSync(ffmpegPath, ["-version"], { timeout: 10000, encoding: "utf8", env });

  return {
    ytDlp: ytDlp.status === 0,
    ytDlpVersion: ytDlp.status === 0 ? ytDlp.stdout.trim().split("\n")[0] : null,
    ytDlpPath,
    ffmpeg: ffmpeg.status === 0,
    ffmpegPath
  };
}

/**
 * Background silent updater for yt-dlp.
 * Fetches latest release binary from GitHub releases and drops it into userData/bin/.
 */
export function initBackgroundYtDlpUpdater(): void {
  // Wait 10 seconds after app startup so startup remains instantaneous
  setTimeout(() => {
    void runSilentYtDlpUpdate().catch((err) => {
      console.warn("[yt-dlp-updater] Silent update check skipped/failed:", err.message);
    });
  }, 10_000);
}

async function runSilentYtDlpUpdate(): Promise<void> {
  const currentTools = checkResolvedTools();
  const currentVersion = currentTools.ytDlpVersion?.trim();

  const releaseRes = await fetch("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest", {
    headers: { "User-Agent": "Zentube-App" }
  });

  if (!releaseRes.ok) return;

  const data = (await releaseRes.json()) as { tag_name?: string; assets?: Array<{ name: string; browser_download_url: string }> };
  const latestTag = data.tag_name?.trim();
  if (!latestTag || latestTag === currentVersion) {
    // Already up to date
    return;
  }

  // Find asset for current platform
  let targetAssetName = "yt-dlp";
  if (isWin) {
    targetAssetName = "yt-dlp.exe";
  } else if (process.platform === "darwin") {
    targetAssetName = "yt-dlp_macos";
  } else {
    targetAssetName = "yt-dlp_linux";
  }

  const asset = data.assets?.find((a) => a.name === targetAssetName) ?? data.assets?.find((a) => a.name === (isWin ? "yt-dlp.exe" : "yt-dlp"));
  if (!asset?.browser_download_url) return;

  const userBinDir = path.join(app.getPath("userData"), "bin");
  mkdirSync(userBinDir, { recursive: true });

  const finalTarget = path.join(userBinDir, isWin ? "yt-dlp.exe" : "yt-dlp");
  const tempTarget = `${finalTarget}.tmp-${Date.now()}`;

  const downloadRes = await fetch(asset.browser_download_url, {
    headers: { "User-Agent": "Zentube-App" }
  });

  if (!downloadRes.ok) return;

  const arrayBuffer = await downloadRes.arrayBuffer();
  writeFileSync(tempTarget, Buffer.from(arrayBuffer));

  if (!isWin) {
    chmodSync(tempTarget, 0o755);
  }

  renameSync(tempTarget, finalTarget);
  console.log(`[yt-dlp-updater] Successfully updated yt-dlp from ${currentVersion} to ${latestTag}`);
}
