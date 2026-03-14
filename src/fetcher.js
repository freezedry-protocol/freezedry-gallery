/**
 * fetcher.js — Fetch blobs from CDN or reconstruct from chain
 *
 * Two paths, both public, no auth:
 *   1. CDN: cdn.freezedry.art/blob/{hash} (fast)
 *   2. Chain: RPC → pointer memo → chunk TXs → reassemble (guaranteed)
 */

import { CDN_URL } from './config.js';
import * as db from './db.js';

/**
 * Parse .hyd blob header to extract dimensions
 */
function parseHydHeader(buf) {
  if (buf.length < 49) return { width: null, height: null };
  // Check magic: HYD\x01
  if (buf[0] !== 0x48 || buf[1] !== 0x59 || buf[2] !== 0x44 || buf[3] !== 0x01) {
    return { width: null, height: null };
  }
  const width = buf[5] | (buf[6] << 8);
  const height = buf[7] | (buf[8] << 8);
  return { width, height };
}

/**
 * Fetch a blob by hash. Tries CDN first, chain fallback.
 */
export async function fetchBlob(hash) {
  // Already have it?
  const existing = db.getBlob(hash);
  if (existing) return true;

  // Path 1: CDN (fast, free, public)
  try {
    const resp = await fetch(`${CDN_URL}/blob/${hash}`, { signal: AbortSignal.timeout(30000) });
    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer());
      const { width, height } = parseHydHeader(buf);
      db.storeBlob(hash, buf, width, height);
      console.log(`[fetch] CDN: ${hash.slice(0, 24)}... (${buf.length} bytes)`);
      return true;
    }
  } catch (err) {
    console.warn(`[fetch] CDN miss for ${hash.slice(0, 24)}...: ${err.message}`);
  }

  // Path 2: Chain reconstruct via Freeze Dry API (handles RPC internally)
  try {
    const resp = await fetch(`https://freezedry.art/api/fetch-chain?hash=${encodeURIComponent(hash)}`, {
      signal: AbortSignal.timeout(120000),
    });
    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length > 0) {
        const { width, height } = parseHydHeader(buf);
        db.storeBlob(hash, buf, width, height);
        console.log(`[fetch] Chain: ${hash.slice(0, 24)}... (${buf.length} bytes)`);
        return true;
      }
    }
  } catch (err) {
    console.warn(`[fetch] Chain reconstruct failed for ${hash.slice(0, 24)}...: ${err.message}`);
  }

  console.warn(`[fetch] Could not fetch ${hash.slice(0, 24)}... — will retry next scan`);
  return false;
}
