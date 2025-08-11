// app/api/analyze/route.ts
export const runtime = "edge";
import { NextResponse } from "next/server";

/** ====== Grok (xAI) 开关 ====== 
 * 默认直连 xAI：https://api.x.ai/v1/chat/completions
 * 兼容 OpenAI：如需回切，把 XAI_BASE 改回 https://api.openai.com/v1
 */
const XAI_BASE = process.env.XAI_BASE || "https://api.x.ai/v1";     // 可通过环境变量覆盖
const XAI_MODEL = process.env.XAI_MODEL || "grok-4";                // 例如 grok-4 / grok-4-mini / grok-4-heavy（视你的权限）
const API_PATH = "/chat/completions";                               // xAI 为 OpenAI-兼容端点

// 各模式的 JSON 模板（保持不变）
const SCHEMAS: Record<string, string> = {
  lawyer: `{"case_meta":{"case_no":"","court":"","date":"","cause":""},"parties":[{"role":"","name":""}],"issues":["..."],"evidence_chain":[{"evidence":"","source_paragraph":"","supports_fact":"","probative_weight":1}],"statutes":[{"law":"","article":"","quote_or_ref":"","application_reasoning":""}],"holdings":"","ratio_decidendi":"","obiter_dicta":"","our_side_arguments":["..."],"risks":[{"level":"高|中|低","reason":"","mitigation":""}]}`,
  corporate: `{"overview":{"overall_risk":"高|中|低","monetary_exposure_range":"80万-120万","business_domain":"","region":"","time":""},"claims_against_company":[{"type":"","amount":"","status":"认定|驳回|部分支持"}],"compliance_gaps":["..."],"action_items":["..."],"watchlist_keywords":["..."],"aggregation_keys":{"cause":"","industry":"","province":"","year":""}}`,
  media: `{"newsworthiness_score":0,"headline":"","six_w":{"who":"","what":"","when":"","where":"","why":"","how":""},"precedent_or_context":["..."],"pull_quotes":[{"text":"","source":"原文段落/忠实转述"}],"tags":["..."],"related_cases_query":"..."}`,
  public: `{"plain_summary":"150-200字","result":"法院判了什么","why":"简述裁判理由","rights_and_duties":["..."],"faq":[{"q":"","a":""}]}`
};

function buildPrompt(mode: string, text: string) {
  const schema = SCHEMAS[mode] ?? SCHEMAS.lawyer;
  const map: Record<string, { system: string; user: string }> = {
    lawyer: {
      system: "你是资深诉讼律师的文书分析助手。严格依据给定文本，不臆造。输出必须为合法 JSON。",
      user: `仅输出 JSON（不要任何额外文字）：\n${schema}\n\n【判决书原文】\n${text}`
    },
    corporate: {
      system: "你是企业法务风险分析助手。仅使用给定文本，输出 JSON。",
      user: `仅输出 JSON：\n${schema}\n\n【原文】\n${text}`
    },
    media: {
      system: "你是法律与公共事务记者/研究员助手。仅输出 JSON。",
      user: `仅输出 JSON：\n${schema}\n\n【原文】\n${text}`
    },
    public: {
      system: "你是面向普通公众的法律解释助手。仅输出 JSON。",
      user: `仅输出 JSON：\n${schema}\n\n【原文】\n${text}`
    }
  };
  return map[mode] ?? map.lawyer;
}

// xAI / OpenAI 兼容的 Chat Completions 调用
async function chatCompletions(messages: any[], model: string, apiKey: string) {
  const r = await fetch(`${XAI_BASE}${API_PATH}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0.2, messages })
  });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  return String(data?.choices?.[0]?.message?.content ?? "");
}

export async function POST(req: Request) {
  try {
    const { mode = "lawyer", text = "" } = await req.json();

    // ✅ 优先用 xAI 的 Key；兼容老的 OPENAI_API_KEY
    const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing XAI_API_KEY/OPENAI_API_KEY" }, { status: 500 });

    const { system, user } = buildPrompt(mode, text);

    // 第一次生成
    let content = await chatCompletions(
      [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      XAI_MODEL,
      apiKey
    );

    // 简单 JSON 修复：若不是合法 JSON，再请求一次仅返回 JSON
    const trimmed = content.trim().replace(/^```[a-zA-Z]*\n?|```$/g, "");
    try {
      JSON.parse(trimmed);
    } catch {
      const fix = await chatCompletions(
        [
          { role: "system", content: "你是 JSON 修复助手。仅返回合法 JSON 字符串，无任何额外文本。" },
          { role: "user", content: `将下列内容修复成合法 JSON（保持语义）：\n${content}` }
        ],
        XAI_MODEL,
        apiKey
      );
      content = fix;
    }

    return NextResponse.json(content);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "analyze_failed" }, { status: 500 });
  }
}
