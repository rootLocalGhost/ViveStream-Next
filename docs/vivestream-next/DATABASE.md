# Database Schema & Models

ViveStream-Next uses a local SQLite database for fast access and metadata management. The database is initialized and managed in `src-tauri/src/db.rs`.

## Schema

### `Videos` Table
Stores metadata for all downloaded or added media.
- `id` (TEXT, PRIMARY KEY): The unique identifier (usually YouTube ID).
- `title` (TEXT): The media title.
- `channel` (TEXT): The channel or artist name.
- `video_path` (TEXT): Local file path to the media.
- `thumbnail_path` (TEXT): Local file path to the cached thumbnail.
- `duration` (INTEGER): Media duration in seconds.
- `added_at` (DATETIME): Timestamp when added.
- `is_favorite` (BOOLEAN): Favorite toggle state.

### `Playlists` Table
Stores user-created playlists.
- `id` (TEXT, PRIMARY KEY): UUID for the playlist.
- `name` (TEXT): Playlist display name.
- `created_at` (DATETIME): Creation timestamp.
- `cover_path` (TEXT, Nullable): Path to custom cover image.
- `banner_path` (TEXT, Nullable): Path to custom banner image.

### `Playlist_Videos` (Junction Table)
Maps videos to playlists, maintaining order.
- `playlist_id` (TEXT): Foreign key to `Playlists.id`.
- `video_id` (TEXT): Foreign key to `Videos.id`.
- `order_index` (INTEGER): Index for custom drag-and-drop sorting.

### `DownloadHistory` Table
Maintains a log of past downloads.
- `id` (TEXT, PRIMARY KEY): UUID.
- `video_id` (TEXT): The extracted ID.
- `title` (TEXT): Title.
- `channel` (TEXT): Channel.
- `url` (TEXT): Source URL.
- `downloaded_at` (DATETIME): Attempt timestamp.
- `status` (TEXT): e.g., 'Completed', 'Error'.

### `Artists` Table (Virtual/Derived)
Channels are dynamically derived from the `Videos` table, but custom avatars are persisted.
- `name` (TEXT, PRIMARY KEY): Channel/Artist name.
- `avatar_path` (TEXT): Path to custom avatar image.

## Access Patterns
The frontend requests data via standard Tauri IPC commands (e.g., `get_downloaded_videos`, `get_playlists`). The Rust backend executes the required SQLite queries using the `rusqlite` crate and serializes the response structs back to the frontend.
