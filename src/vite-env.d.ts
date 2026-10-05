/// <reference types="vite/client" />

type MediaItem = {
  id: string;
  title: string;
  filePath: string;
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  thumbnailPath: string | null;
  addedAt: string;
  progressPercent: number | null;
};

type WatchProgress = {
  mediaId: string;
  positionSeconds: number;
  completed: boolean;
  updatedAt: string;
};

type WatchHistoryEntry = {
  id: string;
  mediaId: string;
  mediaTitle: string;
  filePath: string;
  thumbnailPath: string | null;
  startedAt: string;
  stoppedAt: string;
  startPositionSeconds: number;
  stopPositionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
};

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

type PlaylistItem = {
  playlistId: string;
  mediaId: string;
  position: number;
  addedAt: string;
  title: string;
  filePath: string;
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  thumbnailPath: string | null;
  progressPercent: number | null;
  progressCompleted: boolean;
};

type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  itemCount: number;
  completedCount: number;
  totalDurationSeconds: number;
  coverThumbnail: string | null;
};

type PlaylistDetails = {
  playlist: Playlist;
  items: PlaylistItem[];
};

type QueueJob = {
  id: string;
  type: string;
  status: string;
  input: string;
  outputMediaId?: string;
  progress: number;
  createdAt: string;
};

type DownloadEntry = {
  id: string;
  title: string;
  duration: number | null;
  url: string;
};

type DownloadResolveResult = {
  title: string | null;
  isPlaylist: boolean;
  entries: DownloadEntry[];
};

type DownloadQuality = "best" | "1080" | "720" | "480" | "audio";

type DownloadJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

type DownloadJob = {
  id: string;
  entryId: string;
  title: string;
  url: string;
  quality: DownloadQuality;
  playlistTitle: string | null;
  status: DownloadJobStatus;
  percent: number;
  speed: string | null;
  eta: string | null;
  outputPath: string | null;
  error: string | null;
};

type UpdateStatus =
  | { state: "not-packaged" }
  | { state: "checking" }
  | { state: "update-available"; version: string; currentVersion: string }
  | { state: "update-not-available" }
  | { state: "downloading"; percent: number }
  | { state: "update-downloaded"; version: string }
  | { state: "error"; message: string };

interface Window {
  zentube: {
    getVersion: () => Promise<string>;
    library: {
      list: () => Promise<MediaItem[]>;
      importFiles: () => Promise<MediaItem[]>;
    };
    playlists: {
      list: () => Promise<Playlist[]>;
      listWithSummary: () => Promise<PlaylistSummary[]>;
      getDetails: (playlistId: string) => Promise<PlaylistDetails | null>;
      create: (input: { name: string; description?: string }) => Promise<Playlist>;
      delete: (playlistId: string) => Promise<boolean>;
      addItem: (playlistId: string, mediaId: string) => Promise<boolean>;
      removeItem: (playlistId: string, mediaId: string) => Promise<boolean>;
    };
    history: {
      log: (input: {
        mediaId: string;
        startedAt: string;
        stoppedAt: string;
        startPosition: number;
        stopPosition: number;
        duration?: number | null;
        completed?: boolean;
      }) => Promise<string>;
      list: (limit?: number) => Promise<WatchHistoryEntry[]>;
      clear: () => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
    };
    queue: {
      list: () => Promise<QueueJob[]>;
    };
    progress: {
      get: (mediaId: string) => Promise<WatchProgress | null>;
      update: (input: { mediaId: string; position: number; duration: number | null }) => Promise<WatchProgress>;
    };
    downloads: {
      checkTools: () => Promise<{ ytDlp: boolean; ytDlpVersion: string | null; ffmpeg: boolean }>;
      resolve: (url: string) => Promise<DownloadResolveResult>;
      start: (input: {
        entries: DownloadEntry[];
        quality: DownloadQuality;
        playlistTitle: string | null;
      }) => Promise<string[]>;
      cancel: (jobId: string) => Promise<boolean>;
      list: () => Promise<DownloadJob[]>;
      onProgress: (callback: (jobs: DownloadJob[]) => void) => () => void;
    };
    updates: {
      check: () => Promise<UpdateStatus | null>;
      install: () => Promise<UpdateStatus | null>;
      onStatus: (callback: (status: UpdateStatus) => void) => () => void;
    };
  };
}