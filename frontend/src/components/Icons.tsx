/** Small drawn marks, in one stroke weight, coloured by the surrounding text. Decorative: the words beside them carry the meaning. */
export function Trend({ dir, className = "h-3 w-3" }: { dir: "up" | "down" | "flat"; className?: string }) {
  return (
    <svg className={`inline-block shrink-0 align-[-0.1em] ${className}`} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      {dir === "up" && <path d="M6 1.5 11 10H1Z" />}
      {dir === "down" && <path d="M6 10.5 1 2h10Z" />}
      {dir === "flat" && <circle cx="6" cy="6" r="3.5" />}
    </svg>
  );
}

export function ArrowRight({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={`inline-block shrink-0 align-[-0.15em] ${className}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
    </svg>
  );
}
