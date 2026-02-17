#!/usr/bin/env python3
"""
本地测试 Gemini API 是否可用（仅用标准库，无需 pip 安装）。
用法：
  1. 设置环境变量 GEMINI_API_KEY，或把 config.ts 里的 API_KEY 填到下面 API_KEY_FALLBACK
  2. python scripts/test_gemini.py
"""
import json
import os
import sys
import urllib.request

# 若未设置环境变量，可把 config.ts 里的 API_KEY 复制到这里（勿提交到 git）
API_KEY_FALLBACK = ""

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"


def get_api_key():
    key = os.environ.get("GEMINI_API_KEY", "").strip() or API_KEY_FALLBACK.strip()
    if key:
        return key
    for name in (".env.local", ".env"):
        path = os.path.join(os.path.dirname(__file__), "..", name)
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GEMINI_API_KEY="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def main():
    api_key = (sys.argv[1].strip() if len(sys.argv) > 1 else None) or get_api_key()
    if not api_key:
        print("未设置有效的 GEMINI_API_KEY。")
        print("请任选其一：")
        print('  1. 执行: $env:GEMINI_API_KEY="你的key" 再运行本脚本')
        print("  2. 在项目根目录 .env 或 .env.local 中写: GEMINI_API_KEY=你的key")
        print("  3. 或在本脚本顶部填写 API_KEY_FALLBACK")
        print("  4. 或运行: python scripts/test_gemini.py 你的API_KEY")
        sys.exit(1)
    if "Xxx" in api_key:
        print("警告: API Key 中含占位符 Xxx，可能无效，继续尝试请求...")

    models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-3-flash-preview"]
    prompt = "请从1数到3，只输出数字，不要其他解释。"

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 64},
    }
    data = json.dumps(body).encode("utf-8")

    for model in models_to_try:
        print(f"\n尝试模型: {model}")
        print("-" * 40)
        url = GEMINI_URL.format(model=model, key=api_key)
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                out = json.loads(resp.read().decode())
            text = (
                out.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            if text:
                print(f"回复: {text.strip()}")
                print("OK — 本地请求 Gemini 成功。")
                return
            print("回复为空:", out)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode() if e.fp else ""
            print(f"HTTP {e.code}: {err_body[:500]}")
            if e.code == 429:
                print("  → 配额已用尽，请检查 https://ai.google.dev/gemini-api/docs/rate-limits 或更换/升级 API Key。")
            elif e.code == 404:
                print("  → 模型名可能已变更，可访问 https://ai.google.dev/gemini-api/docs/models 查看当前可用模型。")
        except Exception as e:
            print(f"错误: {e}")

    print("\n所有模型均请求失败，请检查 API Key 与网络。")
    sys.exit(1)


if __name__ == "__main__":
    main()
