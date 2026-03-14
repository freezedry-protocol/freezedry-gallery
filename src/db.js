/**
 * db.js — SQLite storage for gallery artworks and blobs
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { DATA_DIR } from './config.js';

mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(`${DATA_DIR}/gallery.db`);
db.pragma('journal_mode = WAL');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS artworks (
    hash TEXT PRIMARY KEY,
    name TEXT,
    blob_size INTEGER,
    chunk_count INTEGER,
    pointer_sig TEXT,
    nft_address TEXT,
    timestamp INTEGER,
    width INTEGER,
    height INTEGER,
    has_blob INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS blobs (
    hash TEXT PRIMARY KEY,
    data BLOB NOT NULL,
    FOREIGN KEY (hash) REFERENCES artworks(hash)
  );

  CREATE TABLE IF NOT EXISTS aliases (
    slug TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    FOREIGN KEY (hash) REFERENCES artworks(hash)
  );
`);

// Prepared statements
const stmts = {
  upsert: db.prepare(`
    INSERT INTO artworks (hash, name, blob_size, chunk_count, pointer_sig, nft_address, timestamp)
    VALUES (@hash, @name, @blobSize, @chunkCount, @pointerSig, @nftAddress, @timestamp)
    ON CONFLICT(hash) DO UPDATE SET
      name = COALESCE(@name, name),
      blob_size = COALESCE(@blobSize, blob_size),
      chunk_count = COALESCE(@chunkCount, chunk_count),
      pointer_sig = COALESCE(@pointerSig, pointer_sig),
      nft_address = COALESCE(@nftAddress, nft_address),
      timestamp = COALESCE(@timestamp, timestamp)
  `),
  storeBlob: db.prepare(`INSERT OR REPLACE INTO blobs (hash, data) VALUES (?, ?)`),
  markHasBlob: db.prepare(`UPDATE artworks SET has_blob = 1, width = ?, height = ? WHERE hash = ?`),
  getBlob: db.prepare(`SELECT data FROM blobs WHERE hash = ?`),
  getArtwork: db.prepare(`SELECT * FROM artworks WHERE hash = ?`),
  listAll: db.prepare(`SELECT * FROM artworks ORDER BY timestamp DESC`),
  listWithBlobs: db.prepare(`SELECT * FROM artworks WHERE has_blob = 1 ORDER BY timestamp DESC`),
  count: db.prepare(`SELECT COUNT(*) as total FROM artworks`),
  countWithBlobs: db.prepare(`SELECT COUNT(*) as total FROM artworks WHERE has_blob = 1`),
  setAlias: db.prepare(`INSERT OR REPLACE INTO aliases (slug, hash) VALUES (?, ?)`),
  getAlias: db.prepare(`SELECT hash FROM aliases WHERE slug = ?`),
  listAliases: db.prepare(`SELECT slug, hash FROM aliases ORDER BY slug`),
  deleteAlias: db.prepare(`DELETE FROM aliases WHERE slug = ?`),
};

export function upsertArtwork(art) {
  stmts.upsert.run({
    hash: art.hash,
    name: art.name || null,
    blobSize: art.blobSize || null,
    chunkCount: art.chunkCount || null,
    pointerSig: art.pointerSig || null,
    nftAddress: art.nftAddress || null,
    timestamp: art.timestamp || null,
  });
}

export function storeBlob(hash, buffer, width, height) {
  stmts.storeBlob.run(hash, buffer);
  stmts.markHasBlob.run(width || null, height || null, hash);
}

export function getBlob(hash) {
  const row = stmts.getBlob.get(hash);
  return row ? row.data : null;
}

export function getArtwork(hash) { return stmts.getArtwork.get(hash); }
export function listAll() { return stmts.listAll.all(); }
export function listWithBlobs() { return stmts.listWithBlobs.all(); }
export function count() { return stmts.count.get().total; }
export function countWithBlobs() { return stmts.countWithBlobs.get().total; }

export function setAlias(slug, hash) { stmts.setAlias.run(slug, hash); }
export function resolveAlias(slug) {
  const row = stmts.getAlias.get(slug);
  return row ? row.hash : null;
}
export function listAliases() { return stmts.listAliases.all(); }
export function deleteAlias(slug) { stmts.deleteAlias.run(slug); }
