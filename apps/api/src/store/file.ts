import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Invite, OutcomeId } from "@boranois/shared";
import { newId, newInviteCode } from "../ids.js";
import type { ContactPatch, ContactRecord, MemberRecord, NewContact, NewInteraction, RedeemResult, Store } from "./types.js";

// Local-dev store: everything in one JSON file so data survives `tsx watch` restarts.

type InviteRow = {
  code: string;
  groupId: string | null;
  role: "host" | "member";
  contactName: string | null;
  phone: string | null;
  usedBy: string | null;
  createdAt: string;
};
type MemberRow = MemberRecord & { tokenHash: string };
type InteractionRow = NewInteraction & { id: string; createdAt: string };
type Data = { groups: { id: string }[]; members: MemberRow[]; invites: InviteRow[]; contacts: ContactRecord[]; interactions: InteractionRow[] };

export class FileStore implements Store {
  private data: Data;

  constructor(private path: string) {
    try {
      this.data = { contacts: [], interactions: [], ...JSON.parse(readFileSync(path, "utf8")) };
    } catch {
      this.data = { groups: [], members: [], invites: [], contacts: [], interactions: [] };
    }
  }

  private save() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.data, null, 2));
  }

  async createHostCode() {
    const code = newInviteCode();
    this.data.invites.push({ code, groupId: null, role: "host", contactName: null, phone: null, usedBy: null, createdAt: new Date().toISOString() });
    this.save();
    return code;
  }

  async redeemInvite(code: string, name: string, tokenHash: string): Promise<RedeemResult> {
    const invite = this.data.invites.find((i) => i.code === code);
    if (!invite) return { ok: false, error: "not_found" };
    if (invite.usedBy) return { ok: false, error: "used" };

    let groupId = invite.groupId;
    if (!groupId) {
      groupId = newId();
      this.data.groups.push({ id: groupId });
    }
    const member: MemberRow = { id: newId(), groupId, name, role: invite.role, tokenHash };
    this.data.members.push(member);
    invite.usedBy = member.id;
    this.save();
    const { tokenHash: _, ...record } = member;
    return { ok: true, member: record };
  }

  async memberByTokenHash(tokenHash: string) {
    const m = this.data.members.find((m) => m.tokenHash === tokenHash);
    if (!m) return null;
    const { tokenHash: _, ...record } = m;
    return record;
  }

  async listInvites(groupId: string): Promise<Invite[]> {
    return this.data.invites
      .filter((i) => i.groupId === groupId)
      .map((i) => ({
        code: i.code,
        contactName: i.contactName,
        phone: i.phone,
        usedByName: this.data.members.find((m) => m.id === i.usedBy)?.name ?? null,
        createdAt: i.createdAt,
      }));
  }

  async createInvites(groupId: string, contacts: { name: string; phone?: string }[]) {
    for (const c of contacts) {
      this.data.invites.push({ code: newInviteCode(), groupId, role: "member", contactName: c.name, phone: c.phone ?? null, usedBy: null, createdAt: new Date().toISOString() });
    }
    this.save();
    return this.listInvites(groupId);
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
}
