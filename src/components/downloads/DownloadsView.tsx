import { Check, Download, Link2, Loader2, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const QUALITY_OPTIONS: Array<{ value: DownloadQuality; label: string }> = [
  { value: "best", label: "Best available" },
  { value: "1080", label: "1080p" },
  { value: "720", label: "720p" },
  { value: "480", label: "480p" }
];

type Props = {
  onLibraryChanged: () => void;
};

export function DownloadsView({ onLibraryChanged }: Props) {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState<DownloadQuality>("720");
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<DownloadResolveResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<{ ytDlp: boolean; ytDlpVersion: string | null; ffmpeg: boolean } | null>(null);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const seenStatusRef = useRef<Map<string, DownloadJobStatus>>(new Map());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void window.zentube.downloads.checkTools().then((result) => {
      if (active) setTools(result);
    });
    void window.zentube.downloads.list().then((result) => {
      if (active) {
        trackJobs(result);
        setJobs(result);
      }
    });
    const unsubscribe = window.zentube.downloads.onProgress((updated) => {
      const newlyCompleted = updated.some(
        (job) => job.status === "completed" && seenStatusRef.current.get(job.id) !== "completed"
      );
      trackJobs(updated);
      setJobs(updated);
      if (newlyCompleted) {
        onLibraryChanged();
        setNotice("Download finished and added to your library.");
        scheduleNoticeClear();
      }
    });
    return () => {
      active = false;
      unsubscribe();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trackJobs(list: DownloadJob[]) {
    for (const job of list) {
      seenStatusRef.current.set(job.id, job.status);
    }
  }

  function scheduleNoticeClear() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setNotice(null), 6000);
  }

  async function handleResolve() {
    const trimmed = url.trim();
    if (!trimmed || resolving) return;
    setError(null);
    setResolving(true);
    try {
      const result = await window.zentube.downloads.resolve(trimmed);
      setResolved(result);
      setSelected(new Set(result.entries.map((entry) => entry.id)));
    } catch (issue) {
      setError(errorMessage(issue));
      setResolved(null);
    } finally {
      setResolving(false);
    }
  }

  function toggleEntry(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (!resolved) return;
    const all = resolved.entries.map((entry) => entry.id);
    setSelected((current) => (current.size === all.length ? new Set() : new Set(all)));
  }

  async function handleStart() {
    if (!resolved || starting) return;
    const chosen = resolved.entries.filter((entry) => selected.has(entry.id));
    if (chosen.length === 0) return;
    setStarting(true);
    setNotice(null);
    try {
      await window.zentube.downloads.start({
        entries: chosen,
        quality,
        playlistTitle: resolved.title
      });
      setResolved(null);
      setUrl("");
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setStarting(false);
    }
  }

  async function handleCancel(jobId: string) {
    await window.zentube.downloads.cancel(jobId);
  }

  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running");
  const doneJobs = jobs.filter((job) => job.status === "completed");
  const failedJobs = jobs.filter((job) => job.status === "failed" || job.status === "cancelled");
  const allSelected = resolved ? selected.size === resolved.entries.length && resolved.entries.length > 0 : false;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h1>Downloads</h1>
          <p>Paste a YouTube link, pick a quality, download offline to {`~/Zentube`}.</p>
        </div>
      </div>

      {tools && (!tools.ytDlp || !tools.ffmpeg) && (
        <div className="dl-warning">
          {!tools.ytDlp && (
            <p>yt-dlp is not available. Install it and restart the app: <code>pip install -U yt-dlp</code> or your package manager.</p>
          )}
          {!tools.ffmpeg && (
            <p>ffmpeg is not available — best video + best audio merging needs it. Install it, then restart.</p>
          )}
        </div>
      )}

      {notice && <div className="dl-notice">{notice}</div>}

      <div className="dl-paste">
        <div className="dl-paste-input">
          <Link2 size={17} />
          <input
            aria-label="YouTube playlist or video URL"
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleResolve();
            }}
            placeholder="Paste a YouTube video or playlist link..."
            value={url}
          />
          <button className="secondary-button" disabled={!url.trim() || resolving} onClick={() => void handleResolve()} type="button">
            {resolving ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
            {resolving ? "Resolving…" : "Resolve"}
          </button>
        </div>

        {resolved && (
          <div className="dl-options">
            <label className="dl-quality">
              <span>Video quality</span>
              <select value={quality} onChange={(event) => setQuality(event.target.value as DownloadQuality)}>
                {QUALITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {error && <p className="dl-error">{error}</p>}
      </div>

      {resolved && (
        <div className="dl-resolved">
          <div className="dl-resolved-header">
            <strong>
              {resolved.isPlaylist ? (resolved.title ?? "Playlist") : resolved.title ?? "Video"} · {resolved.entries.length} item
              {resolved.entries.length === 1 ? "" : "s"}
            </strong>
            <div className="dl-resolved-actions">
              <button className="secondary-button" onClick={toggleAll} type="button">
                {allSelected ? <X size={15} /> : <Check size={15} />}
                {allSelected ? "Clear all" : "Select all"}
              </button>
              <button className="primary-button" disabled={selected.size === 0 || starting} onClick={() => void handleStart()} type="button">
                {starting ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
                Download {selected.size > 0 ? `${selected.size} item${selected.size === 1 ? "" : "s"}` : ""}
              </button>
            </div>
          </div>
          <div className="dl-entry-list">
            {resolved.entries.map((entry) => {
              const checked = selected.has(entry.id);
              return (
                <label className={checked ? "dl-entry selected" : "dl-entry"} key={entry.id}>
                  <input checked={checked} onChange={() => toggleEntry(entry.id)} type="checkbox" />
                  <img
                    alt=""
                    className="dl-entry-thumb"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden";
                    }}
                    src={`https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`}
                  />
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{entry.duration ? formatDuration(entry.duration) : "—"}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {activeJobs.length > 0 && (
        <div className="dl-section">
          <h2>Active {activeJobs.length}</h2>
          <div className="dl-job-list">
            {activeJobs.map((job) => (
              <DownloadRow job={job} key={job.id} onCancel={() => void handleCancel(job.id)} />
            ))}
          </div>
        </div>
      )}

      {doneJobs.length > 0 && (
        <div className="dl-section">
          <h2>Completed this session {doneJobs.length}</h2>
          <div className="dl-job-list">
            {doneJobs.map((job) => (
              <DownloadRow job={job} key={job.id} />
            ))}
          </div>
        </div>
      )}

      {(failedJobs.length > 0 || (activeJobs.length === 0 && doneJobs.length === 0 && !resolved)) && (
        <div className="empty-state">
          <Download size={34} />
          <h2>Nothing downloading</h2>
          <p>Paste a link above to resolve a playlist or video, then choose what to download.</p>
        </div>
      )}
    </div>
  );
}

function DownloadRow({ job, onCancel }: { job: DownloadJob; onCancel?: () => void }) {
  const statusLabel: Record<DownloadJobStatus, string> = {
    queued: "Queued",
    running: "Downloading",
    completed: "Done",
    failed: "Failed",
    cancelled: "Cancelled"
  };

  return (
    <div className="dl-job">
      <div className="dl-job-main">
        <div className="dl-job-title">
          <div className={`dl-status ${job.status}`}>
            {job.status === "completed" && <Check size={14} />}
            {job.status === "running" || job.status === "queued" ? <Loader2 className="spin" size={14} /> : null}
            {job.status === "failed" && <X size={14} />}
          </div>
          <div>
            <strong>{job.title}</strong>
            <span>
              {statusLabel[job.status]}
              {job.quality !== "best" ? ` · ${job.quality}p` : " · best"}
              {job.speed || job.eta ? ` · ${[job.speed, job.eta].filter(Boolean).join(" · ")}` : ""}
            </span>
          </div>
        </div>
        {(job.status === "running" || job.status === "queued") && onCancel && (
          <button className="icon-button" onClick={onCancel} title="Cancel download" type="button">
            <Square size={13} />
          </button>
        )}
      </div>

      {(job.status === "running" || job.status === "queued") && (
        <div className="dl-progress">
          <div className="dl-progress-fill" style={{ width: `${Math.max(0, Math.min(100, job.percent))}%` }} />
        </div>
      )}

      {job.error && <p className="dl-job-error">{job.error}</p>}
      {job.outputPath && job.status !== "running" && job.status !== "queued" && (
        <p className="dl-job-path">{job.outputPath}</p>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function errorMessage(issue: unknown): string {
  if (issue instanceof Error) {
    return issue.message;
  }
  return "Something went wrong.";
}