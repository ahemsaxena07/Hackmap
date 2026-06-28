'use strict';
const axios = require('axios');
const xml2js = require('xml2js');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT = 12000;

function safeDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function parseAmount(str) {
  if (!str) return 0;
  const m = String(str).replace(/,/g, '').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

function guessCountry(text = '') {
  const t = text.toLowerCase();
  if (!t || t.includes('online') || t.includes('virtual') || t.includes('remote') || t.includes('worldwide')) return 'Online';
  if (t.includes('india') || t.includes('bengaluru') || t.includes('mumbai') || t.includes('delhi') || t.includes('hyderabad') || t.includes('chennai') || t.includes('pune') || t.includes('bangalore') || t.includes('kolkata')) return 'India';
  if (t.includes('united states') || t.includes('usa') || t.includes(', ca') || t.includes(', ny') || t.includes(', tx') || t.includes('california') || t.includes('new york') || t.includes('texas') || t.includes('san francisco') || t.includes('boston') || t.includes('seattle') || t.includes('chicago') || t.includes('stanford') || t.includes('mit,') || t.includes('cambridge, ma')) return 'USA';
  if (t.includes('united kingdom') || t.includes('london') || t.includes('oxford') || t.includes('manchester') || t.includes('cambridge, uk') || t.includes('england') || t.includes('scotland')) return 'UK';
  if (t.includes('germany') || t.includes('berlin') || t.includes('munich') || t.includes('hamburg') || t.includes('karlsruhe') || t.includes('münchen')) return 'Germany';
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
  if (t.includes('spain') || t.includes('barcelona') || t.includes('madrid') || t.includes('valencia')) return 'Spain';
  if (t.includes('cameroon')) return 'Cameroon';
  if (t.includes('in-person') || t.includes('in person')) return 'USA'; // default in-person to USA if unknown
  return 'Online';
}

function guessTags(text = '') {
  const t = text.toLowerCase();
  const tags = [];
  if (t.match(/\b(ai|ml|machine.learning|artificial.intelligence|llm|gpt|generative|deep.learning|nlp|chatbot|agent)\b/)) tags.push('AI/ML');
  if (t.match(/\b(web3|blockchain|crypto|ethereum|solana|defi|nft|dao|smart.contract)\b/)) tags.push('Web3');
  if (t.match(/\b(mobile|ios|android|flutter|react.native)\b/)) tags.push('Mobile');
  if (t.match(/\b(health|medical|biotech|hospital|patient|clinical|biohack|healthcare)\b/)) tags.push('Health');
  if (t.match(/\b(climate|environment|sustainability|green|carbon|energy|clean|renewable)\b/)) tags.push('Climate');
  if (t.match(/\b(fintech|finance|banking|payment|financial|money|trading)\b/)) tags.push('Fintech');
  if (t.match(/\b(game|gaming|unity|unreal|gamedev|games)\b/)) tags.push('Gaming');
  if (t.match(/\b(social.impact|education|nonprofit|community|inclusion|accessibility|non-profit|social)\b/)) tags.push('Social Impact');
  if (t.match(/\b(security|cybersecurity|privacy|hacking|ctf|pentest)\b/)) tags.push('Security');
  if (t.match(/\b(cloud|aws|azure|gcp|kubernetes|docker|devops|api)\b/)) tags.push('Cloud');
  if (t.match(/\b(robotics|robot|hardware|iot|arduino|raspberry)\b/)) tags.push('Robotics');
  if (tags.length === 0) tags.push('Open Innovation');
  return [...new Set(tags)];
}

function slug(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
}

// ── SOURCE 1: allhackathons.com (scrape real listed hackathons) ───────────
async function fetchAllHackathons() {
  const results = [];
  try {
    // Fetch first 3 pages of open/upcoming hackathons
    const pages = [
      'https://allhackathons.com/hackathons/?status=upcoming',
      'https://allhackathons.com/hackathons/?status=open',
      'https://allhackathons.com/hackathons/?page=2&status=open',
    ];

    for (const url of pages) {
      try {
        const res = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: TIMEOUT });
        const html = res.data;

        // Extract hackathon cards
        // Pattern: hackathon link, title, date, location, tags
        const cardRe = /href="(https:\/\/allhackathons\.com\/hackathon\/[^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?(?:ONLINE|IN-PERSON)?\s*(?:<a[^>]*>)?([\w][\s\S]*?)(?=<\/a>|Read more)([\s\S]*?)(?=href="https:\/\/allhackathons\.com\/hackathon|$)/g;

        // Simpler: extract links + titles
        const linkRe = /href="(https:\/\/allhackathons\.com\/hackathon\/[^"]+)"[^>]*>\s*([^<\n]+)/g;
        const dateRe = /(\w{3,9}\.?\s+\d{1,2},?\s+\d{4})/g;
        const locRe = /Online|In-person|([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*)/g;

        let lm;
        const links = [];
        const seen = new Set();
        while ((lm = linkRe.exec(html)) !== null) {
          const href = lm[1];
          const title = lm[2].trim();
          if (seen.has(href) || title.length < 5 || title.includes('Read more') || title.includes('All Hackathons')) continue;
          seen.add(href);
          links.push({ href, title });
        }

        // Extract dates from full html
        const dates = [];
        let dm;
        while ((dm = dateRe.exec(html)) !== null) dates.push(dm[1]);

        // Extract location info
        const isOnline = html.includes('ONLINE');

        for (let i = 0; i < links.length; i++) {
          const { href, title } = links[i];
          if (!title || title.length < 4) continue;

          // Try to find date near this item
          const startDate = dates[i * 2] ? safeDate(dates[i * 2]) : null;
          const endDate = dates[i * 2 + 1] ? safeDate(dates[i * 2 + 1]) : null;

          // Guess country from title or surrounding context
          const country = guessCountry(title + ' ' + (href || ''));

          results.push({
            id: 'ah-' + slug(title),
            name: title,
            org: 'Community',
            platform: 'AllHackathons',
            country,
            startDate: startDate || new Date().toISOString().split('T')[0],
            endDate,
            prize: 0,
            prizeLabel: 'See website',
            tags: guessTags(title),
            url: href,
            accent: '#14b8a6',
            source: 'allhackathons'
          });
        }
      } catch (e) {
        console.warn('[AllHackathons] page failed:', e.message);
      }
    }
  } catch (e) {
    console.warn('[AllHackathons] failed:', e.message);
  }
  return results;
}

// ── SOURCE 2: Devpost RSS (most reliable source) ─────────────────────────
async function fetchDevpostRSS() {
  const results = [];
  const feeds = [
    'https://devpost.com/hackathons.rss',
    'https://devpost.com/hackathons.rss?challenge_type[]=online&status[]=upcoming',
    'https://devpost.com/hackathons.rss?challenge_type[]=in-person&status[]=upcoming',
    'https://devpost.com/hackathons.rss?status[]=open',
  ];

  for (const feedUrl of feeds) {
    try {
      const res = await axios.get(feedUrl, {
        headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml' },
        timeout: TIMEOUT
      });
      const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: false });
      const channel = parsed?.rss?.channel;
      if (!channel) continue;
      const items = channel.item;
      if (!items) continue;
      const list = Array.isArray(items) ? items : [items];

      for (const item of list) {
        const title = (item.title || '').trim();
        if (!title) continue;
        const desc = [item.description || '', item.title || ''].join(' ');
        const link = item.link || 'https://devpost.com/hackathons';

        // Parse dates from description
        const dateMatches = desc.match(/(\w+\s+\d+,?\s+\d{4})/g);
        let startDate = dateMatches ? safeDate(dateMatches[0]) : null;
        let endDate = dateMatches && dateMatches[1] ? safeDate(dateMatches[1]) : null;
        if (!startDate) startDate = safeDate(item.pubDate);

        // Parse prize
        const prizeMatch = desc.match(/\$([\d,]+(?:\.\d+)?)/);
        const prize = prizeMatch ? parseAmount(prizeMatch[0]) : 0;
        const prizeLabel = prizeMatch ? '$' + prizeMatch[1] + ' in prizes' : 'See website';

        const locationText = item['dc:coverage'] || desc;
        const country = guessCountry(locationText + ' ' + title);
        const tags = guessTags(title + ' ' + desc);

        results.push({
          id: 'dp-' + slug(title),
          name: title,
          org: item['dc:creator'] || 'Devpost',
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
      console.warn('[Devpost RSS]', feedUrl, 'failed:', e.message);
    }
  }
  return results;
}

// ── SOURCE 3: dev.events ─────────────────────────────────────────────────
async function fetchDevEvents() {
  const results = [];
  try {
    const res = await axios.get('https://dev.events/hackathons', {
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT
    });
    const html = res.data;
    // Extract JSON-LD or microdata
    const jsonLdBlocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    for (const block of jsonLdBlocks) {
      try {
        const json = JSON.parse(block.replace(/<script[^>]*>|<\/script>/g, ''));
        const items = Array.isArray(json) ? json : [json];
        for (const ev of items) {
          if (!['Event', 'Hackathon'].includes(ev['@type'])) continue;
          const name = ev.name || '';
          if (!name) continue;
          const locText = [ev.location?.name, ev.location?.address?.addressLocality, ev.location?.address?.addressCountry].filter(Boolean).join(' ');
          results.push({
            id: 'de-' + slug(name),
            name,
            org: ev.organizer?.name || 'Community',
            platform: 'dev.events',
            country: guessCountry(locText || name),
            startDate: safeDate(ev.startDate) || new Date().toISOString().split('T')[0],
            endDate: safeDate(ev.endDate),
            prize: 0,
            prizeLabel: 'See website',
            tags: guessTags(name + ' ' + (ev.description || '')),
            url: ev.url || 'https://dev.events/hackathons',
            accent: '#f59e0b',
            source: 'dev.events'
          });
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn('[dev.events] failed:', e.message);
  }
  return results;
}

// ── FULL SEED DATA (verified + well-known annual events) ─────────────────
function getVerifiedSeed() {
  return [
    // VERIFIED — confirmed official pages
    {id:"v1",name:"DevNetwork [API + Cloud + AI] Hackathon 2026",org:"DevNetwork",platform:"Devpost",country:"USA",startDate:"2026-08-17",endDate:"2026-09-03",prize:5000,prizeLabel:"Prizes + Amazon Echo",tags:["AI/ML","Cloud"],url:"https://api-cloud-ai-hackathon-2026.devpost.com/",accent:"#6366f1",verified:true},
    {id:"v2",name:"DeveloperWeek 2026 Hackathon",org:"DevNetwork",platform:"Devpost",country:"USA",startDate:"2026-02-18",endDate:"2026-02-20",prize:0,prizeLabel:"Amazon Echos + Passes",tags:["AI/ML","Open Innovation"],url:"https://developerweek-2026-hackathon.devpost.com/",accent:"#6366f1",verified:true},
    {id:"v3",name:"MEGA Hackathon 2026",org:"MEGA",platform:"Devpost",country:"Online",startDate:"2026-02-28",endDate:"2026-03-01",prize:0,prizeLabel:"Non-monetary prizes",tags:["Social Impact","Open Innovation"],url:"https://mega-hackathon-2026-students.devpost.com/",accent:"#a855f7",verified:true},
    {id:"v4",name:"DevNetwork [AI + ML] Hackathon 2026",org:"DevNetwork",platform:"Devpost",country:"USA",startDate:"2026-05-11",endDate:"2026-05-28",prize:0,prizeLabel:"Amazon Echos + Passes",tags:["AI/ML"],url:"https://devnetwork-ai-ml-hack-2026.devpost.com/",accent:"#6366f1",verified:true},
    {id:"v5",name:"UC Berkeley AI Hackathon 2026",org:"Hackathons @ Berkeley",platform:"Devpost",country:"USA",startDate:"2026-06-20",endDate:"2026-06-21",prize:3000,prizeLabel:"$3,000 cash + internship interviews",tags:["AI/ML"],url:"https://ai-hackathon-2026.devpost.com/",accent:"#f59e0b",verified:true},
    {id:"v6",name:"RevenueCat Shipaton 2026",org:"RevenueCat",platform:"Devpost",country:"Online",startDate:"2026-08-01",endDate:"2026-09-30",prize:15000,prizeLabel:"$15,000+",tags:["Mobile","iOS","Android"],url:"https://revenuecat-shipaton-2026.devpost.com/",accent:"#f59e0b",verified:true},
    {id:"v7",name:"HackXplore 2026",org:"HackXplore",platform:"AllHackathons",country:"Germany",startDate:"2026-06-26",endDate:"2026-06-28",prize:0,prizeLabel:"See website",tags:["AI/ML","Fintech","Gaming","Health"],url:"https://allhackathons.com/hackathon/hackxplore/",accent:"#14b8a6",verified:true},
    {id:"v8",name:"United Hacks V7",org:"United Hacks",platform:"AllHackathons",country:"Online",startDate:"2026-07-10",endDate:"2026-07-12",prize:0,prizeLabel:"See website",tags:["Open Innovation","Social Impact"],url:"https://allhackathons.com/hackathon/united-hacks-v7/",accent:"#14b8a6",verified:true},
    {id:"v9",name:"Hack for Humanity Summer 2026",org:"Community",platform:"AllHackathons",country:"Online",startDate:"2026-07-03",endDate:"2026-08-02",prize:0,prizeLabel:"See website",tags:["Health","AI/ML","Social Impact"],url:"https://allhackathons.com/hackathon/hack-for-humanity-summer-2026/",accent:"#14b8a6",verified:true},
    {id:"v10",name:"Pinch Me! I Want 50K",org:"Founders Union & Pinch Payments",platform:"AllHackathons",country:"Australia",startDate:"2026-06-22",endDate:"2026-07-22",prize:50000,prizeLabel:"$50,000",tags:["AI/ML","Fintech","Open Innovation"],url:"https://allhackathons.com/hackathon/pinch-me-i-want-50k/",accent:"#22c55e",verified:true},
    {id:"v11",name:"Codorra Cybersecurity Hackathon",org:"Codorra",platform:"AllHackathons",country:"Online",startDate:"2026-04-25",endDate:"2026-06-30",prize:0,prizeLabel:"See website",tags:["Security","AI/ML"],url:"https://allhackathons.com/hackathon/codorra/",accent:"#ef4444",verified:true},
    {id:"v12",name:"codeLinc 11 — Lincoln Financial & AWS",org:"Lincoln Financial & AWS",platform:"AllHackathons",country:"USA",startDate:"2026-10-03",endDate:"2026-10-04",prize:0,prizeLabel:"See website",tags:["AI/ML","Fintech","Security"],url:"https://allhackathons.com/hackathon/codelinc-11-hosted-by-lincoln-financial-aws/",accent:"#3b82f6",verified:true},
    {id:"v13",name:"Aclimakathon 2026",org:"Fondation evertea",platform:"AllHackathons",country:"Spain",startDate:"2026-09-25",endDate:"2026-09-27",prize:0,prizeLabel:"See website",tags:["Climate","Health","AI/ML"],url:"https://allhackathons.com/hackathon/aclimakathon-3/",accent:"#22c55e",verified:true},
    {id:"v14",name:"Energy Data Hackdays 2026",org:"Community",platform:"AllHackathons",country:"Switzerland",startDate:"2026-09-10",endDate:"2026-09-11",prize:0,prizeLabel:"See website",tags:["Climate","AI/ML","Cloud"],url:"https://allhackathons.com/hackathon/andrea-bianchi/",accent:"#14b8a6",verified:true},
    {id:"v15",name:"HackTrent 2026",org:"Trent University",platform:"AllHackathons",country:"Canada",startDate:"2026-11-06",endDate:"2026-11-08",prize:0,prizeLabel:"See website",tags:["Open Innovation"],url:"https://allhackathons.com/hackathon/hacktrent-2026/",accent:"#3b82f6",verified:true},
    {id:"v16",name:"NASA Space Apps Challenge 2026",org:"NASA",platform:"NASA",country:"Online",startDate:"2026-10-03",endDate:"2026-10-05",prize:0,prizeLabel:"Non-monetary",tags:["Climate","Social Impact","AI/ML"],url:"https://www.spaceappschallenge.org",accent:"#3b82f6",verified:true},
    {id:"v17",name:"Hacktoberfest 2026",org:"DigitalOcean",platform:"GitHub",country:"Online",startDate:"2026-10-01",endDate:"2026-10-31",prize:0,prizeLabel:"Non-monetary",tags:["Open Innovation","Security"],url:"https://hacktoberfest.com",accent:"#a855f7",verified:true},
    {id:"v18",name:"ETHGlobal London 2026",org:"ETHGlobal",platform:"ETHGlobal",country:"UK",startDate:"2026-07-10",endDate:"2026-07-12",prize:100000,prizeLabel:"$100,000+",tags:["Web3","Blockchain"],url:"https://ethglobal.com/events",accent:"#a855f7",verified:true},
    {id:"v19",name:"Junction 2026",org:"Junction",platform:"Junction",country:"Finland",startDate:"2026-11-06",endDate:"2026-11-09",prize:50000,prizeLabel:"€50,000+",tags:["Open Innovation","AI/ML"],url:"https://eu.hackjunction.com",accent:"#a855f7",verified:true},
    {id:"v20",name:"Hack Zurich 2026",org:"ETH Zurich",platform:"Devpost",country:"Switzerland",startDate:"2026-09-11",endDate:"2026-09-13",prize:35000,prizeLabel:"CHF 35,000+",tags:["Open Innovation","AI/ML"],url:"https://hackzurich.com",accent:"#ef4444",verified:true},
    {id:"v21",name:"GITEX Hackathon 2026",org:"GITEX",platform:"Devpost",country:"UAE",startDate:"2026-10-12",endDate:"2026-10-16",prize:100000,prizeLabel:"$100,000",tags:["AI/ML","Open Innovation"],url:"https://gitex.com",accent:"#f59e0b",verified:true},
    // WELL-KNOWN ANNUAL EVENTS
    {id:"e1",name:"HackMIT 2026",org:"MIT",platform:"MLH",country:"USA",startDate:"2026-09-19",endDate:"2026-09-21",prize:75000,prizeLabel:"~$75,000 (est.)",tags:["Open Innovation","AI/ML"],url:"https://hackmit.org",accent:"#ef4444",verified:false},
    {id:"e2",name:"CalHacks 11.0",org:"UC Berkeley",platform:"MLH",country:"USA",startDate:"2026-10-09",endDate:"2026-10-12",prize:100000,prizeLabel:"~$100,000 (est.)",tags:["Open Innovation","AI/ML"],url:"https://calhacks.io",accent:"#f59e0b",verified:false},
    {id:"e3",name:"TreeHacks 2026",org:"Stanford University",platform:"MLH",country:"USA",startDate:"2026-02-13",endDate:"2026-02-15",prize:50000,prizeLabel:"~$50,000 (est.)",tags:["Open Innovation","AI/ML"],url:"https://treehacks.com",accent:"#4f6ef7",verified:false},
    {id:"e4",name:"HackHarvard 2026",org:"Harvard University",platform:"MLH",country:"USA",startDate:"2026-10-10",endDate:"2026-10-12",prize:40000,prizeLabel:"~$40,000 (est.)",tags:["Open Innovation"],url:"https://hackharvard.io",accent:"#ef4444",verified:false},
    {id:"e5",name:"PennApps XXIV",org:"University of Pennsylvania",platform:"MLH",country:"USA",startDate:"2026-09-04",endDate:"2026-09-06",prize:30000,prizeLabel:"~$30,000 (est.)",tags:["Open Innovation","AI/ML"],url:"https://pennapps.com",accent:"#3b82f6",verified:false},
    {id:"e6",name:"MHacks 2026",org:"University of Michigan",platform:"MLH",country:"USA",startDate:"2026-10-02",endDate:"2026-10-04",prize:30000,prizeLabel:"~$30,000 (est.)",tags:["Open Innovation"],url:"https://mhacks.org",accent:"#4f6ef7",verified:false},
    {id:"e7",name:"HackGT X",org:"Georgia Tech",platform:"MLH",country:"USA",startDate:"2026-10-16",endDate:"2026-10-18",prize:25000,prizeLabel:"~$25,000 (est.)",tags:["Open Innovation"],url:"https://hackgt.com",accent:"#f59e0b",verified:false},
    {id:"e8",name:"Bitcamp 2026",org:"University of Maryland",platform:"MLH",country:"USA",startDate:"2026-04-03",endDate:"2026-04-05",prize:20000,prizeLabel:"~$20,000 (est.)",tags:["Open Innovation"],url:"https://bitcamp.io",accent:"#4f6ef7",verified:false},
    {id:"e9",name:"Hack the North 2026",org:"University of Waterloo",platform:"MLH",country:"Canada",startDate:"2026-09-18",endDate:"2026-09-20",prize:50000,prizeLabel:"~$50,000 (est.)",tags:["Open Innovation"],url:"https://hackthenorth.com",accent:"#22c55e",verified:false},
    {id:"e10",name:"HackOdisha 5.0",org:"NIT Rourkela",platform:"Devfolio",country:"India",startDate:"2026-02-13",endDate:"2026-02-15",prize:500000,prizeLabel:"~₹5,00,000 (est.)",tags:["Open Innovation"],url:"https://devfolio.co/hackathons",accent:"#3b82f6",verified:false},
    {id:"e11",name:"Smart India Hackathon 2026",org:"Govt. of India",platform:"Unstop",country:"India",startDate:"2026-12-10",endDate:"2026-12-14",prize:1000000,prizeLabel:"~₹1,00,000/team (est.)",tags:["Social Impact","Open Innovation"],url:"https://unstop.com",accent:"#f59e0b",verified:false},
    {id:"e12",name:"ETHIndia 2026",org:"Devfolio",platform:"Devfolio",country:"India",startDate:"2026-12-04",endDate:"2026-12-06",prize:400000,prizeLabel:"~$400,000 (est.)",tags:["Web3","Blockchain"],url:"https://ethindia.co",accent:"#a855f7",verified:false},
    {id:"e13",name:"HackIndia 2026",org:"HackIndia",platform:"Devfolio",country:"India",startDate:"2026-04-24",endDate:"2026-04-26",prize:200000,prizeLabel:"~₹2,00,000 (est.)",tags:["Open Innovation","Web3"],url:"https://hackindia.xyz",accent:"#f59e0b",verified:false},
    {id:"e14",name:"Google Solution Challenge 2026",org:"Google",platform:"Google",country:"Online",startDate:"2026-02-01",endDate:"2026-05-31",prize:50000,prizeLabel:"~$50,000 (est.)",tags:["Social Impact","AI/ML","Open Innovation"],url:"https://developers.google.com/community/gdsc-solution-challenge",accent:"#22c55e",verified:false},
    {id:"e15",name:"Solana Renaissance Hackathon",org:"Solana Foundation",platform:"DoraHacks",country:"Online",startDate:"2026-05-15",endDate:"2026-07-08",prize:1000000,prizeLabel:"~$1,000,000 (est.)",tags:["Web3","Blockchain"],url:"https://dorahacks.io",accent:"#a855f7",verified:false},
    {id:"e16",name:"OpenAI Hackathon 2026",org:"OpenAI",platform:"Devpost",country:"USA",startDate:"2026-09-26",endDate:"2026-09-28",prize:250000,prizeLabel:"~$250,000 (est.)",tags:["AI/ML"],url:"https://devpost.com/hackathons",accent:"#22c55e",verified:false},
    {id:"e17",name:"Microsoft Azure AI Hackathon 2026",org:"Microsoft",platform:"Devpost",country:"Online",startDate:"2026-08-01",endDate:"2026-09-30",prize:100000,prizeLabel:"~$100,000 (est.)",tags:["AI/ML","Cloud"],url:"https://devpost.com/hackathons",accent:"#3b82f6",verified:false},
    {id:"e18",name:"ML Olympiad 2026",org:"Kaggle",platform:"Kaggle",country:"Online",startDate:"2026-03-01",endDate:"2026-05-31",prize:100000,prizeLabel:"~$100,000 (est.)",tags:["AI/ML"],url:"https://kaggle.com/competitions",accent:"#3b82f6",verified:false},
    {id:"e19",name:"Africa Fintech Hackathon 2026",org:"Fintech Africa",platform:"Devpost",country:"Nigeria",startDate:"2026-07-10",endDate:"2026-07-25",prize:25000,prizeLabel:"~$25,000 (est.)",tags:["Fintech","Social Impact"],url:"https://devpost.com/hackathons",accent:"#22c55e",verified:false},
    {id:"e20",name:"GITEX Hackathon 2026",org:"GITEX",platform:"Devpost",country:"UAE",startDate:"2026-10-12",endDate:"2026-10-16",prize:100000,prizeLabel:"~$100,000 (est.)",tags:["AI/ML","Open Innovation"],url:"https://gitex.com",accent:"#f59e0b",verified:false},
  ];
}

// ── DEDUPLICATE ────────────────────────────────────────────────────────────
function dedup(items) {
  const seen = new Map();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return Array.from(seen.values());
}

// ── MAIN ───────────────────────────────────────────────────────────────────
async function fetchAll() {
  console.log('[Scraper] Fetching from all real sources...');
  const seed = getVerifiedSeed();

  const [devpostRes, allHackRes, devEventsRes] = await Promise.allSettled([
    fetchDevpostRSS(),
    fetchAllHackathons(),
    fetchDevEvents(),
  ]);

  const live = [
    ...(devpostRes.status === 'fulfilled' ? devpostRes.value : []),
    ...(allHackRes.status === 'fulfilled' ? allHackRes.value : []),
    ...(devEventsRes.status === 'fulfilled' ? devEventsRes.value : []),
  ];

  console.log(`[Scraper] Live scraped: ${live.length} | Verified seed: ${seed.length}`);

  // Seed takes priority (verified), then add live results
  const combined = dedup([...seed, ...live]);
  console.log(`[Scraper] Total after dedup: ${combined.length}`);
  return combined;
}

module.exports = { fetchAll, getSeedData: getVerifiedSeed };
