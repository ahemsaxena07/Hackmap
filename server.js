'use strict';
require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { fetchAll, getSeedData } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Serve static files (works locally and on some platforms) ──────────────
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// ── IN-MEMORY STORE ────────────────────────────────────────────────────────
let store = {
  hackathons: getSeedData(),
  lastUpdated: new Date().toISOString(),
  nextUpdate: null,
  fetchStats: { total: 0, live: 0, upcoming: 0 }
};

function computeStats(hackathons) {
  const today = new Date(); today.setHours(0,0,0,0);
  let live = 0, upcoming = 0;
  for (const h of hackathons) {
    const s = new Date(h.startDate);
    const e = h.endDate ? new Date(h.endDate) : null;
    if (s > today) upcoming++;
    else if (!e || e >= today) live++;
  }
  return { total: hackathons.length, live, upcoming };
}

async function refresh() {
  console.log('[Server] Refreshing hackathon data...');
  try {
    const data = await fetchAll();
    store.hackathons = data;
    store.lastUpdated = new Date().toISOString();
    store.fetchStats = computeStats(data);
    const next = new Date(Date.now() + 6 * 60 * 60 * 1000);
    store.nextUpdate = next.toISOString();
    console.log(`[Server] Updated: ${data.length} hackathons`);
  } catch (err) {
    console.error('[Server] Refresh failed:', err.message);
  }
}

// ── CRON: every 6 hours ────────────────────────────────────────────────────
cron.schedule('0 */6 * * *', () => { refresh(); });

// ── API ROUTES ─────────────────────────────────────────────────────────────
app.get('/api/hackathons', (req, res) => {
  let data = [...store.hackathons];
  const today = new Date(); today.setHours(0,0,0,0);

  data = data.map(h => {
    const s = new Date(h.startDate);
    const e = h.endDate ? new Date(h.endDate) : null;
    let status = 'upcoming';
    if (s <= today && (!e || e >= today)) status = 'live';
    else if (e && e < today) status = 'ended';
    return { ...h, status };
  });

  const { country, month, status, prize, category, q, sort } = req.query;
  if (country)  data = data.filter(h => h.country === country);
  if (month)    data = data.filter(h => new Date(h.startDate).getMonth() + 1 === parseInt(month));
  if (status)   data = data.filter(h => h.status === status);
  if (prize === 'prized')   data = data.filter(h => h.prize > 0);
  if (prize === 'no-prize') data = data.filter(h => h.prize === 0);
  if (category) data = data.filter(h => (h.tags||[]).some(t => t.toLowerCase().includes(category.toLowerCase())));
  if (q) {
    const query = q.toLowerCase();
    data = data.filter(h =>
      h.name.toLowerCase().includes(query) ||
      (h.org||'').toLowerCase().includes(query) ||
      (h.tags||[]).join(' ').toLowerCase().includes(query) ||
      h.country.toLowerCase().includes(query) ||
      (h.platform||'').toLowerCase().includes(query)
    );
  }

  const sortBy = sort || 'date-asc';
  if (sortBy === 'date-asc')   data.sort((a,b) => new Date(a.startDate) - new Date(b.startDate));
  if (sortBy === 'date-desc')  data.sort((a,b) => new Date(b.startDate) - new Date(a.startDate));
  if (sortBy === 'prize-desc') data.sort((a,b) => b.prize - a.prize);
  if (sortBy === 'name-asc')   data.sort((a,b) => a.name.localeCompare(b.name));

  res.json({ success: true, count: data.length, lastUpdated: store.lastUpdated, nextUpdate: store.nextUpdate, data });
});

app.get('/api/stats', (req, res) => {
  res.json({ success: true, ...store.fetchStats, lastUpdated: store.lastUpdated, nextUpdate: store.nextUpdate });
});

app.get('/api/countries', (req, res) => {
  const countries = [...new Set(store.hackathons.map(h => h.country))].sort();
  res.json({ success: true, countries });
});

app.post('/api/refresh', async (req, res) => {
  const secret = process.env.REFRESH_SECRET;
  if (secret && req.headers['x-refresh-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  await refresh();
  res.json({ success: true, message: 'Refreshed', count: store.hackathons.length, lastUpdated: store.lastUpdated });
});

// ── SERVE FRONTEND (inline HTML for Vercel compatibility) ──────────────────
const getHTML = () => {
  // Try reading from public/index.html first (local dev / Render)
  const filePath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  // Fallback: return a redirect page (shouldn't happen in normal deploy)
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>HackMap</title></head>
<body><script>window.location.href='/api/hackathons'</script></body></html>`;
};

app.get('/{*path}', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(getHTML());
});

// ── START ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`\n🚀 HackMap running on http://localhost:${PORT}`);
    await refresh();
  });
}

module.exports = app;
