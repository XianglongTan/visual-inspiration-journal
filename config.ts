export const APP_CONFIG = {
  CEREBRAS: {
    // 网页开发：走 Vite 代理，避免 CORS
    API_URL: '/api/nvidia/v1/chat/completions',
    // 浏览器插件：无代理，必须直连 NVIDIA（需在 manifest 里声明 host 权限）
    API_URL_DIRECT: 'https://integrate.api.nvidia.com/v1/chat/completions',
    API_KEY: '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',
    MODEL: 'qwen/qwen3.5-397b-a17b',
    PROMPT:
      '请基于这张截图的具体使用场景和界面语境，从专业UI/视觉设计角度，提炼5-10个最关键的设计关键词。关键解析设计中的布局结构、组件形态、字体、颜色、材质、层级关系、交互定义，避免抽象评价，需直接可用于复刻或检索类似设计。用list输出(["关键词1"...])，不要输出其他。',
    TEMPERATURE: 1.0,
    TOP_P: 1.0,
    MAX_TOKENS: 16384,
    STREAM: false,
    CHAT_TEMPLATE_KWARGS: { thinking: false } as const,
    MAX_TERMS: 10,
  },
};
