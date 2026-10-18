// The catalogue is written in the feminine ("ela"). When the pessoa is a man, texts are inflected on the way
// out. Deterministic and closed: only forms that occur in the catalogue and refer to the pessoa are listed,
// so a new feminine word in the content must be added here (the test checks the catalogue against this list).

/** f = ela, m = ele, n = elu (non-binary, "-e" endings). */
export type Gender = "f" | "m" | "n";

/** Exact phrases first: words that are ambiguous on their own. [feminine, masculine, neutral] */
const PHRASES: [string, string, string][] = [
  ["sou prática", "sou prático", "sou prátique"],
  ["está certa de", "está certo de", "está certe de"],
  ["não sou otária", "não sou otário", "não sou otárie"],
  ["ela mesma", "ele mesmo", "elu mesme"],
  ["ela própria", "ele próprio", "elu próprie"],
];

/** Whole words that refer to the pessoa: [masculine, neutral]. */
const WORDS: Record<string, [string, string]> = {
  ela: ["ele", "elu"],
  dela: ["dele", "delu"],
  nela: ["nele", "nelu"],
  apaixonada: ["apaixonado", "apaixonade"],
  assaltada: ["assaltado", "assaltade"],
  burra: ["burro", "burre"],
  cansada: ["cansado", "cansade"],
  cobrada: ["cobrado", "cobrade"],
  convencida: ["convencido", "convencide"],
  convidada: ["convidado", "convidade"],
  culpada: ["culpado", "culpade"],
  decidida: ["decidido", "decidide"],
  desanimada: ["desanimado", "desanimade"],
  doutrinada: ["doutrinado", "doutrinade"],
  enganada: ["enganado", "enganade"],
  informada: ["informado", "informade"],
  manipulada: ["manipulado", "manipulade"],
  ouvida: ["ouvido", "ouvide"],
  ridicularizada: ["ridicularizado", "ridicularizade"],
  sozinha: ["sozinho", "sozinhe"],
  traída: ["traído", "traíde"],
  tratada: ["tratado", "tratade"],
  usada: ["usado", "usade"],
  desafiadora: ["desafiador", "desafiadore"],
  decepcionada: ["decepcionado", "decepcionade"],
  indignada: ["indignado", "indignade"],
  segura: ["seguro", "segure"],
  convicta: ["convicto", "convicte"],
};

const WORD_RE = new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\b`, "giu");

function keepCase(from: string, to: string) {
  return from[0] === from[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to;
}

export function inflect(text: string, gender: Gender): string {
  if (gender === "f" || !text) return text;
  const idx = gender === "m" ? 0 : 1;
  let out = text;
  for (const [f, m, n] of PHRASES) {
    const to = idx === 0 ? m : n;
    out = out.replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), (hit) => keepCase(hit, to));
  }
  return out.replace(WORD_RE, (hit) => keepCase(hit, WORDS[hit.toLowerCase()][idx]));
}

/** Inflects every string in a plain object/array, recursively. */
export function inflectDeep<T>(value: T, gender: Gender): T {
  if (gender === "f") return value;
  if (typeof value === "string") return inflect(value, gender) as T;
  if (Array.isArray(value)) return value.map((v) => inflectDeep(v, gender)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, inflectDeep(v, gender)])) as T;
  }
  return value;
}
