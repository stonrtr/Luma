// Luma extension background worker. Proxies Luma API calls (extensions with
// host_permissions bypass page CORS) and captures the visible tab for the
// OCR-fallback aid.

async function getBase() {
  const { lumaBase } = await chrome.storage.sync.get({ lumaBase: "http://localhost:3400" });
  return lumaBase.replace(/\/$/, "");
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      const base = await getBase();
      if (msg.type === "LUMA_LESSONS") {
        const res = await fetch(`${base}/api/lessons?archived=false`);
        sendResponse({ ok: res.ok, data: await res.json() });
      } else if (msg.type === "LUMA_ADD") {
        const res = await fetch(`${base}/api/phrases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg.payload),
        });
        sendResponse({ ok: res.ok, data: await res.json() });
      } else if (msg.type === "LUMA_CREATE_LESSON") {
        const res = await fetch(`${base}/api/lessons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg.payload),
        });
        sendResponse({ ok: res.ok, data: await res.json() });
      } else if (msg.type === "LUMA_CAPTURE") {
        const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
        sendResponse({ ok: true, dataUrl });
      } else {
        sendResponse({ ok: false, error: "unknown message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // keep the message channel open for the async response
});
