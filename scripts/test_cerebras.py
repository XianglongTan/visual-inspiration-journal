#!/usr/bin/env python3
"""
调用 Cerebras Chat Completions API（与 README/终端中的 curl 等价）。
支持流式输出；可在 user 消息中附带图片（base64）。
用法：python scripts/test_cerebras.py
"""
import base64
import json
import os
import sys
import urllib.request

# 与 config.ts 中 CEREBRAS.API_KEY 一致
API_KEY = "csk-xm2h85mkt4prknyttnynev26nv2h4thf89dkwcey83er5e69"

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"

# 项目根目录下的图片，随请求一起发给 API
IMAGE_PATH = os.path.join(os.path.dirname(__file__), "..", "头像.jpg")


def main():
    api_key = (sys.argv[1].strip() if len(sys.argv) > 1 else None) or API_KEY
    if not api_key:
        print("未设置 API Key，请在本脚本中填写 API_KEY 或运行: python scripts/test_cerebras.py 你的API_KEY")
        sys.exit(1)

    # 读取图片并转为 base64（OpenAI 风格 image_url）
    user_content = [{"type": "text", "text": "图片中有什么"}]
    if os.path.isfile(IMAGE_PATH):
        with open(IMAGE_PATH, "rb") as f:
            b64 = base64.standard_b64encode(f.read()).decode("ascii")
        user_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
        })
    else:
        print(f"提示: 未找到图片 {IMAGE_PATH}，仅发送文本。")

    body = {
        "model": "zai-glm-4.7",
        "stream": True,
        "max_tokens": 65000,
        "temperature": 1,
        "top_p": 0.95,
        "messages": [
            {"role": "user", "content": user_content},
        ],
    }
    data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(
        CEREBRAS_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "DesignLog/1.0 (Python)",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            # 流式读取 SSE（data: {...} 行）
            buffer = b""
            while True:
                chunk = resp.read(4096)
                if not chunk:
                    break
                buffer += chunk
                while b"\n" in buffer:
                    line, buffer = buffer.split(b"\n", 1)
                    line = line.decode("utf-8", errors="replace").strip()
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:].strip()
                    if payload == "[DONE]":
                        buffer = b""
                        break
                    try:
                        obj = json.loads(payload)
                        delta = (
                            obj.get("choices", [{}])[0]
                            .get("delta", {})
                            .get("content", "")
                        )
                        if delta:
                            print(delta, end="", flush=True)
                    except json.JSONDecodeError:
                        pass
        print()
        print("OK — Cerebras 流式请求完成。")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(f"HTTP {e.code} {e.reason}")
        if e.headers:
            print("--- 响应头 ---")
            for k, v in e.headers.items():
                print(f"  {k}: {v}")
        print("--- 响应体（完整）---")
        print(err_body if err_body else "(空)")
        print("---")
        # 1010 多为 Cloudflare 拦截（地区/IP/User-Agent），可尝试代理或换网络
        if e.code == 403 and "1010" in err_body:
            print("提示: 1010 多为 Cloudflare 拦截，可尝试：换网络/代理、或检查 API 是否限制地区。")
        sys.exit(1)
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
