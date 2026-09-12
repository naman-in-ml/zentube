/// <reference types="vite/client" />

type MediaItem = {
  id: string;
  title: string;
  filePath: string;
  fileSizeBytes: number | null;
  addedAt: string;
};

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
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

interface Window {
  zentube: {
    library: {
      list: () => Promise<MediaItem[]>;
      importFiles: () => Promise<MediaItem[]>;
    };
    playlists: {
      list: () => Promise<Playlist[]>;
      create: (input: { name: string; description?: string }) => Promise<Playlist>;
    };
    queue: {
      list: () => Promise<QueueJob[]>;
    };
  };
}
