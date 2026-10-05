import {
  CheckCircle2,
  Clock,
  Film,
  Flame,
  Play,
  Search,
  Timer,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatDuration } from "../../lib/format";

type Props = {
  onPlayMedia: (item: MediaItem, seekSeconds?: number) => void;
  mediaItems: MediaItem[];
};

export function WatchHistoryView({ onPlayMedia, mediaItems }: Props) {
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  async function loadHistory() {
    setLoading(true);
    try {
      const rows = await window.zentube.history.list(200);
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

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return history;
    return history.filter((entry) => entry.mediaTitle.toLowerCase().includes(q));
  }, [history, searchQuery]);

  // Analytics
  const totalWatchSeconds = useMemo(() => {
    return history.reduce((acc, curr) => {
      const diff = Math.max(0, curr.stopPositionSeconds - curr.startPositionSeconds);
      return acc + diff;
    }, 0);
  }, [history]);

  const completedCount = useMemo(() => {
    return history.filter((entry) => entry.completed).length;
  }, [history]);

  function formatWatchTime(totalSecs: number): string {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${Math.max(1, mins)}m`;
  }

  function formatTimeRange(start: number, stop: number): string {
    const formattedStart = formatDuration(start) || "0:00";
    const formattedStop = formatDuration(stop) || "0:00";
    const diff = Math.max(0, Math.round(stop - start));
    const diffFormatted = formatDuration(diff) || `${diff}s`;
    return `Watched from ${formattedStart} till ${formattedStop} (${diffFormatted})`;
  }

  function formatSessionTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // Date grouping: Today, Yesterday, This Week, Older
  const groupedHistory = useMemo(() => {
    const groups: { [key: string]: WatchHistoryEntry[] } = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Older: []
    };

    const now = new Date();
    const todayStr = now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);

    for (const item of filteredHistory) {
      const itemDate = new Date(item.stoppedAt);
      const itemDateStr = itemDate.toDateString();

      if (itemDateStr === todayStr) {
        groups.Today.push(item);
      } else if (itemDateStr === yesterdayStr) {
        groups.Yesterday.push(item);
      } else if (itemDate >= oneWeekAgo) {
        groups["This Week"].push(item);
      } else {
        groups.Older.push(item);
      }
    }

    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [filteredHistory]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h1>Watch History</h1>
          <p>Detailed log of your study sessions, watch timestamps, and learning progress.</p>
        </div>
        {history.length > 0 && (
          <button className="secondary-button" onClick={() => void handleClear()} type="button">
            <Trash2 size={16} />
            Clear all history
          </button>
        )}
      </div>

      {/* Analytics Summary Cards */}
      {history.length > 0 && (
        <div className="history-stats-grid">
          <div className="history-stat-card">
            <div className="history-stat-icon red">
              <Timer size={20} />
            </div>
            <div>
              <strong>{formatWatchTime(totalWatchSeconds)}</strong>
              <span>Total Watch Time</span>
            </div>
          </div>

          <div className="history-stat-card">
            <div className="history-stat-icon orange">
              <Flame size={20} />
            </div>
            <div>
              <strong>{history.length}</strong>
              <span>Watch Sessions</span>
            </div>
          </div>

          <div className="history-stat-card">
            <div className="history-stat-icon green">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <strong>{completedCount}</strong>
              <span>Videos Completed</span>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {history.length > 0 && (
        <div className="history-search-bar">
          <Search size={16} />
          <input
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search watch sessions by video title…"
            value={searchQuery}
          />
        </div>
      )}

      {loading ? (
        <p className="notice">Loading watch history…</p>
      ) : filteredHistory.length === 0 ? (
        <div className="empty-state">
          <Clock size={38} />
          <h2>{searchQuery ? "No matching watch logs found" : "No watch history yet"}</h2>
          <p>
            {searchQuery
              ? `No sessions match "${searchQuery}".`
              : "Play any video from your courses or library to automatically track watch sessions."}
          </p>
        </div>
      ) : (
        <div className="history-grouped-container">
          {groupedHistory.map(([period, items]) => (
            <div className="history-group" key={period}>
              <h2 className="history-group-title">{period}</h2>
              <div className="history-list">
                {items.map((entry) => {
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
                          <span className="history-time">{formatSessionTime(entry.stoppedAt)}</span>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
