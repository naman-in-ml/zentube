import { Download, RefreshCw, Settings2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  version: string;
};

export function SettingsView({ version }: Props) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => window.zentube.updates.onStatus((next) => setStatus(next)),
    []
  );

  async function check() {
    setBusy(true);
    try {
      setStatus({ state: "checking" });
      await window.zentube.updates.check();
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    setBusy(true);
    try {
      await window.zentube.updates.install();
    } finally {
      setBusy(false);
    }
  }

  const renderStatus = () => {
    switch (status?.state) {
      case "checking":
        return <p className="notice">Checking for updates…</p>;
      case "update-available":
        return (
          <div className="notice">
            <strong>Update available</strong>
            <p>
              A new version ({status.version}) is ready. Download it locally, then
              Zentube restarts to apply it.
            </p>
            <button className="primary-button" disabled={busy} onClick={() => void install()} type="button">
              <Download size={16} /> Download & install
            </button>
          </div>
        );
      case "downloading":
        return (
          <div className="notice">
            <strong>Downloading update… {Math.round(status.percent)}%</strong>
            <div className="update-progress">
              <div className="update-progress-fill" style={{ width: `${Math.min(100, Math.max(0, status.percent))}%` }} />
            </div>
          </div>
        );
      case "update-downloaded":
        return (
          <div className="notice">
            <strong>Update {status.version} ready</strong>
            <p>Restarting now applies it.</p>
            <button className="primary-button" onClick={() => void install()} type="button">
              <RefreshCw size={16} /> Restart & install
            </button>
          </div>
        );
      case "update-not-available":
        return <p className="notice">You're up to date (v{version}).</p>;
      case "not-packaged":
        return (
          <p className="notice">
            You're running Zentube from source. Updates apply in the installed app — build and
            install it (npm run dist), then use this button here.
          </p>
        );
      case "error":
        return (
          <p className="notice">
            <XCircle size={16} /> Update check failed: {status.message}
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h1>Settings</h1>
          <p>App version and updates.</p>
        </div>
        <Settings2 size={22} />
      </div>
      <div className="update-card">
        <div>
          <strong>Zentube v{version}</strong>
          <span>Check GitHub Releases for a newer build.</span>
        </div>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => void check()}
          type="button"
        >
          <RefreshCw size={15} /> {busy ? "Working…" : "Check for updates"}
        </button>
      </div>
      {renderStatus()}
    </div>
  );
}