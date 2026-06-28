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

// Serve static files (local dev)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// ── KV STORAGE (Vercel KV / Redis) ────────────────────────────────────────
// Falls back to in-memory if KV not configured
let kvClient = null;

async function getKV() {
  if (kvClient) return kvClient;
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { createClient } = require('@vercel/kv');
      kvClient = createClient({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      });
      console.log('[KV] Connected to Vercel KV');
    }
  } catch (e) {
    console.warn('[KV] Not available, using memory:', e.message);
  }
  return kvClient;
}

async function kvSet(key, value) {
  try {
    const kv = await getKV();
    if (kv) {
      await kv.set(key, JSON.stringify(value), { ex: 60 * 60 * 25 }); // 25hr TTL
      return true;
    }
  } catch (e) {
    console.warn('[KV] set failed:', e.message);
  }
  return false;
}

async function kvGet(key) {
  try {
    const kv = await getKV();
    if (kv) {
      const val = await kv.get(key);
      if (val) return typeof val === 'string' ? JSON.parse(val) : val;
    }
  } catch (e) {
    console.warn('[KV] get failed:', e.message);
  }
  return null;
}

// ── IN-MEMORY FALLBACK ─────────────────────────────────────────────────────
let memStore = {
  hackathons: getSeedData(),
  lastUpdated: new Date().toISOString(),
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

// ── GET STORE (KV first, memory fallback) ─────────────────────────────────
async function getStore() {
  const kvData = await kvGet('hackmap:store');
  if (kvData && kvData.hackathons && kvData.hackathons.length > 0) {
    return kvData;
  }
  return memStore;
}

// ── REFRESH ────────────────────────────────────────────────────────────────
async function refresh() {
  console.log('[Server] Refreshing hackathon data...');
  try {
    const data = await fetchAll();
    const stats = computeStats(data);
    const store = {
      hackathons: data,
      lastUpdated: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      fetchStats: stats
    };

    // Save to KV (persistent across all Vercel invocations)
    const saved = await kvSet('hackmap:store', store);
    console.log(`[Server] Saved to ${saved ? 'KV' : 'memory'}: ${data.length} hackathons`);

    // Also update memory
    memStore = store;
    return store;
  } catch (err) {
    console.error('[Server] Refresh failed:', err.message);
    return memStore;
  }
}

// ── CRON (works on persistent servers like Render) ─────────────────────────
cron.schedule('0 */6 * * *', () => {
  console.log('[Cron] 6-hour refresh triggered');
  refresh();
});

// ── API: GET /api/hackathons ───────────────────────────────────────────────
app.get('/api/hackathons', async (req, res) => {
  const store = await getStore();
  let data = [...store.hackathons];
  const today = new Date(); today.setHours(0,0,0,0);

  // Attach computed status
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

  // Sort
  const sortBy = sort || 'date-asc';
  if (sortBy === 'date-asc')   data.sort((a,b) => new Date(a.startDate) - new Date(b.startDate));
  if (sortBy === 'date-desc')  data.sort((a,b) => new Date(b.startDate) - new Date(a.startDate));
  if (sortBy === 'prize-desc') data.sort((a,b) => b.prize - a.prize);
  if (sortBy === 'name-asc')   data.sort((a,b) => a.name.localeCompare(b.name));

  res.json({
    success: true,
    count: data.length,
    lastUpdated: store.lastUpdated,
    nextUpdate: store.nextUpdate,
    storage: kvClient ? 'kv' : 'memory',
    data
  });
});

// ── API: GET /api/stats ────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  const store = await getStore();
  res.json({
    success: true,
    ...store.fetchStats,
    lastUpdated: store.lastUpdated,
    nextUpdate: store.nextUpdate,
    storage: kvClient ? 'kv' : 'memory'
  });
});

// ── API: POST /api/refresh ─────────────────────────────────────────────────
app.post('/api/refresh', async (req, res) => {
  const secret = process.env.REFRESH_SECRET;
  if (secret && req.headers['x-refresh-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const store = await refresh();
  res.json({
    success: true,
    message: 'Refreshed and saved to persistent storage',
    count: store.hackathons.length,
    lastUpdated: store.lastUpdated,
    storage: kvClient ? 'kv' : 'memory'
  });
});

// ── SERVE FRONTEND ─────────────────────────────────────────────────────────
const getHTML = () => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
  return `<!DOCTYPE html><html><body><script>window.location.href='/api/hackathons'</script></body></html>`;
};

app.get('/{*path}', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(getHTML());
});

// ── START ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`\n🚀 HackMap running on http://localhost:${PORT}`);
    console.log(`📦 Storage: ${process.env.KV_REST_API_URL ? 'Vercel KV (persistent)' : 'Memory (local dev)'}`);
    await refresh();
  });
}

module.exports = app;
