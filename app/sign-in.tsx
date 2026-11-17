import { signInAction, signOutAction } from "@/app/actions";
import { InAppGate } from "@/app/in-app-notice";

export function SignInForm({
  redirectTo,
  label,
  className,
  formClassName,
  compact,
}: {
  redirectTo: string;
  label: string;
  className: string;
  formClassName?: string;
  /** No room for the in-app-browser notice here; send those visitors to /me. */
  compact?: boolean;
}) {
  return (
    <InAppGate className={className} compact={compact} label={label} boxClassName={formClassName}>
      <form action={signInAction} className={formClassName}>
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <button type="submit" className={className}>
          {label}
        </button>
      </form>
    </InAppGate>
  );
}

export function SignOutForm({
  className,
  formClassName,
}: {
  className: string;
  formClassName?: string;
}) {
  return (
    <form action={signOutAction} className={formClassName}>
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}
