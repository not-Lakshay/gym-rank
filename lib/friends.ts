import { sql } from "./db";

/*
  Two-way friends (see db/schema.sql). "Add friend" sends a request; the
  other lifter accepts it, and only then are both on each other's Friends
  board. A friendship is two rows, a→b and b→a, always written and deleted
  together, each in a single statement so a half-friendship can't happen.
*/

export type Relationship = "friends" | "sent" | "received" | "none";

/** How `me` stands with `other`, for the profile button. */
export async function relationshipWith(me: string, other: string): Promise<Relationship> {
  const [row] = await sql`
    select
      exists (select 1 from friends where lifter_id = ${me}::uuid and friend_id = ${other}::uuid) as friends,
      exists (select 1 from friend_requests where from_id = ${me}::uuid and to_id = ${other}::uuid) as sent,
      exists (select 1 from friend_requests where from_id = ${other}::uuid and to_id = ${me}::uuid) as received
  `;
  if (row.friends) return "friends";
  if (row.received) return "received";
  if (row.sent) return "sent";
  return "none";
}

/**
 * Accept `from`'s request to `me`: deletes the request and writes both
 * rows in one statement. False if there was no such request.
 */
export async function acceptRequest(me: string, from: string): Promise<boolean> {
  const rows = await sql`
    with r as (
      delete from friend_requests
      where from_id = ${from}::uuid and to_id = ${me}::uuid
      returning from_id, to_id
    )
    insert into friends (lifter_id, friend_id)
    select from_id, to_id from r
    union all
    select to_id, from_id from r
    on conflict do nothing
    returning lifter_id
  `;
  return rows.length > 0;
}

/**
 * Send a request from `me` to `other`. If `other` already asked `me`, that
 * request is accepted instead: both want it.
 */
export async function requestFriend(
  me: string,
  other: string,
): Promise<"sent" | "accepted" | "none"> {
  if (me === other) return "none";
  if (await acceptRequest(me, other)) return "accepted";
  const rows = await sql`
    insert into friend_requests (from_id, to_id)
    select ${me}::uuid, id from lifters
    where id = ${other}::uuid
      and not exists (
        select 1 from friends where lifter_id = ${me}::uuid and friend_id = ${other}::uuid
      )
    on conflict do nothing
    returning to_id
  `;
  return rows.length > 0 ? "sent" : "none";
}

/** Turn down `from`'s request to `me`. */
export async function declineRequest(me: string, from: string): Promise<void> {
  await sql`delete from friend_requests where from_id = ${from}::uuid and to_id = ${me}::uuid`;
}

/** Take back `me`'s pending request to `to`. */
export async function cancelRequest(me: string, to: string): Promise<void> {
  await sql`delete from friend_requests where from_id = ${me}::uuid and to_id = ${to}::uuid`;
}

/** Unfriend: both rows go, so neither is on the other's board. */
export async function removeFriend(me: string, other: string): Promise<void> {
  await sql`
    delete from friends
    where (lifter_id = ${me}::uuid and friend_id = ${other}::uuid)
       or (lifter_id = ${other}::uuid and friend_id = ${me}::uuid)
  `;
}

export async function friendCount(lifterId: string): Promise<number> {
  const [row] = await sql`select count(*) as n from friends where lifter_id = ${lifterId}::uuid`;
  return Number(row.n);
}

export type FriendRequest = {
  fromId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  collegeShort: string | null;
  createdAt: Date;
};

/** Requests waiting on `me`, newest first. */
export async function incomingRequests(me: string): Promise<FriendRequest[]> {
  const rows = await sql`
    select r.from_id, r.created_at, lf.username, lf.display_name, lf.avatar,
           c.short_name as college_short
    from friend_requests r
    join lifters lf on lf.id = r.from_id
    left join colleges c on c.id = lf.college_id
    where r.to_id = ${me}::uuid
    order by r.created_at desc
  `;
  return rows.map((r) => ({
    fromId: r.from_id as string,
    username: r.username as string,
    displayName: r.display_name as string,
    avatar: (r.avatar as string | null) ?? null,
    collegeShort: (r.college_short as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
  }));
}
