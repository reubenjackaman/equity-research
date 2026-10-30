import { useId } from "react";

/** The Value Finch mascot: a house finch, drawn in the site's pink-orange. All artwork is inline SVG. */

function Bird({ fill }: { fill: string }) {
  return (
    <>
      <path d="M17 41 3 53l18-3Z" fill="#334155" />
      <path d="M30 51v7m-5 0h9M38 49v9m-5 0h9" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M13 40c0-14 12-25 25-25 8 0 14 6 14 15 0 14-12 22-24 22-9 0-15-5-15-12Z" fill={fill} />
      <path d="M21 34c8-6 18-4 21 4-6 8-16 8-25 4Z" fill="#334155" />
      <path d="M26 37c5-2 9-1 12 2M24 41c4 1 7 1 10 0" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="m51 23 10 4-10 5Z" fill="#fbbf24" />
      <circle cx="44" cy="25" r="3" fill="#0f172a" />
      <circle cx="45" cy="24" r="1" fill="#fff" />
    </>
  );
}

function Gradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#db2777" />
        <stop offset="1" stopColor="#f97316" />
      </linearGradient>
    </defs>
  );
}

export function FinchLogo({ className = "h-10 w-10" }: { className?: string }) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden>
      <Gradient id={id} />
      <Bird fill={`url(#${id})`} />
    </svg>
  );
}

/** The home button: a finch peeking out of its little house. */
export function Birdhouse({ className = "h-8 w-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden>
      <Gradient id={id} />
      <path d="M12 27h40v29a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3Z" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
      <path d="M5 30 32 6l27 24" fill="none" stroke={`url(#${id})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="36" r="12.5" fill="#334155" />
      <circle cx="31" cy="38" r="9" fill={`url(#${id})`} />
      <path d="m38 34 7 3-7 3Z" fill="#fbbf24" />
      <circle cx="33" cy="35" r="1.8" fill="#0f172a" />
      <path d="M26 53h12" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** The finch with a bright idea, for the game's hints. */
export function HintFinch({ className = "h-8 w-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 64 80" aria-hidden>
      <Gradient id={id} />
      <g transform="translate(26 0)">
        <path d="M12 2a10 10 0 0 0-6 18c1.5 1.200 2 2.5 2 4h8c0-1.5.5-2.800 2-4A10 10 0 0 0 12 2Z" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" />
        <path d="M8.5 27h7" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g transform="translate(0 18)">
        <Bird fill={`url(#${id})`} />
      </g>
    </svg>
  );
}
