import { Clock3, Film, FolderPlus, ListMusic, Play, Plus, Search, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type View = "library" | "playlists" | "queue" | "settings";

const navItems: Array<{ id: View; label: string; icon: typeof Film }> = [
  { id: "library", label: "Library", icon: Film },
  { id: "playlists", label: "Playlists", icon: ListMusic },
  { id: "queue", label: "Queue", icon: Clock3 },
  { id: "settings", label: "Settings", icon: Settings }
];

export function App() {
  const [view, setView] = useState<View>("library");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [query, setQuery] = useState("");
  const [playlistName, setPlaylistName] = useState("");

  async function refresh() {
    const [media, savedPlaylists, jobs] = await Promise.all([
      window.zentube.library.list(),
      window.zentube.playlists.list(),
      window.zentube.queue.list()
    ]);

    setMediaItems(media);
    setPlaylists(savedPlaylists);
    setQueueJobs(jobs);
    setSelected((current) => current ?? media[0] ?? null);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filteredMedia = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return mediaItems;
    return mediaItems.filter((item) => item.title.toLowerCase().includes(needle));
  }, [mediaItems, query]);

  async function importFiles() {
    const imported = await window.zentube.library.importFiles();
    if (imported.length > 0) {
      setSelected(imported[0]);
    }
    await refresh();
  }

  async function addPlaylist() {
    const name = playlistName.trim();
    if (!name) return;
    await window.zentube.playlists.create({ name });
    setPlaylistName("");
    await refresh();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Z</div>
          <div>
            <strong>Zentube</strong>
            <span>Local media library</span>
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
              placeholder="Search your library"
              value={query}
            />
          </div>
          <button className="primary-button" onClick={importFiles} type="button">
            <FolderPlus size={18} />
            Import
          </button>
        </header>

        <section className="content">
          {view === "library" && (
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h1>Library</h1>
                  <p>{mediaItems.length} local item{mediaItems.length === 1 ? "" : "s"}</p>
                </div>
              </div>

              {filteredMedia.length === 0 ? (
                <div className="empty-state">
                  <Film size={38} />
                  <h2>No media yet</h2>
                  <p>Import local video or audio files to start building your offline library.</p>
                  <button className="primary-button" onClick={importFiles} type="button">
                    <FolderPlus size={18} />
                    Import files
                  </button>
                </div>
              ) : (
                <div className="media-list">
                  {filteredMedia.map((item) => (
                    <button
                      className={selected?.id === item.id ? "media-row selected" : "media-row"}
                      key={item.id}
                      onClick={() => setSelected(item)}
                      type="button"
                    >
                      <div className="thumb">
                        <Play size={18} />
                      </div>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{formatBytes(item.fileSizeBytes)} · {item.filePath}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "playlists" && (
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h1>Playlists</h1>
                  <p>Create local playlists before external providers arrive.</p>
                </div>
              </div>
              <div className="inline-form">
                <input
                  onChange={(event) => setPlaylistName(event.target.value)}
                  placeholder="Playlist name"
                  value={playlistName}
                />
                <button className="primary-button" onClick={addPlaylist} type="button">
                  <Plus size={18} />
                  Create
                </button>
              </div>
              <div className="simple-list">
                {playlists.map((playlist) => (
                  <div className="simple-row" key={playlist.id}>
                    <strong>{playlist.name}</strong>
                    <span>{new Date(playlist.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "queue" && (
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h1>Queue</h1>
                  <p>Import and provider job history.</p>
                </div>
              </div>
              <div className="simple-list">
                {queueJobs.map((job) => (
                  <div className="simple-row" key={job.id}>
                    <strong>{job.type}</strong>
                    <span>{job.status} · {job.input}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "settings" && (
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h1>Settings</h1>
                  <p>Provider and storage settings will live here.</p>
                </div>
              </div>
              <div className="notice">
                Zentube starts as a local media library. External source providers should only be
                enabled for content you own or are authorized to store offline.
              </div>
            </div>
          )}
        </section>

        <footer className="player">
          <div>
            <strong>{selected?.title ?? "Nothing selected"}</strong>
            <span>{selected?.filePath ?? "Import a file to test local playback."}</span>
          </div>
          {selected ? <video controls src={`local-file://${selected.filePath}`} /> : null}
        </footer>
      </main>
    </div>
  );
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
