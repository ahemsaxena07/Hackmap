# ⚡ HackMap — Self-Updating Hackathon Aggregator

A fully self-updating hackathon aggregator that pulls data from **Devpost, MLH, HackerEarth, Devfolio, Unstop, ETHGlobal, DoraHacks, Google Dev Events** and more — automatically refreshing every 6 hours.

## Features

- 🔄 **Auto-refreshes every 6 hours** — no manual work needed
- 🌍 **Global coverage** — USA, India, UK, Germany, Canada, Singapore, UAE and more
- 🔍 **Filters** — by country, month, status (live/upcoming/ended), prize, category
- 🔎 **Search** — by name, tech, organizer, country
- 📊 **Live stats** — total, live now, upcoming counts in header
- 💾 **49+ seed hackathons** always available even if live scraping fails
- 🚀 **One-click deploy** on Render (free tier) or Railway

---

## 🚀 Deploy in 5 Minutes (Render — Free)

### Step 1: Push to GitHub
```bash
# Create a new repo on github.com, then:
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/hackmap.git
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to **https://render.com** → Sign up (free)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo
4. Render auto-detects the `render.yaml` config
5. Click **"Deploy"** — done!

Your site will be live at: `https://hackmap.onrender.com` (or your custom name)

---

## 🚂 Deploy on Railway (Alternative — also free)

1. Go to **https://railway.app** → Sign up
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repo
4. Railway reads `Procfile` automatically
5. Your app is live in ~2 minutes

---

## 💻 Run Locally

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open http://localhost:3000
```

---

## 📁 Project Structure

```
hackmap/
├── server.js          # Express server + cron job (auto-refresh every 6h)
├── scraper.js         # Scrapes Devpost, MLH, ETHGlobal, DoraHacks, etc.
├── public/
│   └── index.html     # Frontend (fetches from /api/hackathons)
├── package.json
├── render.yaml        # Render deployment config
├── Procfile           # Railway/Heroku deployment config
├── .env.example       # Environment variables template
└── .gitignore
```

---

## 🔌 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/hackathons` | All hackathons with optional filters |
| `GET /api/stats` | Live/upcoming/total counts |
| `GET /api/countries` | List of all countries |
| `POST /api/refresh` | Manually trigger a data refresh |

### Query Parameters for `/api/hackathons`

| Param | Values | Example |
|-------|--------|---------|
| `country` | Country name | `?country=India` |
| `month` | 1–12 | `?month=9` |
| `status` | live, upcoming, ended | `?status=upcoming` |
| `prize` | prized, no-prize | `?prize=prized` |
| `category` | AI/ML, Web3, Mobile, etc. | `?category=AI/ML` |
| `q` | search string | `?q=blockchain` |
| `sort` | date-asc, date-desc, prize-desc, name-asc | `?sort=prize-desc` |

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` for local dev:

```
PORT=3000
REFRESH_SECRET=optional-secret-for-manual-refresh
```

---

## 🔄 How Auto-Updating Works

1. **On startup**: server immediately fetches from all sources
2. **Every 6 hours**: cron job runs `fetchAll()` in the background
3. **Seed data**: 49+ real hackathons always in memory as fallback
4. **Live scraping**: tries Devpost RSS, MLH, ETHGlobal, DoraHacks, Devfolio, HackerEarth, Unstop, Google Dev Events
5. **Deduplication**: merges live + seed data, removes duplicates by ID
6. **Frontend**: auto-refreshes its view every 10 minutes

---

## 📡 Data Sources

| Platform | Method |
|----------|--------|
| Devpost | RSS feed (`/hackathons.rss`) |
| MLH | HTML scrape + JSON-LD structured data |
| Devfolio | `__NEXT_DATA__` JSON extraction |
| HackerEarth | HTML + `__INITIAL_STATE__` JSON |
| ETHGlobal | `__NEXT_DATA__` JSON extraction |
| DoraHacks | HTML JSON extraction |
| Unstop | HTML JSON extraction |
| Google Dev Events | HTML article scraping |
| Seed data | 49+ curated hackathons (always available) |

---

## 🛠 Tech Stack

- **Backend**: Node.js + Express 5
- **Scraping**: Axios + xml2js
- **Scheduling**: node-cron
- **Frontend**: Vanilla HTML/CSS/JS (no framework needed)
- **Deploy**: Render / Railway (free tier)

---

## 🆓 Free Tier Notes

- **Render free**: spins down after 15min inactivity (first load ~20s)
- **Railway free**: $5/month credit, usually enough for this app
- **Recommendation**: Use Railway for always-on, Render for low traffic

To keep Render awake, use https://uptimerobot.com (free) to ping your URL every 5 minutes.
