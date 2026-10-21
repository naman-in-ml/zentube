import { Check, FolderPlus, Target, X } from "lucide-react";
import { useState } from "react";

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  playlists: PlaylistSummary[];
  mediaItems: MediaItem[];
}

const GOAL_ICONS = ["🎯", "🚀", "💻", "🧠", "⚡", "📚", "🛠️", "🔥", "📈", "🎓"];

export function CreateGoalModal({
  isOpen,
  onClose,
  onCreated,
  playlists,
  mediaItems
}: CreateGoalModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("🎯");
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  function togglePlaylist(id: string) {
    setSelectedPlaylistIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    try {
      setSubmitting(true);
      const created = await window.zentube.goals.create({
        title: title.trim(),
        description: description.trim() || undefined,
        icon: selectedIcon
      });

      // Attach selected playlists
      for (const plId of selectedPlaylistIds) {
        await window.zentube.goals.addItem({
          goalId: created.id,
          itemType: "playlist",
          itemId: plId
        });
      }

      setTitle("");
      setDescription("");
      setSelectedPlaylistIds([]);
      onCreated();
      onClose();
    } catch (err) {
      console.error("Failed to create goal:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card goal-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon-badge">{selectedIcon}</span>
            <div>
              <h3>Create New Learning Goal</h3>
              <p>Group courses and videos into a structured, trackable learning target.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="goal-form">
          <div className="form-group">
            <label htmlFor="goal-title">Goal Title *</label>
            <input
              id="goal-title"
              type="text"
              required
              autoFocus
              placeholder="e.g. Master Backend Development with Go"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="goal-desc">Description (Optional)</label>
            <textarea
              id="goal-desc"
              rows={2}
              placeholder="What will you understand or be able to build once completed?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Goal Icon</label>
            <div className="icon-selector">
              {GOAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`icon-choice-btn ${selectedIcon === icon ? "active" : ""}`}
                  onClick={() => setSelectedIcon(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Attach Existing Courses / Playlists</label>
            {playlists.length === 0 ? (
              <p className="form-hint">No downloaded courses yet. You can attach courses anytime later.</p>
            ) : (
              <div className="course-attachment-list">
                {playlists.map((pl) => {
                  const isChecked = selectedPlaylistIds.includes(pl.id);
                  return (
                    <div
                      key={pl.id}
                      className={`course-attach-item ${isChecked ? "selected" : ""}`}
                      onClick={() => togglePlaylist(pl.id)}
                    >
                      <div className="checkbox-indicator">{isChecked && <Check size={14} />}</div>
                      <div className="course-attach-info">
                        <strong>{pl.name}</strong>
                        <span>{pl.itemCount} lessons</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!title.trim() || submitting}>
              <Target size={16} />
              {submitting ? "Creating..." : "Create Goal"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
