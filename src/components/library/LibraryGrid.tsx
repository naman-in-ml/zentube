import { Film, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatBytes, formatDuration, mediaThumbUrl } from "../../lib/format";

type Props = {
  items: MediaItem[];
  selectedId: string | null;
  onSelect: (item: MediaItem) => void;
  onDelete?: (item: MediaItem) => void;
};

export function LibraryGrid({ items, selectedId, onSelect, onDelete }: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleDeleteClick(item: MediaItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDeleteId === item.id) {
      onDelete?.(item);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(item.id);
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDeleteId(null);
  }

  return (
    <div className="yt-grid">
      {items.map((item) => {
        const thumbUrl = mediaThumbUrl(item);
        const duration = formatDuration(item.durationSeconds);
        const isConfirming = confirmDeleteId === item.id;

        return (
          <div
            className={selectedId === item.id ? "yt-card selected" : "yt-card"}
            key={item.id}
            onClick={() => onSelect(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onSelect(item);
              }
            }}
          >
            <div className="yt-thumb">
              {thumbUrl ? (
                <img alt="" loading="lazy" src={thumbUrl} />
              ) : (
                <div className="yt-thumb-placeholder">
                  <Film size={22} />
                </div>
              )}
              {duration && <span className="yt-duration">{duration}</span>}
              {item.progressPercent !== null && (
                <span className="yt-progress">
                  <span style={{ width: `${item.progressPercent}%` }} />
                </span>
              )}
              <div className="yt-hover-play">
                <Play size={20} fill="currentColor" />
              </div>

              {onDelete && (
                <button
                  className="yt-card-delete-btn"
                  onClick={(e) => handleDeleteClick(item, e)}
                  title="Delete video"
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="yt-card-body">
              {isConfirming ? (
                <div className="yt-delete-confirm" onClick={(e) => e.stopPropagation()}>
                  <p>Delete this video?</p>
                  <div className="yt-delete-confirm-actions">
                    <button
                      className="danger-button-sm"
                      onClick={(e) => handleDeleteClick(item, e)}
                      type="button"
                    >
                      Delete
                    </button>
                    <button
                      className="secondary-button-sm"
                      onClick={handleCancelDelete}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <strong className="yt-title">{item.title}</strong>
                  <span className="yt-meta">
                    {item.fileSizeBytes ? formatBytes(item.fileSizeBytes) : "Local file"} ·{" "}
                    {new Date(item.addedAt).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}