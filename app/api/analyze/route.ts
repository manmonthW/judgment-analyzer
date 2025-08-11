export const runtime = "edge";
import { NextResponse } from "next/server";

/** xAI (Grok) 配置 */
const XAI_BASE = process.env.XAI_BASE || "https://api.x.ai/v1";
const XAI_MODEL = process.env.XAI_MODEL || "grok-4";
const API_PATH = "/chat/completions";

/** 输出模式的 JSON 模板 */
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
      system: "你是一位资深的法律助理，专门进行判决书分析。请仅使用提供的文本内容。输出必须是有效的JSON格式，不要包含任何其他文字。",
      user: `请分析以下判决书内容，并严格按照以下JSON格式返回结果，不要包含任何解释文字或markdown格式:\n${schema}\n\n[原文内容]\n${text}`
    },
    corporate: {
      system: "你是企业法务风险分析助理。请仅使用提供的文本内容。输出必须是JSON格式。",
      user: `请分析以下判决书的企业风险，严格返回JSON格式:\n${schema}\n\n[原文内容]\n${text}`
    },
    media: {
      system: "你是法律新闻编辑的研究助理。请仅使用提供的文本内容。输出必须是JSON格式。",
      user: `请分析以下判决书的新闻价值，严格返回JSON格式:\n${schema}\n\n[原文内容]\n${text}`
    },
    public: {
      system: "你专门用通俗语言解释判决书。请仅使用提供的文本内容。输出必须是JSON格式。",
      user: `请用通俗语言解释以下判决书，严格返回JSON格式:\n${schema}\n\n[原文内容]\n${text}`
    }
  };
  return map[mode] ?? map.lawyer;
}

/** xAI Chat Completions 调用 */
async function chatCompletions(messages: Array<{role:"system"|"user"|"assistant"; content:string}>, model: string, apiKey: string) {
  const url = `${XAI_BASE}${API_PATH}`;
  
  console.log("Calling xAI API:", url, "with model:", model);
  
  const response = await fetch(url, {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${apiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({ 
      model, 
      temperature: 0.1, 
      messages,
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("xAI API Error:", response.status, response.statusText, errorText);
    throw new Error(`xAI API Error: ${response.status} - ${errorText || response.statusText}`);
  }
  
  const data = await response.json();
  console.log("xAI API Response received, content length:", data?.choices?.[0]?.message?.content?.length || 0);
  return String(data?.choices?.[0]?.message?.content ?? "");
}

export async function POST(req: Request) {
  try {
    const { mode = "lawyer", text = "" } = await req.json();

    // 优先使用 XAI_API_KEY，然后是 OPENAI_API_KEY (兼容性)
    const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("Missing API key - need XAI_API_KEY or OPENAI_API_KEY");
      return NextResponse.json({ 
        ok: false, 
        error: "Missing XAI_API_KEY/OPENAI_API_KEY - 请在环境变量中配置 xAI API 密钥" 
      }, { status: 500 });
    }

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ 
        ok: false, 
        error: "文本内容太短或为空" 
      }, { status: 400 });
    }

    console.log("Starting xAI analysis with mode:", mode, "text length:", text.length);

    const { system, user } = buildPrompt(mode, text);

    // 第一次调用 xAI
    let content = await chatCompletions(
      [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      XAI_MODEL,
      apiKey
    );

    console.log("Raw xAI response preview:", content.substring(0, 200) + "...");

    // 清理响应内容，移除可能的 markdown 代码块标记
    const trimmed = content.trim().replace(/^```[a-zA-Z]*\n?|```$/g, "");
    let payload: unknown;
    
    try {
      payload = JSON.parse(trimmed);
      console.log("JSON parsing successful");
    } catch (parseError) {
      console.log("Initial JSON parsing failed, attempting repair...");
      
      // 如果第一次解析失败，尝试修复
      const fixResponse = await chatCompletions(
        [
          { role: "system", content: "你是一个JSON修复助手。请将输入的内容转换为有效的JSON格式，保持原意，只返回JSON字符串，不要任何其他文字，不要markdown格式。" },
          { role: "user", content: `请修复以下内容为有效的JSON格式:\n${content}` }
        ],
        XAI_MODEL,
        apiKey
      );

      const fixed = fixResponse.trim().replace(/^```[a-zA-Z]*\n?|```$/g, "");
      try {
        payload = JSON.parse(fixed);
        console.log("JSON repair successful");
      } catch (finalError) {
        console.error("Final JSON parsing failed:", finalError);
        console.error("Original content:", content.substring(0, 500));
        console.error("Fixed content:", fixed.substring(0, 500));
        payload = { 
          ok: false, 
          reason: "LLM_INVALID_JSON", 
          raw: (fixed || trimmed).slice(0, 1000),
          error: "xAI 返回的内容无法解析为有效的 JSON 格式",
          debug: {
            original: content.substring(0, 200),
            fixed: fixed.substring(0, 200)
          }
        };
      }
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("Analysis API Error:", error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error?.message || "分析过程中发生错误",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}