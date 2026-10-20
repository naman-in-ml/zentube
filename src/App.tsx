import {
  Download,
  Film,
  FolderPlus,
  History,
  ListPlus,
  ListVideo,
  Play,
  Search,
  Settings
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DownloadsView } from "./components/downloads/DownloadsView";
import { WatchHistoryView } from "./components/history/WatchHistoryView";
import { LibraryGrid } from "./components/library/LibraryGrid";
import { PlayerOverlay } from "./components/player/PlayerOverlay";
import { PlaylistDrawer } from "./components/playlists/PlaylistDrawer";
import { PlaylistsView } from "./components/playlists/PlaylistsView";
import { SettingsView } from "./components/settings/SettingsView";

type View = "library" | "playlists" | "history" | "downloads" | "settings";

const navItems: Array<{ id: View; label: string; icon: typeof Film }> = [
  { id: "library", label: "Library", icon: Film },
  { id: "playlists", label: "Playlists & Courses", icon: ListVideo },
  { id: "history", label: "Watch History", icon: History },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "settings", label: "Settings", icon: Settings }
];

export function App() {
  const [view, setView] = useState<View>("library");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [initialSeek, setInitialSeek] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [appVersion, setAppVersion] = useState("0.0.0");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [downloadJobs, setDownloadJobs] = useState<any[]>([]);

  async function refresh() {
    const media = await window.zentube.library.list();
    setMediaItems(media);
    setSelected((current) => (current ? media.find((item) => item.id === current.id) ?? null : null));
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    return window.zentube.downloads.onProgress((jobs) => {
      setDownloadJobs(jobs as any[]);
      // If a job just completed, refresh library
      if ((jobs as any[]).some((j) => j.status === "completed")) {
        void refresh();
      }
    });
  }, []);

  const activeDownloadsCount = useMemo(() => {
    return downloadJobs.filter((j) => j.status === "running" || j.status === "queued").length;
  }, [downloadJobs]);

  async function handleStartDownload(entries: any[], playlistTitle: string | null) {
    await window.zentube.downloads.start({
      entries,
      quality: "best",
      playlistTitle
    });
  }

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

  async function handleDeleteMedia(item: MediaItem) {
    if (selected?.id === item.id) {
      setSelected(null);
      setInitialSeek(null);
    }
    await window.zentube.library.delete(item.id, true);
    await refresh();
  }

  const isMac = typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");

  return (
    <div className={`app-shell ${isMac ? "platform-mac" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark yt-mark">
            <Play fill="#ffffff" size={17} />
          </div>
          <div className="brand-info">
            <strong className="brand-title">
              Zen<span className="brand-tube">Tube</span>
            </strong>
            <span className="brand-subtitle">Offline Learning OS</span>
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
                <span className="nav-label">{item.label}</span>
                {item.id === "downloads" && activeDownloadsCount > 0 && (
                  <span className="sidebar-dl-badge" title={`${activeDownloadsCount} active download(s)`}>
                    {activeDownloadsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header className="toolbar">
          <div className="search-box yt-search-box">
            <input
              aria-label="Search library"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search videos in library..."
              value={query}
            />
            <button className="search-icon-btn" title="Search" type="button">
              <Search size={16} />
            </button>
          </div>

          <div className="toolbar-actions">
            <button
              className="primary-button yt-primary-btn"
              onClick={() => setIsDrawerOpen(true)}
              title="Explore YouTube playlist videos and download"
              type="button"
            >
              <ListPlus size={16} />
              Playlist Explorer
            </button>
            <button
              className="secondary-button yt-secondary-btn"
              onClick={() => setView("downloads")}
              title="Download YouTube playlist or video"
              type="button"
            >
              <Download size={16} />
              Downloads
            </button>
            <button className="secondary-button yt-secondary-btn" onClick={() => void importFiles()} type="button">
              <FolderPlus size={17} />
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
                  onDelete={handleDeleteMedia}
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

          {view === "settings" && <SettingsView version={appVersion} />}
        </section>

        <PlayerOverlay
          initialSeek={initialSeek}
          item={selected}
          onClose={closePlayer}
          onDelete={handleDeleteMedia}
        />

        <PlaylistDrawer
          downloadJobs={downloadJobs}
          isOpen={isDrawerOpen}
          mediaItems={mediaItems}
          onClose={() => setIsDrawerOpen(false)}
          onStartDownload={handleStartDownload}
        />
      </main>
    </div>
  );
}
