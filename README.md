# Freeze Dry Gallery

Personal art vault for [Freeze Dry](https://freezedry.art) inscriptions. Index, store, and serve your on-chain artwork from your own server.

## Quick Start

```bash
git clone https://github.com/freezedry-protocol/freezedry-gallery
cd freezedry-gallery
npm install
node setup.js    # interactive setup — enter your wallet, done
npm start
```

Open `http://localhost:3000` — your gallery is live.

## What It Does

1. Scans Solana for artworks inscribed by your wallet
2. Fetches blobs from the Freeze Dry CDN (or reconstructs from chain)
3. Stores everything locally in SQLite
4. Serves a gallery UI on your own domain
5. Short URLs for sharing individual pieces

## How It Gets Your Art

Your gallery discovers inscriptions through two paths:

- **Registry API** — fast lookup from `freezedry.art` (convenience)
- **On-chain Job PDAs** — reads Solana directly (always works, even if freezedry.art is down)

Blobs are fetched from:
- **CDN** — `cdn.freezedry.art` (fast, public, no auth)
- **Chain reconstruct** — reads memo transactions directly from Solana (guaranteed, always works)

No gossip protocol. No identity keys. No wallet or SOL needed. Just HTTP and RPC reads.

## Configuration

Copy `.env.example` to `.env`:

```env
WALLETS=YourWalletAddress,OptionalSecondWallet
GALLERY_NAME=My Gallery
PORT=3000
HELIUS_API_KEY=your-key-here   # optional, free at helius.dev
```

## Short URLs

Create aliases for easy sharing:

```bash
# Create alias
curl -X POST http://localhost:3000/api/alias \
  -H 'Content-Type: application/json' \
  -d '{"slug": "sunset", "hash": "sha256:abc..."}'

# Share: yourdomain.com/a/sunset
```

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Gallery grid |
| `GET /art.html?hash=...` | Single artwork detail |
| `GET /a/:slug` | Short URL → artwork |
| `GET /blob/:hash` | Raw blob download |
| `GET /api/artworks` | JSON artwork list |
| `GET /api/config` | Gallery config |
| `POST /api/scan` | Trigger manual rescan |
| `POST /api/alias` | Create short URL |

## Deploy

Any VPS works. $5/mo is plenty.

```bash
# Install Node.js 18+
# Clone repo, npm install, configure .env
# Run with PM2 or systemd:

pm2 start src/index.js --name gallery
# or
systemctl enable freezedry-gallery
```

Point your domain with nginx reverse proxy:

```nginx
server {
    server_name art.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

## Hosting Options

You don't need a powerful server — the gallery uses ~50MB of RAM. Pick whatever fits your budget:

| Provider | Cost | Notes |
|----------|------|-------|
| **Oracle Cloud** | **Free forever** | 1 GB RAM, 1 CPU — more than enough. [Always Free tier](https://www.oracle.com/cloud/free/) |
| **DigitalOcean** | $4/mo | Basic droplet. Simple UI, good docs |
| **Hetzner** | $4/mo | Great value in EU/US |
| **Vultr** | $3.50/mo | Cheapest paid option |
| **Railway / Render** | Free tier | No SSH needed, deploy from GitHub |
| **Home server** | $0 | Raspberry Pi, old laptop, anything with Node.js |

No wallet, no private keys, no SOL needed. Just a public wallet address and a server.

| Other costs | |
|-------------|------|
| Helius API key | $0 (free tier, optional) |
| Domain | $12/yr (optional — works fine on IP) |

## No Lock-In

Your art is on Solana. This gallery is just a viewer. If you stop running it, your art is still on-chain and reconstructable by anyone with an RPC endpoint. Start a new gallery, re-scan, and everything comes back.

## License

MIT
