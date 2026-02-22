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
