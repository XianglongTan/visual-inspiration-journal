# 视觉灵感手账

Chrome 浏览器扩展：周视图视觉灵感手账，收集 UI/UX 截图，用 AI 自动生成设计关键词，本地存储、即开即用。

---

## 功能概览

- **周视图**：周一～周五 + 周末，按天收纳截图
- **双列网格**：每天多张卡片，排版清晰
- **AI 标注**：上传图片后自动生成 5～10 个设计术语（如 Glassmorphism、Brutalism）
- **本地存储**：数据与图片存在浏览器本地（IndexedDB），无需账号、不经过服务器
- **拍立得风格**：卡片带随机图钉与旋转，底部可拖拽笔记区，悬停可展开/复制标签、删除
- **全局截图**：在任意网页显示悬浮按钮，截屏后直接写入当天手账并打标签

---

## 安装与使用

1. **安装依赖**：`npm install`
2. **配置**（见下方「配置」一节）
3. **构建扩展**：`npm run build:extension`
4. 打开 Chrome → `chrome://extensions/` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选择项目下的 **`dist`** 目录

安装后：点击扩展图标可打开手账页面；在任意网页会出现「截图」悬浮按钮，截取当前页面后截图会进入当天手账并自动打标签。

---

## 配置

使用前需要配置 AI 接口（用于生成设计关键词）：

1. **生成配置文件**  
   首次运行 `npm run build` 或 `npm run build:extension` 时，会自动根据 `config.example.ts` 在项目根目录生成 `config.ts`。若没有自动生成，可手动把 `config.example.ts` 复制一份并重命名为 `config.ts`。

2. **填写 API Key**  
   打开根目录下的 `config.ts`，找到 `CEREBRAS.API_KEY`，将 `'your-nvidia-api-key-here'` 替换为你的 **NVIDIA API Key**（[NVIDIA API 控制台](https://build.nvidia.com/) 可申请）。

3. **保存后重新构建**  
   保存 `config.ts` 后重新执行 `npm run build:extension` 即可生效。

---

## 技术栈

React、TypeScript、Vite、Tailwind CSS；AI 支持 NVIDIA / Gemini；数据存于浏览器 IndexedDB。

---

## 参与开发

架构、数据模型、AI 模块与扩展打包等说明见 **[doc/开发文档.md](doc/开发文档.md)**。
