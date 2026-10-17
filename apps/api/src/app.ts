import express, { type NextFunction, type Request, type Response } from "express";
import { timingSafeEqual } from "node:crypto";
import {
  CheckRequest,
  CreateInvitesRequest,
  JoinRequest,
  MAX_INVITES_PER_GROUP,
  UpdateGroupRequest,
  type CheckResponse,
  type FeedResponse,
  type JoinResponse,
  type MeResponse,
} from "@boranois/shared";
import { hashToken, newToken, normalizeCode } from "./ids.js";
import type { Scorer } from "./scorer.js";
import type { Store } from "./store/index.js";
import type { MemberRecord } from "./store/types.js";

type Deps = { store: Store; scorer: Scorer; shareThreshold: number; adminToken?: string };
type AuthedRequest = Request & { member: MemberRecord };

export function createApp({ store, scorer, shareThreshold, adminToken }: Deps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "4mb" }));

  const auth = async (req: Request, res: Response, next: NextFunction) => {
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const member = token ? await store.memberByTokenHash(hashToken(token)) : null;
    if (!member) return res.status(401).json({ error: "unauthorized" });
    (req as AuthedRequest).member = member;
    next();
  };

  const hostOnly = (req: Request, res: Response, next: NextFunction) => {
    if ((req as AuthedRequest).member.role !== "host") return res.status(403).json({ error: "host_only" });
    next();
  };

  const api = express.Router();

  api.get("/health", (_req, res) => res.json({ ok: true }));

  api.post("/join", async (req, res) => {
    const body = JoinRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const token = newToken();
    const result = await store.redeemInvite(normalizeCode(body.data.code), body.data.name, hashToken(token));
    if (!result.ok) return res.status(result.error === "used" ? 409 : 404).json({ error: result.error });
    const { groupId: _, ...member } = result.member;
    res.json({ token, member, group: result.group } satisfies JoinResponse);
  });

  api.get("/me", auth, async (req, res) => {
    const { groupId, ...member } = (req as AuthedRequest).member;
    const group = await store.getGroup(groupId);
    const invites = member.role === "host" ? await store.listInvites(groupId) : [];
    res.json({ member, group, invites } satisfies MeResponse);
  });

  api.put("/group", auth, hostOnly, async (req, res) => {
    const body = UpdateGroupRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const group = await store.updateGroup((req as AuthedRequest).member.groupId, body.data.objective);
    res.json(group);
  });

  api.post("/invites", auth, hostOnly, async (req, res) => {
    const body = CreateInvitesRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const groupId = (req as AuthedRequest).member.groupId;
    const existing = await store.listInvites(groupId);
    if (existing.length + body.data.contacts.length > MAX_INVITES_PER_GROUP) {
      return res.status(409).json({ error: "invite_limit" });
    }
    res.json({ invites: await store.createInvites(groupId, body.data.contacts) });
  });

  api.post("/check", auth, async (req, res) => {
    const body = CheckRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const member = (req as AuthedRequest).member;
    const group = await store.getGroup(member.groupId);
    if (!group.objective) return res.status(409).json({ error: "no_objective" });

    const { caption = "", handle, postUrl, screenshot } = body.data;
    const result = await scorer.score({ objective: group.objective, caption, handle, screenshot });
    const decision = result.unclear ? "unclear" : !result.blocked && result.score >= shareThreshold ? "share" : "skip";
    const id = await store.insertCheck({
      groupId: group.id,
      memberId: member.id,
      objective: group.objective,
      postUrl: postUrl || null,
      handle: handle || result.author || null,
      // The screenshot isn't stored; keep the text, or Gemini's description of the post.
      caption: caption || result.summary || "",
      score: result.score,
      decision,
      reason: result.reason,
      suggestedComment: decision === "share" ? result.suggestedComment : null,
      scorer: result.scorer,
    });
    res.json({
      id,
      decision,
      score: result.score,
      reason: result.reason,
      suggestedComment: decision === "share" ? result.suggestedComment : null,
      objective: group.objective,
    } satisfies CheckResponse);
  });

  api.get("/feed", auth, async (req, res) => {
    const items = await store.listSharedChecks((req as AuthedRequest).member.groupId, 30);
    res.json({ items } satisfies FeedResponse);
  });

  // Issues a host code (starts a new group). Protected by ADMIN_TOKEN.
  api.post("/admin/host-codes", async (req, res) => {
    const given = Buffer.from(req.get("x-admin-token") ?? "");
    const expected = Buffer.from(adminToken ?? "");
    if (!adminToken || given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    res.json({ code: await store.createHostCode() });
  });

  app.use("/api", api);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal" });
  });

  return app;
}
