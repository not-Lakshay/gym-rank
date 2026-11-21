"use client";

/*
  "Report a problem" in the footer: a short list of the problems people
  actually hit. Tapping one opens their mail app with the subject and body
  already written, plus the page and device, so all that's left is Send.
  The page and device are read at tap time, so this works on any page and
  needs no server help. Nothing is sent anywhere until they press Send.
*/

const TO = "getgymrank@gmail.com";

const PROBLEMS = [
  { title: "Page is slow or stuck loading", ask: "Which page, and roughly how long did it take?" },
  { title: "Can't sign in", ask: "What happened when you tapped Continue with Google?" },
  { title: "My lift or score looks wrong", ask: "Which lift, what you entered, and what you expected to see?" },
  { title: "A button didn't work", ask: "Which button (co-sign, doubt, add friend, save…) and what happened?" },
  { title: "Something looks broken on screen", ask: "What looks wrong? A screenshot helps a lot." },
  { title: "Something else", ask: "What happened?" },
] as const;

function mailto(problem: (typeof PROBLEMS)[number]): string {
  const body = [
    problem.ask,
    "",
    "",
    "",
    "---",
    `Problem: ${problem.title}`,
    `Page: ${window.location.href}`,
    `Device: ${navigator.userAgent}`,
    `Time: ${new Date().toString()}`,
  ].join("\n");
  const subject = `Gym Rank problem: ${problem.title}`;
  return `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ReportProblem({ className }: { className: string }) {
  return (
    <>
      <button type="button" popoverTarget="report-problem" className={className}>
        Report a problem
      </button>
      <div
        id="report-problem"
        popover="auto"
        className="help-pop m-auto w-[min(22rem,calc(100%-2rem))] rounded-sm border border-rule bg-iron-raised p-4 text-left"
      >
        <p className="text-[15px] font-bold text-chalk">What went wrong?</p>
        <p className="mt-1 text-[13px] leading-relaxed text-chalk-dim">
          Pick one and your mail app opens with the email written. Just hit send.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {PROBLEMS.map((p) => (
            <li key={p.title}>
              <a
                href={`mailto:${TO}`}
                // Built on tap, so it carries the page you're on right now.
                onClick={(e) => {
                  e.currentTarget.href = mailto(p);
                }}
                className="press flex min-h-11 items-center justify-between rounded-sm border border-rule px-3 text-[14px] text-chalk hover:border-chalk-faint"
              >
                {p.title}
                <span aria-hidden className="text-chalk-faint">›</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-chalk-faint">
          No mail app? Write to {TO}.
        </p>
      </div>
    </>
  );
}
