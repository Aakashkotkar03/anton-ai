// electron/db.js — SQLite database initialisation + schema
// Single database file at %APPDATA%/AntonAI/antonai.db
// Tables created on first open. Schema versioned for future migrations.
//
// 🔒 Security: Database is in the user's AppData — not accessible from renderer.
//    All access goes through IPC handlers in the main process.

const { app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

// ---------------------------------------------------------------------------
// Module-level singleton — opened once, reused everywhere
// ---------------------------------------------------------------------------
let db = null;

function getDb() {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'antonai.db');

  db = new Database(dbPath, {
    // WAL mode = better concurrent read performance + crash resilience
    verbose: process.env.NODE_ENV === 'development' ? console.log : null,
  });

  // Enable WAL mode for performance
  db.pragma('journal_mode = WAL');
  // Foreign keys on
  db.pragma('foreign_keys = ON');

  // Create tables if they don't exist
  createTables(db);

  console.log('[db] SQLite opened:', dbPath);
  return db;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
function createTables(database) {
  database.exec(`
    -- Downloaded models on disk
    CREATE TABLE IF NOT EXISTS downloaded_models (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      version         TEXT,
      category        TEXT NOT NULL,
      file_path       TEXT NOT NULL,
      file_size_mb    REAL NOT NULL,
      downloaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Conversations (chat sessions)
    CREATE TABLE IF NOT EXISTS conversations (
      id              TEXT PRIMARY KEY,
      title           TEXT,
      persona         TEXT DEFAULT 'general',
      model_id        TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Messages within conversations
    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role            TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content         TEXT NOT NULL,
      token_count     INTEGER DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    -- FTS5 full-text search on messages (for search feature)
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      content=messages,
      content_rowid=rowid
    );

    -- Context summaries (Layer 3 auto-summarisation)
    CREATE TABLE IF NOT EXISTS context_summaries (
      id                  TEXT PRIMARY KEY,
      conversation_id     TEXT NOT NULL,
      summary_text        TEXT NOT NULL,
      turn_range_start    INTEGER NOT NULL,
      turn_range_end      INTEGER NOT NULL,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    -- App settings (key-value store)
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    -- Onboarding state
    CREATE TABLE IF NOT EXISTS onboarding (
      id                      INTEGER PRIMARY KEY CHECK(id = 1),
      completed               INTEGER NOT NULL DEFAULT 0,
      walkthrough_completed   INTEGER NOT NULL DEFAULT 0,
      completed_at            TEXT
    );

    -- Custom model import disclaimers
    CREATE TABLE IF NOT EXISTS custom_import_disclaimers (
      shown_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ---------------------------------------------------------------------------
// Helper: close cleanly on app quit
// ---------------------------------------------------------------------------
function closeDb() {
  if (db) {
    db.close();
    db = null;
    console.log('[db] SQLite closed.');
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = { getDb, closeDb };
