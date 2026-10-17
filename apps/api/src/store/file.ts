import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { FeedItem, Group, Invite, ObjectiveId } from "@boranois/shared";
import { newId, newInviteCode } from "../ids.js";
import type { MemberRecord, NewCheck, RedeemResult, Store } from "./types.js";

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
type CheckRow = NewCheck & { id: string; createdAt: string };
type Data = { groups: Group[]; members: MemberRow[]; invites: InviteRow[]; checks: CheckRow[] };

export class FileStore implements Store {
  private data: Data;

  constructor(private path: string) {
    try {
      this.data = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      this.data = { groups: [], members: [], invites: [], checks: [] };
    }
  }

  private save() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.data, null, 2));
  }

  async createHostCode() {
    const code = newInviteCode();
    this.data.invites.push({
      code, groupId: null, role: "host", contactName: null, phone: null, usedBy: null,
      createdAt: new Date().toISOString(),
    });
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
      this.data.groups.push({ id: groupId, objective: null });
    }
    const member: MemberRow = { id: newId(), groupId, name, role: invite.role, tokenHash };
    this.data.members.push(member);
    invite.usedBy = member.id;
    this.save();
    const { tokenHash: _, ...record } = member;
    return { ok: true, member: record, group: await this.getGroup(groupId) };
  }

  async memberByTokenHash(tokenHash: string) {
    const m = this.data.members.find((m) => m.tokenHash === tokenHash);
    if (!m) return null;
    const { tokenHash: _, ...record } = m;
    return record;
  }

  async getGroup(groupId: string) {
    return { ...this.data.groups.find((g) => g.id === groupId)! };
  }

  async updateGroup(groupId: string, objective: ObjectiveId) {
    const g = this.data.groups.find((g) => g.id === groupId)!;
    g.objective = objective;
    this.save();
    return { ...g };
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
      this.data.invites.push({
        code: newInviteCode(), groupId, role: "member", contactName: c.name, phone: c.phone ?? null,
        usedBy: null, createdAt: new Date().toISOString(),
      });
    }
    this.save();
    return this.listInvites(groupId);
  }

  async insertCheck(check: NewCheck) {
    const id = newId();
    this.data.checks.push({ ...check, id, createdAt: new Date().toISOString() });
    this.save();
    return id;
  }

  async listSharedChecks(groupId: string, limit: number): Promise<FeedItem[]> {
    return this.data.checks
      .filter((c) => c.groupId === groupId && c.decision === "share")
      .slice(-limit)
      .reverse()
      .map((c) => ({
        id: c.id,
        postUrl: c.postUrl,
        handle: c.handle,
        captionExcerpt: c.caption.slice(0, 200),
        score: c.score,
        reason: c.reason,
        suggestedComment: c.suggestedComment,
        checkedBy: this.data.members.find((m) => m.id === c.memberId)?.name ?? "",
        createdAt: c.createdAt,
      }));
  }
}
