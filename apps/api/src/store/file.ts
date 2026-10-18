import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ChipStats, Member, OutcomeId } from "@boranois/shared";
import { newId } from "../ids.js";
import type { ContactPatch, ContactRecord, NewContact, NewInteraction, Store } from "./types.js";

// Local-dev store: everything in one JSON file so data survives `tsx watch` restarts.

type LoginRow = { tokenHash: string; email: string; expiresAt: string; usedAt: string | null };
type SessionRow = { tokenHash: string; memberId: string };
type InteractionRow = NewInteraction & { id: string; createdAt: string };
type Data = {
  members: Member[];
  logins: LoginRow[];
  sessions: SessionRow[];
  contacts: ContactRecord[];
  interactions: InteractionRow[];
  chipUsage: Record<string, number>;
  chipProposals: Record<string, { count: number; mapped: string | null }>;
};

export class FileStore implements Store {
  private data: Data;

  constructor(private path: string) {
    const empty: Data = { members: [], logins: [], sessions: [], contacts: [], interactions: [], chipUsage: {}, chipProposals: {} };
    try {
      this.data = { ...empty, ...JSON.parse(readFileSync(path, "utf8")) };
    } catch {
      this.data = empty;
    }
  }

  private save() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.data, null, 2));
  }

  async createLogin(email: string, tokenHash: string, expiresAt: Date) {
    this.data.logins.push({ tokenHash, email, expiresAt: expiresAt.toISOString(), usedAt: null });
    this.save();
  }

  async consumeLogin(tokenHash: string) {
    const l = this.data.logins.find((l) => l.tokenHash === tokenHash);
    if (!l || l.usedAt || new Date(l.expiresAt) < new Date()) return null;
    l.usedAt = new Date().toISOString();
    this.save();
    return l.email;
  }

  async memberByEmailOrCreate(email: string) {
    let m = this.data.members.find((m) => m.email === email);
    if (!m) {
      m = { id: newId(), email, name: null };
      this.data.members.push(m);
      this.save();
    }
    return m;
  }

  async createAnonMember() {
    const m: Member = { id: newId(), email: null, name: null };
    this.data.members.push(m);
    this.save();
    return m;
  }

  async linkEmail(memberId: string, email: string) {
    const existing = this.data.members.find((m) => m.email === email);
    const me = this.data.members.find((m) => m.id === memberId)!;
    if (existing && existing.id !== memberId) {
      for (const c of this.data.contacts) if (c.memberId === memberId) c.memberId = existing.id;
      for (const i of this.data.interactions) if (i.memberId === memberId) i.memberId = existing.id;
      this.save();
      return existing;
    }
    me.email = email;
    this.save();
    return me;
  }

  async createSession(memberId: string, tokenHash: string) {
    this.data.sessions.push({ tokenHash, memberId });
    this.save();
  }

  async memberBySessionHash(tokenHash: string) {
    const s = this.data.sessions.find((s) => s.tokenHash === tokenHash);
    return s ? (this.data.members.find((m) => m.id === s.memberId) ?? null) : null;
  }

  async setMemberName(memberId: string, name: string) {
    const m = this.data.members.find((m) => m.id === memberId)!;
    m.name = name;
    this.save();
    return m;
  }

  async createContact(c: NewContact) {
    const now = new Date().toISOString();
    const record: ContactRecord = { ...c, id: newId(), createdAt: now, updatedAt: now };
    this.data.contacts.push(record);
    this.save();
    return record;
  }

  async listContacts(memberId: string) {
    return this.data.contacts.filter((c) => c.memberId === memberId);
  }

  async getContact(memberId: string, id: string) {
    return this.data.contacts.find((c) => c.memberId === memberId && c.id === id) ?? null;
  }

  async updateContact(id: string, patch: ContactPatch) {
    const c = this.data.contacts.find((c) => c.id === id)!;
    Object.assign(c, patch, { updatedAt: new Date().toISOString() });
    this.save();
    return c;
  }

  async deleteContact(memberId: string, id: string) {
    this.data.contacts = this.data.contacts.filter((c) => !(c.memberId === memberId && c.id === id));
    this.save();
  }

  async insertInteraction(i: NewInteraction) {
    this.data.interactions.push({ ...i, id: newId(), createdAt: new Date().toISOString() });
    this.save();
  }

  async listOutcomes(contactId: string): Promise<OutcomeId[]> {
    return this.data.interactions.filter((i) => i.contactId === contactId).map((i) => i.outcome);
  }

  async countChipUsage(questionId: string, optionId: string) {
    const k = `${questionId}|${optionId}`;
    this.data.chipUsage[k] = (this.data.chipUsage[k] ?? 0) + 1;
    this.save();
  }

  async countChipProposal(questionId: string, text: string, mapped: string | null = null) {
    const k = `${questionId}|${text.toLowerCase()}`;
    const cur = this.data.chipProposals[k] ?? { count: 0, mapped: null };
    this.data.chipProposals[k] = { count: cur.count + 1, mapped: mapped ?? cur.mapped };
    this.save();
  }

  async chipStats(): Promise<ChipStats> {
    const split = (k: string) => k.split("|", 2) as [string, string];
    return {
      usage: Object.entries(this.data.chipUsage).map(([k, count]) => ({ questionId: split(k)[0], optionId: split(k)[1], count })),
      proposals: Object.entries(this.data.chipProposals)
        .map(([k, v]) => ({ questionId: split(k)[0], text: split(k)[1], count: v.count, mapped: v.mapped }))
        .sort((a, b) => b.count - a.count),
    };
  }
}
