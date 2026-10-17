import pg from "pg";
import type { FeedItem, Group, Invite, ObjectiveId } from "@boranois/shared";
import { newId, newInviteCode } from "../ids.js";
import type { MemberRecord, NewCheck, RedeemResult, Store } from "./types.js";

// Use Neon's pooled connection string (host contains "-pooler"): Cloud Run
// can run many instances, each with its own small pool.
export function createPool(connectionString: string) {
  return new pg.Pool({ connectionString, max: 5, ssl: { rejectUnauthorized: true } });
}

const toGroup = (r: any): Group => ({ id: r.id, objective: r.objective });
const toMember = (r: any): MemberRecord => ({ id: r.id, groupId: r.group_id, name: r.name, role: r.role });

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
      const g = await client.query(`select * from groups where id = $1`, [groupId]);
      await client.query("commit");
      return { ok: true, member: toMember(m.rows[0]), group: toGroup(g.rows[0]) };
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

  async getGroup(groupId: string) {
    const { rows } = await this.pool.query(`select * from groups where id = $1`, [groupId]);
    return toGroup(rows[0]);
  }

  async updateGroup(groupId: string, objective: ObjectiveId) {
    const { rows } = await this.pool.query(`update groups set objective = $2 where id = $1 returning *`, [groupId, objective]);
    return toGroup(rows[0]);
  }

  async listInvites(groupId: string): Promise<Invite[]> {
    const { rows } = await this.pool.query(
      `select i.*, m.name as used_by_name from invites i
       left join members m on m.id = i.used_by
       where i.group_id = $1 order by i.created_at`,
      [groupId],
    );
    return rows.map((r) => ({
      code: r.code,
      contactName: r.contact_name,
      phone: r.phone,
      usedByName: r.used_by_name,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async createInvites(groupId: string, contacts: { name: string; phone?: string }[]) {
    for (const c of contacts) {
      await this.pool.query(
        `insert into invites (code, group_id, role, contact_name, phone) values ($1, $2, 'member', $3, $4)`,
        [newInviteCode(), groupId, c.name, c.phone ?? null],
      );
    }
    return this.listInvites(groupId);
  }

  async insertCheck(c: NewCheck) {
    const id = newId();
    await this.pool.query(
      `insert into checks (id, group_id, member_id, objective, post_url, handle, caption, score, decision, reason, suggested_comment, scorer)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, c.groupId, c.memberId, c.objective, c.postUrl, c.handle, c.caption, c.score, c.decision, c.reason, c.suggestedComment, c.scorer],
    );
    return id;
  }

  async listSharedChecks(groupId: string, limit: number): Promise<FeedItem[]> {
    const { rows } = await this.pool.query(
      `select c.*, m.name as checked_by from checks c join members m on m.id = c.member_id
       where c.group_id = $1 and c.decision = 'share'
       order by c.created_at desc limit $2`,
      [groupId, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      postUrl: r.post_url,
      handle: r.handle,
      captionExcerpt: r.caption.slice(0, 200),
      score: r.score,
      reason: r.reason,
      suggestedComment: r.suggested_comment,
      checkedBy: r.checked_by,
      createdAt: r.created_at.toISOString(),
    }));
  }
}
