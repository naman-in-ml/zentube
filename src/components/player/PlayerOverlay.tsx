import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatBytes, formatDuration } from "../../lib/format";

type Props = {
  item: MediaItem | null;
  onClose: () => void;
};

export function PlayerOverlay({ item, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const itemRef = useRef<MediaItem | null>(null);
  const lastSavedBucket = useRef(-1);
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
    const saveCurrent = () => {
      const current = videoRef.current;
      const active = itemRef.current;
      if (!current || !active) {
        return;
      }
      if (!Number.isFinite(current.currentTime)) {
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
      void window.zentube.progress.get(item.id).then((progress) => {
        if (progress && !progress.completed && progress.positionSeconds > 0) {
          if (videoRef.current) {
            videoRef.current.currentTime = progress.positionSeconds;
          }
        }
      });
    };

    const handleTimeUpdate = () => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      const bucket = Math.floor(video.currentTime / 5);
      if (bucket !== lastSavedBucket.current) {
        lastSavedBucket.current = bucket;
        saveCurrent();
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("pause", saveCurrent);

    return () => {
      saveCurrent();
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("pause", saveCurrent);
      lastSavedBucket.current = -1;
    };
  }, [item]);

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