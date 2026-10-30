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
