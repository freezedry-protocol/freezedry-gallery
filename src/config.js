/**
 * config.js — Gallery configuration from .env
 */

import { config } from 'dotenv';
config();

const env = (key) => (process.env[key] || '').trim();

/** Wallets to watch — comma-separated */
export const WALLETS = env('WALLETS').split(',').map(s => s.trim()).filter(Boolean);

/** Gallery display name */
export const GALLERY_NAME = env('GALLERY_NAME') || 'Freeze Dry Gallery';

/** Server port */
export const PORT = parseInt(env('PORT') || '3000', 10);

/** Helius API key (free tier works) */
export const HELIUS_API_KEY = env('HELIUS_API_KEY');

/** RPC URL — derived from Helius key or public fallback */
export const RPC_URL = env('RPC_URL')
  || (HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` : 'https://api.mainnet-beta.solana.com');

/** Freeze Dry registry API */
export const REGISTRY_URL = env('REGISTRY_URL') || 'https://freezedry.art';

/** CDN base URL for blob fetching */
export const CDN_URL = env('CDN_URL') || 'https://cdn.freezedry.art';

/** Data directory for SQLite */
export const DATA_DIR = env('DATA_DIR') || './data';

/** Poll interval for new inscriptions (ms) — default 30 min */
export const POLL_INTERVAL = parseInt(env('POLL_INTERVAL') || '1800000', 10);
