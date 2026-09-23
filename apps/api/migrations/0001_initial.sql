PRAGMA foreign_keys = ON;

CREATE TABLE videos (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title TEXT NOT NULL,
  file_id TEXT NOT NULL UNIQUE,
  quality TEXT NOT NULL DEFAULT '1080p',
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  duration REAL NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  is_publish INTEGER NOT NULL DEFAULT 1 CHECK (is_publish IN (0, 1)),
  thumbnail_url TEXT NOT NULL DEFAULT '',
  subtitle_file_id TEXT
);

CREATE INDEX videos_user_created ON videos(user_id, created_at DESC);
CREATE INDEX videos_public_created ON videos(is_public, is_publish, created_at DESC);

CREATE TABLE reactions (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  UNIQUE(video_id, user_id, emoji)
);

CREATE INDEX reactions_video_created ON reactions(video_id, created_at DESC);

CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  metadata TEXT,
  user_name TEXT
);

CREATE INDEX activity_logs_user_created ON activity_logs(user_id, created_at DESC);
