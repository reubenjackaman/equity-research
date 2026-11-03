import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { AskMessage, DcfAssumptions, askApi } from "../api";
import { keys, load } from "../storage";
import { FinchLogo } from "./Finch";

/** Starter questions for each tab, so it's clear what the assistant can do. */
const STARTERS: Record<string, string[]> = {
  Overview: ["Is it overvalued or undervalued?", "How is it valued against competitors?", "What are the main risks?"],
  Financials: ["How has revenue grown?", "Is free cash flow keeping up with net income?", "How much debt does it carry?"],
  Ratios: ["Which ratios stand out, and why?", "Are margins improving?", "How do its returns compare with peers?"],
  Health: ["What does the Piotroski score say?", "Explain the Altman Z-score here.", "Is the Beneish score a concern?"],
  News: ["Summarize the recent headlines.", "What themes come up in the news?"],
  DCF: ["Why is the DCF value different from the price?", "What growth is priced in?", "Which assumption matters most?"],
  Comps: ["How does it compare with its peers?", "Which multiple looks most different from peers?"],
  Summary: ["Is it overvalued or undervalued?", "How do today's multiples compare with history?"],
};

/** "Ask Finch": a question box that answers from the data on the current company page. */
export default function AskFinch({ symbol, name, tab }: { symbol: string; name: string; tab: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [symbol]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  // On wide screens the panel sits beside the page instead of on top of it (see .ask-open in index.css).
  useEffect(() => {
    document.documentElement.classList.toggle("ask-open", open);
    return () => document.documentElement.classList.remove("ask-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(question: string) {
    question = question.trim();
    if (!question || busy) return;
    const history = messages;
    setMessages([...history, { role: "user", text: question }]);
    setText("");
    setBusy(true);
    setError(null);
    try {
      const { answer } = await askApi.ask({
        symbol,
        tab,
        question,
        history,
        assumptions: load<Partial<DcfAssumptions>>(keys.dcf(symbol), {}),
        peers: load<string[] | null>(keys.peers(symbol), null) ?? [],
      });
      setMessages((m) => [...m, { role: "model", text: answer }]);
    } catch (e) {
      setMessages(history); // the question wasn't answered, so put it back in the box
      setText(question);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(text);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded border border-line-strong bg-surface py-2 pr-4 pl-3 text-sm font-medium text-ink shadow-sm transition-colors hover:border-accent hover:text-accent"
      >
        <FinchLogo className="h-6 w-6 text-accent" />
        Ask Finch
      </button>
    );
  }

  return (
    <aside
      aria-label="Ask Finch"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[55vh] flex-col border-t border-line bg-surface shadow-sm lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:w-[26rem] lg:border-t-0 lg:border-l lg:shadow-none"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <div className="flex items-center gap-2">
          <FinchLogo className="h-6 w-6 text-accent" />
          <div>
            <h2 className="text-base">Ask Finch</h2>
            <p className="text-xs text-muted">
              About {name}, using the {tab} tab
            </p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Minimize Ask Finch" title="Minimize (your chat is kept)" className="min-w-11 rounded p-2 text-muted hover:bg-subtle hover:text-ink">
          <svg className="mx-auto h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div>
            <p className="text-sm text-muted">
              Ask anything about {symbol}: valuation, competitors, risks, or what a number means. Finch reads everything the site has
              on the company, plus analyst ratings and recent news.
            </p>
            <ul className="mt-3 space-y-2">
              {(STARTERS[tab] ?? STARTERS.Overview).map((q) => (
                <li key={q}>
                  <button
                    onClick={() => ask(q)}
                    disabled={busy}
                    className="w-full rounded border border-line px-3 py-2 text-left text-sm transition-colors hover:border-accent hover:text-accent"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-8 rounded bg-subtle px-3 py-2 text-sm">
              {m.text}
            </p>
          ) : (
            <Answer key={i} text={m.text} />
          ),
        )}
        {busy && <p className="text-sm text-muted">Reading the page…</p>}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-line px-4 pt-3 pb-3">
        {error && <p className="mb-2 text-xs text-loss">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(text);
              }
            }}
            rows={2}
            maxLength={500}
            placeholder="Ask a question"
            aria-label="Your question"
            className="min-w-0 flex-1 resize-none rounded border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            Ask
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          AI-generated from the site's data, analyst ratings, news and general knowledge. It can make mistakes and isn't investment advice.
        </p>
      </form>
    </aside>
  );
}

/** Renders the assistant's plain-text answer: paragraphs, "- " bullets and **bold** labels. No HTML is ever injected. */
function Answer({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-1 pl-5">
          {bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const line of text.split("\n")) {
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}
