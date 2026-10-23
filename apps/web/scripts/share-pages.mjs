// After `vite build`: one extra copy of index.html per section that needs its own share card.
// Link previews (WhatsApp, X) read the HTML without running the app, so the tags must differ at the HTML level.
// firebase.json rewrites each section's paths to its copy; the app inside is the same bundle.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const base = readFileSync(join(dist, "index.html"), "utf8");

const PAGES = [
  {
    path: "casas-de-repouso",
    title: "Casas de repouso: ligue no sábado, acompanhe no domingo",
    tab: "Boranois — Casas de repouso",
    description: "Moradores de casas de repouso querem votar e não têm com quem ir. Escolha uma casa perto do seu CEP, ligue, e combine companhia a pé ou de transporte público. Sem carro, sem partido.",
    image: "https://boranois.web.app/og-casas.png",
    alt: "Ligue para uma casa de repouso. Domingo, acompanhe quem quer votar.",
    url: "https://boranois.web.app/casas-de-repouso",
  },
];

const set = (html, re, value) => {
  if (!re.test(html)) throw new Error(`tag not found: ${re}`);
  return html.replace(re, value);
};

for (const p of PAGES) {
  let html = base;
  html = set(html, /<title>[^<]*<\/title>/, `<title>${p.tab}</title>`);
  html = set(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${p.description}" />`);
  html = set(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${p.url}" />`);
  html = set(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${p.url}" />`);
  html = set(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${p.title}" />`);
  html = set(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${p.description}" />`);
  html = set(html, /<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${p.image}" />`);
  html = set(html, /<meta property="og:image:alt" content="[^"]*" \/>/, `<meta property="og:image:alt" content="${p.alt}" />`);
  html = set(html, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${p.title}" />`);
  html = set(html, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${p.description}" />`);
  html = set(html, /<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${p.image}" />`);
  mkdirSync(join(dist, p.path), { recursive: true });
  writeFileSync(join(dist, p.path, "index.html"), html);
  console.log(`share page: /${p.path}`);
}
