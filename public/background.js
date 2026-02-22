/** 打开或聚焦手账页：若已有标签则聚焦，否则新建 */
async function openOrFocusJournal() {
  const targetUrl = chrome.runtime.getURL('index.html');
  try {
    const tabs = await chrome.tabs.query({ url: targetUrl });
    if (tabs.length > 0 && tabs[0].id != null) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId != null) {
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      }
    } else {
      await chrome.tabs.create({ url: targetUrl });
    }
  } catch {
    // 降级：直接新建标签
    chrome.tabs.create({ url: targetUrl });
  }
}

/** 将图片 URL 转换为 base64 dataURL（Service Worker 环境兼容） */
async function imageUrlToDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  return `data:${blob.type};base64,${base64}`;
}

// 注册右键菜单（插件安装/更新时创建）
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-designlog',
    title: '保存到 DesignLog ✦',
    contexts: ['image'],
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'save-to-designlog') return;
  const srcUrl = info.srcUrl;
  if (!srcUrl) return;

  try {
    const dataUrl = await imageUrlToDataUrl(srcUrl);
    await chrome.storage.local.set({ pendingScreenshot: dataUrl });
    await openOrFocusJournal();
  } catch (err) {
    console.error('DesignLog: failed to save image from context menu', err);
  }
});

chrome.action.onClicked.addListener(() => {
  openOrFocusJournal();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PENDING_SCREENSHOT' && msg.dataUrl) {
    chrome.storage.local.set({ pendingScreenshot: msg.dataUrl })
      .then(() => {
        openOrFocusJournal();
        sendResponse({ ok: true });
      })
      .catch((err) => {
        console.error('DesignLog: failed to store screenshot', err);
        sendResponse({ ok: false });
      });
    return true;
  }
});
