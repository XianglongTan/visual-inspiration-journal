
import requests, base64

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
stream = False


with open("image.png", "rb") as f:
  image_b64 = base64.b64encode(f.read()).decode()

headers = {
  "Authorization": "Bearer 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",
  "Accept": "text/event-stream" if stream else "application/json"
}

user_content = [{"type": "text", "text": '请基于这张截图的具体使用场景和界面语境，从专业UI/视觉设计角度，提炼5-10个最关键的设计关键词。关键解析设计中的布局结、技大系、支的定，越免抽象评价，需直接可用于复刻或检索类似设计。用list输出(["关键词1"...])，不要输出其他。'}]
user_content.append({
    "type": "image_url",
    "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
  })


payload = {
  "model": "moonshotai/kimi-k2.5",
  "messages": [
      {
        "role": "user",
        "content": user_content
      }
    ],
  "max_tokens": 16384,
  "temperature": 1.00,
  "top_p": 1.00,
  "stream": stream,
  "chat_template_kwargs": {"thinking":False},
}



response = requests.post(invoke_url, headers=headers, json=payload)

if stream:
    for line in response.iter_lines():
        if line:
            print(line.decode("utf-8"))
else:
    print(response.json())
