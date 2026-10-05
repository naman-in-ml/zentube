import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Film,
  ListMusic,
  Play,
  Plus,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration } from "../../lib/format";

type Props = {
  onPlayMedia: (item: MediaItem, seekSeconds?: number) => void;
};

export function PlaylistsView({ onPlayMedia }: Props) {
  const [summaries, setSummaries] = useState<PlaylistSummary[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<PlaylistDetails | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [loading, setLoading] = useState(true);

  async function refreshSummaries() {
    setLoading(true);
    try {
      const list = await window.zentube.playlists.listWithSummary();
      setSummaries(list);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(id: string) {
    setLoading(true);
    try {
      const details = await window.zentube.playlists.getDetails(id);
      setSelectedDetails(details);
      setSelectedPlaylistId(id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshSummaries();
  }, []);

  async function handleCreate() {
    const name = newPlaylistName.trim();
    if (!name) return;
    await window.zentube.playlists.create({ name });
    setNewPlaylistName("");
    await refreshSummaries();
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Delete this playlist? Videos will remain in your library.")) {
      return;
    }
    await window.zentube.playlists.delete(id);
    if (selectedPlaylistId === id) {
      setSelectedPlaylistId(null);
      setSelectedDetails(null);
    }
    await refreshSummaries();
  }

  async function handleRemoveItem(mediaId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!selectedPlaylistId) return;
    await window.zentube.playlists.removeItem(selectedPlaylistId, mediaId);
    await loadDetails(selectedPlaylistId);
    await refreshSummaries();
  }

  function handlePlayItem(item: PlaylistItem) {
    onPlayMedia({
      id: item.mediaId,
      title: item.title,
      filePath: item.filePath,
      fileSizeBytes: item.fileSizeBytes,
      durationSeconds: item.durationSeconds,
      thumbnailPath: item.thumbnailPath,
      addedAt: item.addedAt,
      progressPercent: item.progressPercent
    });
  }

  function handleContinueCourse() {
    if (!selectedDetails || selectedDetails.items.length === 0) return;
    // Find the first video that is not yet completed, or start at the beginning
    const target =
      selectedDetails.items.find((item) => !item.progressCompleted) ||
      selectedDetails.items[0];
    handlePlayItem(target);
  }

  if (selectedDetails) {
    const { playlist, items } = selectedDetails;
    const completedCount = items.filter((i) => i.progressCompleted).length;
    const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
    const totalDuration = items.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);

    return (
      <div className="panel">
        <div className="panel-header">
          <div className="playlist-detail-nav">
            <button
              className="secondary-button"
              onClick={() => {
                setSelectedPlaylistId(null);
                setSelectedDetails(null);
                void refreshSummaries();
              }}
              type="button"
            >
              <ArrowLeft size={16} />
              All Courses & Playlists
            </button>
            <div className="playlist-title-header">
              <h1>{playlist.name}</h1>
              <p>
                {items.length} video{items.length === 1 ? "" : "s"}
                {totalDuration > 0 ? ` · ${formatDuration(totalDuration)} total` : ""} ·{" "}
                {completedCount}/{items.length} completed ({progressPercent}%)
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <button className="primary-button" onClick={handleContinueCourse} type="button">
              <Play size={16} fill="currentColor" />
              {completedCount === 0 ? "Start Course" : "Continue Course"}
            </button>
          )}
        </div>

        {items.length > 0 && (
          <div className="course-progress-bar">
            <div className="course-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        )}

        {items.length === 0 ? (
          <div className="empty-state">
            <Film size={34} />
            <h2>No videos in this playlist yet</h2>
            <p>Downloaded playlists will automatically appear here with all their videos organized.</p>
          </div>
        ) : (
          <div className="playlist-items-list">
            {items.map((item, index) => {
              const thumbUrl = item.thumbnailPath ? `local-file://${item.thumbnailPath}` : null;
              const duration = formatDuration(item.durationSeconds);
              return (
                <div
                  className={`playlist-item-row ${item.progressCompleted ? "completed" : ""}`}
                  key={item.mediaId}
                  onClick={() => handlePlayItem(item)}
                >
                  <span className="playlist-item-index">{index + 1}</span>

                  <div className="playlist-item-thumb">
                    {thumbUrl ? (
                      <img alt="" loading="lazy" src={thumbUrl} />
                    ) : (
                      <div className="yt-thumb-placeholder">
                        <Film size={18} />
                      </div>
                    )}
                    {duration && <span className="yt-duration">{duration}</span>}
                    {item.progressPercent !== null && (
                      <span className="yt-progress">
                        <span style={{ width: `${item.progressPercent}%` }} />
                      </span>
                    )}
                  </div>

                  <div className="playlist-item-body">
                    <strong className="playlist-item-title">{item.title}</strong>
                    <div className="playlist-item-meta">
                      {item.progressCompleted ? (
                        <span className="badge badge-success">
                          <CheckCircle size={12} /> Completed
                        </span>
                      ) : item.progressPercent ? (
                        <span className="badge badge-neutral">{item.progressPercent}% watched</span>
                      ) : (
                        <span className="playlist-item-status">Unwatched</span>
                      )}
                    </div>
                  </div>

                  <div className="playlist-item-actions">
                    <button
                      className="icon-button"
                      onClick={(e) => void handleRemoveItem(item.mediaId, e)}
                      title="Remove from playlist"
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

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h1>Courses & Playlists</h1>
          <p>Organize videos into courses with automatic ordering and watch tracking.</p>
        </div>
      </div>

      <div className="inline-form">
        <input
          onChange={(event) => setNewPlaylistName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleCreate();
          }}
          placeholder="New playlist or course name…"
          value={newPlaylistName}
        />
        <button className="primary-button" onClick={() => void handleCreate()} type="button">
          <Plus size={18} />
          Create
        </button>
      </div>

      {loading ? (
        <p className="notice">Loading courses and playlists…</p>
      ) : summaries.length === 0 ? (
        <div className="empty-state">
          <ListMusic size={38} />
          <h2>No playlists yet</h2>
          <p>
            When you paste a YouTube playlist in the Downloads tab, it is automatically organized
            here with ordered tracks and progress!
          </p>
        </div>
      ) : (
        <div className="playlists-grid">
          {summaries.map((summary) => {
            const coverUrl = summary.coverThumbnail ? `local-file://${summary.coverThumbnail}` : null;
            const progress =
              summary.itemCount > 0
                ? Math.round((summary.completedCount / summary.itemCount) * 100)
                : 0;

            return (
              <div
                className="playlist-card"
                key={summary.id}
                onClick={() => void loadDetails(summary.id)}
              >
                <div className="playlist-card-cover">
                  {coverUrl ? (
                    <img alt="" loading="lazy" src={coverUrl} />
                  ) : (
                    <div className="playlist-card-placeholder">
                      <ListMusic size={32} />
                    </div>
                  )}
                  <span className="playlist-badge">
                    <ListMusic size={13} /> {summary.itemCount} video{summary.itemCount === 1 ? "" : "s"}
                  </span>
                  {summary.totalDurationSeconds > 0 && (
                    <span className="playlist-duration-badge">
                      <Clock size={12} /> {formatDuration(summary.totalDurationSeconds)}
                    </span>
                  )}
                </div>

                <div className="playlist-card-body">
                  <div className="playlist-card-header">
                    <strong className="playlist-card-title">{summary.name}</strong>
                    <button
                      className="icon-button playlist-delete-btn"
                      onClick={(e) => void handleDelete(summary.id, e)}
                      title="Delete playlist"
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="playlist-card-progress">
                    <div className="playlist-progress-bar">
                      <div className="playlist-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="playlist-progress-text">
                      {summary.completedCount}/{summary.itemCount} completed ({progress}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
