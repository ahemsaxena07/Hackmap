'use strict';
const axios = require('axios');
const xml2js = require('xml2js');

const UA = 'Mozilla/5.0 (compatible; HackMap/1.0; +https://github.com/hackmap)';
const TIMEOUT = 15000;

// ── HELPERS ────────────────────────────────────────────────────────────────
function safeDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function parseAmount(str) {
  if (!str) return 0;
  const m = str.replace(/,/g, '').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

function guessCountry(text = '') {
  const t = text.toLowerCase();
  if (t.includes('online') || t.includes('virtual') || t.includes('remote') || t.includes('worldwide') || t.includes('global')) return 'Online';
  if (t.includes('india') || t.includes('bengaluru') || t.includes('mumbai') || t.includes('delhi') || t.includes('hyderabad') || t.includes('chennai') || t.includes('pune') || t.includes('bangalore')) return 'India';
  if (t.includes('usa') || t.includes('united states') || t.includes(', ca') || t.includes(', ny') || t.includes(', tx') || t.includes(', ma') || t.includes(', wa') || t.includes('california') || t.includes('new york') || t.includes('texas') || t.includes('chicago') || t.includes('san francisco') || t.includes('boston') || t.includes('seattle') || t.includes('stanford') || t.includes('mit') || t.includes('harvard') || t.includes('berkeley')) return 'USA';
  if (t.includes('uk') || t.includes('united kingdom') || t.includes('london') || t.includes('oxford') || t.includes('cambridge england') || t.includes('manchester') || t.includes('england')) return 'UK';
  if (t.includes('germany') || t.includes('berlin') || t.includes('munich') || t.includes('hamburg')) return 'Germany';
  if (t.includes('canada') || t.includes('toronto') || t.includes('waterloo') || t.includes('vancouver') || t.includes('montreal')) return 'Canada';
  if (t.includes('singapore')) return 'Singapore';
  if (t.includes('france') || t.includes('paris')) return 'France';
  if (t.includes('pakistan') || t.includes('lahore') || t.includes('karachi') || t.includes('islamabad')) return 'Pakistan';
  if (t.includes('south korea') || t.includes('seoul') || t.includes('korea')) return 'South Korea';
  if (t.includes('australia') || t.includes('sydney') || t.includes('melbourne')) return 'Australia';
  if (t.includes('nigeria') || t.includes('lagos') || t.includes('abuja')) return 'Nigeria';
  if (t.includes('brazil') || t.includes('são paulo') || t.includes('rio')) return 'Brazil';
  if (t.includes('japan') || t.includes('tokyo') || t.includes('osaka')) return 'Japan';
  if (t.includes('netherlands') || t.includes('amsterdam') || t.includes('delft')) return 'Netherlands';
  if (t.includes('switzerland') || t.includes('zurich') || t.includes('geneva') || t.includes('zürich')) return 'Switzerland';
  if (t.includes('uae') || t.includes('dubai') || t.includes('abu dhabi')) return 'UAE';
  if (t.includes('finland') || t.includes('helsinki')) return 'Finland';
  if (t.includes('philippines') || t.includes('manila')) return 'Philippines';
  if (t.includes('spain') || t.includes('barcelona') || t.includes('madrid')) return 'Spain';
  if (t.includes('netherlands')) return 'Netherlands';
  if (t.includes('poland') || t.includes('warsaw')) return 'Poland';
  return 'Online';
}

function guessTags(text = '') {
  const t = text.toLowerCase();
  const tags = [];
  if (t.match(/\b(ai|ml|machine learning|artificial intelligence|llm|gpt|generative|deep learning|nlp)\b/)) tags.push('AI/ML');
  if (t.match(/\b(web3|blockchain|crypto|ethereum|solana|defi|nft|dao|smart contract)\b/)) tags.push('Web3');
  if (t.match(/\b(mobile|ios|android|flutter|react native|app store)\b/)) tags.push('Mobile');
  if (t.match(/\b(health|medical|biotech|hospital|patient|clinical|biohack)\b/)) tags.push('Health');
  if (t.match(/\b(climate|environment|sustainability|green|carbon|energy|clean)\b/)) tags.push('Climate');
  if (t.match(/\b(fintech|finance|banking|payment|financial|money|trading)\b/)) tags.push('Fintech');
  if (t.match(/\b(game|gaming|unity|unreal|gamedev)\b/)) tags.push('Gaming');
  if (t.match(/\b(social impact|education|nonprofit|community|inclusion|accessibility)\b/)) tags.push('Social Impact');
  if (t.match(/\b(security|cybersecurity|privacy|hacking|ctf|pentest)\b/)) tags.push('Security');
  if (t.match(/\b(cloud|aws|azure|gcp|kubernetes|docker|devops|api)\b/)) tags.push('Cloud');
  if (tags.length === 0) tags.push('Open Innovation');
  return [...new Set(tags)];
}

function slug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── SOURCE 1: DEVPOST RSS ─────────────────────────────────────────────────
async function fetchDevpost() {
  const results = [];
  const feeds = [
    'https://devpost.com/hackathons.rss',
    'https://devpost.com/hackathons.rss?challenge_type=online&status=upcoming',
    'https://devpost.com/hackathons.rss?challenge_type=in-person&status=upcoming',
  ];

  for (const url of feeds) {
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': UA },
        timeout: TIMEOUT
      });
      const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: false });
      const items = parsed?.rss?.channel?.item;
      if (!items) continue;
      const list = Array.isArray(items) ? items : [items];

      for (const item of list) {
        const desc = [item.description || '', item.title || ''].join(' ');
        const link = item.link || 'https://devpost.com/hackathons';

        // parse dates from description
        const dateMatch = desc.match(/(\w+ \d+,? \d{4})/g);
        let startDate = dateMatch ? safeDate(dateMatch[0]) : null;
        let endDate = dateMatch && dateMatch[1] ? safeDate(dateMatch[1]) : null;
        if (!startDate) startDate = safeDate(item.pubDate);

        // parse prize
        const prizeMatch = desc.match(/\$[\d,]+/);
        const prize = prizeMatch ? parseAmount(prizeMatch[0]) : 0;
        const prizeLabel = prizeMatch ? prizeMatch[0] + ' in prizes' : 'Non-monetary';

        const country = guessCountry(desc + ' ' + (item['dc:coverage'] || ''));
        const tags = guessTags(item.title + ' ' + desc);

        results.push({
          id: 'devpost-' + slug(item.title || link),
          name: (item.title || 'Devpost Hackathon').trim(),
          org: 'Devpost',
          platform: 'Devpost',
          country,
          startDate: startDate || new Date().toISOString().split('T')[0],
          endDate,
          prize,
          prizeLabel,
          tags,
          url: link,
          accent: '#6366f1',
          source: 'devpost-rss'
        });
      }
    } catch (e) {
      console.warn('[Devpost RSS] failed:', e.message);
    }
  }
  return results;
}

// ── SOURCE 2: MLH JSON ────────────────────────────────────────────────────
async function fetchMLH() {
  const results = [];
  try {
    // MLH embeds event data as JSON in their events page
    const res = await axios.get('https://mlh.io/seasons/2026/events', {
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT
    });
    const html = res.data;

    // Extract event blocks - MLH uses structured data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        try {
          const json = JSON.parse(block.replace(/<script[^>]*>|<\/script>/g, ''));
          const events = Array.isArray(json) ? json : [json];
          for (const ev of events) {
            if (ev['@type'] !== 'Event') continue;
            const loc = ev.location?.address?.addressCountry || ev.location?.name || 'Online';
            results.push({
              id: 'mlh-' + slug(ev.name || ''),
              name: ev.name || 'MLH Hackathon',
              org: ev.organizer?.name || 'MLH',
              platform: 'MLH',
              country: guessCountry(loc + ' ' + (ev.description || '')),
              startDate: safeDate(ev.startDate) || new Date().toISOString().split('T')[0],
              endDate: safeDate(ev.endDate),
              prize: 0,
              prizeLabel: 'Non-monetary',
              tags: guessTags(ev.name + ' ' + (ev.description || '')),
              url: ev.url || 'https://mlh.io/seasons/2026/events',
              accent: '#22c55e',
              source: 'mlh-json'
            });
          }
        } catch (_) {}
      }
    }

    // Fallback: parse HTML event cards
    if (results.length === 0) {
      const nameRe = /<h3[^>]*class="[^"]*event-name[^"]*"[^>]*>([\s\S]*?)<\/h3>/g;
      const dateRe = /(\w+ \d+(?:–\d+)?,? \d{4})/g;
      const locRe = /<span[^>]*class="[^"]*event-location[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
      const urlRe = /<a[^>]*href="(https:\/\/[^"]+)"[^>]*class="[^"]*event-link[^"]*"/g;

      let m;
      const names = [], dates = [], locs = [], urls = [];
      while ((m = nameRe.exec(html)) !== null) names.push(m[1].replace(/<[^>]+>/g, '').trim());
      while ((m = dateRe.exec(html)) !== null) dates.push(m[1]);
      while ((m = locRe.exec(html)) !== null) locs.push(m[1].replace(/<[^>]+>/g, '').trim());
      while ((m = urlRe.exec(html)) !== null) urls.push(m[1]);

      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (!name || name.length < 3) continue;
        results.push({
          id: 'mlh-' + slug(name),
          name,
          org: 'MLH',
          platform: 'MLH',
          country: guessCountry(locs[i] || ''),
          startDate: safeDate(dates[i * 2]) || new Date().toISOString().split('T')[0],
          endDate: safeDate(dates[i * 2 + 1]),
          prize: 0,
          prizeLabel: 'Non-monetary',
          tags: guessTags(name),
          url: urls[i] || 'https://mlh.io/seasons/2026/events',
          accent: '#22c55e',
          source: 'mlh-html'
        });
      }
    }
  } catch (e) {
    console.warn('[MLH] failed:', e.message);
  }
  return results;
}

// ── SOURCE 3: DEVFOLIO ────────────────────────────────────────────────────
async function fetchDevfolio() {
  const results = [];
  try {
    const res = await axios.get('https://devfolio.co/hackathons', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      timeout: TIMEOUT
    });
    const html = res.data;

    // Devfolio embeds __NEXT_DATA__ JSON
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const json = JSON.parse(nextDataMatch[1]);
        // Walk the props tree for hackathon data
        const hackathons = findNestedArray(json, 'hackathons') || findNestedArray(json, 'results') || [];
        for (const h of hackathons.slice(0, 50)) {
          const name = h.name || h.title || '';
          if (!name) continue;
          results.push({
            id: 'devfolio-' + slug(name),
            name,
            org: h.organization || h.team_name || 'Community',
            platform: 'Devfolio',
            country: guessCountry((h.city || '') + ' ' + (h.country || '') + ' ' + (h.location || '')),
            startDate: safeDate(h.starts_at || h.start_date || h.hackathon_setting?.starts_at) || new Date().toISOString().split('T')[0],
            endDate: safeDate(h.ends_at || h.end_date || h.hackathon_setting?.ends_at),
            prize: parseAmount(h.prize_pool || h.total_prizes || '0'),
            prizeLabel: h.prize_pool ? '₹' + h.prize_pool : 'Non-monetary',
            tags: guessTags(name + ' ' + (h.description || '')),
            url: h.url ? 'https://' + h.url + '.devfolio.co' : 'https://devfolio.co/hackathons',
            accent: '#3b82f6',
            source: 'devfolio'
          });
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn('[Devfolio] failed:', e.message);
  }
  return results;
}

function findNestedArray(obj, key, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj[key]) && obj[key].length > 0) return obj[key];
  for (const k of Object.keys(obj)) {
    const r = findNestedArray(obj[k], key, depth + 1);
    if (r) return r;
  }
  return null;
}

// ── SOURCE 4: HACKEREARTH RSS ─────────────────────────────────────────────
async function fetchHackerEarth() {
  const results = [];
  try {
    const res = await axios.get('https://www.hackerearth.com/challenges/hackathon/', {
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT
    });
    const html = res.data;

    // HackerEarth embeds challenge data in HTML
    const cardRe = /challenge-card[\s\S]*?challenge-name"[^>]*>([\s\S]*?)<\/[\w]+>[\s\S]*?challenge-prize[^>]*>([\s\S]*?)<\/[\w]+>/g;
    let m;
    while ((m = cardRe.exec(html)) !== null) {
      const name = m[1].replace(/<[^>]+>/g, '').trim();
      const prizeStr = m[2].replace(/<[^>]+>/g, '').trim();
      if (!name || name.length < 3) continue;
      results.push({
        id: 'he-' + slug(name),
        name,
        org: 'HackerEarth',
        platform: 'HackerEarth',
        country: 'Online',
        startDate: new Date().toISOString().split('T')[0],
        endDate: null,
        prize: parseAmount(prizeStr),
        prizeLabel: prizeStr || 'Non-monetary',
        tags: guessTags(name),
        url: 'https://www.hackerearth.com/challenges/hackathon/',
        accent: '#3b82f6',
        source: 'hackerearth'
      });
    }

    // Also try JSON embedded
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[1]);
        const challenges = findNestedArray(json, 'challenges') || findNestedArray(json, 'hackathons') || [];
        for (const c of challenges.slice(0, 30)) {
          const name = c.title || c.name || '';
          if (!name) continue;
          results.push({
            id: 'he-' + slug(name),
            name,
            org: c.company?.name || 'HackerEarth',
            platform: 'HackerEarth',
            country: guessCountry(c.location || c.city || ''),
            startDate: safeDate(c.start_utc_tz || c.start_date) || new Date().toISOString().split('T')[0],
            endDate: safeDate(c.end_utc_tz || c.end_date),
            prize: parseAmount(c.prize_pool || '0'),
            prizeLabel: c.prize_pool || 'Non-monetary',
            tags: guessTags(name + ' ' + (c.description || '')),
            url: c.url ? 'https://www.hackerearth.com' + c.url : 'https://www.hackerearth.com/challenges/hackathon/',
            accent: '#3b82f6',
            source: 'hackerearth-json'
          });
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn('[HackerEarth] failed:', e.message);
  }
  return results;
}

// ── SOURCE 5: ETHGLOBAL ───────────────────────────────────────────────────
async function fetchETHGlobal() {
  const results = [];
  try {
    const res = await axios.get('https://ethglobal.com/events', {
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT
    });
    const html = res.data;

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      const json = JSON.parse(nextDataMatch[1]);
      const events = findNestedArray(json, 'events') || findNestedArray(json, 'hackathons') || [];
      for (const ev of events) {
        const name = ev.name || ev.title || '';
        if (!name) continue;
        results.push({
          id: 'eth-' + slug(name),
          name,
          org: 'ETHGlobal',
          platform: 'ETHGlobal',
          country: guessCountry((ev.location || '') + ' ' + (ev.city || '') + ' ' + (ev.country || '')),
          startDate: safeDate(ev.startDate || ev.start_date) || new Date().toISOString().split('T')[0],
          endDate: safeDate(ev.endDate || ev.end_date),
          prize: parseAmount(ev.prizePool || ev.prize_pool || '0'),
          prizeLabel: ev.prizePool ? '$' + ev.prizePool : '$50,000+',
          tags: ['Web3', 'Blockchain'],
          url: ev.url ? 'https://ethglobal.com' + ev.url : 'https://ethglobal.com/events',
          accent: '#a855f7',
          source: 'ethglobal'
        });
      }
    }

    // Fallback: scrape event cards
    if (results.length === 0) {
      const re = /href="(\/events\/[^"]+)"[^>]*>[\s\S]*?<h\d[^>]*>([\s\S]*?)<\/h\d>/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        const name = m[2].replace(/<[^>]+>/g, '').trim();
        if (!name || name.length < 3) continue;
        results.push({
          id: 'eth-' + slug(name),
          name,
          org: 'ETHGlobal',
          platform: 'ETHGlobal',
          country: guessCountry(name),
          startDate: new Date().toISOString().split('T')[0],
          endDate: null,
          prize: 50000,
          prizeLabel: '$50,000+',
          tags: ['Web3', 'Blockchain'],
          url: 'https://ethglobal.com' + m[1],
          accent: '#a855f7',
          source: 'ethglobal-html'
        });
      }
    }
  } catch (e) {
    console.warn('[ETHGlobal] failed:', e.message);
  }
  return results;
}

// ── SOURCE 6: DORAHACKS ───────────────────────────────────────────────────
async function fetchDoraHacks() {
  const results = [];
  try {
    const res = await axios.get('https://dorahacks.io/hackathon', {
      headers: { 'User-Agent': UA, 'Accept': 'application/json, text/html' },
      timeout: TIMEOUT
    });
    const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const re = /"title":"([^"]+)"[\s\S]*?"start_time":"([^"]+)"[\s\S]*?"end_time":"([^"]*)"[\s\S]*?"prize_pool":"?([^",]*)"?/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const name = m[1];
      if (!name || name.length < 3) continue;
      results.push({
        id: 'dora-' + slug(name),
        name,
        org: 'DoraHacks',
        platform: 'DoraHacks',
        country: guessCountry(name),
        startDate: safeDate(m[2]) || new Date().toISOString().split('T')[0],
        endDate: safeDate(m[3]),
        prize: parseAmount(m[4]),
        prizeLabel: m[4] ? '$' + m[4] : 'Non-monetary',
        tags: guessTags(name),
        url: 'https://dorahacks.io/hackathon',
        accent: '#ec4899',
        source: 'dorahacks'
      });
    }
  } catch (e) {
    console.warn('[DoraHacks] failed:', e.message);
  }
  return results;
}

// ── SOURCE 7: UNSTOP RSS / HTML ───────────────────────────────────────────
async function fetchUnstop() {
  const results = [];
  try {
    const res = await axios.get('https://unstop.com/hackathons', {
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT
    });
    const html = res.data;
    // Unstop uses Angular/Next, try to find embedded JSON
    const re = /"opportunity_name":"([^"]+)"[\s\S]*?"start_date":"([^"]*)"[\s\S]*?"end_date":"([^"]*)"[\s\S]*?"prize_money":"?(\d*)"?/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const name = m[1];
      if (!name) continue;
      results.push({
        id: 'unstop-' + slug(name),
        name,
        org: 'Unstop',
        platform: 'Unstop',
        country: guessCountry(name),
        startDate: safeDate(m[2]) || new Date().toISOString().split('T')[0],
        endDate: safeDate(m[3]),
        prize: parseAmount(m[4]),
        prizeLabel: m[4] ? '₹' + m[4] : 'Non-monetary',
        tags: guessTags(name),
        url: 'https://unstop.com/hackathons',
        accent: '#f59e0b',
        source: 'unstop'
      });
    }
  } catch (e) {
    console.warn('[Unstop] failed:', e.message);
  }
  return results;
}

// ── SOURCE 8: GOOGLE DEVELOPER EVENTS ────────────────────────────────────
async function fetchGoogleDevEvents() {
  const results = [];
  try {
    const res = await axios.get('https://developers.google.com/community/events', {
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT
    });
    const html = res.data;
    const re = /<article[\s\S]*?<h\d[^>]*>([\s\S]*?)<\/h\d>[\s\S]*?<time[^>]*datetime="([^"]*)"[^>]*>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const name = m[1].replace(/<[^>]+>/g, '').trim();
      if (!name || name.length < 3) continue;
      results.push({
        id: 'google-' + slug(name),
        name,
        org: 'Google',
        platform: 'Google',
        country: guessCountry(name),
        startDate: safeDate(m[2]) || new Date().toISOString().split('T')[0],
        endDate: null,
        prize: 0,
        prizeLabel: 'Non-monetary',
        tags: guessTags(name),
        url: 'https://developers.google.com/community/events',
        accent: '#22c55e',
        source: 'google'
      });
    }
  } catch (e) {
    console.warn('[Google Dev Events] failed:', e.message);
  }
  return results;
}

// ── SEED DATA (always included as baseline) ───────────────────────────────
function getSeedData() {
  return [
    { id:'seed-revenuecat-shipaton', name:'RevenueCat Shipaton 2026', org:'RevenueCat', platform:'Devpost', country:'Online', startDate:'2026-08-01', endDate:'2026-09-30', prize:15000, prizeLabel:'$15,000+', tags:['Mobile','iOS','Android'], url:'https://revenuecat-shipaton-2026.devpost.com/', accent:'#f59e0b', source:'seed' },
    { id:'seed-api-world', name:'API World Hackathon 2026', org:'DevNetwork', platform:'Devpost', country:'USA', startDate:'2026-08-17', endDate:'2026-09-03', prize:5000, prizeLabel:'$5,000+', tags:['AI/ML','API','Cloud'], url:'https://api-cloud-ai-hackathon-2026.devpost.com/', accent:'#4f6ef7', source:'seed' },
    { id:'seed-devweek26', name:'DeveloperWeek 2026 Hackathon', org:'DevNetwork', platform:'Devpost', country:'USA', startDate:'2026-02-18', endDate:'2026-02-20', prize:10000, prizeLabel:'$10,000+', tags:['AI/ML','Open Innovation','Cloud'], url:'https://developerweek-2026-hackathon.devpost.com/', accent:'#4f6ef7', source:'seed' },
    { id:'seed-lahacks', name:'LA Hacks AI Hackathon 2026', org:'LA Hacks', platform:'Devpost', country:'USA', startDate:'2026-04-18', endDate:'2026-04-20', prize:50000, prizeLabel:'$50,000+', tags:['AI/ML'], url:'https://devpost.com/hackathons', accent:'#4f6ef7', source:'seed' },
    { id:'seed-ethcc', name:'EthCC Hacker House 2026', org:'ETHGlobal', platform:'ETHGlobal', country:'France', startDate:'2026-03-31', endDate:'2026-04-02', prize:95000, prizeLabel:'$95,000', tags:['Web3','Blockchain'], url:'https://ethglobal.com', accent:'#a855f7', source:'seed' },
    { id:'seed-hacknorth', name:'Hack the North 2026', org:'University of Waterloo', platform:'MLH', country:'Canada', startDate:'2026-09-18', endDate:'2026-09-20', prize:50000, prizeLabel:'$50,000+', tags:['Open Innovation'], url:'https://hackthenorth.com', accent:'#22c55e', source:'seed' },
    { id:'seed-hackmit', name:'HackMIT 2026', org:'MIT', platform:'MLH', country:'USA', startDate:'2026-09-20', endDate:'2026-09-22', prize:75000, prizeLabel:'$75,000+', tags:['Open Innovation','AI/ML'], url:'https://hackmit.org', accent:'#ef4444', source:'seed' },
    { id:'seed-calhacks', name:'CalHacks 11.0', org:'UC Berkeley', platform:'MLH', country:'USA', startDate:'2026-10-09', endDate:'2026-10-12', prize:100000, prizeLabel:'$100,000+', tags:['Open Innovation','AI/ML'], url:'https://calhacks.io', accent:'#f59e0b', source:'seed' },
    { id:'seed-treehacks', name:'TreeHacks 2026', org:'Stanford University', platform:'MLH', country:'USA', startDate:'2026-02-14', endDate:'2026-02-16', prize:50000, prizeLabel:'$50,000+', tags:['Open Innovation','AI/ML'], url:'https://treehacks.com', accent:'#4f6ef7', source:'seed' },
    { id:'seed-pennapps', name:'PennApps XXIV', org:'UPenn', platform:'MLH', country:'USA', startDate:'2026-09-05', endDate:'2026-09-07', prize:30000, prizeLabel:'$30,000+', tags:['Open Innovation','AI/ML'], url:'https://pennapps.com', accent:'#3b82f6', source:'seed' },
    { id:'seed-mhacks', name:'MHacks 2026', org:'University of Michigan', platform:'MLH', country:'USA', startDate:'2026-02-21', endDate:'2026-02-23', prize:30000, prizeLabel:'$30,000+', tags:['Open Innovation'], url:'https://mhacks.org', accent:'#4f6ef7', source:'seed' },
    { id:'seed-bitcamp', name:'Bitcamp 2026', org:'University of Maryland', platform:'MLH', country:'USA', startDate:'2026-04-04', endDate:'2026-04-06', prize:20000, prizeLabel:'$20,000+', tags:['Open Innovation'], url:'https://bitcamp.io', accent:'#4f6ef7', source:'seed' },
    { id:'seed-hackodiisha', name:'HackOdisha 5.0', org:'NIT Rourkela', platform:'Devfolio', country:'India', startDate:'2026-02-14', endDate:'2026-02-16', prize:500000, prizeLabel:'₹5,00,000', tags:['Open Innovation'], url:'https://devfolio.co/hackathons', accent:'#3b82f6', source:'seed' },
    { id:'seed-hacknitr', name:'HackNITR 6.0', org:'NIT Rourkela', platform:'Devfolio', country:'India', startDate:'2026-03-03', endDate:'2026-03-05', prize:300000, prizeLabel:'₹3,00,000', tags:['Open Innovation','AI/ML'], url:'https://devfolio.co/hackathons', accent:'#3b82f6', source:'seed' },
    { id:'seed-ethindia', name:'ETHIndia 2025', org:'Devfolio', platform:'Devfolio', country:'India', startDate:'2025-12-05', endDate:'2025-12-07', prize:400000, prizeLabel:'$400,000+', tags:['Web3','Blockchain'], url:'https://ethindia.co', accent:'#a855f7', source:'seed' },
    { id:'seed-sia-hack', name:'Smart India Hackathon 2025', org:'Govt. of India', platform:'Unstop', country:'India', startDate:'2025-12-11', endDate:'2025-12-15', prize:1000000, prizeLabel:'₹1,00,000/team', tags:['Social Impact','Open Innovation'], url:'https://unstop.com', accent:'#f59e0b', source:'seed' },
    { id:'seed-amazon-ml', name:'Amazon ML Challenge 2026', org:'Amazon', platform:'Unstop', country:'India', startDate:'2026-05-01', endDate:'2026-06-30', prize:500000, prizeLabel:'₹5,00,000', tags:['AI/ML'], url:'https://unstop.com', accent:'#f59e0b', source:'seed' },
    { id:'seed-eth-london', name:'ETHGlobal London 2026', org:'ETHGlobal', platform:'ETHGlobal', country:'UK', startDate:'2026-07-10', endDate:'2026-07-12', prize:100000, prizeLabel:'$100,000+', tags:['Web3','Blockchain'], url:'https://ethglobal.com/events', accent:'#a855f7', source:'seed' },
    { id:'seed-eth-sydney', name:'ETHGlobal Sydney 2026', org:'ETHGlobal', platform:'ETHGlobal', country:'Australia', startDate:'2026-06-27', endDate:'2026-06-29', prize:80000, prizeLabel:'$80,000+', tags:['Web3','Blockchain'], url:'https://ethglobal.com/events', accent:'#a855f7', source:'seed' },
    { id:'seed-dora-asia', name:'DoraHacks BUIDL Asia 2026', org:'DoraHacks', platform:'DoraHacks', country:'Singapore', startDate:'2026-07-15', endDate:'2026-07-18', prize:200000, prizeLabel:'$200,000+', tags:['Web3','AI/ML'], url:'https://dorahacks.io', accent:'#ec4899', source:'seed' },
    { id:'seed-solana', name:'Solana Renaissance Hackathon', org:'Solana Foundation', platform:'DoraHacks', country:'Online', startDate:'2026-05-15', endDate:'2026-07-08', prize:1000000, prizeLabel:'$1,000,000+', tags:['Web3','Blockchain'], url:'https://dorahacks.io', accent:'#a855f7', source:'seed' },
    { id:'seed-google-sln', name:'Google Solution Challenge 2026', org:'Google', platform:'Google', country:'Online', startDate:'2026-02-01', endDate:'2026-05-31', prize:50000, prizeLabel:'$50,000', tags:['Social Impact','AI/ML','Open Innovation'], url:'https://developers.google.com/community/gdsc-solution-challenge', accent:'#22c55e', source:'seed' },
    { id:'seed-gemini', name:'Google Gemini API Dev Competition', org:'Google', platform:'Devpost', country:'Online', startDate:'2026-03-01', endDate:'2026-06-15', prize:1000000, prizeLabel:'$1,000,000', tags:['AI/ML'], url:'https://devpost.com/hackathons', accent:'#22c55e', source:'seed' },
    { id:'seed-nasa', name:'NASA Space Apps Challenge 2026', org:'NASA', platform:'NASA', country:'Online', startDate:'2026-10-03', endDate:'2026-10-05', prize:0, prizeLabel:'Non-monetary', tags:['Climate','Social Impact','AI/ML'], url:'https://www.spaceappschallenge.org', accent:'#3b82f6', source:'seed' },
    { id:'seed-junction', name:'Junction 2026', org:'Junction', platform:'Junction', country:'Finland', startDate:'2026-11-06', endDate:'2026-11-09', prize:50000, prizeLabel:'€50,000+', tags:['Open Innovation','AI/ML'], url:'https://eu.hackjunction.com', accent:'#a855f7', source:'seed' },
    { id:'seed-hackzurich', name:'Hack Zürich 2026', org:'ETH Zürich', platform:'Devpost', country:'Switzerland', startDate:'2026-09-11', endDate:'2026-09-13', prize:35000, prizeLabel:'CHF 35,000+', tags:['Open Innovation','AI/ML'], url:'https://hackzurich.com', accent:'#ef4444', source:'seed' },
    { id:'seed-gitex', name:'GITEX Hackathon 2026', org:'GITEX', platform:'Devpost', country:'UAE', startDate:'2026-10-12', endDate:'2026-10-16', prize:100000, prizeLabel:'$100,000', tags:['AI/ML','Open Innovation'], url:'https://gitex.com', accent:'#f59e0b', source:'seed' },
    { id:'seed-hacktoberfest', name:'Hacktoberfest 2026', org:'DigitalOcean', platform:'GitHub', country:'Online', startDate:'2026-10-01', endDate:'2026-10-31', prize:0, prizeLabel:'Non-monetary', tags:['Open Innovation','Security'], url:'https://hacktoberfest.com', accent:'#a855f7', source:'seed' },
    { id:'seed-openai', name:'OpenAI Hackathon 2026', org:'OpenAI', platform:'Devpost', country:'USA', startDate:'2026-09-26', endDate:'2026-09-28', prize:250000, prizeLabel:'$250,000', tags:['AI/ML'], url:'https://devpost.com/hackathons', accent:'#22c55e', source:'seed' },
    { id:'seed-microsoft', name:'Microsoft Azure Hackathon 2026', org:'Microsoft', platform:'Devpost', country:'Online', startDate:'2026-08-01', endDate:'2026-09-30', prize:100000, prizeLabel:'$100,000', tags:['AI/ML','Cloud'], url:'https://devpost.com/hackathons', accent:'#3b82f6', source:'seed' },
    { id:'seed-aws', name:'AWS Build On Gen AI 2026', org:'Amazon Web Services', platform:'Devpost', country:'Online', startDate:'2026-07-01', endDate:'2026-08-31', prize:50000, prizeLabel:'$50,000', tags:['AI/ML','Cloud'], url:'https://devpost.com/hackathons', accent:'#f59e0b', source:'seed' },
    { id:'seed-hackharvard', name:'HackHarvard 2026', org:'Harvard University', platform:'MLH', country:'USA', startDate:'2026-10-11', endDate:'2026-10-13', prize:40000, prizeLabel:'$40,000+', tags:['Open Innovation'], url:'https://hackharvard.io', accent:'#ef4444', source:'seed' },
    { id:'seed-hackindia', name:'HackIndia 2026', org:'HackIndia', platform:'Devfolio', country:'India', startDate:'2026-04-25', endDate:'2026-04-27', prize:200000, prizeLabel:'₹2,00,000', tags:['Open Innovation','Web3'], url:'https://hackindia.xyz', accent:'#f59e0b', source:'seed' },
    { id:'seed-girlscript', name:'GirlScript Summer of Code 2026', org:'GirlScript', platform:'GirlScript', country:'India', startDate:'2026-05-01', endDate:'2026-08-10', prize:0, prizeLabel:'Non-monetary', tags:['Open Innovation','Social Impact'], url:'https://gssoc.girlscript.tech', accent:'#ec4899', source:'seed' },
    { id:'seed-africa-fin', name:'Africa Fintech Hackathon 2026', org:'Fintech Africa', platform:'Devpost', country:'Nigeria', startDate:'2026-07-10', endDate:'2026-07-25', prize:25000, prizeLabel:'$25,000', tags:['Fintech','Social Impact'], url:'https://devpost.com/hackathons', accent:'#22c55e', source:'seed' },
    { id:'seed-hacklatam', name:'HackLATAM 2026', org:'HackLATAM', platform:'Devpost', country:'Brazil', startDate:'2026-08-07', endDate:'2026-08-10', prize:30000, prizeLabel:'$30,000', tags:['Open Innovation','Social Impact'], url:'https://devpost.com/hackathons', accent:'#22c55e', source:'seed' },
    { id:'seed-oxfordhack', name:'Oxford Hack 2026', org:'University of Oxford', platform:'MLH', country:'UK', startDate:'2026-11-07', endDate:'2026-11-09', prize:15000, prizeLabel:'£15,000+', tags:['Open Innovation','AI/ML'], url:'https://oxfordhack.co.uk', accent:'#3b82f6', source:'seed' },
    { id:'seed-climhack', name:'Hack4Climate 2026', org:'UNFCCC', platform:'OpenHackathons', country:'Online', startDate:'2026-09-22', endDate:'2026-10-06', prize:25000, prizeLabel:'$25,000', tags:['Climate','Social Impact'], url:'https://openhackathons.org', accent:'#22c55e', source:'seed' },
    { id:'seed-kaggle-ml', name:'ML Olympiad 2026', org:'Kaggle', platform:'Kaggle', country:'Online', startDate:'2026-03-01', endDate:'2026-05-31', prize:100000, prizeLabel:'$100,000', tags:['AI/ML'], url:'https://kaggle.com/competitions', accent:'#3b82f6', source:'seed' },
    { id:'seed-gamedev', name:'GameDev Hackathon 2026', org:'Unity', platform:'itch.io', country:'Online', startDate:'2026-08-28', endDate:'2026-09-01', prize:15000, prizeLabel:'$15,000', tags:['Gaming'], url:'https://itch.io', accent:'#ec4899', source:'seed' },
    { id:'seed-hf-oss', name:'Open Source AI Hackathon', org:'Hugging Face', platform:'Devpost', country:'Online', startDate:'2026-08-15', endDate:'2026-09-15', prize:50000, prizeLabel:'$50,000', tags:['AI/ML'], url:'https://devpost.com/hackathons', accent:'#f59e0b', source:'seed' },
    { id:'seed-iit-techfest', name:'IIT Bombay Techfest Hackathon', org:'IIT Bombay', platform:'Unstop', country:'India', startDate:'2026-12-26', endDate:'2026-12-28', prize:500000, prizeLabel:'₹5,00,000', tags:['Open Innovation','AI/ML'], url:'https://unstop.com', accent:'#f59e0b', source:'seed' },
    { id:'seed-mega-hack', name:'MEGA Hackathon 2026', org:'MEGA', platform:'Devpost', country:'Online', startDate:'2026-06-01', endDate:'2026-07-31', prize:1200, prizeLabel:'~$1,200 value', tags:['Open Innovation','STEM'], url:'https://mega-hackathon-2026-students.devpost.com/', accent:'#a855f7', source:'seed' },
    { id:'seed-chainlink', name:'Chainlink Dev Bootcamp Hack', org:'Chainlink', platform:'DoraHacks', country:'Online', startDate:'2026-06-15', endDate:'2026-07-15', prize:50000, prizeLabel:'$50,000', tags:['Web3','Blockchain'], url:'https://dorahacks.io', accent:'#3b82f6', source:'seed' },
    { id:'seed-health-hack', name:'Health Innovation Hackathon', org:'WHO', platform:'OpenHackathons', country:'Online', startDate:'2026-07-07', endDate:'2026-07-21', prize:30000, prizeLabel:'$30,000', tags:['Health','AI/ML'], url:'https://openhackathons.org', accent:'#14b8a6', source:'seed' },
    { id:'seed-vibe-hack', name:'Vibe Hackathon 2026', org:'Community', platform:'Devpost', country:'Online', startDate:'2026-01-29', endDate:'2026-02-01', prize:5000, prizeLabel:'$5,000+', tags:['AI/ML','Gaming'], url:'https://devpost.com/hackathons', accent:'#ec4899', source:'seed' },
    { id:'seed-hackillinos', name:'HackIllinois 2026', org:'UIUC', platform:'MLH', country:'USA', startDate:'2026-02-27', endDate:'2026-03-01', prize:15000, prizeLabel:'$15,000+', tags:['Open Innovation','AI/ML'], url:'https://hackillinois.org', accent:'#4f6ef7', source:'seed' },
    { id:'seed-hacksquad', name:'Hacksquad 2026', org:'novu.io', platform:'GitHub', country:'Online', startDate:'2026-10-05', endDate:'2026-10-28', prize:10000, prizeLabel:'$10,000', tags:['Open Innovation','Security'], url:'https://hacksquad.dev', accent:'#a855f7', source:'seed' },
    { id:'seed-devweek27', name:'DeveloperWeek 2027 Hackathon', org:'DevNetwork', platform:'Devpost', country:'USA', startDate:'2027-02-17', endDate:'2027-02-19', prize:10000, prizeLabel:'$10,000+', tags:['AI/ML','Cloud','Open Innovation'], url:'https://developerweek.com', accent:'#4f6ef7', source:'seed' },
  ];
}

// ── DEDUPLICATE ────────────────────────────────────────────────────────────
function deduplicate(items) {
  const seen = new Map();
  for (const item of items) {
    const key = item.id;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

// ── MAIN FETCH ALL ─────────────────────────────────────────────────────────
async function fetchAll() {
  console.log('[Scraper] Starting fetch from all sources...');
  const seed = getSeedData();

  const [devpost, mlh, devfolio, hackerearth, ethglobal, dorahacks, unstop, google] = await Promise.allSettled([
    fetchDevpost(),
    fetchMLH(),
    fetchDevfolio(),
    fetchHackerEarth(),
    fetchETHGlobal(),
    fetchDoraHacks(),
    fetchUnstop(),
    fetchGoogleDevEvents(),
  ]);

  const allResults = [
    ...seed,
    ...(devpost.status === 'fulfilled' ? devpost.value : []),
    ...(mlh.status === 'fulfilled' ? mlh.value : []),
    ...(devfolio.status === 'fulfilled' ? devfolio.value : []),
    ...(hackerearth.status === 'fulfilled' ? hackerearth.value : []),
    ...(ethglobal.status === 'fulfilled' ? ethglobal.value : []),
    ...(dorahacks.status === 'fulfilled' ? dorahacks.value : []),
    ...(unstop.status === 'fulfilled' ? unstop.value : []),
    ...(google.status === 'fulfilled' ? google.value : []),
  ];

  const deduped = deduplicate(allResults);

  console.log(`[Scraper] Fetched ${deduped.length} total hackathons (${seed.length} seed + ${deduped.length - seed.length} live)`);
  return deduped;
}

module.exports = { fetchAll, getSeedData };
