import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { getCollegeBySlug, getCollegeOptions } from "./colleges";
import { getGlobalRankFor, getLeaderboard, getLiftBoards, getLiftTitles, getMostTrusted, getRankFor, type BoardScope } from "./leaderboard";
import { getLifterById, getLifterByUsername, getLiftsFor } from "./lifters";

/*
  Cached reads for pages. Every board, profile and college a visitor sees
  comes from here, so 500 people looking at the same board cost the
  database one query, not 2,000 a minute, and a visitor arriving while
  Neon sleeps gets the cached page instead of waiting for it to wake.

  "remote" keeps entries in Vercel's shared Runtime Cache (free on Hobby,
  paused rather than billed past its allotment), not per-server memory,
  which is gone between requests on serverless.

  Every write action calls updateTag(DATA_TAG), so a cached board is never
  wrong: the hourly revalidate is a safety net, not the freshness plan.
  Server actions deliberately keep using the uncached functions, so a save
  and its "you passed X" check always read the database itself.
*/
export const DATA_TAG = "data";

function shared() {
  cacheTag(DATA_TAG);
  // Served instantly for a week after the last refresh; refreshed in the
  // background at most hourly. Only a week of zero visits makes someone wait.
  cacheLife({ stale: 300, revalidate: 3600, expire: 7 * 24 * 3600 });
}

// React's cache() on top dedupes within one request: metadata and the page
// body both ask for the same college or lifter.
export const collegeBySlug = cache(async (slug: string) => {
  "use cache: remote";
  shared();
  return getCollegeBySlug(slug);
});

export async function collegeOptions() {
  "use cache: remote";
  shared();
  return getCollegeOptions();
}

export async function leaderboard(scope: BoardScope) {
  "use cache: remote";
  shared();
  return getLeaderboard(scope);
}

export async function liftBoardsFor(scope: BoardScope) {
  "use cache: remote";
  shared();
  return getLiftBoards(scope);
}

export async function rankFor(lifterId: string, knownCollegeId?: number) {
  "use cache: remote";
  shared();
  return getRankFor(lifterId, knownCollegeId);
}

export async function globalRankFor(lifterId: string) {
  "use cache: remote";
  shared();
  return getGlobalRankFor(lifterId);
}

export const lifterByUsername = cache(async (username: string) => {
  "use cache: remote";
  shared();
  return getLifterByUsername(username.toLowerCase());
});

export const lifterById = cache(async (id: string) => {
  "use cache: remote";
  shared();
  return getLifterById(id);
});

export async function liftsFor(lifterId: string) {
  "use cache: remote";
  shared();
  return getLiftsFor(lifterId);
}

/** Who holds "Most trusted" at each college, for profiles and You. */
export async function mostTrusted() {
  "use cache: remote";
  shared();
  return getMostTrusted();
}

/** Who holds #1 squat, bench and deadlift at each college. */
export async function liftTitles() {
  "use cache: remote";
  shared();
  return getLiftTitles();
}
