'use strict';
require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const cors = require('cors');
const path = require('path');
const { fetchAll, getSeedData } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    console.log(`[Server] Store updated: ${data.length} hackathons. Live: ${store.fetchStats.live}, Upcoming: ${store.fetchStats.upcoming}`);
  } catch (err) {
    console.error('[Server] Refresh failed:', err.message);
  }
}

// ── CRON: every 6 hours ────────────────────────────────────────────────────
cron.schedule('0 */6 * * *', () => {
  console.log('[Cron] 6-hour refresh triggered');
  refresh();
});

// ── API ROUTES ─────────────────────────────────────────────────────────────
// GET /api/hackathons — returns all with optional filters
app.get('/api/hackathons', (req, res) => {
  let data = [...store.hackathons];
  const today = new Date(); today.setHours(0,0,0,0);

  // Attach status to each
  data = data.map(h => {
    const s = new Date(h.startDate);
    const e = h.endDate ? new Date(h.endDate) : null;
    let status = 'upcoming';
    if (s <= today && (!e || e >= today)) status = 'live';
    else if (e && e < today) status = 'ended';
    return { ...h, status };
  });

  // Filters
  const { country, month, status, prize, category, q, sort } = req.query;
  if (country) data = data.filter(h => h.country === country);
  if (month) data = data.filter(h => new Date(h.startDate).getMonth() + 1 === parseInt(month));
  if (status) data = data.filter(h => h.status === status);
  if (prize === 'prized') data = data.filter(h => h.prize > 0);
  if (prize === 'no-prize') data = data.filter(h => h.prize === 0);
  if (category) data = data.filter(h => h.tags.some(t => t.toLowerCase().includes(category.toLowerCase())));
  if (q) {
    const query = q.toLowerCase();
    data = data.filter(h =>
      h.name.toLowerCase().includes(query) ||
      h.org.toLowerCase().includes(query) ||
      h.tags.join(' ').toLowerCase().includes(query) ||
      h.country.toLowerCase().includes(query) ||
      h.platform.toLowerCase().includes(query)
    );
  }

  // Sort
  const sortBy = sort || 'date-asc';
  if (sortBy === 'date-asc') data.sort((a,b) => new Date(a.startDate) - new Date(b.startDate));
  if (sortBy === 'date-desc') data.sort((a,b) => new Date(b.startDate) - new Date(a.startDate));
  if (sortBy === 'prize-desc') data.sort((a,b) => b.prize - a.prize);
  if (sortBy === 'name-asc') data.sort((a,b) => a.name.localeCompare(b.name));

  res.json({
    success: true,
    count: data.length,
    lastUpdated: store.lastUpdated,
    nextUpdate: store.nextUpdate,
    data
  });
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    ...store.fetchStats,
    lastUpdated: store.lastUpdated,
    nextUpdate: store.nextUpdate
  });
});

// GET /api/countries
app.get('/api/countries', (req, res) => {
  const countries = [...new Set(store.hackathons.map(h => h.country))].sort();
  res.json({ success: true, countries });
});

// POST /api/refresh — manual trigger (optionally password-protected)
app.post('/api/refresh', async (req, res) => {
  const secret = process.env.REFRESH_SECRET;
  if (secret && req.headers['x-refresh-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  await refresh();
  res.json({ success: true, message: 'Refreshed', count: store.hackathons.length, lastUpdated: store.lastUpdated });
});

// Catch-all: serve the frontend
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START ──────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 HackMap server running on http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/hackathons`);
  console.log(`⏰ Auto-refresh: every 6 hours\n`);
  // Initial fetch on startup
  await refresh();
});
