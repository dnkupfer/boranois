import pg from "pg";
import type { Invite, OutcomeId } from "@boranois/shared";
import { newId, newInviteCode } from "../ids.js";
import type { ContactPatch, ContactRecord, MemberRecord, NewContact, NewInteraction, RedeemResult, Store } from "./types.js";

// Use Neon's pooled connection string (host contains "-pooler"): Cloud Run
// can run many instances, each with its own small pool.
export function createPool(connectionString: string) {
  return new pg.Pool({ connectionString, max: 5, ssl: { rejectUnauthorized: true } });
}

const toMember = (r: any): MemberRecord => ({ id: r.id, groupId: r.group_id, name: r.name, role: r.role });
const toContact = (r: any): ContactRecord => ({
  id: r.id,
  memberId: r.member_id,
  groupId: r.group_id,
  chips: r.chips,
  match: r.match,
  priority: r.priority,
  state: r.state,
  stepsDone: r.steps_done,
  lastSaying: r.last_saying,
  catalogueVersion: r.catalogue_version,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

export class PostgresStore implements Store {
  constructor(private pool: pg.Pool) {}

  async createHostCode() {
    const code = newInviteCode();
    await this.pool.query(`insert into invites (code, role) values ($1, 'host')`, [code]);
    return code;
  }

  async redeemInvite(code: string, name: string, tokenHash: string): Promise<RedeemResult> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query(`select * from invites where code = $1 for update`, [code]);
      const invite = rows[0];
      if (!invite) {
        await client.query("rollback");
        return { ok: false, error: "not_found" };
      }
      if (invite.used_by) {
        await client.query("rollback");
        return { ok: false, error: "used" };
      }
      let groupId: string = invite.group_id;
      if (!groupId) {
        groupId = newId();
        await client.query(`insert into groups (id) values ($1)`, [groupId]);
      }
      const memberId = newId();
      const m = await client.query(
        `insert into members (id, group_id, name, role, token_hash) values ($1, $2, $3, $4, $5) returning *`,
        [memberId, groupId, name, invite.role, tokenHash],
      );
      await client.query(`update invites set used_by = $1, used_at = now() where code = $2`, [memberId, code]);
      await client.query("commit");
      return { ok: true, member: toMember(m.rows[0]) };
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  async memberByTokenHash(tokenHash: string) {
    const { rows } = await this.pool.query(`select * from members where token_hash = $1`, [tokenHash]);
    return rows[0] ? toMember(rows[0]) : null;
  }

  async listInvites(groupId: string): Promise<Invite[]> {
    const { rows } = await this.pool.query(
      `select i.*, m.name as used_by_name from invites i left join members m on m.id = i.used_by
       where i.group_id = $1 order by i.created_at`,
      [groupId],
    );
    return rows.map((r) => ({ code: r.code, contactName: r.contact_name, phone: r.phone, usedByName: r.used_by_name, createdAt: r.created_at.toISOString() }));
  }

  async createInvites(groupId: string, contacts: { name: string; phone?: string }[]) {
    for (const c of contacts) {
      await this.pool.query(`insert into invites (code, group_id, role, contact_name, phone) values ($1, $2, 'member', $3, $4)`, [newInviteCode(), groupId, c.name, c.phone ?? null]);
    }
    return this.listInvites(groupId);
  }

  async createContact(c: NewContact) {
    const { rows } = await this.pool.query(
      `insert into contacts (id, member_id, group_id, chips, persona_id, match, priority, state, steps_done, last_saying, catalogue_version)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
      [newId(), c.memberId, c.groupId, c.chips, c.match.personaId, c.match, c.priority, c.state, JSON.stringify(c.stepsDone), c.lastSaying, c.catalogueVersion],
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
}
