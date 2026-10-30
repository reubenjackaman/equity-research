/** Value Finch's marks: flat, one colour, drawn in the current text colour. */

function Bird() {
  return (
    <>
      <path d="M17 41 3 53l18-3Z" fill="currentColor" />
      <path d="M30 51v7m8-9v9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M13 40c0-14 12-25 25-25 8 0 14 6 14 15 0 14-12 22-24 22-9 0-15-5-15-12Z" fill="currentColor" />
      <path d="m51 23 10 4-10 5Z" fill="currentColor" />
      <path d="M21 35c8-6 17-4 20 3-6 7-15 7-23 4" fill="none" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="44" cy="25" r="2.5" fill="var(--bg)" />
    </>
  );
}

export function FinchLogo({ className = "h-10 w-10 text-accent" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden>
      <Bird />
    </svg>
  );
}

/** The home button: a finch at the door of its little house. */
export function Birdhouse({ className = "h-8 w-8 text-accent" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 28 32 6l26 22M13 23v35h38V23" />
      <circle cx="31" cy="34" r="10" fill="currentColor" stroke="none" />
      <path d="m39 30 9 4-9 4Z" fill="currentColor" stroke="none" />
      <circle cx="34" cy="31" r="1.8" fill="var(--bg)" stroke="none" />
    </svg>
  );
}

/** The finch with a bright idea, for the game's hints. */
export function HintFinch({ className = "h-9 w-8 text-accent" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 80" aria-hidden>
      <g transform="translate(26 0)" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 0 0-6 18c1.5 1.2 2 2.5 2 4h8c0-1.5.5-2.8 2-4A10 10 0 0 0 12 2Z" />
        <path d="M8.5 28h7" />
      </g>
      <g transform="translate(0 18)">
        <Bird />
      </g>
    </svg>
  );
}
