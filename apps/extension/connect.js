// Runs only on the Boranois web app (see manifest "content_scripts"), never on Instagram.
// The web app hands over the member's session token so the popup can call the API.

const ORIGIN = location.origin;
const reply = (type) => window.postMessage({ source: "boranois-ext", type }, ORIGIN);

window.addEventListener("message", async (event) => {
  if (event.source !== window || event.origin !== ORIGIN) return;
  const msg = event.data;
  if (msg?.source !== "boranois-web") return;

  if (msg.type === "ping") reply("hello");
  if (msg.type === "connect" && typeof msg.token === "string") {
    await chrome.storage.local.set({ token: msg.token, webOrigin: ORIGIN });
    reply("connected");
  }
  if (msg.type === "disconnect") await chrome.storage.local.remove(["token"]);
});

reply("hello");
