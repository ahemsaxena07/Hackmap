import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

type HackathonStatus = "live" | "upcoming" | "ended";

interface Hackathon {
  id: string;
  name: string;
  url: string;
  platform: string;
  org?: string;
  startDate: string;
  endDate?: string;
  country: string;
  prize: number;
  tags: string[];
  status: HackathonStatus;
  description?: string;
}

interface AIMatchResult {
  hackathon: Hackathon;
  reason: string;
  matchScore: number;
}

function buildSystemPrompt(): string {
  return `You are HackMap's AI matchmaking engine. Analyze user interests and match them to hackathons.
Return ONLY a JSON array of exactly 3 objects:
[{ "hackathonId": "<string>", "matchScore": <integer 60-100>, "reason": "<1-2 sentences>" }]
No markdown, no explanation, just the JSON array.`;
}

function buildUserPrompt(interests: string[], hackathons: Hackathon[]): string {
  const hacksJson = hackathons
    .filter((h) => h.status !== "ended")
    .slice(0, 40)
    .map(({ id, name, tags, prize, status, country }) => ({ id, name, tags, prize, status, country }));
  return `User interests: ${interests.join(", ")}\n\nHackathons:\n${JSON.stringify(hacksJson, null, 2)}\n\nReturn top 3 matches as JSON array.`;
}

async function callGemini(system: string, user: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 600 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
}

async function callOpenAI(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 600,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "[]";
}

export async function POST(req: NextRequest) {
  const { interests, hackathons } = (await req.json()) as { interests: string[]; hackathons: Hackathon[] };
  if (!interests?.length || !hackathons?.length) {
    return NextResponse.json({ error: "interests and hackathons required" }, { status: 400 });
  }
  const system = buildSystemPrompt();
  const userPrompt = buildUserPrompt(interests, hackathons);
  const provider = process.env.AI_PROVIDER ?? "gemini";
  let rawJson: string;
  try {
    rawJson = provider === "openai" ? await callOpenAI(system, userPrompt) : await callGemini(system, userPrompt);
  } catch (err) {
    return NextResponse.json({ success: false, error: "AI service unavailable" }, { status: 503 });
  }
  let aiPicks: Array<{ hackathonId: string; matchScore: number; reason: string }>;
  try {
    const parsed = JSON.parse(rawJson);
    aiPicks = Array.isArray(parsed) ? parsed : parsed.matches ?? [];
  } catch {
    return NextResponse.json({ success: false, error: "AI returned malformed JSON" }, { status: 500 });
  }
  const hackathonMap = new Map(hackathons.map((h) => [h.id, h]));
  const matches: AIMatchResult[] = aiPicks
    .map(({ hackathonId, matchScore, reason }) => {
      const hackathon = hackathonMap.get(hackathonId);
      if (!hackathon) return null;
      return { hackathon, matchScore, reason };
    })
    .filter((m): m is AIMatchResult => m !== null);
  return NextResponse.json({ success: true, matches, generatedAt: new Date().toISOString() });
}
