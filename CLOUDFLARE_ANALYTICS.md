# Cloudflare Analytics Setup

This project uses a tiny Cloudflare Worker + D1 analytics backend.

It records:

- PV: one row per page view
- UV: unique anonymous browser id from `localStorage`
- Today PV and UV
- Recent daily PV and UV

It does not store visitor IP addresses.

## Setup

1. Install Node.js from https://nodejs.org if it is not installed.
2. Run `npm install`.
3. Run `npx wrangler login`.
4. Run `npx wrangler d1 create comeback_countdown_analytics`.
5. Copy the returned `database_id` into `wrangler.toml`.
6. Run `npx wrangler d1 migrations apply comeback_countdown_analytics --remote`.
7. Optional: run `npx wrangler secret put STATS_TOKEN` to protect `/stats`.
8. Run `npx wrangler deploy`.
9. Copy the Worker URL into `analyticsEndpoint` in `index.html`.
10. Push `index.html`, `stats.html`, and the Worker files to GitHub.

## Endpoints

- `POST /track`: records one page view.
- `GET /stats`: returns total, today, and recent PV/UV.

If `STATS_TOKEN` is set, open stats with:

`https://your-worker.your-subdomain.workers.dev/stats?token=YOUR_TOKEN`
