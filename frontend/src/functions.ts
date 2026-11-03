// The terminal's function codes: short commands typed in the command bar (like "AAPL GP" or "WEI").
// Market functions open a screen; company functions open a tab on the current or named company.

export type MarketFunction = { code: string; aliases: string[]; name: string; path: string };
export type CompanyFunction = { code: string; aliases: string[]; name: string; tab: CompanyTab };

export const COMPANY_TABS = [
  "Overview", "Chart", "Financials", "Ratios", "Health", "Analysts", "Insiders", "News", "DCF", "Comps", "Summary",
] as const;
export type CompanyTab = (typeof COMPANY_TABS)[number];

export const MARKET_FUNCTIONS: MarketFunction[] = [
  { code: "MKTS", aliases: ["HOME", "MAIN"], name: "Markets dashboard", path: "/" },
  { code: "WEI", aliases: ["WORLD", "INDICES"], name: "World markets: indices, currencies, commodities, crypto", path: "/wei" },
  { code: "MOST", aliases: ["MOVERS", "MOV"], name: "Top movers and most traded, US and TSX", path: "/most" },
  { code: "GC", aliases: ["RATES", "CURVE", "YCRV"], name: "Yield curves and policy rates, US and Canada", path: "/rates" },
  { code: "ECO", aliases: ["ECON", "MACRO"], name: "Economic indicators, US and Canada", path: "/eco" },
  { code: "EVTS", aliases: ["ERN", "EARNINGS", "CAL"], name: "Earnings calendar, next two weeks", path: "/earnings" },
  { code: "MON", aliases: ["W", "WATCH", "WATCHLIST"], name: "Monitor: your watchlist", path: "/monitor" },
  { code: "EQS", aliases: ["SCREEN", "SCREENER", "EXPLORE"], name: "Equity screener", path: "/screener" },
  { code: "GAME", aliases: ["MYSTERY"], name: "Mystery Company daily puzzle", path: "/game" },
  { code: "HELP", aliases: ["?", "FUNCTIONS"], name: "List of functions and shortcuts", path: "/help" },
];

export const COMPANY_FUNCTIONS: CompanyFunction[] = [
  { code: "DES", aliases: ["OVERVIEW", "PROFILE"], name: "Description and key statistics", tab: "Overview" },
  { code: "GP", aliases: ["CHART", "GRAPH"], name: "Price chart with technicals and comparison", tab: "Chart" },
  { code: "FA", aliases: ["FINANCIALS", "STATEMENTS"], name: "Financial statements", tab: "Financials" },
  { code: "RATIO", aliases: ["RATIOS", "RAT"], name: "Ratios and growth", tab: "Ratios" },
  { code: "HLTH", aliases: ["HEALTH", "SCORES"], name: "Piotroski, Altman Z and Beneish scores", tab: "Health" },
  { code: "ANR", aliases: ["EE", "ANALYSTS", "ESTIMATES"], name: "Analyst ratings, targets and earnings surprises", tab: "Analysts" },
  { code: "INS", aliases: ["INSIDERS", "INSIDER"], name: "Insider buying and selling", tab: "Insiders" },
  { code: "CN", aliases: ["NEWS"], name: "Company news", tab: "News" },
  { code: "DCF", aliases: ["VALUE"], name: "Discounted cash flow and reverse DCF", tab: "DCF" },
  { code: "RV", aliases: ["COMPS", "PEERS"], name: "Relative value against peers", tab: "Comps" },
  { code: "SUM", aliases: ["SUMMARY"], name: "Valuation summary and tear sheet", tab: "Summary" },
];

const byCode = <T extends { code: string; aliases: string[] }>(list: T[], word: string) =>
  list.find((f) => f.code === word || f.aliases.includes(word));

export const marketFunction = (word: string) => byCode(MARKET_FUNCTIONS, word.toUpperCase());
export const companyFunction = (word: string) => byCode(COMPANY_FUNCTIONS, word.toUpperCase());
export const tabCode = (tab: string) => COMPANY_FUNCTIONS.find((f) => f.tab === tab)?.code ?? "";

export const companyPath = (symbol: string, tab: CompanyTab = "Overview") =>
  `/company/${encodeURIComponent(symbol)}${tab === "Overview" ? "" : `?tab=${tab}`}`;

export type Command = { path: string } | { ask: true } | { search: string } | null;

/**
 * Turns what was typed into somewhere to go:
 *   "WEI"            -> the world markets screen
 *   "AAPL" / "AAPL DES" -> Apple's overview;  "AAPL GP" -> Apple's chart
 *   "GP" on a company page -> that company's chart
 *   "ASK" -> opens Ask Finch
 */
export function parseCommand(text: string, currentSymbol: string | null): Command {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  if (words[0] === "ASK" || words[0] === "AI" || words[0] === "FINCH") return { ask: true };
  if (words.length === 1) {
    const market = marketFunction(words[0]);
    if (market) return { path: market.path };
    const fn = companyFunction(words[0]);
    if (fn && currentSymbol) return { path: companyPath(currentSymbol, fn.tab) };
    if (/^[A-Z0-9.\-^=]{1,15}$/.test(words[0])) return { path: companyPath(words[0]) };
    return { search: text.trim() };
  }
  const fn = companyFunction(words[words.length - 1]);
  const rest = (fn ? words.slice(0, -1) : words).filter((w) => w !== "US" && w !== "EQUITY");
  if (rest.length === 1 && /^[A-Z0-9.\-^=]{1,15}$/.test(rest[0])) return { path: companyPath(rest[0], fn?.tab ?? "Overview") };
  return { search: text.trim() };
}
