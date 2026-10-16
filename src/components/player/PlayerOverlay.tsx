import {
  Headphones,
  Maximize2,
  Minimize2,
  Minus,
  PictureInPicture2,
  Plus,
  Subtitles,
  Trash2,
  Video,
  X,
  Zap
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatBytes, formatDuration, mediaThumbUrl } from "../../lib/format";

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

  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("zentube_cc") === "true";
    } catch {
      return false;
    }
  });

  const [isAudioOnly, setIsAudioOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem("zentube_audio_mode") === "true";
    } catch {
      return false;
    }
  });

  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
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

  function toggleCaptions() {
    const next = !captionsEnabled;
    setCaptionsEnabled(next);
    try {
      localStorage.setItem("zentube_cc", String(next));
    } catch {
      // ignore
    }
    const video = videoRef.current;
    if (video && video.textTracks.length > 0) {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = next ? "showing" : "hidden";
      }
    }
    showToast(next ? "CC: Subtitles ON" : "CC: Subtitles OFF");
  }

  function toggleAudioOnly() {
    const next = !isAudioOnly;
    setIsAudioOnly(next);
    try {
      localStorage.setItem("zentube_audio_mode", String(next));
    } catch {
      // ignore
    }
    showToast(next ? "🎧 Audio-Only Mode: ON" : "🎬 Video Mode: ON");
  }

  async function togglePiP() {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        showToast("PiP: Closed");
      } else if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
        await video.requestPictureInPicture();
        showToast("PiP: Picture-in-Picture Active");
      } else {
        setIsMiniPlayer((prev) => !prev);
        showToast(!isMiniPlayer ? "Mini Player: ON" : "Mini Player: OFF");
      }
    } catch {
      setIsMiniPlayer((prev) => !prev);
      showToast(!isMiniPlayer ? "Mini Player: ON" : "Mini Player: OFF");
    }
  }

  // Keyboard controls
  useEffect(() => {
    if (!item) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "Escape") {
        if (isMiniPlayer) {
          setIsMiniPlayer(false);
        } else {
          onClose();
        }
      } else if (event.key === "[" || (event.shiftKey && event.key === "<")) {
        event.preventDefault();
        applySpeed(playbackRate - 0.25);
      } else if (event.key === "]" || (event.shiftKey && event.key === ">")) {
        event.preventDefault();
        applySpeed(playbackRate + 0.25);
      } else if (event.key === "0") {
        event.preventDefault();
        applySpeed(1);
      } else if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        toggleCaptions();
      } else if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        void togglePiP();
      } else if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        toggleAudioOnly();
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
  }, [item, onClose, playbackRate, captionsEnabled, isAudioOnly, isMiniPlayer]);

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
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRate;
        if (videoRef.current.textTracks.length > 0) {
          for (let i = 0; i < videoRef.current.textTracks.length; i++) {
            videoRef.current.textTracks[i].mode = captionsEnabled ? "showing" : "hidden";
          }
        }
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
  }, [item, initialSeek, playbackRate, captionsEnabled]);

  if (!item) {
    return null;
  }

  const duration = formatDuration(item.durationSeconds);
  const subtitleUrl = item.subtitlePath ? `local-file://${item.subtitlePath}` : null;
  const thumbUrl = mediaThumbUrl(item);

  return (
    <div
      className={`player-overlay ${isMiniPlayer ? "mini-mode" : ""}`}
      onClick={isMiniPlayer ? undefined : onClose}
    >
      <div
        className={`player-box ${isMiniPlayer ? "player-box-mini" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="player-header">
          <div className="player-heading">
            <strong>{item.title}</strong>
            <span>
              {formatBytes(item.fileSizeBytes)}
              {duration ? ` · ${duration}` : ""}
              {isAudioOnly ? " · 🎧 Audio Mode" : ""}
            </span>
          </div>

          <div className="player-header-actions">
            {/* Audio-only Mode Toggle */}
            <button
              className={`player-header-btn ${isAudioOnly ? "active" : ""}`}
              onClick={toggleAudioOnly}
              title={`Switch to ${isAudioOnly ? "Video" : "Audio-only"} Mode (a)`}
              type="button"
            >
              {isAudioOnly ? <Video size={16} /> : <Headphones size={16} />}
              <span className="btn-label">{isAudioOnly ? "Video" : "Audio"}</span>
            </button>

            {/* Captions Toggle */}
            <button
              className={`player-header-btn ${captionsEnabled ? "active" : ""}`}
              disabled={!subtitleUrl}
              onClick={toggleCaptions}
              title={
                subtitleUrl
                  ? `Toggle Captions (c) - ${captionsEnabled ? "On" : "Off"}`
                  : "No subtitles available for this file"
              }
              type="button"
            >
              <Subtitles size={16} />
              <span className="btn-label">CC</span>
            </button>

            {/* Picture-in-Picture / Mini-player */}
            <button
              className={`player-header-btn ${isMiniPlayer ? "active" : ""}`}
              onClick={() => void togglePiP()}
              title="Picture-in-Picture / Mini player (p)"
              type="button"
            >
              <PictureInPicture2 size={16} />
            </button>

            {/* Speed Badge */}
            <div className="player-speed-badge" title="Current playback speed">
              <Zap size={14} />
              <span>{playbackRate}×</span>
            </div>

            {/* Mini Player Expand Toggle */}
            {isMiniPlayer && (
              <button
                className="player-header-btn"
                onClick={() => setIsMiniPlayer(false)}
                title="Expand to Full Player"
                type="button"
              >
                <Maximize2 size={16} />
              </button>
            )}

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

            <button
              className="player-close"
              onClick={onClose}
              title="Close player (Esc)"
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Video / Audio Player Surface */}
        <div className={`player-video-wrapper ${isAudioOnly ? "audio-surface-active" : ""}`}>
          <video
            autoPlay
            controls
            ref={videoRef}
            src={`local-file://${item.filePath}`}
            style={isAudioOnly ? { opacity: 0, position: "absolute", pointerEvents: "none", height: 1, width: 1 } : undefined}
          >
            {subtitleUrl && (
              <track
                default={captionsEnabled}
                kind="subtitles"
                label="English"
                src={subtitleUrl}
                srcLang="en"
              />
            )}
          </video>

          {/* Audio-Only Mode Visualizer Surface */}
          {isAudioOnly && (
            <div className="audio-mode-view">
              <div className="audio-art-container">
                {thumbUrl ? (
                  <img alt={item.title} className="audio-art-img" src={thumbUrl} />
                ) : (
                  <div className="audio-art-placeholder">
                    <Headphones size={48} />
                  </div>
                )}
                <div className="audio-glow-ring" />
              </div>

              <div className="audio-meta">
                <h3>{item.title}</h3>
                <p>Playing in battery-saver Audio Mode</p>
                <div className="audio-equalizer">
                  <span className="eq-bar eq-1" />
                  <span className="eq-bar eq-2" />
                  <span className="eq-bar eq-3" />
                  <span className="eq-bar eq-4" />
                  <span className="eq-bar eq-5" />
                </div>
              </div>
            </div>
          )}

          {toastMessage && <div className="player-toast">{toastMessage}</div>}
        </div>

        {/* Speed Controls Bar (Up to 4x) */}
        {!isMiniPlayer && (
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

            <span className="player-speed-hint">
              [ / ] speed · CC (c) · PiP (p) · Audio (a) · Space play/pause
            </span>
          </div>
        )}

        {!isMiniPlayer && <p className="player-path">{item.filePath}</p>}
      </div>
    </div>
  );
}