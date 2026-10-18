import pg from "pg";
import type { ChipStats, Member, OutcomeId } from "@boranois/shared";
import { newId } from "../ids.js";
import type { ContactPatch, ContactRecord, NewContact, NewInteraction, Store } from "./types.js";

// Use Neon's pooled connection string (host contains "-pooler"): Cloud Run
// can run many instances, each with its own small pool.
export function createPool(connectionString: string) {
  return new pg.Pool({ connectionString, max: 5, ssl: { rejectUnauthorized: true } });
}

const toMember = (r: any): Member => ({ id: r.id, email: r.email, name: r.name });
const toContact = (r: any): ContactRecord => ({
  id: r.id,
  memberId: r.member_id,
  chips: r.chips,
  match: r.match,
  priority: r.priority,
  state: r.state,
  stepsDone: r.steps_done,
  lastSaying: r.last_saying,
  lastSentAt: r.last_sent_at ? r.last_sent_at.toISOString() : null,
  catalogueVersion: r.catalogue_version,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

export class PostgresStore implements Store {
  constructor(private pool: pg.Pool) {}

  async createLogin(email: string, tokenHash: string, expiresAt: Date) {
    await this.pool.query(`insert into logins (token_hash, email, expires_at) values ($1, $2, $3)`, [tokenHash, email, expiresAt]);
  }

  async consumeLogin(tokenHash: string) {
    const { rows } = await this.pool.query(
      `update logins set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning email`,
      [tokenHash],
    );
    return rows[0]?.email ?? null;
  }

  async memberByEmailOrCreate(email: string) {
    const { rows } = await this.pool.query(
      `insert into members (id, email) values ($1, $2) on conflict (email) do update set email = excluded.email returning *`,
      [newId(), email],
    );
    return toMember(rows[0]);
  }

  async createSession(memberId: string, tokenHash: string) {
    await this.pool.query(`insert into sessions (token_hash, member_id) values ($1, $2)`, [tokenHash, memberId]);
  }

  async memberBySessionHash(tokenHash: string) {
    const { rows } = await this.pool.query(`select m.* from sessions s join members m on m.id = s.member_id where s.token_hash = $1`, [tokenHash]);
    return rows[0] ? toMember(rows[0]) : null;
  }

  async setMemberName(memberId: string, name: string) {
    const { rows } = await this.pool.query(`update members set name = $2 where id = $1 returning *`, [memberId, name]);
    return toMember(rows[0]);
  }

  async createContact(c: NewContact) {
    const { rows } = await this.pool.query(
      `insert into contacts (id, member_id, chips, persona_id, match, priority, state, steps_done, last_saying, last_sent_at, catalogue_version)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
      [newId(), c.memberId, c.chips, c.match.personaId, c.match, c.priority, c.state, JSON.stringify(c.stepsDone), c.lastSaying, c.lastSentAt, c.catalogueVersion],
    );
    return toContact(rows[0]);
  }

  async listContacts(memberId: string) {
    const { rows } = await this.pool.query(`select * from contacts where member_id = $1 order by created_at`, [memberId]);
    return rows.map(toContact);
  }

  async getContact(memberId: string, id: string) {
    const { rows } = await this.pool.query(`select * from contacts where member_id = $1 and id = $2`, [memberId, id]);
    return rows[0] ? toContact(rows[0]) : null;
  }

  async updateContact(id: string, patch: ContactPatch) {
    const { rows } = await this.pool.query(
      `update contacts set
         state = coalesce($2, state),
         steps_done = coalesce($3, steps_done),
         priority = coalesce($4, priority),
         match = coalesce($5, match),
         persona_id = coalesce($6, persona_id),
         last_saying = case when $7::boolean then $8 else last_saying end,
         last_sent_at = coalesce($9, last_sent_at),
         updated_at = now()
       where id = $1 returning *`,
      [
        id,
        patch.state ?? null,
        patch.stepsDone ? JSON.stringify(patch.stepsDone) : null,
        patch.priority ?? null,
        patch.match ?? null,
        patch.match?.personaId ?? null,
        patch.lastSaying !== undefined,
        patch.lastSaying ?? null,
        patch.lastSentAt ?? null,
      ],
    );
    return toContact(rows[0]);
  }

  async deleteContact(memberId: string, id: string) {
    await this.pool.query(`delete from contacts where member_id = $1 and id = $2`, [memberId, id]);
  }

  async insertInteraction(i: NewInteraction) {
    await this.pool.query(
      `insert into interactions (id, contact_id, member_id, step_id, outcome, saying, catalogue_version) values ($1, $2, $3, $4, $5, $6, $7)`,
      [newId(), i.contactId, i.memberId, i.stepId, i.outcome, i.saying, i.catalogueVersion],
    );
  }

  async listOutcomes(contactId: string): Promise<OutcomeId[]> {
    const { rows } = await this.pool.query(`select outcome from interactions where contact_id = $1 order by created_at`, [contactId]);
    return rows.map((r) => r.outcome);
  }

  async countChipUsage(questionId: string, optionId: string) {
    await this.pool.query(
      `insert into chip_usage (question_id, option_id, count) values ($1, $2, 1) on conflict (question_id, option_id) do update set count = chip_usage.count + 1`,
      [questionId, optionId],
    );
  }

  async countChipProposal(questionId: string, text: string, mapped: string | null = null) {
    await this.pool.query(
      `insert into chip_proposals (question_id, text, count, mapped) values ($1, $2, 1, $3)
       on conflict (question_id, text) do update set count = chip_proposals.count + 1, mapped = coalesce(excluded.mapped, chip_proposals.mapped)`,
      [questionId, text.toLowerCase(), mapped],
    );
  }

  async chipStats(): Promise<ChipStats> {
    const u = await this.pool.query(`select question_id, option_id, count from chip_usage order by count desc`);
    const pr = await this.pool.query(`select question_id, text, count, mapped from chip_proposals order by count desc`);
    return {
      usage: u.rows.map((r) => ({ questionId: r.question_id, optionId: r.option_id, count: Number(r.count) })),
      proposals: pr.rows.map((r) => ({ questionId: r.question_id, text: r.text, count: Number(r.count), mapped: r.mapped ?? null })),
    };
  }
}
