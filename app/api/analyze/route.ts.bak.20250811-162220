// app/api/analyze/route.ts
export const runtime = "edge";
import { NextResponse } from "next/server";

/** ====== Grok (xAI) 寮€鍏?====== 
 * 榛樿鐩磋繛 xAI锛歨ttps://api.x.ai/v1/chat/completions
 * 鍏煎 OpenAI锛氬闇€鍥炲垏锛屾妸 XAI_BASE 鏀瑰洖 https://api.openai.com/v1
 */
const XAI_BASE = process.env.XAI_BASE || "https://api.x.ai/v1";     // 鍙€氳繃鐜鍙橀噺瑕嗙洊
const XAI_MODEL = process.env.XAI_MODEL || "grok-4";                // 渚嬪 grok-4 / grok-4-mini / grok-4-heavy锛堣浣犵殑鏉冮檺锛?
const API_PATH = "/chat/completions";                               // xAI 涓?OpenAI-鍏煎绔偣

// 鍚勬ā寮忕殑 JSON 妯℃澘锛堜繚鎸佷笉鍙橈級
const SCHEMAS: Record<string, string> = {
  lawyer: `{"case_meta":{"case_no":"","court":"","date":"","cause":""},"parties":[{"role":"","name":""}],"issues":["..."],"evidence_chain":[{"evidence":"","source_paragraph":"","supports_fact":"","probative_weight":1}],"statutes":[{"law":"","article":"","quote_or_ref":"","application_reasoning":""}],"holdings":"","ratio_decidendi":"","obiter_dicta":"","our_side_arguments":["..."],"risks":[{"level":"楂榺涓瓅浣?,"reason":"","mitigation":""}]}`,
  corporate: `{"overview":{"overall_risk":"楂榺涓瓅浣?,"monetary_exposure_range":"80涓?120涓?,"business_domain":"","region":"","time":""},"claims_against_company":[{"type":"","amount":"","status":"璁ゅ畾|椹冲洖|閮ㄥ垎鏀寔"}],"compliance_gaps":["..."],"action_items":["..."],"watchlist_keywords":["..."],"aggregation_keys":{"cause":"","industry":"","province":"","year":""}}`,
  media: `{"newsworthiness_score":0,"headline":"","six_w":{"who":"","what":"","when":"","where":"","why":"","how":""},"precedent_or_context":["..."],"pull_quotes":[{"text":"","source":"鍘熸枃娈佃惤/蹇犲疄杞堪"}],"tags":["..."],"related_cases_query":"..."}`,
  public: `{"plain_summary":"150-200瀛?,"result":"娉曢櫌鍒や簡浠€涔?,"why":"绠€杩拌鍒ょ悊鐢?,"rights_and_duties":["..."],"faq":[{"q":"","a":""}]}`
};

function buildPrompt(mode: string, text: string) {
  const schema = SCHEMAS[mode] ?? SCHEMAS.lawyer;
  const map: Record<string, { system: string; user: string }> = {
    lawyer: {
      system: "浣犳槸璧勬繁璇夎寰嬪笀鐨勬枃涔﹀垎鏋愬姪鎵嬨€備弗鏍间緷鎹粰瀹氭枃鏈紝涓嶈噯閫犮€傝緭鍑哄繀椤讳负鍚堟硶 JSON銆?,
      user: `浠呰緭鍑?JSON锛堜笉瑕佷换浣曢澶栨枃瀛楋級锛歕n${schema}\n\n銆愬垽鍐充功鍘熸枃銆慭n${text}`
    },
    corporate: {
      system: "浣犳槸浼佷笟娉曞姟椋庨櫓鍒嗘瀽鍔╂墜銆備粎浣跨敤缁欏畾鏂囨湰锛岃緭鍑?JSON銆?,
      user: `浠呰緭鍑?JSON锛歕n${schema}\n\n銆愬師鏂囥€慭n${text}`
    },
    media: {
      system: "浣犳槸娉曞緥涓庡叕鍏变簨鍔¤鑰?鐮旂┒鍛樺姪鎵嬨€備粎杈撳嚭 JSON銆?,
      user: `浠呰緭鍑?JSON锛歕n${schema}\n\n銆愬師鏂囥€慭n${text}`
    },
    public: {
      system: "浣犳槸闈㈠悜鏅€氬叕浼楃殑娉曞緥瑙ｉ噴鍔╂墜銆備粎杈撳嚭 JSON銆?,
      user: `浠呰緭鍑?JSON锛歕n${schema}\n\n銆愬師鏂囥€慭n${text}`
    }
  };
  return map[mode] ?? map.lawyer;
}

// xAI / OpenAI 鍏煎鐨?Chat Completions 璋冪敤
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

    // 鉁?浼樺厛鐢?xAI 鐨?Key锛涘吋瀹硅€佺殑 OPENAI_API_KEY
    const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing XAI_API_KEY/OPENAI_API_KEY" }, { status: 500 });

    const { system, user } = buildPrompt(mode, text);

    // 绗竴娆＄敓鎴?
    let content = await chatCompletions(
      [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      XAI_MODEL,
      apiKey
    );

    // 绠€鍗?JSON 淇锛氳嫢涓嶆槸鍚堟硶 JSON锛屽啀璇锋眰涓€娆′粎杩斿洖 JSON
    const trimmed = content.trim().replace(/^```[a-zA-Z]*\n?|```$/g, "");
    try {
      JSON.parse(trimmed);
    } catch {
      const fix = await chatCompletions(
        [
          { role: "system", content: "浣犳槸 JSON 淇鍔╂墜銆備粎杩斿洖鍚堟硶 JSON 瀛楃涓诧紝鏃犱换浣曢澶栨枃鏈€? },
          { role: "user", content: `灏嗕笅鍒楀唴瀹逛慨澶嶆垚鍚堟硶 JSON锛堜繚鎸佽涔夛級锛歕n${content}` }
        ],
        XAI_MODEL,
        apiKey
      );
      content = fix;
    }

    const trimmed = content.trim().replace(/^```[a-zA-Z]*\n?|```$/g, "");
let payload: unknown;
try {
  payload = JSON.parse(trimmed);
} catch {
  payload = { ok: false, reason: "LLM_INVALID_JSON", raw: trimmed.slice(0, 5000) };
}
return NextResponse.json(payload);
  } catch (e: any) {
  return NextResponse.json(
    { ok: false, error: e?.message || "analyze_failed" },
    { status: 500 }
  );
}, { status: 500 });
  }
}

