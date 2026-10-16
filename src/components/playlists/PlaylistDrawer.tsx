import {
  Check,
  Download,
  ListPlus,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  X
} from "lucide-react";
import { useState } from "react";
import { formatDuration } from "../../lib/format";

type ResolvedEntry = {
  id: string;
  title: string;
  duration: number | null;
  url: string;
};

type ResolveResult = {
  title: string | null;
  isPlaylist: boolean;
  entries: ResolvedEntry[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  mediaItems: MediaItem[];
  downloadJobs: Array<{
    id: string;
    entryId: string;
    title: string;
    status: string;
    percent: number;
  }>;
  onStartDownload: (entries: ResolvedEntry[], playlistTitle: string | null) => void;
};

export function PlaylistDrawer({
  isOpen,
  onClose,
  mediaItems,
  downloadJobs,
  onStartDownload
}: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolveResult | null>(null);

  if (!isOpen) {
    return null;
  }

  async function handleResolve(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const input = url.trim();
    if (!input) return;

    setBusy(true);
    setError(null);
    try {
      const res = await window.zentube.downloads.resolve(input);
      setResolved(res as ResolveResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load playlist.");
    } finally {
      setBusy(false);
    }
  }

  function isEntryDownloaded(entry: ResolvedEntry): boolean {
    return mediaItems.some(
      (m) =>
        m.title.toLowerCase().includes(entry.title.toLowerCase()) ||
        (entry.id && m.filePath.includes(entry.id))
    );
  }

  function getEntryJob(entry: ResolvedEntry) {
    return downloadJobs.find(
      (j) =>
        j.entryId === entry.id ||
        j.title.toLowerCase().includes(entry.title.toLowerCase())
    );
  }

  function handleDownloadSingle(entry: ResolvedEntry) {
    if (!resolved) return;
    onStartDownload([entry], resolved.title);
  }

  function handleDownloadAll() {
    if (!resolved) return;
    const notDownloaded = resolved.entries.filter((entry) => !isEntryDownloaded(entry));
    if (notDownloaded.length === 0) {
      onStartDownload(resolved.entries, resolved.title);
    } else {
      onStartDownload(notDownloaded, resolved.title);
    }
  }

  return (
    <aside className="playlist-drawer" aria-label="Playlist Explorer">
      <div className="playlist-drawer-header">
        <div className="drawer-title-area">
          <ListPlus size={18} className="drawer-icon" />
          <h3>Playlist Explorer</h3>
        </div>
        <button className="drawer-close-btn" onClick={onClose} title="Close drawer" type="button">
          <X size={18} />
        </button>
      </div>

      {/* URL Input Bar */}
      <form className="drawer-input-form" onSubmit={handleResolve}>
        <div className="drawer-input-wrapper">
          <input
            autoFocus
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube playlist URL..."
            value={url}
          />
          <button
            className="drawer-submit-btn"
            disabled={busy || !url.trim()}
            type="submit"
          >
            {busy ? <Loader2 size={15} className="spin" /> : "Explore"}
          </button>
        </div>
      </form>

      {error && <div className="drawer-error">{error}</div>}

      {/* Playlist Content */}
      {resolved && (
        <div className="drawer-content">
          <div className="drawer-summary">
            <div>
              <h4>{resolved.title || "YouTube Playlist"}</h4>
              <span>
                {resolved.entries.length} video{resolved.entries.length === 1 ? "" : "s"}
                {resolved.isPlaylist ? " · Sponsor ads will be auto-removed" : ""}
              </span>
            </div>
            <button
              className="drawer-dl-all-btn"
              onClick={handleDownloadAll}
              type="button"
            >
              <Download size={14} />
              <span>Download All</span>
            </button>
          </div>

          <div className="drawer-entry-list">
            {resolved.entries.map((entry, index) => {
              const downloaded = isEntryDownloaded(entry);
              const job = getEntryJob(entry);
              const isRunning = job?.status === "running";
              const isQueued = job?.status === "queued";

              return (
                <div className={`drawer-entry-card ${downloaded ? "is-downloaded" : ""}`} key={entry.id || index}>
                  <div className="entry-index">#{index + 1}</div>
                  <div className="entry-details">
                    <strong className="entry-title" title={entry.title}>
                      {entry.title}
                    </strong>
                    <span className="entry-meta">
                      {formatDuration(entry.duration) || "Unknown duration"}
                    </span>
                  </div>

                  <div className="entry-actions">
                    {downloaded ? (
                      <span className="entry-badge downloaded" title="Already in your library">
                        <Check size={13} />
                        <span>Saved</span>
                      </span>
                    ) : isRunning ? (
                      <span className="entry-badge downloading" title="Currently downloading">
                        <Loader2 size={13} className="spin" />
                        <span>{Math.round(job.percent)}%</span>
                      </span>
                    ) : isQueued ? (
                      <span className="entry-badge queued" title="Queued in Downloads">
                        <span>Queued</span>
                      </span>
                    ) : (
                      <button
                        className="entry-dl-btn"
                        onClick={() => handleDownloadSingle(entry)}
                        title="Download this video"
                        type="button"
                      >
                        <Download size={14} />
                        <span>Download</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
