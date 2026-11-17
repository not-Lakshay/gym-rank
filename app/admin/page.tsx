import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Bone, ChevronLeft, navButton } from "@/app/board";
import { currentAdmin } from "@/lib/admin";
import { timeAgo } from "@/lib/format";
import {
  MOVEMENTS,
  adminListLifters,
  adminStats,
  getLifterById,
  getLiftsFor,
} from "@/lib/lifters";
import {
  AddCollegeForm,
  ClearCosignButton,
  DeleteLiftButton,
  DeleteLifterButton,
} from "./forms";

export const metadata = { title: "Admin — Gym Rank", robots: { index: false } };

type SearchParams = Promise<{ lifter?: string }>;

/*
  The admin page. Not linked from anywhere; a non-admin gets a 404, not a
  403, so the page doesn't advertise that it exists. Every button here
  calls an action that re-checks the admin on the server.
*/
export default function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <Suspense fallback={<Bone className="h-11 w-36" />}>
        <Admin searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Admin({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const admin = await currentAdmin();
  if (!admin) notFound();

  const [{ lifter: focusId }, stats, lifters] = await Promise.all([
    searchParams,
    adminStats(),
    adminListLifters(),
  ]);
  const focus = focusId ? await getLifterById(focusId).catch(() => null) : null;
  const focusLifts = focus ? await getLiftsFor(focus.id) : [];

  return (
    <div>
      <Link href="/?all" className={navButton}>
        <ChevronLeft />
        All colleges
      </Link>

      <header className="pt-8">
        <h1 className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
          Admin
        </h1>
        <p className="mt-2 text-[13px] text-chalk-dim">Signed in as {admin}</p>
      </header>

      <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-rule bg-rule">
        <Stat label="lifters" value={stats.lifters} />
        <Stat label="with a total" value={stats.withTotal} />
        <Stat label="colleges active" value={stats.colleges} />
        <Stat label="co-signs" value={stats.cosigns} />
        <Stat label="sign-ups, 7d" value={stats.signupsLast7} />
        <Stat label="lifts saved, 7d" value={stats.liftsSavedLast7} />
      </dl>

      {focus && (
        <section className="mt-10 rounded-sm border border-rule bg-iron-raised p-4">
          <h2 className="flex items-center justify-between caption">
            <span>
              Lifts of <span className="text-chalk">{focus.displayName}</span> @
              {focus.username}
            </span>
            <Link href="/admin" className="text-[12px] underline underline-offset-4">
              close
            </Link>
          </h2>
          {focusLifts.length === 0 && (
            <p className="mt-3 text-[13px] text-chalk-faint">No lifts entered.</p>
          )}
          {focusLifts.map((lift) => (
            <div
              key={lift.id}
              className="flex items-center gap-3 border-b border-rule py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">
                  {MOVEMENTS.find((m) => m.id === lift.movement)?.label}
                </p>
                <p className="tnum text-[11px] text-chalk-faint">
                  {lift.movement === "pullups"
                    ? `${lift.reps} reps`
                    : `${lift.weightKg} kg × ${lift.reps} · est. 1RM ${lift.est1rmKg?.toFixed(1)} kg`}
                  {lift.verifiedByName && ` · co-signed by ${lift.verifiedByName}`}
                </p>
              </div>
              {lift.verifiedByName && <ClearCosignButton liftId={lift.id} />}
              <DeleteLiftButton liftId={lift.id} />
            </div>
          ))}
        </section>
      )}

      <section className="mt-10">
        <h2 className="border-b border-rule pb-2 caption">
          Lifters · {lifters.length}
        </h2>
        <ol>
          {lifters.map((l) => (
            <li key={l.id} className="flex items-center gap-3 border-b border-rule py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">
                  <Link href={`/u/${l.username}`} className="underline-offset-4 hover:underline">
                    {l.displayName}
                  </Link>
                  <span className="text-chalk-faint"> @{l.username}</span>
                </p>
                <p className="tnum truncate text-[11px] text-chalk-faint">
                  {l.email} · {l.collegeShort ?? "no college"} · {l.bodyweightKg} kg ·{" "}
                  {l.liftCount} lifts, {l.verifiedCount} co-signed · {timeAgo(l.createdAt)}
                </p>
              </div>
              <Link
                href={`/admin?lifter=${l.id}`}
                className={`${navButton} min-h-9 px-3 text-[13px]`}
              >
                Lifts
              </Link>
              <DeleteLifterButton lifterId={l.id} name={l.displayName} />
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="border-b border-rule pb-2 caption">
          Add a college
        </h2>
        <p className="mb-4 mt-3 text-[12px] leading-relaxed text-chalk-faint">
          Goes live immediately. Add it to db/colleges.json too so a fresh
          database gets it on migrate.
        </p>
        <AddCollegeForm />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-iron px-3 py-2.5">
      <dd className="tnum text-[20px] font-extrabold leading-none">{value}</dd>
      <dt className="caption mt-1">{label}</dt>
    </div>
  );
}
