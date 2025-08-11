// app/api/analyze/route.ts
export const runtime = "edge";
import { NextResponse } from "next/server";

// 各模式输出所需的简化 JSON 模板
const SCHEMAS: Record<string,string> = {
  lawyer: `{"case_meta":{"case_no":"","court":"","date":"","cause":""},"parties":[{"role":"","name":""}],"issues":["..."],"evidence_chain":[{"evidence":"","source_paragraph":"","supports_fact":"","probative_weight":1}],"statutes":[{"law":"","article":"","quote_or_ref":"","application_reasoning":""}],"holdings":"","ratio_decidendi":"","obiter_dicta":"","our_side_arguments":["..."],"risks":[{"level":"高|中|低","reason":"","mitigation":""}]}`,
  corporate: `{"overview":{"overall_risk":"高|中|低","monetary_exposure_range":"80万-120万","business_domain":"","region":"","time":""},"claims_against_company":[{"type":"","amount":"","status":"认定|驳回|部分支持"}],"compliance_gaps":["..."],"action_items":["..."],"watchlist_keywords":["..."],"aggregation_keys":{"cause":"","industry":"","province":"","year":""}}`,
  media: `{"newsworthiness_score":0,"headline":"","six_w":{"who":"","what":"","when":"","where":"","why":"","how":""},"precedent_or_context":["..."],"pull_quotes":[{"text":"","source":"原文段落/忠实转述"}],"tags":["..."],"related_cases_query":"..."}`,
  public: `{"plain_summary":"150-200字","result":"法院判了什么","why":"简述裁判理由","rights_and_duties":["..."],"faq":[{"q":"","a":""}]}`
};

// 构造prompt
function buildPrompt(mode: string, text: string) {
  const schema = SCHEMAS[mode] ?? SCHEMAS.lawyer;
  const map: Record<string, {system: string; user: string}> = {
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

// 调用 OpenAI
async function callOpenAI(messages: any[], model: string, apiKey: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时
    
    console.log(`Calling OpenAI API with model: ${model}`);
    
    // 获取代理配置
    const httpProxy = process.env.HTTP_PROXY;
    const httpsProxy = process.env.HTTPS_PROXY;
    
    if (httpProxy || httpsProxy) {
      console.log(`Using proxy: ${httpsProxy || httpProxy}`);
    }
    
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        model, 
        temperature: 0.2, 
        messages,
        max_tokens: 4000
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error(`OpenAI API error: ${r.status} ${r.statusText}`, errorText);
      throw new Error(`OpenAI API error: ${r.status} ${r.statusText} - ${errorText}`);
    }
    
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content received from OpenAI API");
    }
    
    console.log("OpenAI API call successful");
    return String(content);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error("Request timeout - OpenAI API took too long to respond");
    }
    if (error.message.includes('fetch failed')) {
      const proxyInfo = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      if (proxyInfo) {
        throw new Error(`Network error - Unable to connect to OpenAI API through proxy ${proxyInfo}. Please check your proxy configuration.`);
      } else {
        throw new Error("Network error - Unable to connect to OpenAI API. Please check your internet connection or proxy settings.");
      }
    }
    throw error;
  }
}

// Edge API 入口
export async function POST(req: Request) {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { mode = "lawyer", text = "" } = await req.json();
    
    // 检查输入参数
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Missing or empty text parameter" }, { status: 400 });
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("Missing OPENAI_API_KEY environment variable");
      return NextResponse.json({ 
        error: "Missing OPENAI_API_KEY", 
        message: "Please set OPENAI_API_KEY in your .env.local file" 
      }, { status: 500 });
    }
    
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const { system, user } = buildPrompt(mode, text);
    
    console.log(`Starting analysis with mode: ${mode}, model: ${model}`);
    
    let content = await callOpenAI(
      [
        { role:"system", content: system },
        { role:"user", content: user }
      ],
      model,
      apiKey
    );
    
    // 如果模型输出不是合法 JSON，则再请求一次修正
    const trimmed = content.trim().replace(/^```[a-zA-Z]*\n?|```$/g, "");
    try { 
      JSON.parse(trimmed); 
    } catch (parseError) {
      console.log("Initial response is not valid JSON, attempting to fix...");
      const fix = await callOpenAI(
        [
          { role:"system", content:"你是 JSON 修复助手。仅返回合法的 JSON 字符串，无任何额外文本。" },
          { role:"user", content:`将下列内容修复成合法 JSON（保持语义）：\n${content}` }
        ],
        model,
        apiKey
      );
      content = fix;
    }
    
    console.log("Analysis completed successfully");
    return NextResponse.json(content);
    
  } catch (e: any) {
    console.error("API Error:", e);
    return NextResponse.json({ 
      error: e?.message || "analyze_failed",
      details: e?.stack || "Unknown error occurred"
    }, { status: 500 });
  }
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
