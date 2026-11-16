"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/actions";
import { field, primary, secondary } from "@/app/forms";
import {
  addCollegeAction,
  clearCosignAction,
  deleteLiftAction,
  deleteLifterAction,
} from "./actions";

const initial: ActionState = { error: null };

/*
  A destructive button that asks once. First tap arms it ("Sure?"), second
  tap fires; it disarms itself after a few seconds. No modal: on a phone a
  confirm dialog is one more thing to mis-tap.
*/
function ArmedButton({
  action,
  hidden,
  label,
  armedLabel = "Sure?",
  danger = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  label: string;
  armedLabel?: string;
  danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [armed, setArmed] = useState(false);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
          setTimeout(() => setArmed(false), 4000);
        }
      }}
      className="inline-flex flex-col items-end"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className={`${secondary} min-h-9 px-3 text-[13px] ${
          armed
            ? danger
              ? "border-[var(--plate-25)] text-[var(--plate-25)]"
              : "border-chalk text-chalk"
            : ""
        }`}
      >
        {pending ? "…" : armed ? armedLabel : label}
      </button>
      {state.error && (
        <span role="alert" className="mt-1 text-[11px] text-[var(--plate-25)]">
          {state.error}
        </span>
      )}
    </form>
  );
}

export function DeleteLifterButton({
  lifterId,
  name,
}: {
  lifterId: string;
  name: string;
}) {
  return (
    <ArmedButton
      action={deleteLifterAction}
      hidden={{ lifterId }}
      label="Delete"
      armedLabel={`Delete ${name}?`}
      danger
    />
  );
}

export function DeleteLiftButton({ liftId }: { liftId: string }) {
  return (
    <ArmedButton action={deleteLiftAction} hidden={{ liftId }} label="Remove" danger />
  );
}

export function ClearCosignButton({ liftId }: { liftId: string }) {
  return (
    <ArmedButton action={clearCosignAction} hidden={{ liftId }} label="Clear co-sign" />
  );
}

export function AddCollegeForm() {
  const [state, action, pending] = useActionState(addCollegeAction, initial);
  const input = `${field} w-full text-left`;
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <label className="col-span-2 flex flex-col gap-1">
        <span className="text-[12px] text-chalk-dim">Full name</span>
        <input
          name="name"
          required
          placeholder="Indian Institute of Technology Delhi"
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-chalk-dim">Short name</span>
        <input name="shortName" required placeholder="IIT Delhi" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-chalk-dim">Slug (URL)</span>
        <input
          name="slug"
          required
          placeholder="iitd"
          pattern="[a-z0-9-]{2,40}"
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-chalk-dim">City</span>
        <input name="city" required className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-chalk-dim">State</span>
        <input name="state" required className={input} />
      </label>
      <label className="col-span-2 flex flex-col gap-1">
        <span className="text-[12px] text-chalk-dim">
          Email domains (comma-separated, optional)
        </span>
        <input
          name="domains"
          placeholder="iitd.ac.in, student.iitd.ac.in"
          className={input}
        />
      </label>
      {state.error && (
        <p role="alert" className="col-span-2 text-[12px] text-[var(--plate-25)]">
          {state.error}
        </p>
      )}
      {state.savedAt && !state.error && (
        <p className="col-span-2 text-[12px] text-[var(--plate-10)]">Added.</p>
      )}
      <button type="submit" disabled={pending} className={`${primary} col-span-2 w-fit`}>
        {pending ? "Adding…" : "Add college"}
      </button>
    </form>
  );
}
