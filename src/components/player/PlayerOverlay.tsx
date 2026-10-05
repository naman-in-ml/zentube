import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatBytes, formatDuration } from "../../lib/format";

type Props = {
  item: MediaItem | null;
  initialSeek?: number | null;
  onClose: () => void;
};

export function PlayerOverlay({ item, initialSeek, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const itemRef = useRef<MediaItem | null>(null);
  const lastSavedBucket = useRef(-1);
  const sessionStartRef = useRef<{ time: number; startedAt: string } | null>(null);
  itemRef.current = item;

  useEffect(() => {
    if (!item) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [item, onClose]);

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
  }, [item, initialSeek]);

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
          <button className="player-close" onClick={onClose} title="Close player" type="button">
            <X size={20} />
          </button>
        </header>
        <video autoPlay controls ref={videoRef} src={`local-file://${item.filePath}`} />
        <p className="player-path">{item.filePath}</p>
      </div>
    </div>
  );
}