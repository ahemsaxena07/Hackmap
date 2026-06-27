# ⚡ HackMap Next — Full-Stack Expansion

A production-ready Next.js 15 (App Router) expansion of HackMap featuring:

- **Three-tab UI** — Explore, Bookmarks, Dashboard
- **OAuth Authentication** — Google + GitHub via NextAuth v5
- **Smart Bookmarks** — LocalStorage for guests, PostgreSQL for signed-in users (with auto-migration on login)
- **User Dashboard** — Multi-select interest categories + AI email toggle
- **AI Matchmaking** — Gemini or OpenAI picks top 3 hackathons per user
- **Email Digest Engine** — React Email + Resend sends personalized weekly picks
- **Vercel Cron** — Automated Monday morning digest delivery

---

## 📁 Project Structure

```
hackmap-next/
├── prisma/
│   └── schema.prisma              # DB schema: User, SavedHackathon, NotificationPreference, EmailDigestLog
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout with SessionProvider
│   │   ├── page.tsx               # Home page (server component, SSR stats)
│   │   ├── globals.css            # Full design system (ported from original HackMap)
│   │   ├── auth/signin/page.tsx   # Custom OAuth sign-in page
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts  # NextAuth handler
│   │       ├── hackathons/route.ts          # Proxy to existing scraper
│   │       ├── saved/route.ts               # GET/POST/DELETE bookmarks
│   │       ├── preferences/route.ts         # GET/PATCH user preferences
│   │       ├── ai-match/route.ts            # AI matchmaking endpoint
│   │       └── cron/send-digests/route.ts   # Weekly email cron job
│   ├── components/
│   │   ├── hackathon/
│   │   │   ├── HackathonCard.tsx   # Card with bookmark toggle
│   │   │   └── FilterBar.tsx       # Full filter/search/sort bar
│   │   └── tabs/
│   │       ├── TabController.tsx   # Root tab orchestrator (client)
│   │       ├── BookmarksTab.tsx    # Tab 2: Saved hackathons
│   │       └── DashboardTab.tsx    # Tab 3: Profile + prefs + email toggle
│   ├── hooks/
│   │   ├── useHackathons.ts       # Fetch + filter with debounced search
│   │   ├── useBookmarks.ts        # LocalStorage ↔ DB unified bookmarks
│   │   └── usePreferences.ts      # User notification preferences
│   ├── lib/
│   │   ├── auth/auth.config.ts    # NextAuth v5 config + callbacks
│   │   ├── db/prisma.ts           # Prisma singleton
│   │   └── email/
│   │       ├── DigestEmail.tsx    # React Email template
│   │       └── send-digest.ts     # Resend sender
│   ├── middleware.ts              # Edge route protection
│   └── types/
│       ├── index.ts               # All shared TypeScript types
│       └── next-auth.d.ts         # Session type augmentation
├── .env.example                   # All required env vars documented
├── next.config.ts
├── package.json
├── tsconfig.json
└── vercel.json                    # Cron: every Monday 9am UTC
```

---

## 🚀 Deploy to Vercel in 10 Steps

### Step 1 — Create a PostgreSQL database

**Recommended: Supabase (free)**
1. Go to https://supabase.com → New project
2. Settings → Database → copy the **Connection string** (Transaction mode, port 6543) for `DATABASE_URL`
3. Copy the **Direct connection** (port 5432) for `DIRECT_URL`

**Alternative: Neon** (https://neon.tech) — also free, works identically.

---

### Step 2 — Set up Google OAuth

1. Go to https://console.cloud.google.com
2. APIs & Services → Credentials → Create OAuth 2.0 Client
3. Authorized redirect URIs: `https://your-domain.vercel.app/api/auth/callback/google`
4. Copy Client ID → `GOOGLE_CLIENT_ID`, Client Secret → `GOOGLE_CLIENT_SECRET`

---

### Step 3 — Set up GitHub OAuth

1. GitHub → Settings → Developer Settings → OAuth Apps → New OAuth App
2. Authorization callback URL: `https://your-domain.vercel.app/api/auth/callback/github`
3. Copy Client ID → `GITHUB_CLIENT_ID`, Client Secret → `GITHUB_CLIENT_SECRET`

---

### Step 4 — Get an AI API key (choose one)

**Gemini (recommended — generous free tier):**
- https://aistudio.google.com → Get API Key → `GEMINI_API_KEY`
- Set `AI_PROVIDER=gemini`

**OpenAI:**
- https://platform.openai.com → API Keys → `OPENAI_API_KEY`
- Set `AI_PROVIDER=openai`

---

### Step 5 — Set up Resend (email)

1. https://resend.com → Sign up free
2. Add your domain (or use the test domain for development)
3. API Keys → Create API Key → `RESEND_API_KEY`
4. Update `from:` in `src/lib/email/send-digest.ts` to your verified domain

---

### Step 6 — Push to GitHub

```bash
cd hackmap-next
git init
git add .
git commit -m "feat: HackMap Next.js expansion v2"
git remote add origin https://github.com/YOUR_USERNAME/hackmap-next.git
git push -u origin main
```

---

### Step 7 — Deploy on Vercel

1. https://vercel.com → New Project → Import your repo
2. Framework: **Next.js** (auto-detected)
3. Add all environment variables from `.env.example`
4. Click **Deploy**

---

### Step 8 — Run database migrations

After first deploy, open **Vercel CLI** or the Vercel dashboard terminal:

```bash
npm install -g vercel
vercel env pull .env.local      # Pull env vars locally
npx prisma generate
npx prisma db push              # Push schema to Supabase/Neon
```

---

### Step 9 — Verify Cron job

In Vercel dashboard → your project → **Cron Jobs** tab.
You should see `/api/cron/send-digests` scheduled for `0 9 * * 1` (Mondays 9am UTC).

To test manually:
```bash
curl -X GET https://your-domain.vercel.app/api/cron/send-digests \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

### Step 10 — Update OAuth redirect URIs

Once your Vercel domain is live, update the callback URLs in Google Cloud Console and GitHub OAuth app to match your actual domain.

---

## 🔌 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/hackathons` | — | List hackathons (proxies to scraper, all filters supported) |
| GET | `/api/saved` | ✅ | Get user's bookmarked hackathons |
| POST | `/api/saved` | ✅ | Save a hackathon |
| DELETE | `/api/saved` | ✅ | Remove a bookmark |
| GET | `/api/preferences` | ✅ | Get notification preferences |
| PATCH | `/api/preferences` | ✅ | Update preferences |
| POST | `/api/ai-match` | — | AI-match interests to hackathons |
| GET | `/api/cron/send-digests` | 🔑 CRON_SECRET | Run weekly email digest |

---

## ⚙️ Architecture decisions

**Why proxy the existing scraper?**
Your Express server at `hackmap-psi.vercel.app` already has 49+ seed hackathons and working scrapers. Reusing it means zero data loss and instant data on deploy. The Next.js API layer adds caching (`revalidate: 3600`), type safety, and auth.

**Why LocalStorage → DB migration on login?**
Guests can bookmark immediately (zero friction). On first sign-in, `useBookmarks` reads LocalStorage, pushes all saved hackathons to the DB, then clears local storage. Seamless for the user.

**Why JWT sessions over database sessions?**
JWT sessions are edge-compatible (middleware runs on Vercel Edge Runtime) and don't require a DB lookup on every request. userId is embedded in the JWT and forwarded to `session.user.id`.

**Why Gemini over OpenAI?**
Gemini Flash is cheaper (often free at this scale) and supports `responseMimeType: "application/json"` natively for reliable structured output. Swap via `AI_PROVIDER=openai` env var.
