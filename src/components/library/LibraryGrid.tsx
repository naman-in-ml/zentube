import { Film, Play } from "lucide-react";
import { formatBytes, formatDuration, mediaThumbUrl } from "../../lib/format";

type Props = {
  items: MediaItem[];
  selectedId: string | null;
  onSelect: (item: MediaItem) => void;
};

export function LibraryGrid({ items, selectedId, onSelect }: Props) {
  return (
    <div className="yt-grid">
      {items.map((item) => {
        const thumbUrl = mediaThumbUrl(item);
        const duration = formatDuration(item.durationSeconds);
        return (
          <button
            className={selectedId === item.id ? "yt-card selected" : "yt-card"}
            key={item.id}
            onClick={() => onSelect(item)}
            type="button"
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
            </div>
            <div className="yt-card-body">
              <strong className="yt-title">{item.title}</strong>
              <span className="yt-meta">
                {item.fileSizeBytes ? formatBytes(item.fileSizeBytes) : "Local file"} ·{" "}
                {new Date(item.addedAt).toLocaleDateString()}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}