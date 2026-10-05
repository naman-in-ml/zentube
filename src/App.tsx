import {
  Clock3,
  Download,
  Film,
  FolderPlus,
  History,
  ListMusic,
  Search,
  Settings
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DownloadsView } from "./components/downloads/DownloadsView";
import { WatchHistoryView } from "./components/history/WatchHistoryView";
import { LibraryGrid } from "./components/library/LibraryGrid";
import { PlayerOverlay } from "./components/player/PlayerOverlay";
import { PlaylistsView } from "./components/playlists/PlaylistsView";
import { SettingsView } from "./components/settings/SettingsView";

type View = "library" | "playlists" | "history" | "downloads" | "queue" | "settings";

const navItems: Array<{ id: View; label: string; icon: typeof Film }> = [
  { id: "library", label: "Library", icon: Film },
  { id: "playlists", label: "Courses & Playlists", icon: ListMusic },
  { id: "history", label: "Watch History", icon: History },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "queue", label: "Queue", icon: Clock3 },
  { id: "settings", label: "Settings", icon: Settings }
];

export function App() {
  const [view, setView] = useState<View>("library");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [initialSeek, setInitialSeek] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [appVersion, setAppVersion] = useState("0.0.0");

  async function refresh() {
    const [media, jobs] = await Promise.all([
      window.zentube.library.list(),
      window.zentube.queue.list()
    ]);

    setMediaItems(media);
    setQueueJobs(jobs);
    setSelected((current) => (current ? media.find((item) => item.id === current.id) ?? null : null));
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    void window.zentube.getVersion().then(setAppVersion);
  }, []);

  const filteredMedia = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return mediaItems;
    return mediaItems.filter((item) => item.title.toLowerCase().includes(needle));
  }, [mediaItems, query]);

  async function importFiles() {
    const imported = await window.zentube.library.importFiles();
    if (imported.length > 0) {
      playMedia(imported[0]);
    }
    await refresh();
  }

  function playMedia(item: MediaItem, seekSeconds?: number) {
    setInitialSeek(typeof seekSeconds === "number" ? seekSeconds : null);
    setSelected(item);
  }

  function closePlayer() {
    setSelected(null);
    setInitialSeek(null);
    void refresh();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Z</div>
          <div>
            <strong>Zentube</strong>
            <span>Learning Media OS</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={view === item.id ? "nav-item active" : "nav-item"}
                key={item.id}
                onClick={() => setView(item.id)}
                type="button"
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header className="toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Search library"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your library..."
              value={query}
            />
          </div>

          <div className="toolbar-actions">
            <button
              className="secondary-button"
              onClick={() => setView("downloads")}
              title="Download YouTube playlist or video"
              type="button"
            >
              <Download size={16} />
              Paste Link
            </button>
            <button className="primary-button" onClick={() => void importFiles()} type="button">
              <FolderPlus size={18} />
              Import Local
            </button>
          </div>
        </header>

        <section className="content">
          {view === "library" && (
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h1>Library</h1>
                  <p>
                    {mediaItems.length} media item{mediaItems.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              {filteredMedia.length === 0 ? (
                <div className="empty-state">
                  <Film size={38} />
                  <h2>No media yet</h2>
                  <p>Paste a YouTube playlist link or import local files to start your offline learning library.</p>
                  <div className="empty-actions">
                    <button
                      className="primary-button"
                      onClick={() => setView("downloads")}
                      type="button"
                    >
                      <Download size={18} />
                      Download YouTube Playlist
                    </button>
                    <button className="secondary-button" onClick={() => void importFiles()} type="button">
                      <FolderPlus size={18} />
                      Import Local Files
                    </button>
                  </div>
                </div>
              ) : (
                <LibraryGrid
                  items={filteredMedia}
                  onSelect={(item) => playMedia(item)}
                  selectedId={selected?.id ?? null}
                />
              )}
            </div>
          )}

          {view === "playlists" && <PlaylistsView onPlayMedia={playMedia} />}

          {view === "history" && (
            <WatchHistoryView mediaItems={mediaItems} onPlayMedia={playMedia} />
          )}

          {view === "downloads" && <DownloadsView onLibraryChanged={refresh} />}

          {view === "queue" && (
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h1>Queue</h1>
                  <p>Import and download task history.</p>
                </div>
              </div>
              <div className="simple-list">
                {queueJobs.map((job) => (
                  <div className="simple-row" key={job.id}>
                    <strong>{job.type}</strong>
                    <span>
                      {job.status} · {job.input}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "settings" && <SettingsView version={appVersion} />}
        </section>

        <PlayerOverlay item={selected} initialSeek={initialSeek} onClose={closePlayer} />
      </main>
    </div>
  );
}
