import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const httpProxy = process.env.HTTP_PROXY;
  const httpsProxy = process.env.HTTPS_PROXY;
  
  // 测试网络连接
  let networkTest = "unknown";
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    networkTest = response.ok ? "connected" : "api_error";
  } catch (error) {
    networkTest = "failed";
  }
  
  return NextResponse.json({
    status: "ok",
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 7) + "..." : "none",
    model: model,
    proxy: {
      http: httpProxy || "not_set",
      https: httpsProxy || "not_set"
    },
    networkTest: networkTest,
    timestamp: new Date().toISOString()
  });
} 