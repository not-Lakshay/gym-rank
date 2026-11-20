"use server";

import { refresh, updateTag } from "next/cache";
import { DATA_TAG } from "@/lib/cached";
import type { ActionState } from "@/app/actions";
import { currentAdmin } from "@/lib/admin";
import { addCollege } from "@/lib/colleges";
import {
  adminClearCosign,
  adminDeleteLift,
  deleteLifter,
  recordEvent,
} from "@/lib/lifters";

const ok = (): ActionState => ({ error: null, savedAt: Date.now() });
const fail = (error: string): ActionState => ({ error });

/*
  Every admin action re-checks the admin on the server. The page hiding
  the buttons from non-admins is not security; this is.
*/

export async function deleteLifterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await currentAdmin();
  if (!admin) return fail("Not allowed.");
  const id = String(formData.get("lifterId") ?? "");
  const done = await deleteLifter(id);
  if (!done) return fail("No such lifter.");
  await recordEvent("admin:lifter_deleted", null);
  updateTag(DATA_TAG);
  refresh();
  return ok();
}

export async function deleteLiftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await currentAdmin();
  if (!admin) return fail("Not allowed.");
  const id = String(formData.get("liftId") ?? "");
  const done = await adminDeleteLift(id);
  if (!done) return fail("No such lift.");
  await recordEvent("admin:lift_deleted", null);
  updateTag(DATA_TAG);
  refresh();
  return ok();
}

export async function clearCosignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await currentAdmin();
  if (!admin) return fail("Not allowed.");
  const id = String(formData.get("liftId") ?? "");
  const done = await adminClearCosign(id);
  if (!done) return fail("No such lift.");
  await recordEvent("admin:cosign_cleared", null);
  updateTag(DATA_TAG);
  refresh();
  return ok();
}

export async function addCollegeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await currentAdmin();
  if (!admin) return fail("Not allowed.");

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("shortName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const domains = String(formData.get("domains") ?? "")
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
    return fail("Slug: lowercase letters, digits, dashes.");
  }
  if (!name || !shortName || !city || !state) {
    return fail("Every field except domains is required.");
  }
  if (domains.some((d) => !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))) {
    return fail("A domain looks wrong.");
  }

  try {
    await addCollege({ slug, name, shortName, city, state, domains });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") return fail(`Slug "${slug}" already exists.`);
    throw err;
  }
  await recordEvent("admin:college_added", null);
  updateTag(DATA_TAG);
  refresh();
  return ok();
}
