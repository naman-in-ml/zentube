import { CheckCircle2, Clock, Film, Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration } from "../../lib/format";

type Props = {
  onPlayMedia: (item: MediaItem, seekSeconds?: number) => void;
  mediaItems: MediaItem[];
};

export function WatchHistoryView({ onPlayMedia, mediaItems }: Props) {
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadHistory() {
    setLoading(true);
    try {
      const rows = await window.zentube.history.list(150);
      setHistory(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function handleClear() {
    if (!window.confirm("Clear all watch history?")) {
      return;
    }
    await window.zentube.history.clear();
    setHistory([]);
  }

  async function handleDelete(id: string) {
    await window.zentube.history.delete(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }

  function handleResume(entry: WatchHistoryEntry) {
    const media = mediaItems.find((m) => m.id === entry.mediaId) ?? {
      id: entry.mediaId,
      title: entry.mediaTitle,
      filePath: entry.filePath,
      fileSizeBytes: null,
      durationSeconds: entry.durationSeconds,
      thumbnailPath: entry.thumbnailPath,
      addedAt: entry.startedAt,
      progressPercent: null
    };
    onPlayMedia(media, entry.stopPositionSeconds);
  }

  function formatTimeRange(start: number, stop: number): string {
    const formattedStart = formatDuration(start) || "0:00";
    const formattedStop = formatDuration(stop) || "0:00";
    const diff = Math.max(0, Math.round(stop - start));
    const diffFormatted = formatDuration(diff) || `${diff}s`;
    return `Watched from ${formattedStart} till ${formattedStop} (${diffFormatted})`;
  }

  function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${timeStr}`;
    }

    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeStr}`;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h1>Watch History</h1>
          <p>
            {history.length} watch session{history.length === 1 ? "" : "s"} logged
          </p>
        </div>
        {history.length > 0 && (
          <button className="secondary-button" onClick={() => void handleClear()} type="button">
            <Trash2 size={16} />
            Clear history
          </button>
        )}
      </div>

      {loading ? (
        <p className="notice">Loading watch history…</p>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <Clock size={38} />
          <h2>No watch history yet</h2>
          <p>Start watching videos from your library or courses to track your activity log.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((entry) => {
            const thumbUrl = entry.thumbnailPath ? `local-file://${entry.thumbnailPath}` : null;
            return (
              <div className="history-card" key={entry.id}>
                <div className="history-thumb">
                  {thumbUrl ? (
                    <img alt="" loading="lazy" src={thumbUrl} />
                  ) : (
                    <div className="yt-thumb-placeholder">
                      <Film size={20} />
                    </div>
                  )}
                </div>

                <div className="history-info">
                  <strong className="history-title">{entry.mediaTitle}</strong>
                  <div className="history-meta">
                    <span className="history-time">{formatTimestamp(entry.stoppedAt)}</span>
                    <span className="history-range">
                      {formatTimeRange(entry.startPositionSeconds, entry.stopPositionSeconds)}
                    </span>
                  </div>
                  {entry.completed ? (
                    <span className="badge badge-success">
                      <CheckCircle2 size={13} /> Completed
                    </span>
                  ) : (
                    <span className="badge badge-neutral">In progress</span>
                  )}
                </div>

                <div className="history-actions">
                  <button
                    className="primary-button history-resume-btn"
                    onClick={() => handleResume(entry)}
                    title="Resume playback"
                    type="button"
                  >
                    <Play size={16} fill="currentColor" />
                    Resume
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => void handleDelete(entry.id)}
                    title="Remove from history"
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
