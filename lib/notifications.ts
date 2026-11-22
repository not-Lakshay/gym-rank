import { sql } from "./db";
import { getLeaderboard, getLiftBoards } from "./leaderboard";
import type { Movement } from "./movements";
import { unclaimedTitles } from "./titles";

export type Notification = {
  id: number;
  kind: "cosign" | "passed" | "doubt" | "friend_request" | "friend_accepted" | "title_chance";
  actorName: string | null;
  actorUsername: string | null;
  actorId: string | null;
  movement: Movement | null;
  /** The actor is now a friend: a request since accepted reads as done. */
  actorIsFriend: boolean;
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
           a.display_name as actor_name, a.username as actor_username,
           exists (select 1 from friends f
                   where f.lifter_id = n.lifter_id and f.friend_id = n.actor_id) as actor_is_friend
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
    actorIsFriend: Boolean(row.actor_is_friend),
    createdAt: new Date(row.created_at as string),
    seen: row.seen_at !== null,
  }));
}

/** Unread count for the bell; null when this email has no lifter yet. One query. */
export async function unseenCountFor(email: string): Promise<number | null> {
  const rows = await sql`
    select lf.id,
           (select count(*) from notifications n
            where n.lifter_id = lf.id and n.seen_at is null
              and n.created_at > now() - interval '30 days') as unseen
    from lifters lf
    where lf.email = ${email}
    limit 1
  `;
  return rows.length === 0 ? null : Number(rows[0].unseen);
}

export async function markNotificationsSeen(lifterId: string): Promise<void> {
  await sql`
    update notifications set seen_at = now()
    where lifter_id = ${lifterId} and seen_at is null
  `;
}

/** A friend request arrived, or one this lifter sent was accepted. */
export async function notifyFriend(params: {
  lifterId: string;
  actorId: string;
  kind: "friend_request" | "friend_accepted";
}): Promise<void> {
  const { lifterId, actorId, kind } = params;
  await sql`
    insert into notifications (lifter_id, actor_id, kind)
    values (${lifterId}, ${actorId}, ${kind})
    on conflict do nothing
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
 * Someone questioned one of this lifter's sets. No actor: who doubted is
 * never shown. At most one per lift per day, since the null actor slips
 * past the dedupe index.
 */
export async function notifyDoubted(params: {
  lifterId: string;
  movement: Movement;
}): Promise<void> {
  const { lifterId, movement } = params;
  await sql`
    insert into notifications (lifter_id, kind, movement)
    select ${lifterId}, 'doubt', ${movement}
    where not exists (
      select 1 from notifications
      where lifter_id = ${lifterId} and kind = 'doubt' and movement = ${movement}
        and created_at > now() - interval '1 day'
    )
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
 *
 * Returns who was passed, best first, so the saver can be told too.
 */
export async function notifyPassed(params: {
  lifterId: string;
  collegeId: number;
  dotsBefore: number | null;
}): Promise<string[]> {
  const { lifterId, collegeId, dotsBefore } = params;

  const board = await getLeaderboard({ collegeId }, false);
  const me = board.find((r) => r.id === lifterId);
  if (!me) return [];

  const floor = dotsBefore ?? -Infinity;
  if (me.dots <= floor) return [];

  const passed = board.filter(
    (r) => r.id !== lifterId && r.dots < me.dots && r.dots >= floor,
  );

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
  return passed.map((r) => r.displayName);
}

/**
 * Tell whoever tops a college's squat, bench or deadlift tab without a
 * co-sign that one co-sign earns them the #1 title (lib/titles.ts).
 *
 * Run after anything that can reorder a college's lift tabs: a lift saved,
 * a bodyweight changed, someone joining or leaving. Once per version of
 * the lift: a notice created since the lift was last saved means they
 * already know, so other people's saves don't repeat it.
 */
export async function notifyTitleChances(collegeId: number): Promise<void> {
  for (const { id, movement } of unclaimedTitles(await getLiftBoards({ collegeId }))) {
    await sql`
      insert into notifications (lifter_id, kind, movement)
      select ${id}, 'title_chance', ${movement}
      where not exists (
        select 1 from notifications n
        join lifts l on l.lifter_id = n.lifter_id and l.movement = n.movement
        where n.lifter_id = ${id} and n.kind = 'title_chance'
          and n.movement = ${movement} and n.created_at >= l.recorded_at
      )
    `;
  }
}
