import { z } from "zod";

// Campaign objectives a host can pick for their group.
// TODO: replace the texts with the campaign's exact wording.
export const OBJECTIVES = [
  {
    id: "abstencao",
    title: "Quem não votou no 1º turno",
    description:
      "Motivar quem não votou no primeiro turno a votar agora, para proteger os direitos dos trabalhadores.",
  },
  {
    id: "branco",
    title: "Quem votou em branco no 1º turno",
    description:
      "Motivar quem votou em branco no primeiro turno a votar agora, para proteger os direitos dos trabalhadores.",
  },
  {
    id: "reconquista",
    title: "Eleitores de Lula que estão indo para o Flávio",
    description:
      "Reconquistar quem votou em Lula antes e agora pensa em votar no Flávio, mas sem muita convicção.",
  },
] as const;

export const ObjectiveId = z.enum(["abstencao", "branco", "reconquista"]);
export type ObjectiveId = z.infer<typeof ObjectiveId>;

export function getObjective(id: ObjectiveId) {
  return OBJECTIVES.find((o) => o.id === id)!;
}

export const MAX_INVITES_PER_GROUP = 5;

// --- Requests ---

export const JoinRequest = z.object({
  code: z.string().trim().min(4).max(20),
  name: z.string().trim().min(1).max(60),
});
export type JoinRequest = z.infer<typeof JoinRequest>;

export const UpdateGroupRequest = z.object({
  objective: ObjectiveId,
});
export type UpdateGroupRequest = z.infer<typeof UpdateGroupRequest>;

export const CreateInvitesRequest = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        phone: z.string().trim().max(30).optional(),
      }),
    )
    .min(1)
    .max(MAX_INVITES_PER_GROUP),
});
export type CreateInvitesRequest = z.infer<typeof CreateInvitesRequest>;

export const CheckRequest = z
  .object({
    postUrl: z.string().trim().max(500).optional(),
    handle: z.string().trim().max(100).optional(),
    caption: z.string().trim().max(5000).optional(),
    /** Base64 JPEG of the visible tab, taken by the extension when the user clicks. */
    screenshot: z.string().max(3_000_000).optional(),
  })
  .refine((r) => r.caption || r.screenshot, { message: "caption or screenshot required" });
export type CheckRequest = z.infer<typeof CheckRequest>;

// --- Responses ---

export type Member = { id: string; name: string; role: "host" | "member" };
export type Group = { id: string; objective: ObjectiveId | null };
export type Invite = {
  code: string;
  contactName: string | null;
  phone: string | null;
  usedByName: string | null;
  createdAt: string;
};

export type JoinResponse = { token: string; member: Member; group: Group };
export type MeResponse = { member: Member; group: Group; invites: Invite[] };

/** "unclear": there wasn't enough on screen to tell what the post says. */
export type Decision = "share" | "skip" | "unclear";

export type CheckResponse = {
  id: string;
  decision: Decision;
  score: number;
  reason: string;
  suggestedComment: string | null;
  objective: ObjectiveId;
};

export type FeedItem = {
  id: string;
  postUrl: string | null;
  handle: string | null;
  captionExcerpt: string;
  score: number;
  reason: string;
  suggestedComment: string | null;
  checkedBy: string;
  createdAt: string;
};
export type FeedResponse = { items: FeedItem[] };
