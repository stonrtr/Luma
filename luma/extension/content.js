// Luma subtitle reader (§23). Tracks the currently visible caption on YouTube,
// Netflix, native HTML5 <track> cues, and generic caption DOM. Responds to the
// popup with the latest caption, any manual text selection, and page context.
// It never touches DRM or downloads protected video — it only reads visible text.

(function () {
  let lastCaption = "";

  const SELECTORS = [
    ".ytp-caption-segment", // YouTube
    ".player-timedtext-text-container", // Netflix
    ".player-timedtext", // Netflix (container)
    "[class*='caption']",
    "[class*='subtitle']",
    ".vjs-text-track-cue", // video.js
  ];

  function fromDom() {
    for (const sel of SELECTORS) {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length) {
        const text = Array.from(nodes)
          .map((n) => n.textContent.trim())
          .filter(Boolean)
          .join(" ")
          .trim();
        if (text) return text;
      }
    }
    return "";
  }

  function fromTextTracks() {
    const videos = document.querySelectorAll("video");
    for (const v of videos) {
      const tracks = v.textTracks || [];
      for (const t of tracks) {
        if ((t.mode === "showing" || t.mode === "hidden") && t.activeCues) {
          const cues = Array.from(t.activeCues)
            .map((c) => (c.text || "").replace(/<[^>]+>/g, "").trim())
            .filter(Boolean)
            .join(" ");
          if (cues) return cues;
        }
      }
    }
    return "";
  }

  function currentVideoTime() {
    const v = document.querySelector("video");
    return v ? Math.floor(v.currentTime) : undefined;
  }

  // Poll for the latest caption so we keep the last shown line even after it disappears.
  setInterval(() => {
    const cap = fromTextTracks() || fromDom();
    if (cap && cap.length < 300) lastCaption = cap;
  }, 500);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "LUMA_GET_CAPTION") {
      const selection = (window.getSelection && window.getSelection().toString().trim()) || "";
      sendResponse({
        caption: lastCaption,
        selection,
        url: location.href,
        title: document.title,
        time: currentVideoTime(),
      });
    }
    return true;
  });
})();
