import { APP_CONFIG } from "../config";

const STORAGE_KEY = "designlog_user_config";

function parseNum(v: unknown, def: number): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return def;
}

function parseStored(o: Record<string, unknown>): UserConfig {
  return {
    apiUrlDirect: typeof o.apiUrlDirect === "string" ? o.apiUrlDirect : undefined,
    apiKey: typeof o.apiKey === "string" ? o.apiKey : undefined,
    model: typeof o.model === "string" ? o.model : undefined,
    prompt: typeof o.prompt === "string" ? o.prompt : undefined,
    temperature: parseNum(o.temperature, APP_CONFIG.CEREBRAS.TEMPERATURE),
    topP: parseNum(o.topP, APP_CONFIG.CEREBRAS.TOP_P),
    maxTokens: parseNum(o.maxTokens, APP_CONFIG.CEREBRAS.MAX_TOKENS),
    stream: typeof o.stream === "boolean" ? o.stream : undefined,
    thinking: typeof o.thinking === "boolean" ? o.thinking : undefined,
    maxTerms: parseNum(o.maxTerms, APP_CONFIG.CEREBRAS.MAX_TERMS),
  };
}

export type UserConfig = {
  apiUrlDirect?: string;
  apiKey?: string;
  model?: string;
  prompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
  thinking?: boolean;
  maxTerms?: number;
};

function isExtension(): boolean {
  return typeof location !== "undefined" && location.protocol === "chrome-extension:";
}

export async function getUserConfig(): Promise<UserConfig> {
  if (isExtension() && typeof chrome !== "undefined" && chrome.storage?.local) {
    const out = await chrome.storage.local.get(STORAGE_KEY);
    const raw = out[STORAGE_KEY];
    if (raw && typeof raw === "object") {
      return parseStored(raw);
    }
    return {};
  }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return {};
    const raw = JSON.parse(s) as unknown;
    if (raw && typeof raw === "object") return parseStored(raw as Record<string, unknown>);
  } catch {
    /* ignore */
  }
  return {};
}

export async function setUserConfig(config: UserConfig): Promise<void> {
  const payload: Record<string, unknown> = {
    apiUrlDirect: config.apiUrlDirect ?? "",
    apiKey: config.apiKey ?? "",
    model: config.model ?? "",
    prompt: config.prompt ?? "",
    temperature: config.temperature,
    topP: config.topP,
    maxTokens: config.maxTokens,
    stream: config.stream,
    thinking: config.thinking,
    maxTerms: config.maxTerms,
  };
  if (isExtension() && typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: payload });
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** 合并默认配置与用户配置，供 API 调用使用 */
export function getEffectiveConfig(): {
  apiKey: string;
  model: string;
  prompt: string;
  apiUrl: string;
  apiUrlDirect: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  stream: boolean;
  chatTemplateKwargs: { thinking: false };
  maxTerms: number;
} {
  const D = APP_CONFIG.CEREBRAS;
  return {
    apiKey: D.API_KEY,
    model: D.MODEL,
    prompt: D.PROMPT,
    apiUrl: D.API_URL,
    apiUrlDirect: D.API_URL_DIRECT,
    maxTokens: D.MAX_TOKENS,
    temperature: D.TEMPERATURE,
    topP: D.TOP_P,
    stream: D.STREAM,
    chatTemplateKwargs: D.CHAT_TEMPLATE_KWARGS,
    maxTerms: D.MAX_TERMS,
  };
}

/** 异步获取：若存在用户配置则合并后返回，否则返回默认 */
let cached: Awaited<ReturnType<typeof getEffectiveConfig>> | null = null;

export async function getEffectiveConfigAsync(): Promise<ReturnType<typeof getEffectiveConfig>> {
  const user = await getUserConfig();
  const base = getEffectiveConfig();
  if (user.apiUrlDirect !== undefined && user.apiUrlDirect.trim() !== "") base.apiUrlDirect = user.apiUrlDirect.trim();
  if (user.apiKey !== undefined && user.apiKey.trim() !== "") base.apiKey = user.apiKey.trim();
  if (user.model !== undefined && user.model.trim() !== "") base.model = user.model.trim();
  if (user.prompt !== undefined && user.prompt.trim() !== "") base.prompt = user.prompt.trim();
  if (user.temperature !== undefined) base.temperature = user.temperature;
  if (user.topP !== undefined) base.topP = user.topP;
  if (user.maxTokens !== undefined) base.maxTokens = user.maxTokens;
  if (user.stream !== undefined) base.stream = user.stream;
  if (user.thinking !== undefined) base.chatTemplateKwargs = { thinking: user.thinking };
  if (user.maxTerms !== undefined) base.maxTerms = user.maxTerms;
  cached = base;
  return base;
}

export function clearConfigCache(): void {
  cached = null;
}
