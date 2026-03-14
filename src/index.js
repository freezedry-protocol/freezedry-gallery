/**
 * Freeze Dry Gallery — Personal art vault
 *
 * Index, store, and serve your inscribed artwork.
 * No marketplace, no gossip, no wallet needed.
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PORT, GALLERY_NAME, WALLETS } from './config.js';
import * as db from './db.js';
import { scanAll, startPolling } from './scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: false });

// Serve static files (gallery UI)
app.register(fastifyStatic, {
  root: join(__dirname, '..', 'public'),
  prefix: '/',
});

// ── API Routes ────────────────────────────────────────────────────────────

// Gallery config (for frontend)
app.get('/api/config', async () => ({
  name: GALLERY_NAME,
  wallets: WALLETS,
  totalArtworks: db.count(),
  totalWithBlobs: db.countWithBlobs(),
}));

// List all artworks (with blobs only by default)
app.get('/api/artworks', async (req) => {
  const all = req.query.all === 'true';
  const artworks = all ? db.listAll() : db.listWithBlobs();
  return { artworks, count: artworks.length };
});

// Single artwork metadata
app.get('/api/artwork/:hash', async (req, reply) => {
  const art = db.getArtwork(req.params.hash);
  if (!art) return reply.code(404).send({ error: 'Not found' });
  return art;
});

// Serve raw blob
app.get('/blob/:hash', async (req, reply) => {
  const blob = db.getBlob(req.params.hash);
  if (!blob) return reply.code(404).send({ error: 'Blob not found' });
  reply.header('Content-Type', 'application/octet-stream');
  reply.header('Content-Length', blob.length);
  reply.header('Cache-Control', 'public, max-age=31536000, immutable');
  return reply.send(blob);
});

// Short URL alias → redirect to artwork page
app.get('/a/:slug', async (req, reply) => {
  const hash = db.resolveAlias(req.params.slug);
  if (!hash) return reply.code(404).send({ error: 'Alias not found' });
  return reply.redirect(`/art.html?hash=${encodeURIComponent(hash)}`);
});

// Manage aliases
app.get('/api/aliases', async () => ({ aliases: db.listAliases() }));

app.post('/api/alias', async (req, reply) => {
  const { slug, hash } = req.body || {};
  if (!slug || !hash) return reply.code(400).send({ error: 'Missing slug or hash' });
  if (!/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/.test(slug)) {
    return reply.code(400).send({ error: 'Slug must be 2-50 chars, lowercase alphanumeric + hyphens' });
  }
  const art = db.getArtwork(hash);
  if (!art) return reply.code(404).send({ error: 'Artwork not found' });
  db.setAlias(slug, hash);
  return { ok: true, slug, hash };
});

app.delete('/api/alias/:slug', async (req) => {
  db.deleteAlias(req.params.slug);
  return { ok: true };
});

// Trigger manual rescan
app.post('/api/scan', async () => {
  await scanAll();
  return { ok: true, total: db.count(), withBlobs: db.countWithBlobs() };
});

// ── Start ─────────────────────────────────────────────────────────────────

async function start() {
  console.log(`\n  Freeze Dry Gallery — ${GALLERY_NAME}`);
  console.log(`  Watching ${WALLETS.length} wallet(s)\n`);

  // Initial scan
  if (WALLETS.length > 0) {
    await scanAll();
  } else {
    console.log('  No wallets configured — add WALLETS to .env\n');
  }

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n  Gallery running at http://localhost:${PORT}`);
  console.log(`  ${db.countWithBlobs()} artworks ready to view\n`);

  // Start polling for new inscriptions
  startPolling();
}

start().catch(err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
