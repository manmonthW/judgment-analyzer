export const runtime = "edge";
import { NextResponse } from "next/server";

/** xAI (Grok) config */
const XAI_BASE = process.env.XAI_BASE || "https://api.x.ai/v1";
const XAI_MODEL = process.env.XAI_MODEL || "grok-4";
const API_PATH = "/chat/completions";

/** Output schemas per mode (JSON-only) */
const SCHEMAS: Record<string, string> = {
  lawyer: `{"case_meta":{"case_no":"","court":"","date":"","cause":""},"parties":[{"role":"","name":""}],"issues":["..."],"evidence_chain":[{"evidence":"","source_paragraph":"","supports_fact":"","probative_weight":1}],"statutes":[{"law":"","article":"","quote_or_ref":"","application_reasoning":""}],"holdings":"","ratio_decidendi":"","obiter_dicta":"","our_side_arguments":["..."],"risks":[{"level":"high|medium|low","reason":"","mitigation":""}]}`,
  corporate: `{"overview":{"overall_risk":"high|medium|low","monetary_exposure_range":"80w-120w","business_domain":"","region":"","time":""},"claims_against_company":[{"type":"","amount":"","status":"affirmed|rejected|partial"}],"compliance_gaps":["..."],"action_items":["..."],"watchlist_keywords":["..."],"aggregation_keys":{"cause":"","industry":"","province":"","year":""}}`,
  media: `{"newsworthiness_score":0,"headline":"","six_w":{"who":"","what":"","when":"","where":"","why":"","how":""},"precedent_or_context":["..."],"pull_quotes":[{"text":"","source":"original paragraph or faithful paraphrase"}],"tags":["..."],"related_cases_query":"..."}`,
  public: `{"plain_summary":"150-200 chars","result":"what the court ruled","why":"brief reasoning","rights_and_duties":["..."],"faq":[{"q":"","a":""}]}`
};

function buildPrompt(mode: string, text: string) {
  const schema = SCHEMAS[mode] ?? SCHEMAS.lawyer;
  const map: Record<string, { system: string; user: string }> = {
    lawyer: {
      system: "You are a senior litigation assistant for judgment analysis. Use ONLY the provided text. Output MUST be valid JSON and nothing else.",
      user: `Return JSON ONLY (no extra words):\n${schema}\n\n[ORIGINAL TEXT]\n${text}`
    },
    corporate: {
      system: "You are a corporate legal risk analysis assistant. Use ONLY the provided text. Output JSON only.",
      user: `Return JSON ONLY:\n${schema}\n\n[ORIGINAL TEXT]\n${text}`
    },
    media: {
      system: "You are a research assistant for legal/news editors. Use ONLY the provided text. Output JSON only.",
      user: `Return JSON ONLY:\n${schema}\n\n[ORIGINAL TEXT]\n${text}`
    },
    public: {
      system: "You explain judgments in plain language for the public. Use ONLY the provided text. Output JSON only.",
      user: `Return JSON ONLY:\n${schema}\n\n[ORIGINAL TEXT]\n${text}`
    }
  };
  return map[mode] ?? map.lawyer;
}

/** OpenAI-compatible chat completions (xAI) */
async function chatCompletions(messages: Array<{role:"system"|"user"|"assistant"; content:string}>, model: string, apiKey: string) {
  const r = await fetch(`${XAI_BASE}${API_PATH}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0.2, messages })
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    throw new Error(errText || `HTTP ${r.status}`);
  }
  const data = await r.json();
  return String(data?.choices?.[0]?.message?.content ?? "");
}

export async function POST(req: Request) {
  try {
    const { mode = "lawyer", text = "" } = await req.json();

    // Prefer xAI key; fallback to OPENAI key if provided (compat).
    const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Missing XAI_API_KEY/OPENAI_API_KEY" }, { status: 500 });
    }

    const { system, user } = buildPrompt(mode, text);

    // 1st try
    let content = await chatCompletions(
      [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      XAI_MODEL,
      apiKey
    );

    // If not valid JSON, try to repair via a second round
    const trimmed = content.trim().replace(/^```[a-zA-Z]*\n?|```$/g, "");
    let payload: unknown;
    try {
      payload = JSON.parse(trimmed);
    } catch {
      const fix = await chatCompletions(
        [
          { role: "system", content: "You are a JSON repair assistant. Return only valid JSON string with no extra text." },
          { role: "user", content: `Fix the following into valid JSON (preserve meaning):\n${content}` }
        ],
        XAI_MODEL,
        apiKey
      );

      const fixed = fix.trim().replace(/^```[a-zA-Z]*\n?|```$/g, "");
      try {
        payload = JSON.parse(fixed);
      } catch {
        payload = { ok: false, reason: "LLM_INVALID_JSON", raw: (fixed || trimmed).slice(0, 5000) };
      }
    }

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "analyze_failed" },
      { status: 500 }
    );
  }
}