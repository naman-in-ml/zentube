import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Film,
  Flame,
  FolderPlus,
  Play,
  Plus,
  Target,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration } from "../../lib/format";

interface DashboardViewProps {
  mediaItems: MediaItem[];
  playlists: PlaylistSummary[];
  onPlayMedia: (item: MediaItem, seekSeconds?: number) => void;
  onRequestCreateGoal: () => void;
  onBrowseLibrary: () => void;
  onBrowsePlaylists: () => void;
}

export function DashboardView({
  mediaItems,
  playlists,
  onPlayMedia,
  onRequestCreateGoal,
  onBrowseLibrary,
  onBrowsePlaylists
}: DashboardViewProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSummary() {
    try {
      const data = await window.zentube.dashboard.getSummary();
      setSummary(data);
    } catch (err) {
      console.error("Failed to load dashboard summary:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, [mediaItems, playlists]);

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  async function handleDeleteGoal(goalId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this goal? (Your downloaded videos and courses will remain safe)")) {
      return;
    }
    await window.zentube.goals.delete(goalId);
    await loadSummary();
  }

  function handlePlayContinue() {
    if (!summary?.continueLearning) return;
    const item = mediaItems.find((m) => m.id === summary.continueLearning!.id);
    if (item) {
      onPlayMedia(item, summary.continueLearning.positionSeconds);
    }
  }

  function handlePlayUpNext() {
    if (!summary?.upNext) return;
    const item = mediaItems.find((m) => m.id === summary.upNext!.id);
    if (item) {
      onPlayMedia(item, 0);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
        <p>Loading your learning dashboard...</p>
      </div>
    );
  }

  const { continueLearning, upNext, goals = [], stats } = summary || {
    continueLearning: null,
    upNext: null,
    goals: [],
    stats: {
      todayMinutes: 0,
      weekMinutes: 0,
      completedVideosCount: 0,
      totalLibraryVideos: 0,
      totalLibraryHours: 0
    }
  };

  return (
    <div className="dashboard-container">
      {/* Top Banner & Header */}
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-greeting">
            {getGreeting()}, Learner <span className="greeting-emoji">👋</span>
          </h1>
          <p className="dashboard-subtext">
            Welcome back to your distraction-free offline learning space.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary create-goal-btn"
          onClick={onRequestCreateGoal}
        >
          <Target size={16} />
          <span>New Study Goal</span>
        </button>
      </header>

      {/* Hero Action Row: Continue Learning & Up Next */}
      <section className="dashboard-hero-grid">
        {/* Continue Learning Card */}
        <div className="hero-card continue-card">
          <div className="hero-card-header">
            <span className="hero-tag continue-tag">
              <Flame size={14} /> Continue Learning
            </span>
            {continueLearning?.progressPercent ? (
              <span className="hero-progress-pill">
                {continueLearning.progressPercent}% Watched
              </span>
            ) : null}
          </div>

          {continueLearning ? (
            <div className="hero-card-body">
              <div className="hero-thumb-wrapper" onClick={handlePlayContinue}>
                {continueLearning.thumbnailPath ? (
                  <img
                    src={`local-file://${continueLearning.thumbnailPath}`}
                    alt={continueLearning.title}
                    className="hero-thumb-img"
                  />
                ) : (
                  <div className="hero-thumb-placeholder">
                    <Film size={32} />
                  </div>
                )}
                <div className="hero-play-overlay">
                  <Play fill="#ffffff" size={24} />
                </div>
              </div>

              <div className="hero-content">
                {continueLearning.playlistTitle && (
                  <span className="hero-course-name">
                    {continueLearning.playlistTitle}
                  </span>
                )}
                <h3 className="hero-title" title={continueLearning.title} onClick={handlePlayContinue}>
                  {continueLearning.title}
                </h3>

                <div className="hero-progress-bar-container">
                  <div
                    className="hero-progress-fill"
                    style={{ width: `${continueLearning.progressPercent}%` }}
                  />
                </div>

                <div className="hero-footer">
                  <span className="hero-timestamp">
                    Resume at {formatDuration(continueLearning.positionSeconds)}
                    {continueLearning.durationSeconds
                      ? ` / ${formatDuration(continueLearning.durationSeconds)}`
                      : ""}
                  </span>
                  <button
                    type="button"
                    className="btn-accent resume-btn"
                    onClick={handlePlayContinue}
                  >
                    <Play fill="currentColor" size={14} />
                    <span>Resume</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hero-empty-state">
              <div className="empty-icon-box">
                <Compass size={28} />
              </div>
              <h4>No lessons in progress</h4>
              <p>Pick a course or video from your library to start studying.</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={onBrowseLibrary}
              >
                Explore Library
              </button>
            </div>
          )}
        </div>

        {/* Up Next Card */}
        <div className="hero-card upnext-card">
          <div className="hero-card-header">
            <span className="hero-tag upnext-tag">
              <Clock size={14} /> Up Next
            </span>
            {upNext?.reason && (
              <span className="upnext-reason-pill">{upNext.reason}</span>
            )}
          </div>

          {upNext ? (
            <div className="hero-card-body">
              <div className="hero-thumb-wrapper" onClick={handlePlayUpNext}>
                {upNext.thumbnailPath ? (
                  <img
                    src={`local-file://${upNext.thumbnailPath}`}
                    alt={upNext.title}
                    className="hero-thumb-img"
                  />
                ) : (
                  <div className="hero-thumb-placeholder">
                    <Film size={32} />
                  </div>
                )}
                <div className="hero-play-overlay">
                  <Play fill="#ffffff" size={24} />
                </div>
              </div>

              <div className="hero-content">
                {upNext.playlistTitle && (
                  <span className="hero-course-name">{upNext.playlistTitle}</span>
                )}
                <h3 className="hero-title" title={upNext.title} onClick={handlePlayUpNext}>
                  {upNext.title}
                </h3>

                <div className="hero-footer" style={{ marginTop: "auto" }}>
                  <span className="hero-timestamp">
                    {upNext.durationSeconds
                      ? `Duration: ${formatDuration(upNext.durationSeconds)}`
                      : "Unwatched"}
                  </span>
                  <button
                    type="button"
                    className="btn-primary resume-btn"
                    onClick={handlePlayUpNext}
                  >
                    <Play fill="currentColor" size={14} />
                    <span>Start Lesson</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hero-empty-state">
              <div className="empty-icon-box">
                <CheckCircle2 size={28} color="#22c55e" />
              </div>
              <h4>All caught up!</h4>
              <p>Download new courses or add items to your goals.</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={onBrowsePlaylists}
              >
                Browse Courses
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Your Goals Section */}
      <section className="dashboard-section">
        <div className="section-title-row">
          <div>
            <h2 className="section-heading">Your Active Goals</h2>
            <span className="section-subheading">
              Structured tracks keeping your learning on course
            </span>
          </div>
          <button
            type="button"
            className="btn-secondary add-goal-btn"
            onClick={onRequestCreateGoal}
          >
            <Plus size={15} />
            <span>Add Goal</span>
          </button>
        </div>

        {goals.length === 0 ? (
          <div className="empty-goals-card" onClick={onRequestCreateGoal}>
            <div className="empty-goals-icon">🎯</div>
            <h3>Create your first learning goal</h3>
            <p>
              Group playlists like "Fullstack Rust" or "Machine Learning" into structured
              goals with automated progress tracking.
            </p>
            <button type="button" className="btn-primary">
              <Target size={16} /> Create Goal
            </button>
          </div>
        ) : (
          <div className="goals-grid">
            {goals.map((goal) => (
              <div key={goal.id} className="goal-card">
                <div className="goal-card-top">
                  <span className="goal-icon-badge">{goal.icon || "🎯"}</span>
                  <button
                    type="button"
                    className="goal-delete-btn"
                    title="Delete goal"
                    onClick={(e) => handleDeleteGoal(goal.id, e)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <h3 className="goal-title">{goal.title}</h3>
                {goal.description && (
                  <p className="goal-description">{goal.description}</p>
                )}

                <div className="goal-stats-row">
                  <span>
                    {goal.completedMediaCount} / {goal.totalMediaCount} lessons completed
                  </span>
                  <strong className="goal-percent-text">
                    {goal.progressPercent}%
                  </strong>
                </div>

                <div className="goal-meter-track">
                  <div
                    className="goal-meter-fill"
                    style={{ width: `${goal.progressPercent}%` }}
                  />
                </div>

                {goal.items && goal.items.length > 0 && (
                  <div className="goal-attached-preview">
                    <span className="attached-label">Attached tracks:</span>
                    <div className="attached-chips">
                      {goal.items.slice(0, 3).map((item) => (
                        <span key={item.itemId} className="attached-chip" title={item.title}>
                          {item.itemType === "playlist" ? "📚" : "🎬"} {item.title}
                        </span>
                      ))}
                      {goal.items.length > 3 && (
                        <span className="attached-chip more">
                          +{goal.items.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Study Pulse / Analytics Stats */}
      <section className="dashboard-section">
        <div className="section-title-row">
          <div>
            <h2 className="section-heading">Study Pulse</h2>
            <span className="section-subheading">
              Offline watch metrics and personal library volume
            </span>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
              <Clock size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Studied Today</span>
              <strong className="stat-value">
                {stats.todayMinutes > 0 ? `${stats.todayMinutes} min` : "0 min"}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
              <Calendar size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Past 7 Days</span>
              <strong className="stat-value">
                {stats.weekMinutes >= 60
                  ? `${Math.round((stats.weekMinutes / 60) * 10) / 10} hrs`
                  : `${stats.weekMinutes} min`}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}>
              <CheckCircle2 size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Completed Lessons</span>
              <strong className="stat-value">{stats.completedVideosCount}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#a855f7" }}>
              <BookOpen size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Offline Library</span>
              <strong className="stat-value">
                {stats.totalLibraryVideos} videos ({stats.totalLibraryHours}h)
              </strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
