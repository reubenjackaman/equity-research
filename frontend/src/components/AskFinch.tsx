import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { AskMessage, DcfAssumptions, askApi } from "../api";
import { keys, load } from "../storage";
import { OPEN_ASK } from "./CommandBar";
import { FinchLogo } from "./Finch";

/** Starter questions for each tab, so it's clear what the assistant can do. */
const STARTERS: Record<string, string[]> = {
  Markets: ["What stands out in markets today?", "What does the yield curve say about the economy?", "Which big companies report earnings this week?"],
  World: ["How are global markets doing this month?", "Why might gold and the US dollar move together?", "What is the VIX telling us?"],
  Movers: ["What do today's biggest movers have in common?", "Is the market broadly up or down today?"],
  Rates: ["Is the yield curve inverted?", "How do Canadian yields compare with US yields?", "What does a steepening curve mean for banks?"],
  Economy: ["Is inflation cooling in the US and Canada?", "How strong is the US job market?", "What might the Fed and Bank of Canada do next?"],
  Earnings: ["Which companies report this week?", "What does an earnings surprise mean for a stock?"],
  Monitor: ["Explain what moves a watchlist day to day.", "What should I look at first on a company page?"],
  Screener: ["What is a low P/E a sign of?", "How do I screen for quality dividend stocks?"],
  Chart: ["What does the chart say about the trend?", "Explain RSI and moving averages here.", "How has it done against the index?"],
  Analysts: ["What do analysts think of it?", "How has it done against earnings estimates?", "When is the next earnings report?"],
  Insiders: ["Are insiders buying or selling?", "Should insider selling worry me?"],
  Pitch: ["What's the strongest bull case?", "What's the strongest bear case?", "What target price can the data support?"],
  Overview: ["Is it overvalued or undervalued?", "How is it valued against competitors?", "What are the main risks?"],
  Financials: ["How has revenue grown?", "Is free cash flow keeping up with net income?", "How much debt does it carry?"],
  Ratios: ["Which ratios stand out, and why?", "Are margins improving?", "How do its returns compare with peers?"],
  Health: ["What does the Piotroski score say?", "Explain the Altman Z-score here.", "Is the Beneish score a concern?"],
  News: ["Summarize the recent headlines.", "What themes come up in the news?"],
  DCF: ["Why is the DCF value different from the price?", "What growth is priced in?", "Which assumption matters most?"],
  Comps: ["How does it compare with its peers?", "Which multiple looks most different from peers?"],
  Summary: ["Is it overvalued or undervalued?", "How do today's multiples compare with history?"],
};

/** "Ask Finch": an AI assistant beside the page. On a company page it knows that company and tab;
 *  on a market screen (no symbol) it knows the markets, movers, rates, economy and earnings calendar. */
export default function AskFinch({ symbol = "", name = "", tab }: { symbol?: string; name?: string; tab: string }) {
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

  // Typing ASK in the command bar opens the panel.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_ASK, onOpen);
    return () => window.removeEventListener(OPEN_ASK, onOpen);
  }, []);

  // On wide screens the panel sits beside the page instead of on top of it (see .ask-open in index.css).
  useEffect(() => {
    document.documentElement.classList.toggle("ask-open", open);
    return () => document.documentElement.classList.remove("ask-open");
  }, [open]);

  // Start gathering the company's data as soon as the panel opens, so the first answer has it all.
  // The server caches each result; the responses themselves aren't needed here.
  useEffect(() => {
    if (!open || !symbol) return;
    const t = encodeURIComponent(symbol);
    const peers = (load<string[] | null>(keys.peers(symbol), null) ?? []).join(",");
    for (const path of ["ratios", `comps?peers=${encodeURIComponent(peers)}`, "health", "valuation-history", "news", "estimates", "insiders"]) {
      fetch(`/api/company/${t}/${path}`).catch(() => {});
    }
    fetch(`/api/company/${t}/dcf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assumptions: load<Partial<DcfAssumptions>>(keys.dcf(symbol), {}) }),
    }).catch(() => {});
  }, [open, symbol]);

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
        assumptions: symbol ? load<Partial<DcfAssumptions>>(keys.dcf(symbol), {}) : {},
        peers: symbol ? load<string[] | null>(keys.peers(symbol), null) ?? [] : [],
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
        className="fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-sm border border-accent bg-surface py-1.5 pr-3 pl-2 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-accent hover:text-on-accent"
      >
        <FinchLogo className="h-5 w-5 text-accent" />
        <span className="font-mono text-xs font-semibold tracking-wider">ASK FINCH</span>
        <span className="hidden text-xs text-muted sm:inline">AI</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Ask Finch"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[55vh] flex-col border-t border-line-strong bg-surface shadow-sm lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:top-0 lg:w-[26rem] lg:border-t-0 lg:border-l lg:shadow-none"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line bg-subtle px-3 py-1.5">
        <div className="flex items-center gap-2">
          <FinchLogo className="h-5 w-5 text-accent" />
          <div>
            <h2 className="font-mono text-xs font-semibold tracking-wider text-accent">ASK FINCH · AI</h2>
            <p className="text-xs text-muted">{symbol ? `About ${name}, using the ${tab} tab` : `Markets, using the ${tab} screen`}</p>
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
              {symbol
                ? `Ask anything about ${symbol}: valuation, competitors, risks, or what a number means. Finch reads everything the site has on the company, plus analyst ratings, insider trades and recent news.`
                : "Ask about the markets: indices, currencies, commodities, yields, the economy, today's movers or upcoming earnings. Finch reads the data on these screens."}
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
        {busy && <p className="font-mono text-xs text-muted">Reading the data<span className="animate-pulse">…</span></p>}
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
          AI-generated from the site's data and general knowledge. It can make mistakes and isn't investment advice.
        </p>
      </form>
    </aside>
  );
}

/** Renders the assistant's plain-text answer: paragraphs, "- " bullets and **bold** labels. No HTML is ever injected. */
export function Answer({ text }: { text: string }) {
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
