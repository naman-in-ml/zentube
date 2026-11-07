import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  FileText,
  Film,
  Folder,
  HardDrive,
  Headphones,
  Image as ImageIcon,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatBytes, formatDuration } from "../../lib/format";

type CleanupTab = "completed" | "largest" | "stale";

interface StorageDashboardViewProps {
  onPlayMedia?: (item: MediaItem) => void;
  onRefreshLibrary: () => void;
}

export function StorageDashboardView({
  onPlayMedia,
  onRefreshLibrary
}: StorageDashboardViewProps) {
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CleanupTab>("completed");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function loadSummary() {
    setLoading(true);
    try {
      const data = await window.zentube.storage.getSummary();
      setSummary(data);
    } catch (err) {
      console.error("Failed to load storage summary:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  async function handleOpenFolder() {
    await window.zentube.storage.openFolder();
  }

  // Active candidate list based on selected tab
  const candidates = useMemo(() => {
    if (!summary) return [];
    let list: CleanupItem[] = [];
    if (activeTab === "completed") list = summary.cleanupCandidates.completed;
    else if (activeTab === "largest") list = summary.cleanupCandidates.largest;
    else if (activeTab === "stale") list = summary.cleanupCandidates.stale;

    if (!searchQuery.trim()) return list;
    const needle = searchQuery.toLowerCase().trim();
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        (item.playlistTitle && item.playlistTitle.toLowerCase().includes(needle))
    );
  }, [summary, activeTab, searchQuery]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === candidates.length && candidates.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  }

  const selectedBytes = useMemo(() => {
    if (!summary || selectedIds.size === 0) return 0;
    const allCandidates = [
      ...summary.cleanupCandidates.completed,
      ...summary.cleanupCandidates.largest,
      ...summary.cleanupCandidates.stale
    ];
    let total = 0;
    const counted = new Set<string>();
    for (const item of allCandidates) {
      if (selectedIds.has(item.id) && !counted.has(item.id)) {
        counted.add(item.id);
        total += item.fileSizeBytes || 0;
      }
    }
    return total;
  }, [summary, selectedIds]);

  async function executeDelete() {
    if (selectedIds.size === 0 || isDeleting) return;
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await window.zentube.storage.deleteItems(ids, true);
      setStatusMessage(
        `Successfully deleted ${res.deletedCount} video(s) and reclaimed ${formatBytes(res.reclaimedBytes)} of disk space!`
      );
      setSelectedIds(new Set());
      setConfirmModalOpen(false);
      await loadSummary();
      onRefreshLibrary();
    } catch (err) {
      console.error("Failed to delete items:", err);
      setStatusMessage("Failed to delete selected items. Check console for details.");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleSelectCourseVideos(courseName: string) {
    if (!summary) return;
    const matching = summary.cleanupCandidates.largest.filter(
      (c) => c.playlistTitle === courseName
    );
    if (matching.length > 0) {
      setActiveTab("largest");
      setSelectedIds(new Set(matching.map((m) => m.id)));
    }
  }

  if (loading && !summary) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
        <p>Analyzing disk usage and storage footprint...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="empty-state">
        <HardDrive size={38} />
        <h2>Unable to load storage data</h2>
        <button type="button" className="primary-button" onClick={loadSummary}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  // Calculate drive percentage bars
  const totalDrive = summary.totalDiskBytes || 1;
  const zentubePercent = Math.min(100, Math.max(0.5, (summary.zentubeTotalBytes / totalDrive) * 100));
  const otherUsedPercent = Math.min(
    100 - zentubePercent,
    Math.max(0, ((summary.usedDiskBytes - summary.zentubeTotalBytes) / totalDrive) * 100)
  );
  const freePercent = Math.max(0, 100 - zentubePercent - otherUsedPercent);

  return (
    <div className="storage-view-container">
      {/* Top Header */}
      <header className="storage-header">
        <div>
          <h1 className="storage-heading">
            Storage & Disk Cleanup <span className="greeting-emoji">💾</span>
          </h1>
          <p className="storage-subheading">
            Track media disk footprint, inspect course sizes, and safely reclaim storage space.
          </p>
        </div>
        <div className="storage-header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={loadSummary}
            title="Refresh storage statistics"
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleOpenFolder}
            title="Open Zentube media folder in File Manager"
          >
            <Folder size={16} />
            <span>Open Storage Folder</span>
          </button>
        </div>
      </header>

      {statusMessage && (
        <div className="storage-toast-banner">
          <CheckCircle2 size={18} color="#22c55e" />
          <span>{statusMessage}</span>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setStatusMessage(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Hero Drive & Zentube Storage Bar */}
      <section className="storage-hero-card">
        <div className="storage-hero-top">
          <div className="storage-hero-info">
            <div className="storage-icon-circle">
              <HardDrive size={26} color="#ff3b30" />
            </div>
            <div>
              <span className="storage-hero-label">Zentube Library Footprint</span>
              <strong className="storage-hero-total">
                {formatBytes(summary.zentubeTotalBytes)}
              </strong>
              <span className="storage-hero-files">
                {summary.totalLibraryVideos} videos · {summary.totalFiles} total files
              </span>
            </div>
          </div>

          <div className="drive-stats-pills">
            <div className="drive-pill">
              <span className="drive-pill-dot zentube-dot" />
              <div className="drive-pill-text">
                <span className="pill-title">Zentube</span>
                <strong>{formatBytes(summary.zentubeTotalBytes)}</strong>
              </div>
            </div>
            <div className="drive-pill">
              <span className="drive-pill-dot other-dot" />
              <div className="drive-pill-text">
                <span className="pill-title">Other Drive Data</span>
                <strong>{formatBytes(Math.max(0, summary.usedDiskBytes - summary.zentubeTotalBytes))}</strong>
              </div>
            </div>
            <div className="drive-pill">
              <span className="drive-pill-dot free-dot" />
              <div className="drive-pill-text">
                <span className="pill-title">Free Space</span>
                <strong>{formatBytes(summary.freeDiskBytes)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Drive Progress Bar */}
        <div className="drive-meter-wrapper" title={`Capacity: ${formatBytes(summary.totalDiskBytes)}`}>
          <div
            className="meter-segment zentube-segment"
            style={{ width: `${zentubePercent}%` }}
            title={`Zentube: ${formatBytes(summary.zentubeTotalBytes)} (${zentubePercent.toFixed(1)}%)`}
          />
          <div
            className="meter-segment other-segment"
            style={{ width: `${otherUsedPercent}%` }}
            title={`Other Used: ${formatBytes(summary.usedDiskBytes - summary.zentubeTotalBytes)}`}
          />
          <div
            className="meter-segment free-segment"
            style={{ width: `${freePercent}%` }}
            title={`Free Space: ${formatBytes(summary.freeDiskBytes)}`}
          />
        </div>

        <div className="drive-meter-footer">
          <span className="storage-dir-path" title={summary.storageDirectory}>
            <Folder size={13} /> {summary.storageDirectory}
          </span>
          <span className="drive-total-label">
            Drive Total: {formatBytes(summary.totalDiskBytes)}
          </span>
        </div>
      </section>

      {/* Category Breakdown Grid */}
      <section className="storage-breakdown-grid">
        <div className="breakdown-card">
          <div className="breakdown-icon-box" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
            <Film size={20} />
          </div>
          <div className="breakdown-details">
            <span className="breakdown-label">Video Media</span>
            <strong className="breakdown-bytes">{formatBytes(summary.breakdown.video.bytes)}</strong>
            <span className="breakdown-count">{summary.breakdown.video.count} files</span>
          </div>
        </div>

        <div className="breakdown-card">
          <div className="breakdown-icon-box" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#a855f7" }}>
            <Headphones size={20} />
          </div>
          <div className="breakdown-details">
            <span className="breakdown-label">Audio Only</span>
            <strong className="breakdown-bytes">{formatBytes(summary.breakdown.audio.bytes)}</strong>
            <span className="breakdown-count">{summary.breakdown.audio.count} files</span>
          </div>
        </div>

        <div className="breakdown-card">
          <div className="breakdown-icon-box" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
            <ImageIcon size={20} />
          </div>
          <div className="breakdown-details">
            <span className="breakdown-label">Thumbnails</span>
            <strong className="breakdown-bytes">{formatBytes(summary.breakdown.thumbnail.bytes)}</strong>
            <span className="breakdown-count">{summary.breakdown.thumbnail.count} covers</span>
          </div>
        </div>

        <div className="breakdown-card">
          <div className="breakdown-icon-box" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}>
            <FileText size={20} />
          </div>
          <div className="breakdown-details">
            <span className="breakdown-label">Transcripts & Subs</span>
            <strong className="breakdown-bytes">{formatBytes(summary.breakdown.subtitle.bytes)}</strong>
            <span className="breakdown-count">{summary.breakdown.subtitle.count} files</span>
          </div>
        </div>

        <div className="breakdown-card">
          <div className="breakdown-icon-box" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
            <Database size={20} />
          </div>
          <div className="breakdown-details">
            <span className="breakdown-label">Metadata & Archive</span>
            <strong className="breakdown-bytes">{formatBytes(summary.breakdown.metadata.bytes + summary.breakdown.other.bytes)}</strong>
            <span className="breakdown-count">{summary.breakdown.metadata.count + summary.breakdown.other.count} files</span>
          </div>
        </div>
      </section>

      {/* Courses & Playlists Storage Section */}
      {summary.courses.length > 0 && (
        <section className="storage-section">
          <div className="section-title-row">
            <div>
              <h2 className="section-heading">Courses Storage Footprint</h2>
              <span className="section-subheading">
                Disk space occupied by downloaded playlists and structured tracks
              </span>
            </div>
          </div>

          <div className="course-storage-grid">
            {summary.courses.map((course) => (
              <div key={course.id} className="course-storage-card">
                <div className="course-storage-thumb">
                  {course.coverThumbnail ? (
                    <img src={`local-file://${course.coverThumbnail}`} alt={course.name} />
                  ) : (
                    <div className="course-storage-placeholder">
                      <Layers size={24} />
                    </div>
                  )}
                  <span className="course-size-pill">
                    {formatBytes(course.totalSizeBytes)}
                  </span>
                </div>

                <div className="course-storage-body">
                  <h4 className="course-storage-title" title={course.name}>
                    {course.name}
                  </h4>
                  <div className="course-storage-meta">
                    <span>{course.videoCount} lessons</span>
                    {course.totalDurationSeconds > 0 && (
                      <span>· {formatDuration(course.totalDurationSeconds)}</span>
                    )}
                    <span>· {course.completedCount}/{course.videoCount} watched</span>
                  </div>

                  <div className="course-meter-container">
                    <div
                      className="course-meter-fill"
                      style={{ width: `${course.percentOfZentube}%` }}
                    />
                  </div>
                  <div className="course-meter-label">
                    <span>{course.percentOfZentube}% of Zentube storage</span>
                    <button
                      type="button"
                      className="course-clean-btn"
                      onClick={() => handleSelectCourseVideos(course.name)}
                    >
                      Select to Clean
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Smart Cleanup Manager Section */}
      <section className="storage-section cleanup-section">
        <div className="section-title-row">
          <div>
            <h2 className="section-heading">
              Smart Disk Cleanup <Sparkles size={18} color="#eab308" style={{ display: "inline", verticalAlign: "middle" }} />
            </h2>
            <span className="section-subheading">
              Select finished or heavyweight videos to instantly reclaim disk space
            </span>
          </div>
        </div>

        {/* Filter Tabs & Search Header */}
        <div className="cleanup-controls-bar">
          <div className="cleanup-tabs">
            <button
              type="button"
              className={`cleanup-tab-btn ${activeTab === "completed" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("completed");
                setSelectedIds(new Set());
              }}
            >
              <CheckCircle2 size={15} />
              <span>Watched & Completed</span>
              <span className="tab-badge">{summary.cleanupCandidates.completed.length}</span>
            </button>

            <button
              type="button"
              className={`cleanup-tab-btn ${activeTab === "largest" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("largest");
                setSelectedIds(new Set());
              }}
            >
              <Layers size={15} />
              <span>Largest Files</span>
              <span className="tab-badge">{summary.cleanupCandidates.largest.length}</span>
            </button>

            <button
              type="button"
              className={`cleanup-tab-btn ${activeTab === "stale" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("stale");
                setSelectedIds(new Set());
              }}
            >
              <Clock size={15} />
              <span>Inactive (&gt;30 Days)</span>
              <span className="tab-badge">{summary.cleanupCandidates.stale.length}</span>
            </button>
          </div>

          <div className="cleanup-search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="Filter videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery("")}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Video Candidate Table / List */}
        {candidates.length === 0 ? (
          <div className="cleanup-empty-card">
            <CheckCircle2 size={36} color="#22c55e" />
            <h4>No cleanup candidates in this view</h4>
            <p>
              {activeTab === "completed"
                ? "No completed videos found. Finished lessons will appear here for easy purging."
                : activeTab === "stale"
                ? "No inactive videos older than 30 days. Your library is fresh!"
                : "No matching video files found."}
            </p>
          </div>
        ) : (
          <div className="cleanup-table-wrapper">
            <div className="cleanup-table-header">
              <label className="cleanup-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedIds.size === candidates.length && candidates.length > 0}
                  onChange={toggleSelectAll}
                />
                <span>Select All ({candidates.length})</span>
              </label>
              <span className="table-header-col-meta">Progress & Size</span>
            </div>

            <div className="cleanup-list">
              {candidates.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`cleanup-item-row ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleSelect(item.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      onClick={(e) => e.stopPropagation()}
                    />

                    <div className="cleanup-thumb">
                      {item.thumbnailPath ? (
                        <img src={`local-file://${item.thumbnailPath}`} alt="" />
                      ) : (
                        <div className="cleanup-thumb-placeholder">
                          <Film size={18} />
                        </div>
                      )}
                    </div>

                    <div className="cleanup-info">
                      <strong className="cleanup-title" title={item.title}>
                        {item.title}
                      </strong>
                      <div className="cleanup-submeta">
                        {item.playlistTitle && (
                          <span className="cleanup-course-badge">
                            {item.playlistTitle}
                          </span>
                        )}
                        {item.durationSeconds && (
                          <span>{formatDuration(item.durationSeconds)}</span>
                        )}
                        <span>Added: {new Date(item.addedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="cleanup-badges">
                      {item.completed ? (
                        <span className="cleanup-status-pill completed">
                          <Check size={12} /> Completed
                        </span>
                      ) : item.progressPercent ? (
                        <span className="cleanup-status-pill progress">
                          {item.progressPercent}% Watched
                        </span>
                      ) : (
                        <span className="cleanup-status-pill unwatched">Unwatched</span>
                      )}

                      <span className="cleanup-size-pill">
                        {formatBytes(item.fileSizeBytes)}
                      </span>

                      <button
                        type="button"
                        className="cleanup-single-delete-btn"
                        title="Delete this file to reclaim disk space"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIds(new Set([item.id]));
                          setConfirmModalOpen(true);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Sticky Bottom Action Bar when items are selected */}
      {selectedIds.size > 0 && (
        <div className="cleanup-sticky-bar">
          <div className="sticky-info">
            <span className="sticky-count">
              {selectedIds.size} video{selectedIds.size === 1 ? "" : "s"} selected
            </span>
            <span className="sticky-divider">•</span>
            <span className="sticky-reclaim">
              Reclaim <strong>{formatBytes(selectedBytes)}</strong> of disk space
            </span>
          </div>

          <div className="sticky-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSelectedIds(new Set())}
            >
              Deselect All
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => setConfirmModalOpen(true)}
            >
              <Trash2 size={16} />
              <span>Delete & Reclaim {formatBytes(selectedBytes)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="modal-backdrop" onClick={() => setConfirmModalOpen(false)}>
          <div className="modal-card storage-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <div className="modal-title-group">
                <div className="modal-icon-badge danger">
                  <AlertTriangle size={24} color="#ef4444" />
                </div>
                <div>
                  <h3>Permanently Delete Media Files?</h3>
                  <p>This will delete the selected video files from disk and free up storage.</p>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setConfirmModalOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </header>

            <div className="confirm-modal-body">
              <div className="confirm-reclaim-box">
                <span>Disk Space to be Reclaimed:</span>
                <strong>{formatBytes(selectedBytes)}</strong>
              </div>

              <p className="confirm-warning-note">
                {selectedIds.size} file(s) and their associated thumbnails/subtitles will be removed
                from your computer. Your goals and watch history logs will remain intact.
              </p>
            </div>

            <footer className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={executeDelete}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                <span>{isDeleting ? "Deleting..." : "Confirm & Reclaim Space"}</span>
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
