/**
 * The five ranked movements.
 *
 * This file has no database import on purpose: it is shared with client
 * components, and lib/lifters.ts pulls in the Neon client, which must never
 * reach the browser bundle.
 *
 * maxKg is a plausibility cap, not a world record — it exists so a joke
 * entry can't poison the leaderboard. A board nobody believes is a board
 * nobody opens twice.
 */
export const MOVEMENTS = [
  { id: "squat", label: "Squat", maxKg: 400 },
  { id: "bench", label: "Bench press", maxKg: 300 },
  { id: "deadlift", label: "Deadlift", maxKg: 450 },
  { id: "overhead_press", label: "Overhead press", maxKg: 220 },
  { id: "pullups", label: "Pull-ups", maxKg: null },
] as const;

export type Movement = (typeof MOVEMENTS)[number]["id"];

// The squat/bench/deadlift total is what DOTS is actually defined on.
export const TOTAL_MOVEMENTS: Movement[] = ["squat", "bench", "deadlift"];
