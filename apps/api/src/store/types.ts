import type { ChipStats, Contact, Member, OutcomeId, SayingId } from "@boranois/shared";

export type ContactRecord = Contact & { memberId: string; lastSaying: SayingId | null };
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
  // Magic-link sign-in: a short-lived login token, then a long-lived session token. Both stored hashed.
  createLogin(email: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Marks the login used and returns its email, or null if unknown, used or expired. */
  consumeLogin(tokenHash: string): Promise<string | null>;
  memberByEmailOrCreate(email: string): Promise<Member>;
  createSession(memberId: string, tokenHash: string): Promise<void>;
  memberBySessionHash(tokenHash: string): Promise<Member | null>;
  setMemberName(memberId: string, name: string): Promise<Member>;

  createContact(c: NewContact): Promise<ContactRecord>;
  listContacts(memberId: string): Promise<ContactRecord[]>;
  getContact(memberId: string, id: string): Promise<ContactRecord | null>;
  updateContact(id: string, patch: ContactPatch): Promise<ContactRecord>;
  deleteContact(memberId: string, id: string): Promise<void>;

  insertInteraction(i: NewInteraction): Promise<void>;
  listOutcomes(contactId: string): Promise<OutcomeId[]>;

  // Anonymous counts: which chips get chosen, which get typed in. Never linked to a member or a pessoa.
  countChipUsage(questionId: string, optionId: string): Promise<void>;
  countChipProposal(questionId: string, text: string, mapped?: string | null): Promise<void>;
  chipStats(): Promise<ChipStats>;
}
