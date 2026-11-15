import { sql } from "./db";
import { getLeaderboard } from "./leaderboard";
import type { Movement } from "./movements";

export type Notification = {
  id: number;
  kind: "cosign" | "passed";
  actorName: string | null;
  actorUsername: string | null;
  actorId: string | null;
  movement: Movement | null;
  createdAt: Date;
  seen: boolean;
};

/*
  What happened to you while you were away.

  Nothing here is pushed anywhere. A notification is a row that /me reads
  and then marks seen; the "passed" rows are the groundwork for an email
  later, but an email is a delivery mechanism and this is the fact being
  delivered. Keep them separate.
*/

export async function getNotificationsFor(
  lifterId: string,
  limit = 8,
): Promise<Notification[]> {
  const rows = await sql`
    select n.id, n.kind, n.actor_id, n.movement, n.created_at, n.seen_at,
           a.display_name as actor_name, a.username as actor_username
    from notifications n
    left join lifters a on a.id = n.actor_id
    where n.lifter_id = ${lifterId}
      and n.created_at > now() - interval '30 days'
    order by n.created_at desc
    limit ${limit}
  `;
  return rows.map((row) => ({
    id: Number(row.id),
    kind: row.kind as Notification["kind"],
    actorName: (row.actor_name as string | null) ?? null,
    actorUsername: (row.actor_username as string | null) ?? null,
    actorId: (row.actor_id as string | null) ?? null,
    movement: (row.movement as Movement | null) ?? null,
    createdAt: new Date(row.created_at as string),
    seen: row.seen_at !== null,
  }));
}

export async function markNotificationsSeen(lifterId: string): Promise<void> {
  await sql`
    update notifications set seen_at = now()
    where lifter_id = ${lifterId} and seen_at is null
  `;
}

/** Someone co-signed one of this lifter's sets. */
export async function notifyCosigned(params: {
  lifterId: string;
  witnessId: string;
  movement: Movement;
}): Promise<void> {
  const { lifterId, witnessId, movement } = params;
  await sql`
    insert into notifications (lifter_id, actor_id, kind, movement)
    values (${lifterId}, ${witnessId}, 'cosign', ${movement})
    on conflict do nothing
  `;
}

/**
 * Tell everyone this lifter just went past.
 *
 * Rank isn't stored anywhere — the board computes it on every read — so
 * a pass is detected by comparing scores: anyone on the same college board
 * whose DOTS sits in (before, after] was below the saver's new score and
 * at or above the old one. A first full total has no "before", so it
 * passes everyone it lands above, which is the honest reading.
 *
 * A lowered score passes nobody, and nobody needs a notice that someone
 * fell below them.
 */
export async function notifyPassed(params: {
  lifterId: string;
  collegeId: number;
  dotsBefore: number | null;
}): Promise<void> {
  const { lifterId, collegeId, dotsBefore } = params;

  const board = await getLeaderboard({ collegeId });
  const me = board.find((r) => r.id === lifterId);
  if (!me) return;

  const floor = dotsBefore ?? -Infinity;
  if (me.dots <= floor) return;

  const passed = board.filter(
    (r) => r.id !== lifterId && r.dots < me.dots && r.dots >= floor,
  );
  if (passed.length === 0) return;

  // One insert per lifter passed rather than a VALUES list: the Neon HTTP
  // driver's tagged template can't spread an array into rows, and a save
  // passes a handful of people, not hundreds.
  for (const row of passed) {
    await sql`
      insert into notifications (lifter_id, actor_id, kind)
      values (${row.id}, ${lifterId}, 'passed')
      on conflict do nothing
    `;
  }
}
