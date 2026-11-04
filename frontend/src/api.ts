// Every call to the backend lives here, with the shape of the data it returns.

export type SearchResult = { symbol: string; name: string; exchange: string };

export type Overview = {
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  website: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  sharesOutstanding: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  volume: number | null;
  averageVolume: number | null;
  dividendYield: number | null; // already in percent, e.g. 0.45 means 0.45%
  beta: number | null;
  targetLow: number | null; // analysts' 12-month price targets
  targetMean: number | null;
  targetHigh: number | null;
  analystCount: number | null;
  profileSource: string; // "Yahoo Finance", or the fallback sources used on servers Yahoo blocks
};

export type PricePoint = { time: string; close: number };
export type Range = "1M" | "6M" | "1Y" | "5Y";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).detail ?? message;
    } catch {}
    throw new ApiError(res.status, message);
  }
  return res.json();
}

export const api = {
  search: (q: string, signal?: AbortSignal) =>
    get<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`, signal),
  overview: (ticker: string) =>
    get<Overview>(`/api/company/${encodeURIComponent(ticker)}/overview`),
  history: (ticker: string, range: Range) =>
    get<PricePoint[]>(`/api/company/${encodeURIComponent(ticker)}/history?range=${range}`),
};

export type Period = "annual" | "quarterly";
export type StatementKey = "income" | "balance" | "cashflow";

export type StatementRow = {
  key: string;
  label: string;
  values: (number | null)[];
  sources: (string | null)[]; // where each value came from, shown on hover
  format: "money" | "perShare" | "shares";
  bold: boolean;
  indent: boolean;
  formula: string | null; // set for calculated rows
};

export type Statements = {
  symbol: string;
  period: Period;
  currency: string; // reporting currency (can differ from the trading currency)
  source: string;
  columns: { end: string; label: string }[];
  statements: Record<StatementKey, StatementRow[]>;
};

export const statementsApi = {
  get: (ticker: string, period: Period) =>
    get<Statements>(`/api/company/${encodeURIComponent(ticker)}/statements?period=${period}`),
  excelUrl: (ticker: string, period: Period) =>
    `/api/company/${encodeURIComponent(ticker)}/statements.xlsx?period=${period}`,
};

export type RatioRow = {
  key: string;
  label: string;
  category: string;
  format: "pct" | "x" | "days";
  formula: string;
  explanation: string;
  values: (number | null)[];
  calcs: (string | null)[]; // the actual inputs, e.g. "180,683 ÷ 391,035"
};

export type Cagr = { value: number; calc: string; span: string } | null;

export type Ratios = {
  symbol: string;
  currency: string;
  columns: { label: string; end: string }[];
  ratios: RatioRow[];
  cagr: { key: string; label: string; formula: string; cagr3: Cagr; cagr5: Cagr }[];
  notes: string[];
  source: string;
};

export const ratiosApi = {
  get: (ticker: string) => get<Ratios>(`/api/company/${encodeURIComponent(ticker)}/ratios`),
};

export type Article = {
  headline: string;
  source: string | null;
  url: string;
  published: string; // ISO date-time
  summary?: string | null;
  about: boolean; // the headline names the company (vs. a passing mention)
};

export type News = { articles: Article[]; sources: string[]; matchName: string; errors: string[] };

export const newsApi = {
  get: (ticker: string) => get<News>(`/api/company/${encodeURIComponent(ticker)}/news`),
};

export type DcfAssumptions = {
  years: number;
  growth_start: number; // decimals: 0.05 = 5%
  growth_end: number;
  margin_target: number;
  tax_rate: number;
  da_pct: number;
  capex_pct: number;
  nwc_pct: number;
  terminal_growth: number;
  risk_free: number;
  beta: number;
  erp: number;
  cost_of_debt: number;
  wacc_override: number | null; // null = use the CAPM build-up
};

export type DcfYear = {
  label: string;
  revenue: number;
  growth: number | null;
  margin: number;
  ebit: number;
  taxes?: number;
  nopat?: number;
  da: number | null;
  capex: number | null;
  nwc: number | null;
  dNwc: number | null;
  fcf?: number;
  discount?: number;
  pv?: number;
};

export type Dcf = {
  symbol: string;
  name: string;
  currency: string;
  tradingCurrency: string;
  fx: number;
  price: number | null;
  balanceAsOf: string;
  marketCap: number | null;
  source: string;
  assumptions: DcfAssumptions;
  defaults: DcfAssumptions;
  warnings: string[]; // plain-English flags, e.g. loss-making company or negative equity value
  years: number;
  wacc: { costOfEquity: number; afterTaxCostOfDebt: number; equityWeight: number; debtWeight: number; computed: number; used: number };
  history: DcfYear[];
  forecast: DcfYear[];
  valuation: {
    pvFcf: number;
    terminalValue: number;
    pvTerminal: number;
    enterpriseValue: number;
    debt: number;
    cash: number;
    equityValue: number;
    shares: number;
    perShare: number | null;
    perShareTrading: number | null;
    price: number | null;
    upside: number | null;
    terminalShare: number | null;
  } | null;
  sensitivity: { waccs: number[]; growths: number[]; values: (number | null)[][] };
  /** Reverse DCF: the flat annual revenue growth that makes the DCF value equal today's price. */
  reverse: {
    growth: number | null;
    reason: string | null; // why there's no answer, when growth is null
    years: number;
    cagr: { y3?: { value: number; span: string }; y5?: { value: number; span: string } };
  };
};

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).detail ?? message;
    } catch {}
    throw new ApiError(res.status, message);
  }
  return res;
}

export const dcfApi = {
  run: async (ticker: string, assumptions: Partial<DcfAssumptions>, signal?: AbortSignal) =>
    (await post(`/api/company/${encodeURIComponent(ticker)}/dcf`, { assumptions }, signal)).json() as Promise<Dcf>,
  excel: async (ticker: string, assumptions: Partial<DcfAssumptions>) =>
    (await post(`/api/company/${encodeURIComponent(ticker)}/dcf.xlsx`, { assumptions })).blob(),
};

export type CompRow = {
  symbol: string;
  name: string;
  industry: string | null;
  period: string;
  reportingCurrency: string;
  warning: string | null;
  marketCapUsd: number | null;
  [metric: string]: number | string | null;
};

export type Comps = {
  symbol: string;
  basis: string | null;
  suggested: string[];
  metrics: { key: string; label: string; format: "x" | "pct" }[];
  target: CompRow;
  peers: CompRow[];
  failed: string[];
  excluded: string[];
  stats: { median: Record<string, number | null>; mean: Record<string, number | null> };
  implied: {
    key: string;
    label: string;
    formula: string;
    medianMultiple: number | null;
    value: number | null; // at the peer median
    lowMultiple: number | null; // 25th percentile of peers
    highMultiple: number | null; // 75th percentile of peers
    low: number | null;
    high: number | null;
    upside: number | null;
  }[];
};

export const compsApi = {
  get: (ticker: string, peers: string[] | null) =>
    get<Comps>(`/api/company/${encodeURIComponent(ticker)}/comps${peers ? `?peers=${encodeURIComponent(peers.join(","))}` : ""}`),
};

export type ScreenerFilters = {
  country: "us" | "ca";
  sector: string;
  industry: string;
  cap: string; // "", mega, large, mid, small, micro
  pe: string; // "", under15, 15to25, over25
  dividend: string; // "", any, over2, over4
  growth: string; // "", over10, over25, negative
  sort: string; // marketcap, change, pe, dividend, growth
};

export type ScreenerRow = {
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string | null;
  price: number | null;
  changePercent: number | null;
  marketCap: number | null;
  pe: number | null;
  dividendYield: number | null; // percent
  yearChangePercent: number | null;
};

export const screenerApi = {
  options: () => get<Record<string, string[]>>("/api/screener/options"),
  run: (f: ScreenerFilters, signal?: AbortSignal) =>
    get<{ total: number; results: ScreenerRow[]; note: string | null }>(`/api/screener?${new URLSearchParams(f).toString()}`, signal),
};

export type Clue = "match" | "miss" | "higher" | "lower" | "unknown";

export type GameCompany = {
  symbol: string;
  name: string;
  sector: string;
  country: string;
  marketCapUsd: number | null;
  pe: number | null;
  dividendYield: number;
  yearChangePercent: number | null;
};

export type GameGuess = {
  guess: GameCompany;
  clues: Record<"sector" | "country" | "marketCap" | "pe" | "dividend" | "yearReturn", Clue>;
  correct: boolean;
  answer: GameCompany | null; // only sent once the game is over
};

export type GameHintKind = "news" | "product" | "industry" | "letter";

export type GameHint = {
  kind: GameHintKind;
  label: string;
  text: string; // hidden words are already blacked out by the server
  attempt: number; // which of the six turns it used up
};

export type GameToday = {
  puzzle: number;
  maxGuesses: number;
  snapshotDate: string;
  companies: { symbol: string; name: string }[];
};

export const gameApi = {
  today: () => get<GameToday>("/api/game/today"),
  hint: (puzzle: number, kind: GameHintKind) => get<Omit<GameHint, "attempt">>(`/api/game/hint?puzzle=${puzzle}&kind=${kind}`),
  guess: (puzzle: number, attempt: number, symbol: string) =>
    get<GameGuess>(`/api/game/guess?puzzle=${puzzle}&attempt=${attempt}&symbol=${encodeURIComponent(symbol)}`),
};

export type HealthComponent = { key: string; formula: string; value: number | null; calc: string | null };

export type Health = {
  symbol: string;
  currency: string;
  year: string; // latest fiscal year, e.g. "FY2025"
  priorYear: string;
  source: string;
  financial: boolean; // bank or insurer: several scores don't apply
  piotroski: {
    score: number;
    available: number; // tests that could be run (out of 9)
    tests: { key: string; label: string; group: string; pass: boolean | null; detail: string }[];
    caution: string | null;
  };
  altman: {
    value: number | null;
    zone: "safe" | "grey" | "distress" | null;
    components: (HealthComponent & { weight: number })[];
    reason: string | null;
    caution: string | null;
  };
  beneish: {
    value: number | null;
    flag: boolean | null; // true = above -1.78
    components: (HealthComponent & { label: string; coef: number })[];
    reason: string | null;
    caution: string | null;
  };
  accruals: { value: number | null; calc: string | null };
};

export const healthApi = {
  get: (ticker: string) => get<Health>(`/api/company/${encodeURIComponent(ticker)}/health`),
};

export type MultipleHistory = {
  key: "pe" | "ev_ebitda" | "ps";
  label: string;
  points: { label: string; value: number }[]; // one per fiscal year, at the year-end share price
  current: number | null; // today's (TTM) value
  currentLabel: string | null;
  mean: number | null;
  sd: number | null;
  z: number | null; // standard deviations today's value sits from the average
  reason: string | null; // why there's no average or no comparison
  caution: string | null; // the history swings so much the average isn't a reliable guide
};

export const valuationHistoryApi = {
  get: (ticker: string) =>
    get<{ symbol: string; multiples: MultipleHistory[]; source: string }>(`/api/company/${encodeURIComponent(ticker)}/valuation-history`),
};

export type AskMessage = { role: "user" | "model"; text: string };

export const askApi = {
  ask: async (body: {
    symbol: string;
    tab: string;
    question: string;
    history: AskMessage[];
    assumptions: Partial<DcfAssumptions>;
    peers: string[];
  }) => (await post("/api/ask", body)).json() as Promise<{ answer: string }>,
};

// ---------- Terminal: market screens ----------

export type BoardQuote = {
  symbol: string;
  label: string;
  value: number | null;
  change: number | null;
  changePercent: number | null;
  changeBp?: number; // yields: the daily move in basis points
  monthChangePercent?: number | null;
  date?: string;
  spark: number[];
};
export type BoardGroup = { group: string; items: BoardQuote[] };

export type Mover = {
  symbol: string;
  name: string;
  sector: string | null;
  currency: string | null;
  price: number;
  changePercent: number;
  volume: number;
  dollarVolume: number;
  marketCap: number | null;
};
export type MoversSet = { gainers: Mover[]; losers: Mover[]; active: Mover[]; advancing: number; declining: number; universe: number };
export type Movers = { us: MoversSet; ca: MoversSet };

export type CurvePoint = { tenor: string; now: number; monthAgo: number | null; yearAgo: number | null };
export type Rates = {
  us: { date: string; points: CurvePoint[] };
  ca: { date: string; points: CurvePoint[] };
  spread: { label: string; points: { time: string; value: number }[] };
  policy: { label: string; value: number | null; date: string | null }[];
};

export type EconomyItem = { label: string; unit: string; value: number; date: string; previous: number | null; spark: number[] };
export type Economy = { country: string; items: EconomyItem[] }[];

export type EarningsEvent = {
  date: string;
  hour: string;
  symbol: string;
  name: string;
  sector: string | null;
  marketCap: number;
  epsEstimate: number | null;
  revenueEstimate: number | null;
  quarter: number | null;
  year: number | null;
};

export const marketsApi = {
  board: () => get<BoardGroup[]>("/api/markets/board"),
  movers: () => get<Movers>("/api/markets/movers"),
  rates: () => get<Rates>("/api/markets/rates"),
  economy: () => get<Economy>("/api/markets/economy"),
  earnings: () => get<EarningsEvent[]>("/api/markets/earnings"),
};

// ---------- Terminal: company functions ----------

export type BarRange = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX";
export type Bar = { time: string | number; open: number; high: number; low: number; close: number; volume: number };
export type Bars = { symbol: string; range: BarRange; intraday: boolean; bars: Bar[] };

export type InsiderTrade = {
  date: string;
  filed: string | null;
  name: string;
  code: string;
  type: string;
  shares: number;
  price: number | null;
  value: number | null;
  held: number | null;
  derivative: boolean;
};
export type Insiders = {
  symbol: string;
  source: string;
  days: number;
  note: string | null;
  summary: { buys: number; sells: number; buyValue: number; sellValue: number; buyers: number; sellers: number; netShares: number };
  transactions: InsiderTrade[];
};

export type RatingMonth = { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number };
export type Surprise = {
  period: string;
  year: number;
  quarter: number;
  estimate: number | null;
  actual: number | null;
  surprise: number | null;
  surprisePercent: number | null;
};
export type Estimates = {
  symbol: string;
  ratings: RatingMonth[];
  surprises: Surprise[];
  next: { date: string; hour: string; epsEstimate: number | null; revenueEstimate: number | null; quarter: number; year: number } | null;
  targets: { low: number | null; mean: number | null; high: number | null; analysts: number | null; currency: string | null; price: number | null } | null;
};

export const companyApi = {
  bars: (ticker: string, range: BarRange) => get<Bars>(`/api/company/${encodeURIComponent(ticker)}/bars?range=${range}`),
  insiders: (ticker: string) => get<Insiders>(`/api/company/${encodeURIComponent(ticker)}/insiders`),
  estimates: (ticker: string) => get<Estimates>(`/api/company/${encodeURIComponent(ticker)}/estimates`),
};

// ---------- Plain-English insights and the pitch builder ----------

export type Insight = { topic: string; tone: "good" | "bad" | "neutral"; text: string; learn: string };
export type Insights = { symbol: string; insights: Insight[]; skipped: string[] };

export const insightsApi = {
  get: (ticker: string) => get<Insights>(`/api/company/${encodeURIComponent(ticker)}/insights`),
};

type PitchRequest = { symbol: string; pitch: object; assumptions: Partial<DcfAssumptions>; peers: string[] };
export const pitchApi = {
  draft: async (body: PitchRequest & { section: string }) => (await post("/api/pitch/draft", body)).json() as Promise<{ text: string }>,
  critique: async (body: PitchRequest) => (await post("/api/pitch/critique", body)).json() as Promise<{ text: string }>,
};
