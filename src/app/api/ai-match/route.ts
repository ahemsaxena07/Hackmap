// hackmap-next/src/app/api/ai-match/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Hackathon, AIMatchResult } from "@/types/index";

export const maxDuration = 30;

function buildSystemPrompt(): string {
  return `You are HackMap's AI matchmaking engine. Your job is to analyze a user's
interests and match them to the best hackathons from a provided list.

Rules:
- Return ONLY valid JSON — no markdown, no explanation, no preamble.
- The JSON must be an array of exactly 3 objects with this shape:
  [{ "hackathonId": "<string>", "matchScore": <integer 60-100>, "reason": "<1-2 sentences>" }]
- Rank by relevance to the user's stated interests.
- The reason must mention which interest category it aligns with.
- If fewer than 3 hackathons are provided, return however many exist.`;
}

function buildUserPrompt(interests: string[], hackathons: Hackathon[]): string {
  const hacksJson = hackathons
    .filter((h) => h.status !== "ended")
    .slice(0, 40)
    .map(({ id, name, tags, prize, status, country }) => ({ id, name, tags, prize, status, country }));

  return `User interests: ${interests.join(", ")}\n\nAvailable hackathons:\n${JSON.stringify(hacksJson, null, 2)}\n\nReturn the top 3 best matches as a JSON array.`;
}

async function callGemini(system: string, user: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
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
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "[]";
}

export async function POST(req: NextRequest) {
  const { interests, hackathons } = (await req.json()) as {
    interests: string[];
    hackathons: Hackathon[];
  };

  if (!interests?.length || !hackathons?.length) {
    return NextResponse.json({ error: "interests and hackathons arrays are required" }, { status: 400 });
  }

  const system = buildSystemPrompt();
  const userPrompt = buildUserPrompt(interests, hackathons);
  const provider = process.env.AI_PROVIDER ?? "gemini";

  let rawJson: string;
  try {
    rawJson = provider === "openai" ? await callOpenAI(system, userPrompt) : await callGemini(system, userPrompt);
  } catch (err) {
    console.error("[/api/ai-match] LLM call failed:", err);
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
