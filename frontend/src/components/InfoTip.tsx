import { useRef, useState } from"react";
import { createPortal } from"react-dom";

/**
 * Hover (or tap, on phones) to show a small popover. It's positioned relative to the
 * window and rendered at the end of <body> (a"portal"), so scrolling tables and
 * sticky columns can't clip or cover it.
 */
export default function InfoTip({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  function show() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const width = 288;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    // Open upwards when there isn't room below.
    setPos(r.bottom + 180 > window.innerHeight ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 });
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        onFocus={show}
        onBlur={() => setPos(null)}
        onClick={() => (pos ? setPos(null) : show())}
        className="cursor-help text-left underline decoration-line-strong decoration-dotted underline-offset-4"
      >
        {children}
      </button>
      {pos &&
        createPortal(
        <div
          role="tooltip"
          style={pos}
          className="fixed z-50 w-72 rounded border border-line bg-surface p-3 text-xs font-normal leading-relaxed text-ink shadow-sm"
        >
          {content}
        </div>,
          document.body,
        )}
    </>
  );
}
