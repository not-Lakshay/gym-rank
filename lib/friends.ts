import { sql } from "./db";

/*
  One-way friends (see db/schema.sql): a lifter's Friends board is them
  plus everyone they added.
*/

/** Add a friend. False if it's yourself or already added. */
export async function addFriend(lifterId: string, friendId: string): Promise<boolean> {
  if (lifterId === friendId) return false;
  const rows = await sql`
    insert into friends (lifter_id, friend_id)
    select ${lifterId}::uuid, id from lifters where id = ${friendId}::uuid
    on conflict do nothing
    returning friend_id
  `;
  return rows.length > 0;
}

export async function removeFriend(lifterId: string, friendId: string): Promise<void> {
  await sql`delete from friends where lifter_id = ${lifterId}::uuid and friend_id = ${friendId}::uuid`;
}

export async function isFriend(lifterId: string, friendId: string): Promise<boolean> {
  const rows = await sql`
    select 1 from friends where lifter_id = ${lifterId}::uuid and friend_id = ${friendId}::uuid
  `;
  return rows.length > 0;
}

export async function friendCount(lifterId: string): Promise<number> {
  const [row] = await sql`select count(*) as n from friends where lifter_id = ${lifterId}::uuid`;
  return Number(row.n);
}
