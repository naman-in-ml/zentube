import { Check, Plus, Target, X } from "lucide-react";
import { useState } from "react";

interface AssignToGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: { type: "playlist" | "media"; id: string; title: string } | null;
  goals: GoalSummary[];
  onAssigned: () => void;
  onRequestCreateGoal: () => void;
}

export function AssignToGoalModal({
  isOpen,
  onClose,
  item,
  goals,
  onAssigned,
  onRequestCreateGoal
}: AssignToGoalModalProps) {
  const [loadingGoalId, setLoadingGoalId] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  async function handleToggle(goal: GoalSummary) {
    if (!item || loadingGoalId) return;

    const alreadyAttached = goal.items.some(
      (gi) => gi.itemType === item.type && gi.itemId === item.id
    );

    try {
      setLoadingGoalId(goal.id);
      if (alreadyAttached) {
        await window.zentube.goals.removeItem({
          goalId: goal.id,
          itemType: item.type,
          itemId: item.id
        });
      } else {
        await window.zentube.goals.addItem({
          goalId: goal.id,
          itemType: item.type,
          itemId: item.id
        });
      }
      onAssigned();
    } catch (err) {
      console.error("Failed to toggle goal item:", err);
    } finally {
      setLoadingGoalId(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card assign-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon-badge">🎯</span>
            <div>
              <h3>Add to Learning Goal</h3>
              <p className="truncate-1">
                Assign <strong>{item.title}</strong> to one or more goals
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="assign-goal-body">
          {goals.length === 0 ? (
            <div className="empty-goals-prompt">
              <p>You don't have any goals created yet.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onClose();
                  onRequestCreateGoal();
                }}
              >
                <Plus size={16} />
                Create Your First Goal
              </button>
            </div>
          ) : (
            <div className="goals-select-list">
              {goals.map((goal) => {
                const isAttached = goal.items.some(
                  (gi) => gi.itemType === item.type && gi.itemId === item.id
                );
                const isLoading = loadingGoalId === goal.id;

                return (
                  <button
                    key={goal.id}
                    type="button"
                    className={`goal-assign-row ${isAttached ? "attached" : ""}`}
                    onClick={() => handleToggle(goal)}
                    disabled={isLoading}
                  >
                    <span className="goal-row-icon">{goal.icon || "🎯"}</span>
                    <div className="goal-row-info">
                      <strong>{goal.title}</strong>
                      <span>
                        {goal.totalMediaCount} lessons · {goal.progressPercent}% completed
                      </span>
                    </div>
                    <div className="goal-row-check">
                      {isAttached ? <Check size={16} color="#22c55e" /> : <Plus size={16} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              onClose();
              onRequestCreateGoal();
            }}
          >
            <Plus size={15} />
            New Goal
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
