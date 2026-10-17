import type { GroupId } from "@boranois/shared";

// Everything that identifies a pessoa lives here, on the member's device only.
// The server knows a pessoa as an id plus chips; it never sees a name, a phone or a note.

export type PrivateContact = {
  nickname: string;
  phone: string;
  note: string;
  /** Chips the member typed in ("+ outra"). Kept here; only an anonymous count goes to the server. */
  customChips: string[];
};
export type Profile = { groups: GroupId[]; voiceSample: string };

const CONTACTS_KEY = "boranois.pessoas";
const PROFILE_KEY = "boranois.perfil";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode etc.: the session just won't persist.
  }
}

const EMPTY: PrivateContact = { nickname: "", phone: "", note: "", customChips: [] };

export const privateContacts = {
  all: () => read<Record<string, PrivateContact>>(CONTACTS_KEY, {}),
  get: (id: string): PrivateContact => ({ ...EMPTY, ...privateContacts.all()[id] }),
  set: (id: string, c: PrivateContact) => write(CONTACTS_KEY, { ...privateContacts.all(), [id]: c }),
  remove: (id: string) => {
    const all = privateContacts.all();
    delete all[id];
    write(CONTACTS_KEY, all);
  },
};

export const profile = {
  get: (): Profile => read<Profile>(PROFILE_KEY, { groups: [], voiceSample: "" }),
  set: (p: Profile) => write(PROFILE_KEY, p),
};

/** wa.me link for a Brazilian number typed any which way. */
export function whatsappLink(phone: string, text: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
