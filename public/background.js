chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PENDING_SCREENSHOT' && msg.dataUrl) {
    chrome.storage.local.set({ pendingScreenshot: msg.dataUrl }).then(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
      sendResponse({ ok: true });
    }).catch((err) => {
      console.error('DesignLog: failed to store screenshot', err);
      sendResponse({ ok: false });
    });
    return true;
  }
});
