// Runs only when the user clicks the toolbar button: takes a picture of the visible
// tab, reads what it can of the open post, asks the API for a verdict and shows it.
// The only thing it does on Instagram is open the share window, and only when the
// user presses "Enviar para o grupo".

const DEFAULT_WEB_ORIGIN = "http://localhost:5173";
const app = document.getElementById("app");

const MESSAGES = {
  no_objective: "Quem criou o grupo ainda não escolheu o objetivo. Avise essa pessoa.",
  unauthorized: "Sua conexão expirou. Abra o site do Boranois e entre de novo.",
};

main().catch((err) => {
  console.error(err);
  render(`<h1>Algo deu errado</h1><p>Feche esta janela e tente de novo em instantes.</p>`);
});

async function main() {
  const { token, webOrigin = DEFAULT_WEB_ORIGIN } = await chrome.storage.local.get(["token", "webOrigin"]);
  if (!token) return showNotConnected(webOrigin);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/^https:\/\/(www\.)?instagram\.com\//.test(tab.url)) {
    return render(`
      <h1>Abra um post do Instagram</h1>
      <p>Entre no Instagram, clique na foto ou no vídeo para abrir o post, e depois clique de novo neste botão.</p>`);
  }

  const [{ result: post }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPost });
  if (!post.isPost) {
    return render(`
      <h1>Abra o post primeiro</h1>
      <p>Clique na foto ou no vídeo para abrir o post, e depois clique de novo neste botão.</p>`);
  }

  render(`<p class="muted">Verificando o post…</p>`);
  const screenshot = await captureTab(tab.windowId);
  await check(webOrigin, token, tab, { ...post, screenshot });
}

async function check(webOrigin, token, tab, post) {
  const res = await fetch(`${webOrigin}/api/check`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      postUrl: post.url,
      handle: post.handle || undefined,
      caption: post.caption || undefined,
      screenshot: post.screenshot,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) await chrome.storage.local.remove(["token"]);
    return render(`<h1>Não deu certo</h1><p>${escape(MESSAGES[data.error] ?? "Tente de novo em instantes.")}</p>`);
  }
  showResult(data, tab, post);
}

function showResult(result, tab, post) {
  if (result.decision === "unclear") {
    return render(`
      <div class="skip">
        <h1>🤔 Não deu para entender este post</h1>
        <p>${escape(result.reason)}</p>
        <p>Assista e decida você mesmo(a) se vale a pena mandar para o grupo.</p>
      </div>`);
  }
  if (result.decision !== "share") {
    return render(`
      <div class="skip">
        <h1>⏭️ Verifique o próximo post</h1>
        <p>${escape(result.reason)}</p>
      </div>`);
  }
  render(`
    <div class="share">
      <h1>✅ Compartilhe com o grupo</h1>
      <p>${escape(result.reason)}</p>
      <button id="send" class="primary">✈️ Enviar para o grupo</button>
      <button id="copy-link">Copiar link do post</button>
      ${result.suggestedComment ? `
        <p class="small next"><strong>Quer comentar?</strong> Uma sugestão (mude com suas palavras):</p>
        <blockquote>${escape(result.suggestedComment)}</blockquote>
        <button id="copy-comment">Copiar comentário</button>` : ""}
    </div>`);

  document.getElementById("send").addEventListener("click", async () => {
    const [{ result: opened }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: openShareWindow });
    if (opened) return window.close(); // Instagram's share window is now open; the user picks the group there.
    await navigator.clipboard.writeText(post.url);
    document.getElementById("send").textContent = "Link copiado ✓ — cole no grupo";
  });
  document.getElementById("copy-link").addEventListener("click", async (e) => {
    await navigator.clipboard.writeText(post.url);
    e.target.textContent = "Link copiado ✓";
  });
  document.getElementById("copy-comment")?.addEventListener("click", async (e) => {
    await navigator.clipboard.writeText(result.suggestedComment);
    e.target.textContent = "Copiado ✓";
  });
}

function showNotConnected(webOrigin) {
  render(`
    <h1>Falta conectar</h1>
    <p>Abra o site do Boranois e entre com o seu código. A extensão se conecta sozinha.</p>
    <button id="open" class="primary">Abrir o site</button>`);
  document.getElementById("open").addEventListener("click", () => chrome.tabs.create({ url: `${webOrigin}/extensao` }));
}

/** Picture of the visible tab, scaled down, as base64 JPEG (no data: prefix). */
async function captureTab(windowId) {
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 85 });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, 1280 / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
}

function render(html) {
  app.innerHTML = html;
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// --- Injected into the Instagram tab. Each function must be self-contained. ---

// Best-effort text from the page; the screenshot covers whatever this misses.
// Instagram's markup changes often, so try several sources, best first.
function readPost() {
  const match = location.pathname.match(/^\/(?:[^/]+\/)?(p|reel|reels)\/([^/]+)/);
  const url = match ? `https://www.instagram.com/${match[1] === "p" ? "p" : "reel"}/${match[2]}/` : location.href;
  const scope = document.querySelector('div[role="dialog"] article') || document.querySelector("main article") || document;
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };

  // On the Reels page many posts are in the DOM at once; only trust text that is on screen.
  const visibleH1 = [...scope.querySelectorAll("h1")].find(onScreen);
  let caption = String(window.getSelection() || "").trim() || visibleH1?.innerText?.trim() || "";

  // og:description is only trustworthy if it belongs to the post on screen (it goes stale on in-app navigation).
  const ogUrl = document.querySelector('meta[property="og:url"]')?.content || "";
  const ogDesc = match && ogUrl.includes(match[2]) ? document.querySelector('meta[property="og:description"]')?.content || "" : "";
  if (!caption && ogDesc) caption = ogDesc.match(/:\s*["“]([\s\S]*)["”]\.?\s*$/)?.[1] || "";

  // The author is a visible link to /<username>/ whose text is the username.
  const author = [...document.querySelectorAll('a[href^="/"]')].find((a) => {
    const name = a.getAttribute("href").match(/^\/([A-Za-z0-9._]+)\/$/)?.[1];
    return name && a.innerText.trim() === name && onScreen(a);
  });
  const handle = author?.innerText.trim() || ogDesc.match(/-\s*([A-Za-z0-9._]+)\s+(?:on|em)\s/)?.[1] || "";

  return { isPost: !!match, url, caption: caption.slice(0, 5000), handle };
}

// Clicks Instagram's own share (paper plane) button for the post on screen.
function openShareWindow() {
  const icons = [...document.querySelectorAll("svg[aria-label]")]
    .filter((svg) => /^(compartilhar|share)/i.test(svg.getAttribute("aria-label")))
    .map((svg) => ({ svg, r: svg.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)
    .sort((a, b) => Math.abs(a.r.top - innerHeight / 2) - Math.abs(b.r.top - innerHeight / 2));
  const button = icons[0]?.svg.closest('[role="button"], button, a') || icons[0]?.svg.parentElement;
  if (!button) return false;
  button.click();
  return true;
}
