// The catalogue is written in the feminine ("ela"). When the pessoa is a man, texts are inflected on the way
// out. Deterministic and closed: only forms that occur in the catalogue and refer to the pessoa are listed,
// so a new feminine word in the content must be added here (the test checks the catalogue against this list).

export type Gender = "f" | "m";

/** Exact phrases first: words that are ambiguous on their own. */
const PHRASES: [string, string][] = [
  ["sou prática", "sou prático"],
  ["está certa de", "está certo de"],
  ["não sou otária", "não sou otário"],
  ["ela mesma", "ele mesmo"],
  ["ela própria", "ele próprio"],
  ["uma pessoa de bem", "uma pessoa de bem"],
];

/** Whole words that refer to the pessoa. */
const WORDS: Record<string, string> = {
  ela: "ele",
  dela: "dele",
  nela: "nele",
  apaixonada: "apaixonado",
  assaltada: "assaltado",
  burra: "burro",
  cansada: "cansado",
  cobrada: "cobrado",
  convencida: "convencido",
  convidada: "convidado",
  culpada: "culpado",
  decidida: "decidido",
  desanimada: "desanimado",
  doutrinada: "doutrinado",
  enganada: "enganado",
  informada: "informado",
  manipulada: "manipulado",
  ouvida: "ouvido",
  ridicularizada: "ridicularizado",
  sozinha: "sozinho",
  traída: "traído",
  tratada: "tratado",
  usada: "usado",
  desafiadora: "desafiador",
  decepcionada: "decepcionado",
  indignada: "indignado",
  segura: "seguro",
  convicta: "convicto",
};

const WORD_RE = new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\b`, "giu");

function keepCase(from: string, to: string) {
  return from[0] === from[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to;
}

export function inflect(text: string, gender: Gender): string {
  if (gender !== "m" || !text) return text;
  let out = text;
  for (const [f, m] of PHRASES) {
    out = out.replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), (hit) => keepCase(hit, m));
  }
  return out.replace(WORD_RE, (hit) => keepCase(hit, WORDS[hit.toLowerCase()]));
}

/** Inflects every string in a plain object/array, recursively. */
export function inflectDeep<T>(value: T, gender: Gender): T {
  if (gender !== "m") return value;
  if (typeof value === "string") return inflect(value, gender) as T;
  if (Array.isArray(value)) return value.map((v) => inflectDeep(v, gender)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, inflectDeep(v, gender)])) as T;
  }
  return value;
}
