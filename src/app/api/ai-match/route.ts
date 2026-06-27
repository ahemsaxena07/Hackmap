// hackmap-next/src/app/api/ai-match/route.ts
// POST /api/ai-match
// Takes user interests + recent hackathons → returns top 3 AI-matched picks
//
// Supports both Google Gemini and OpenAI — set AI_PROVIDER env var

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import type { Hackathon, AIMatchResult } from "@/types";

export const maxDuration = 30; // Vercel Function timeout (seconds)

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are HackMap's AI matchmaking engine. Your job is to analyze a user's
interests and match them to the best hackathons from a provided list.

Rules:
- Return ONLY valid JSON — no markdown, no explanation, no preamble.
- The JSON must be an array of exactly 3 objects with this shape:
  [
    {
      "hackathonId": "<string: exact id from input>",
      "matchScore": <integer 60-100>,
      "reason": "<1-2 concise sentences explaining why this matches the user's interests>"
    }
  ]
- Rank by relevance to the user's stated interests.
- Consider prize size and upcoming/live status as secondary signals.
- The reason must be specific — mention which interest category it aligns with.
- If fewer than 3 hackathons are provided, return however many exist.`;
}

function buildUserPrompt(
  interests: string[],
  hackathons: Hackathon[]
): string {
  const hacksJson = hackathons
    .filter((h) => h.status !== "ended")
    .slice(0, 40) // Cap to avoid token limits
    .map(({ id, name, tags, prize, status, country, description }) => ({
      id,
      name,
      tags,
      prize,
      status,
      country,
      description: description?.slice(0, 120),
    }));

  return `User interests: ${interests.join(", ")}

Available hackathons:
${JSON.stringify(hacksJson, null, 2)}

Return the top 3 best matches as JSON.`;
}

// ─── AI Providers ─────────────────────────────────────────────────────────────

async function callGemini(system: string, user: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const model = "gemini-1.5-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 600,
        },
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "[]";
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Optional auth — guests can use AI match but logged-in users get preferences auto-loaded
  const session = await auth();

  const { interests, hackathons } = (await req.json()) as {
    interests: string[];
    hackathons: Hackathon[];
  };

  if (!interests?.length || !hackathons?.length) {
    return NextResponse.json(
      { error: "interests and hackathons arrays are required" },
      { status: 400 }
    );
  }

  const system = buildSystemPrompt();
  const userPrompt = buildUserPrompt(interests, hackathons);
  const provider = process.env.AI_PROVIDER ?? "gemini"; // "gemini" | "openai"

  let rawJson: string;
  try {
    rawJson =
      provider === "openai"
        ? await callOpenAI(system, userPrompt)
        : await callGemini(system, userPrompt);
  } catch (err) {
    console.error("[/api/ai-match] LLM call failed:", err);
    return NextResponse.json(
      { success: false, error: "AI service unavailable" },
      { status: 503 }
    );
  }

  // Parse and hydrate with full hackathon objects
  let aiPicks: Array<{
    hackathonId: string;
    matchScore: number;
    reason: string;
  }>;

  try {
    // Handle both array and {matches:[...]} shapes from different LLMs
    const parsed = JSON.parse(rawJson);
    aiPicks = Array.isArray(parsed) ? parsed : parsed.matches ?? [];
  } catch {
    console.error("[/api/ai-match] JSON parse failed:", rawJson);
    return NextResponse.json(
      { success: false, error: "AI returned malformed JSON" },
      { status: 500 }
    );
  }

  // Hydrate: join AI picks with full hackathon data
  const hackathonMap = new Map(hackathons.map((h) => [h.id, h]));
  const matches: AIMatchResult[] = aiPicks
    .map(({ hackathonId, matchScore, reason }) => {
      const hackathon = hackathonMap.get(hackathonId);
      if (!hackathon) return null;
      return { hackathon, matchScore, reason } satisfies AIMatchResult;
    })
    .filter((m): m is AIMatchResult => m !== null);

  return NextResponse.json({
    success: true,
    matches,
    generatedAt: new Date().toISOString(),
    userId: session?.user?.id ?? null,
  });
}
