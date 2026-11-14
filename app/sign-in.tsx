import { signInAction, signOutAction } from "@/app/actions";

export function SignInForm({
  redirectTo,
  label,
  className,
  formClassName,
}: {
  redirectTo: string;
  label: string;
  className: string;
  formClassName?: string;
}) {
  return (
    <form action={signInAction} className={formClassName}>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
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
