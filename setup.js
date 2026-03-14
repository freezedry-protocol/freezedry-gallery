#!/usr/bin/env node
/**
 * Freeze Dry Gallery — Setup Wizard
 * Run: npx freezedry-gallery  or  node setup.js
 */

import { createInterface } from 'readline';
import { writeFileSync, existsSync } from 'fs';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function setup() {
  console.log('\n  Freeze Dry Gallery Setup\n');

  if (existsSync('.env')) {
    const overwrite = await ask('  .env already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('  Keeping existing .env. Run: npm start\n');
      rl.close();
      return;
    }
  }

  const wallet = await ask('  Your wallet address: ');
  if (!wallet || wallet.length < 32) {
    console.log('  Invalid wallet address.\n');
    rl.close();
    return;
  }

  const extraWallets = await ask('  Additional wallets (comma-separated, Enter to skip): ');
  const allWallets = [wallet, ...extraWallets.split(',').map(s => s.trim())].filter(Boolean);

  const name = await ask('  Gallery name (default: My Gallery): ') || 'My Gallery';
  const helius = await ask('  Helius API key (free at helius.dev, Enter for public RPC): ');
  const port = await ask('  Port (default: 3000): ') || '3000';

  const env = [
    `WALLETS=${allWallets.join(',')}`,
    `GALLERY_NAME=${name}`,
    `PORT=${port}`,
    helius ? `HELIUS_API_KEY=${helius}` : '# HELIUS_API_KEY=your-key-here',
    '# DATA_DIR=./data',
    '# POLL_INTERVAL=1800000',
  ].join('\n');

  writeFileSync('.env', env + '\n');
  console.log('\n  .env written.\n');
  console.log('  Start your gallery:');
  console.log('    npm start\n');

  rl.close();
}

setup().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
