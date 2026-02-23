import { APP_CONFIG } from "../config";
import { getEffectiveConfigAsync } from "./configStore";

const DEFAULTS = APP_CONFIG.CEREBRAS;

type RuntimeConfig = Awaited<ReturnType<typeof getEffectiveConfigAsync>>;

/** 插件环境无 Vite 代理，需直连 NVIDIA */
function getApiUrl(cfg: RuntimeConfig): string {
  if (typeof location !== "undefined" && location.protocol === "chrome-extension:") return cfg.apiUrlDirect;
  return cfg.apiUrl;
}

/** 从回复文本中解析 JSON 字符串数组 */
function parseTermsFromResponse(text: string, maxTerms: number): string[] {
  if (!text || !text.trim()) return [];
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, trimmed];
  const raw = (jsonMatch[1] || trimmed).trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string").slice(0, maxTerms);
    }
    if (typeof parsed === "object" && Array.isArray(parsed.terms)) {
      return parsed.terms.filter((x: unknown): x is string => typeof x === "string").slice(0, maxTerms);
    }
  } catch {
    const list = raw.replace(/^\[|\]$/g, "").split(/[,\n]/).map((s) => s.trim().replace(/^["']|["']$/g, ""));
    if (list.some(Boolean)) return list.filter(Boolean).slice(0, maxTerms);
  }
  return [];
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 将任意格式的 dataURL（包括 AVIF、WebP 等）用 canvas 转换为 JPEG dataURL。
 * NVIDIA NIM 服务端用 Pillow 解码图片，不支持 AVIF/WebP 等现代格式，需要统一转为 JPEG。
 */
function convertToJpeg(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(dataUrl); // 转换失败则保留原图
    img.src = dataUrl;
  });
}

/**
 * 请求逻辑与 scripts/test_nv2.py 一致（NVIDIA NIM chat/completions）。
 * 使用用户配置（API Key、Model、Prompt），未配置时使用 config 默认值。
 */
export async function generateDesignTerms(imageBase64: string): Promise<string[]> {
  const cfg = await getEffectiveConfigAsync();
  const stream = cfg.stream;
  const userContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: cfg.prompt },
  ];
  if (imageBase64?.trim()) {
    const rawUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`;
    const mimeMatch = rawUrl.match(/^data:([^;]+);/);
    const mime = mimeMatch?.[1] ?? "";
    const needsConvert = !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime);
    const url = needsConvert ? await convertToJpeg(rawUrl) : rawUrl;
    if (needsConvert) console.log("[LLM] 图片格式", mime, "已转换为 JPEG");
    userContent.push({ type: "image_url", image_url: { url } });
    console.log("[LLM] messages 已包含图片, data URL 长度:", url.length);
  } else {
    console.log("[LLM] 未传入图片 base64，仅发送文本");
  }
  const body = {
    model: cfg.model,
    messages: [
      { role: "user" as const, content: userContent },
    ],
    max_tokens: cfg.maxTokens,
    temperature: cfg.temperature,
    top_p: cfg.topP,
    stream,
    chat_template_kwargs: cfg.chatTemplateKwargs,
  };

  const maxRetries = 2;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const waitMs = 2000 * attempt;
        console.log(`LLM 429，${waitMs / 1000}s 后重试 (${attempt}/${maxRetries})...`);
        await delay(waitMs);
      }

      const apiUrl = getApiUrl(cfg);
      console.log(`Requesting design terms with model: ${cfg.model}`, apiUrl === cfg.apiUrlDirect ? "(extension)" : "(web)");
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
          Accept: stream ? "text/event-stream" : "application/json",
        },
        body: JSON.stringify(body),
      });

      const responseText = await res.text();
      console.log("[LLM response] status:", res.status, "statusText:", res.statusText);
      console.log("[LLM response] body:", responseText);

      if (res.status === 429) {
        const errData = (() => {
          try {
            return JSON.parse(responseText) as Record<string, unknown>;
          } catch {
            return {};
          }
        })();
        lastError = (errData?.message as string) || "请求过多，请稍后重试";
        console.warn("[LLM 429] errData:", errData, "lastError:", lastError);
        continue;
      }

      if (!res.ok) {
        console.error("[LLM API Error] status:", res.status, "body:", responseText);
        if (res.status === 400 && /image|vision|content|unsupported/i.test(responseText)) {
          return ["当前模型不支持图片分析", "请使用支持视觉的模型"];
        }
        if (res.status === 401) return ["Invalid API Key", "Check Config"];
        return ["Analysis Failed", "Retry Later"];
      }

      const data = (() => {
        try {
          return JSON.parse(responseText) as { choices?: Array<{ message?: { content?: string } }> };
        } catch {
          return {};
        }
      })();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string") return [];

      const terms = parseTermsFromResponse(content, cfg.maxTerms);
      console.log("LLM design terms:", terms);
      return terms;
    } catch (e) {
      console.error("LLM request error:", e);
      lastError = "网络错误，请重试";
    }
  }

  console.warn("[LLM] 重试用尽，返回失败. lastError:", lastError);
  return ["请求过多，请稍后重试", lastError || "Retry Later"];
}
