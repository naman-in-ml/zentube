import { Minus, Plus, Trash2, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatBytes, formatDuration } from "../../lib/format";

type Props = {
  item: MediaItem | null;
  initialSeek?: number | null;
  onClose: () => void;
  onDelete?: (item: MediaItem) => void;
};

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];

export function PlayerOverlay({ item, initialSeek, onClose, onDelete }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const itemRef = useRef<MediaItem | null>(null);
  const lastSavedBucket = useRef(-1);
  const sessionStartRef = useRef<{ time: number; startedAt: string } | null>(null);
  itemRef.current = item;

  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("zentube_speed");
      const parsed = saved ? parseFloat(saved) : 1;
      return Number.isFinite(parsed) && parsed >= 0.25 && parsed <= 4 ? parsed : 1;
    } catch {
      return 1;
    }
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 1200);
  }

  function applySpeed(newRate: number) {
    const clamped = Math.round(Math.min(4.0, Math.max(0.25, newRate)) * 100) / 100;
    setPlaybackRate(clamped);
    try {
      localStorage.setItem("zentube_speed", clamped.toString());
    } catch {
      // ignore
    }
    if (videoRef.current) {
      videoRef.current.playbackRate = clamped;
    }
    showToast(`⚡ ${clamped}× Speed`);
  }

  // Keyboard controls
  useEffect(() => {
    if (!item) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "[" || (event.shiftKey && event.key === "<")) {
        event.preventDefault();
        applySpeed(playbackRate - 0.25);
      } else if (event.key === "]" || (event.shiftKey && event.key === ">")) {
        event.preventDefault();
        applySpeed(playbackRate + 0.25);
      } else if (event.key === "0") {
        event.preventDefault();
        applySpeed(1);
      } else if (event.key === " " || event.key === "k" || event.key === "K") {
        const video = videoRef.current;
        if (video) {
          event.preventDefault();
          if (video.paused) {
            void video.play();
          } else {
            video.pause();
          }
        }
      } else if (event.key === "ArrowLeft" || event.key === "j" || event.key === "J") {
        const video = videoRef.current;
        if (video) {
          event.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          showToast(`-5s (${Math.floor(video.currentTime)}s)`);
        }
      } else if (event.key === "ArrowRight" || event.key === "l" || event.key === "L") {
        const video = videoRef.current;
        if (video) {
          event.preventDefault();
          video.currentTime = Math.min(video.duration || 999999, video.currentTime + 5);
          showToast(`+5s (${Math.floor(video.currentTime)}s)`);
        }
      } else if (event.key === "m" || event.key === "M") {
        const video = videoRef.current;
        if (video) {
          event.preventDefault();
          video.muted = !video.muted;
          showToast(video.muted ? "Muted" : "Unmuted");
        }
      } else if (event.key === "f" || event.key === "F") {
        const video = videoRef.current;
        if (video) {
          event.preventDefault();
          if (!document.fullscreenElement) {
            void video.requestFullscreen();
          } else {
            void document.exitFullscreen();
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [item, onClose, playbackRate]);

  useEffect(() => {
    if (!item) {
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let resumed = false;

    const flushHistorySession = () => {
      const current = videoRef.current;
      const active = itemRef.current;
      const session = sessionStartRef.current;
      if (!current || !active || !session) {
        return;
      }
      const stopPos = current.currentTime;
      const startPos = session.time;
      // Only log if watched for at least 2 seconds or moved by 2 seconds
      if (Math.abs(stopPos - startPos) >= 1.5) {
        const duration =
          Number.isFinite(current.duration) && current.duration > 0 ? current.duration : null;
        const completed = Boolean(duration && stopPos >= 0.9 * duration);
        void window.zentube.history.log({
          mediaId: active.id,
          startedAt: session.startedAt,
          stoppedAt: new Date().toISOString(),
          startPosition: startPos,
          stopPosition: stopPos,
          duration,
          completed
        });
      }
      sessionStartRef.current = {
        time: stopPos,
        startedAt: new Date().toISOString()
      };
    };

    const saveCurrentProgress = () => {
      const current = videoRef.current;
      const active = itemRef.current;
      if (!current || !active || !Number.isFinite(current.currentTime)) {
        return;
      }
      const duration =
        Number.isFinite(current.duration) && current.duration > 0 ? current.duration : null;
      void window.zentube.progress.update({
        mediaId: active.id,
        position: current.currentTime,
        duration
      });
    };

    const handleLoadedMetadata = () => {
      // Apply current playback rate
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRate;
      }

      if (resumed) {
        return;
      }
      resumed = true;

      if (typeof initialSeek === "number" && initialSeek >= 0) {
        video.currentTime = initialSeek;
        sessionStartRef.current = {
          time: initialSeek,
          startedAt: new Date().toISOString()
        };
      } else {
        void window.zentube.progress.get(item.id).then((progress) => {
          if (progress && !progress.completed && progress.positionSeconds > 0) {
            if (videoRef.current) {
              videoRef.current.currentTime = progress.positionSeconds;
            }
          }
          sessionStartRef.current = {
            time: videoRef.current?.currentTime ?? 0,
            startedAt: new Date().toISOString()
          };
        });
      }
    };

    const handlePlay = () => {
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRate;
      }
      sessionStartRef.current = {
        time: video.currentTime,
        startedAt: new Date().toISOString()
      };
    };

    const handlePause = () => {
      saveCurrentProgress();
      flushHistorySession();
    };

    const handleEnded = () => {
      saveCurrentProgress();
      flushHistorySession();
    };

    const handleTimeUpdate = () => {
      const current = videoRef.current;
      if (!current) return;

      const bucket = Math.floor(current.currentTime / 5);
      if (bucket !== lastSavedBucket.current) {
        lastSavedBucket.current = bucket;
        saveCurrentProgress();
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      saveCurrentProgress();
      flushHistorySession();
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      lastSavedBucket.current = -1;
      sessionStartRef.current = null;
    };
  }, [item, initialSeek, playbackRate]);

  if (!item) {
    return null;
  }

  const duration = formatDuration(item.durationSeconds);

  return (
    <div className="player-overlay" onClick={onClose}>
      <div className="player-box" onClick={(event) => event.stopPropagation()}>
        <header className="player-header">
          <div className="player-heading">
            <strong>{item.title}</strong>
            <span>
              {formatBytes(item.fileSizeBytes)}
              {duration ? ` · ${duration}` : ""}
            </span>
          </div>
          <div className="player-header-actions">
            <div className="player-speed-badge" title="Current playback speed">
              <Zap size={14} />
              <span>{playbackRate}×</span>
            </div>
            {onDelete && (
              <button
                className="player-delete"
                onClick={() => {
                  if (window.confirm(`Delete "${item.title}"?`)) {
                    onDelete(item);
                  }
                }}
                title="Delete video"
                type="button"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button className="player-close" onClick={onClose} title="Close player (Esc)" type="button">
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="player-video-wrapper">
          <video autoPlay controls ref={videoRef} src={`local-file://${item.filePath}`} />
          {toastMessage && <div className="player-toast">{toastMessage}</div>}
        </div>

        {/* Speed Controls Bar (Up to 4x) */}
        <div className="player-speed-bar">
          <div className="player-speed-label">
            <Zap size={15} />
            <span>Speed:</span>
          </div>

          <button
            className="player-speed-step-btn"
            disabled={playbackRate <= 0.25}
            onClick={() => applySpeed(playbackRate - 0.25)}
            title="Decrease speed by 0.25x ([)"
            type="button"
          >
            <Minus size={14} />
          </button>

          <div className="player-speed-pills">
            {SPEED_PRESETS.map((speed) => (
              <button
                className={`player-speed-pill ${playbackRate === speed ? "active" : ""}`}
                key={speed}
                onClick={() => applySpeed(speed)}
                type="button"
              >
                {speed}×
              </button>
            ))}
          </div>

          <button
            className="player-speed-step-btn"
            disabled={playbackRate >= 4.0}
            onClick={() => applySpeed(playbackRate + 0.25)}
            title="Increase speed by 0.25x (])"
            type="button"
          >
            <Plus size={14} />
          </button>

          <span className="player-speed-hint">[ / ] speed · Space play/pause · J/L seek</span>
        </div>

        <p className="player-path">{item.filePath}</p>
      </div>
    </div>
  );
}