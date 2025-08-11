// 移除 Edge Runtime，使用 Node.js Runtime 支持代理
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
  
  // 如果文本太长，截断处理
  const maxTextLength = 8000;
  const truncatedText = text.length > maxTextLength 
    ? text.substring(0, maxTextLength) + "\n...(文本已截断)"
    : text;
  
  const map: Record<string, { system: string; user: string }> = {
    lawyer: {
      system: "你是一位资深的法律助理，专门进行判决书分析。请仅使用提供的文本内容。输出必须是有效的JSON格式，不要包含任何其他文字。",
      user: `请分析以下判决书内容，并严格按照以下JSON格式返回结果，不要包含任何解释文字或markdown格式:\n${schema}\n\n[原文内容]\n${truncatedText}`
    },
    corporate: {
      system: "你是企业法务风险分析助理。请仅使用提供的文本内容。输出必须是JSON格式。",
      user: `请分析以下判决书的企业风险，严格返回JSON格式:\n${schema}\n\n[原文内容]\n${truncatedText}`
    },
    media: {
      system: "你是法律新闻编辑的研究助理。请仅使用提供的文本内容。输出必须是JSON格式。",
      user: `请分析以下判决书的新闻价值，严格返回JSON格式:\n${schema}\n\n[原文内容]\n${truncatedText}`
    },
    public: {
      system: "你专门用通俗语言解释判决书。请仅使用提供的文本内容。输出必须是JSON格式。",
      user: `请用通俗语言解释以下判决书，严格返回JSON格式:\n${schema}\n\n[原文内容]\n${truncatedText}`
    }
  };
  return map[mode] ?? map.lawyer;
}

/** 获取代理配置 */
function getProxyConfig() {
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  
  if (httpProxy || httpsProxy) {
    console.log("Using proxy config:", { httpProxy, httpsProxy });
    return {
      http: httpProxy,
      https: httpsProxy || httpProxy
    };
  }
  return null;
}

/** xAI Chat Completions 调用 */
async function chatCompletions(messages: Array<{role:"system"|"user"|"assistant"; content:string}>, model: string, apiKey: string) {
  const url = `${XAI_BASE}${API_PATH}`;
  
  console.log("Calling xAI API:", url, "with model:", model);
  console.log("Request payload size:", JSON.stringify({ model, messages }).length, "characters");
  
  // 代理配置
  const proxyConfig = getProxyConfig();
  const fetchOptions: RequestInit = {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${apiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({ 
      model, 
      temperature: 0.1, 
      messages,
      max_tokens: 1500
    })
  };

  // 在 Node.js 环境中设置代理
  if (proxyConfig && typeof global !== 'undefined') {
    try {
      // 动态导入 node 模块（仅在 Node.js 环境中可用）
      const { HttpsProxyAgent } = await import('https-proxy-agent');
      const { HttpProxyAgent } = await import('http-proxy-agent');
      
      if (url.startsWith('https://') && proxyConfig.https) {
        (fetchOptions as any).agent = new HttpsProxyAgent(proxyConfig.https);
        console.log("Using HTTPS proxy:", proxyConfig.https);
      } else if (proxyConfig.http) {
        (fetchOptions as any).agent = new HttpProxyAgent(proxyConfig.http);
        console.log("Using HTTP proxy:", proxyConfig.http);
      }
    } catch (error) {
      console.log("Proxy agent setup failed, proceeding without proxy:", error);
    }
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时
  fetchOptions.signal = controller.signal;
  
  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("xAI API Error:", response.status, response.statusText, errorText);
      throw new Error(`xAI API Error: ${response.status} - ${errorText || response.statusText}`);
    }
    
    const data = await response.json();
    console.log("xAI API Response received, content length:", data?.choices?.[0]?.message?.content?.length || 0);
    return String(data?.choices?.[0]?.message?.content ?? "");
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("请求超时，请检查网络连接或代理设置");
    }
    throw error;
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    console.log("=== Analysis API Request Started ===");
    console.log("Runtime: Node.js (proxy support enabled)");
    console.log("Proxy config:", getProxyConfig());
    
    const { mode = "lawyer", text = "" } = await req.json();
    console.log("Request params:", { mode, textLength: text.length });

    // 优先使用 XAI_API_KEY，然后是 OPENAI_API_KEY (兼容性)
    const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("Missing API key");
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

    if (text.length > 15000) {
      console.log("Text too long, will be truncated:", text.length);
    }

    console.log("Building prompt for mode:", mode);
    const { system, user } = buildPrompt(mode, text);

    console.log("Calling xAI API...");
    let content = await chatCompletions(
      [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      XAI_MODEL,
      apiKey
    );

    console.log("Raw xAI response received, length:", content.length);
    console.log("Response preview:", content.substring(0, 100) + "...");

    // 清理响应内容
    const trimmed = content.trim().replace(/^```[a-zA-Z]*\n?|```$/g, "");
    let payload: unknown;
    
    try {
      payload = JSON.parse(trimmed);
      console.log("JSON parsing successful");
    } catch (parseError) {
      console.log("Initial JSON parsing failed, attempting repair...");
      
      try {
        const fixResponse = await chatCompletions(
          [
            { role: "system", content: "你是JSON修复助手。只返回有效的JSON，不要其他文字。" },
            { role: "user", content: `修复为JSON:\n${content.substring(0, 2000)}` }
          ],
          XAI_MODEL,
          apiKey
        );

        const fixed = fixResponse.trim().replace(/^```[a-zA-Z]*\n?|```$/g, "");
        payload = JSON.parse(fixed);
        console.log("JSON repair successful");
      } catch (finalError) {
        console.error("Final JSON parsing failed:", finalError);
        payload = { 
          ok: false, 
          reason: "LLM_INVALID_JSON", 
          raw: trimmed.slice(0, 500),
          error: "AI 返回的内容无法解析为有效的 JSON 格式"
        };
      }
    }

    const duration = Date.now() - startTime;
    console.log(`=== Analysis completed in ${duration}ms ===`);

    return NextResponse.json(payload);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`=== Analysis failed after ${duration}ms ===`);
    console.error("Error details:", error);
    
    return NextResponse.json(
      { 
        ok: false, 
        error: error?.message || "分析过程中发生错误",
        duration: duration,
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}