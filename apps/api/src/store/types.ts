import type { Contact, ContactState, Invite, Member, OutcomeId, SayingId } from "@boranois/shared";

export type MemberRecord = Member & { groupId: string };

export type RedeemResult =
  | { ok: true; member: MemberRecord }
  | { ok: false; error: "not_found" | "used" };

export type ContactRecord = Contact & { memberId: string; groupId: string; lastSaying: SayingId | null };

export type NewContact = Omit<ContactRecord, "id" | "createdAt" | "updatedAt">;

export type ContactPatch = Partial<Pick<ContactRecord, "state" | "stepsDone" | "priority" | "match" | "lastSaying">>;

export type NewInteraction = {
  contactId: string;
  memberId: string;
  stepId: string;
  outcome: OutcomeId;
  saying: SayingId | null;
  catalogueVersion: string;
};

export interface Store {
  createHostCode(): Promise<string>;
  /** Redeems an invite code. A host code creates a new group with the redeemer as host. */
  redeemInvite(code: string, name: string, tokenHash: string): Promise<RedeemResult>;
  memberByTokenHash(tokenHash: string): Promise<MemberRecord | null>;
  listInvites(groupId: string): Promise<Invite[]>;
  createInvites(groupId: string, contacts: { name: string; phone?: string }[]): Promise<Invite[]>;

  createContact(c: NewContact): Promise<ContactRecord>;
  listContacts(memberId: string): Promise<ContactRecord[]>;
  getContact(memberId: string, id: string): Promise<ContactRecord | null>;
  updateContact(id: string, patch: ContactPatch): Promise<ContactRecord>;
  deleteContact(memberId: string, id: string): Promise<void>;

  insertInteraction(i: NewInteraction): Promise<void>;
  listOutcomes(contactId: string): Promise<OutcomeId[]>;
}

export type ContactStateValue = ContactState;
