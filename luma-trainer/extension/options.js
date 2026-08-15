const input = document.getElementById("base");
chrome.storage.sync.get({ lumaBase: "http://localhost:3400" }, (v) => (input.value = v.lumaBase));
document.getElementById("save").addEventListener("click", () => {
  const lumaBase = input.value.trim() || "http://localhost:3400";
  chrome.storage.sync.set({ lumaBase }, () => {
    const el = document.getElementById("saved");
    el.textContent = "Сохранено";
    setTimeout(() => (el.textContent = ""), 1500);
  });
});
