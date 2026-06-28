# ⚡ HackMap — Self-Updating Hackathon Aggregator

Real verified hackathons from Devpost, AllHackathons.com, ETHGlobal & more.
Auto-refreshes every 6 hours. Persistent storage via Vercel KV.

---

## 🚀 Full Setup (Vercel + KV = truly self-updating)

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "HackMap by Ahem Saxena"
git remote add origin https://github.com/ahemsaxena07/hackmap.git
git push -u origin main
```

### Step 2 — Deploy on Vercel
1. Go to **vercel.com** → New Project → Import your repo
2. Click **Deploy**

### Step 3 — Add Vercel KV (the persistent storage)
1. In Vercel Dashboard → go to your **hackmap** project
2. Click **Storage** tab → **Create Database** → choose **KV**
3. Name it `hackmap-kv` → click **Create**
4. Click **Connect to Project** → select hackmap → **Connect**
5. Vercel **automatically adds** `KV_REST_API_URL` and `KV_REST_API_TOKEN`
   to your environment variables — no manual copy needed
6. Go to **Deployments** → click the 3 dots on latest → **Redeploy**

### Step 4 — Set up cron-job.org (triggers the refresh)
1. Go to **cron-job.org** → sign up free
2. New cronjob → URL: `https://hackmap-one.vercel.app/api/refresh`
3. Method: `POST` → Schedule: every 6 hours → Save
4. Click **Run now** once to test

✅ Done! Now every 6 hours:
- cron-job.org pings /api/refresh
- Vercel scrapes Devpost RSS + AllHackathons.com
- Data is saved to KV database
- Every visitor sees the fresh scraped data instantly

---

## How it works

```
cron-job.org (every 6h)
      │
      ▼
POST /api/refresh
      │
      ▼
scraper.js fetches:
  • Devpost RSS feed
  • AllHackathons.com
  • dev.events
      │
      ▼
Data saved to Vercel KV ◄── persists forever
      │
      ▼
Any visitor → GET /api/hackathons → reads from KV → instant fresh data
```

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/hackathons` | All hackathons (filterable) |
| `GET /api/stats` | Live/upcoming counts + storage type |
| `POST /api/refresh` | Trigger manual refresh |

### Filter params
`country`, `month`, `status` (live/upcoming/ended), `prize` (prized/no-prize), `category`, `q` (search), `sort` (date-asc/date-desc/prize-desc/name-asc)

---

## Local Development
```bash
npm install
npm start
# Opens at http://localhost:3000
# Without KV env vars, runs fine with in-memory storage
```
