import base64
import json
import os
import requests

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
stream = True

API_KEY = "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"
IMAGE_PATH = os.path.join(os.path.dirname(__file__), "..", "头像.jpg")

# 传统 OpenAI 多模态格式：content 为数组，含 text + image_url
user_content = [{"type": "text", "text": "图片中有什么"}]
if os.path.isfile(IMAGE_PATH):
  with open(IMAGE_PATH, "rb") as f:
    image_b64 = base64.b64encode(f.read()).decode()
  user_content.append({
    "type": "image_url",
    "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
  })
else:
  print(f"提示: 未找到图片 {IMAGE_PATH}，仅发送文本。")

headers = {
  "Authorization": f"Bearer {API_KEY}",
  "Accept": "text/event-stream" if stream else "application/json",
}

payload = {
  "model": "moonshotai/kimi-k2.5",
  "messages": [
    {"role": "user", "content": user_content},
  ],
  "max_tokens": 8192,
  "temperature": 1.0,
  "top_p": 0.95,
  "stream": stream,
}

response = requests.post(invoke_url, headers=headers, json=payload, stream=stream, timeout=60)
response.raise_for_status()

if stream:
  for line in response.iter_lines(decode_unicode=True):
    if not line or not line.startswith("data: "):
      continue
    payload_str = line[6:].strip()
    if payload_str == "[DONE]":
      break
    try:
      obj = json.loads(payload_str)
      delta = obj.get("choices", [{}])[0].get("delta", {}).get("content")
      if delta:
        print(delta, end="", flush=True)
    except json.JSONDecodeError:
      pass
  print()
else:
  out = response.json()
  text = out.get("choices", [{}])[0].get("message", {}).get("content", "")
  print(text or out)
