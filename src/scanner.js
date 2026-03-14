/**
 * scanner.js — Discover inscribed artworks for configured wallets
 *
 * Three discovery paths, no lock-in:
 *   1. Registry API (fast, convenience)
 *   2. Job PDAs (on-chain, permissionless, always works)
 *   3. TX history (catches direct/self-inscription)
 */

import { WALLETS, REGISTRY_URL, POLL_INTERVAL } from './config.js';
import * as db from './db.js';
import { fetchBlob } from './fetcher.js';

let pollTimer = null;

/**
 * Discover all artworks for a wallet. Deduplicates across all paths.
 */
async function discoverWallet(wallet) {
  const found = new Map();
  let newCount = 0;

  // Path 1: Registry export API (fast, returns CDN URLs)
  try {
    const resp = await fetch(`${REGISTRY_URL}/api/registry?action=export&wallet=${wallet}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.ok && data.artworks) {
        for (const art of data.artworks) {
          found.set(art.hash, art);
        }
        console.log(`[scan] Registry: ${data.artworks.length} artworks for ${wallet.slice(0, 8)}...`);
      }
    }
  } catch (err) {
    console.warn(`[scan] Registry unavailable: ${err.message}`);
  }

  // Path 2: On-chain Job PDAs (fallback — always works)
  // Only if registry returned nothing (saves RPC credits)
  if (found.size === 0) {
    try {
      const { Connection, PublicKey } = await import('@solana/web3.js');
      const { RPC_URL } = await import('./config.js');
      const conn = new Connection(RPC_URL, 'confirmed');

      const JOBS_PROGRAM = new PublicKey('AmqBYKYCqpmKoFcgvripCQ3bJC2d8ygWWhcoHtmTvvzx');
      const JOB_DISC = Buffer.from([91, 16, 162, 5, 45, 210, 125, 65]);
      const walletPk = new PublicKey(wallet);

      const accounts = await conn.getProgramAccounts(JOBS_PROGRAM, {
        filters: [
          { memcmp: { offset: 0, bytes: JOB_DISC.toString('base64'), encoding: 'base64' } },
          { memcmp: { offset: 16, bytes: walletPk.toBase58() } },
        ],
      });

      for (const { account } of accounts) {
        const data = account.data;
        if (data.length < 60) continue;
        // Parse contentHash from Job PDA (offset 56: 4-byte LE length + UTF-8)
        const hashLen = data.readUInt32LE(56);
        if (hashLen > 128 || 60 + hashLen > data.length) continue;
        const contentHash = data.subarray(60, 60 + hashLen).toString('utf8');
        const chunkCount = data.readUInt32LE(60 + hashLen);
        if (contentHash && !found.has(contentHash)) {
          found.set(contentHash, {
            hash: contentHash.startsWith('sha256:') ? contentHash : `sha256:${contentHash}`,
            chunkCount,
          });
        }
      }
      console.log(`[scan] On-chain: found ${accounts.length} jobs for ${wallet.slice(0, 8)}...`);
    } catch (err) {
      console.warn(`[scan] On-chain scan failed: ${err.message}`);
    }
  }

  // Store and fetch blobs for new discoveries
  for (const [hash, meta] of found) {
    const existing = db.getArtwork(hash);
    if (!existing) {
      db.upsertArtwork({
        hash: meta.hash || hash,
        name: meta.name || null,
        blobSize: meta.blobSize || null,
        chunkCount: meta.chunkCount || null,
        pointerSig: meta.pointerSig || null,
        nftAddress: meta.nftAddress || null,
        timestamp: meta.timestamp || null,
      });
      newCount++;
    }

    // Fetch blob if we don't have it yet
    if (!existing?.has_blob) {
      await fetchBlob(meta.hash || hash);
    }
  }

  if (newCount > 0) console.log(`[scan] Added ${newCount} new artworks for ${wallet.slice(0, 8)}...`);
  return found.size;
}

/**
 * Scan all configured wallets
 */
export async function scanAll() {
  if (WALLETS.length === 0) {
    console.warn('[scan] No wallets configured — set WALLETS in .env');
    return;
  }

  console.log(`[scan] Scanning ${WALLETS.length} wallet(s)...`);
  let total = 0;
  for (const wallet of WALLETS) {
    total += await discoverWallet(wallet);
  }
  console.log(`[scan] Done — ${total} total artworks, ${db.countWithBlobs()} with blobs`);
}

/**
 * Start periodic scanning
 */
export function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    scanAll().catch(err => console.error('[scan] Poll error:', err.message));
  }, POLL_INTERVAL);
  console.log(`[scan] Polling every ${Math.round(POLL_INTERVAL / 60000)} min`);
}

export function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}
