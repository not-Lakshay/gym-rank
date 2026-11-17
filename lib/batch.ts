/*
  Batch years, for LNMIIT only — the campus the app started at and where
  most of its lifters are. A batch is named for the August it joined:
  joining in August 2024 makes you Y24, and you move up a year every
  August after that. Stored as the full year (2024); shown as "Y24".
*/

export const BATCH_COLLEGE = "lnmiit";

/** The batch that joined most recently: this year's from August on. */
export function newestBatch(now: Date = new Date()): number {
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * The batches someone can pick, newest first. Five, so a dual-degree
 * student in their fifth year still finds theirs.
 */
export function batchOptions(now: Date = new Date()): number[] {
  const newest = newestBatch(now);
  return [0, 1, 2, 3, 4].map((i) => newest - i);
}

export function batchLabel(year: number): string {
  return `Y${String(year % 100).padStart(2, "0")}`;
}

/**
 * The batch boards a viewer sees, oldest first: their own and the one
 * either side. No batch (or signed out), no batch boards.
 */
export function batchesFor(viewerBatch: number | null): number[] {
  return viewerBatch === null ? [] : [viewerBatch - 1, viewerBatch, viewerBatch + 1];
}
