import type { GroupId } from "@boranois/shared";

// Everything that identifies a pessoa lives here, on the member's device only.
// The server knows a pessoa as an id plus chips; it never sees a name, a phone or a note.

export type PrivateContact = {
  nickname: string;
  /** Never asked anymore. Old entries may still carry one; `all()` strips it. */
  phone?: string;
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

const EMPTY: PrivateContact = { nickname: "", note: "", customChips: [] };

export const privateContacts = {
  all: () => {
    const all = read<Record<string, PrivateContact>>(CONTACTS_KEY, {});
    // Phone numbers were collected before 20 Oct 2026. Drop any still on the device.
    if (Object.values(all).some((c) => c.phone !== undefined)) {
      for (const c of Object.values(all)) delete c.phone;
      write(CONTACTS_KEY, all);
    }
    return all;
  },
  get: (id: string): PrivateContact => ({ ...EMPTY, ...privateContacts.all()[id] }),
  set: (id: string, c: PrivateContact) => write(CONTACTS_KEY, { ...privateContacts.all(), [id]: c }),
  remove: (id: string) => {
    const all = privateContacts.all();
    delete all[id];
    write(CONTACTS_KEY, all);
  },
};

export type CoachTurn = { role: "user" | "coach"; text: string; suggestion?: string | null };
const COACH_KEY = "boranois.coach";

/** The coach conversation for each pessoa. Device only; never sent except as context for the next turn. */
export const coachThreads = {
  get: (contactId: string): CoachTurn[] => read<Record<string, CoachTurn[]>>(COACH_KEY, {})[contactId] ?? [],
  set: (contactId: string, turns: CoachTurn[]) => write(COACH_KEY, { ...read<Record<string, CoachTurn[]>>(COACH_KEY, {}), [contactId]: turns.slice(-16) }),
  remove: (contactId: string) => {
    const all = read<Record<string, CoachTurn[]>>(COACH_KEY, {});
    delete all[contactId];
    write(COACH_KEY, all);
  },
};

export const profile = {
  get: (): Profile => read<Profile>(PROFILE_KEY, { groups: [], voiceSample: "" }),
  set: (p: Profile) => write(PROFILE_KEY, p),
};

/** wa.me link for a Brazilian number typed any which way. */
/** Opens WhatsApp with the text ready; the person picks the contact there. No number is ever stored. */
export function whatsappLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
