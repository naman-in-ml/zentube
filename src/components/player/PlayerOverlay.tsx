import { X } from "lucide-react";
import { useEffect } from "react";
import { formatBytes, formatDuration } from "../../lib/format";

type Props = {
  item: MediaItem | null;
  onClose: () => void;
};

export function PlayerOverlay({ item, onClose }: Props) {
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
        <video autoPlay controls src={`local-file://${item.filePath}`} />
        <p className="player-path">{item.filePath}</p>
      </div>
    </div>
  );
}