import type { Decision, FeedItem, Group, Invite, Member, ObjectiveId } from "@boranois/shared";

export type MemberRecord = Member & { groupId: string };

export type NewCheck = {
  groupId: string;
  memberId: string;
  objective: ObjectiveId;
  postUrl: string | null;
  handle: string | null;
  caption: string;
  score: number;
  decision: Decision;
  reason: string;
  suggestedComment: string | null;
  scorer: string;
};

export type RedeemResult =
  | { ok: true; member: MemberRecord; group: Group }
  | { ok: false; error: "not_found" | "used" };

export interface Store {
  createHostCode(): Promise<string>;
  /** Redeems an invite code. A host code creates a new group with the redeemer as host. */
  redeemInvite(code: string, name: string, tokenHash: string): Promise<RedeemResult>;
  memberByTokenHash(tokenHash: string): Promise<MemberRecord | null>;
  getGroup(groupId: string): Promise<Group>;
  updateGroup(groupId: string, objective: ObjectiveId): Promise<Group>;
  listInvites(groupId: string): Promise<Invite[]>;
  createInvites(groupId: string, contacts: { name: string; phone?: string }[]): Promise<Invite[]>;
  insertCheck(check: NewCheck): Promise<string>;
  listSharedChecks(groupId: string, limit: number): Promise<FeedItem[]>;
}
