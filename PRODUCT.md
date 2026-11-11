# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: beginner investors, ordinary people learning how to research and value a listed company, often for the first time. They arrive curious, not fluent in finance jargon, and are easily put off by screens that look built for professionals. (Confirmed by the owner, November 2026.)

Secondary, carried over from the current product copy: students preparing stock pitches for class, competitions or interviews; and people judging Reuben's work (the site doubles as a portfolio piece, so it must look accomplished).

## Product Purpose

Value Finch is a free equity research site for US and Canadian (TSX) companies, about 2,750 of them. A visitor can look up a company, read its statements, ratios and health scores with plain-English explanations, value it with a DCF and comparable companies, follow world markets, and turn their work into a stock pitch. Every figure shows how it was calculated.

Success for the redesign: a beginner lands, understands what the site does within seconds, and feels capable rather than intimidated; and the site impresses anyone who sees it.

## Positioning

Free, no account, and educational by construction: every number explains itself ("What's this?"), and an AI analyst, Ask Finch, answers questions about the data on screen. Professional depth (statements, DCF, comps, insiders, yield curves) with beginner-grade explanation.

## Operating Context

Visitors search by company name or ticker, move between a company's sections (overview, chart, financials, ratios, health, analysts, insiders, news, DCF, comps, summary, pitch), check market overviews, play the daily Mystery Company puzzle, and export PDFs, Excel files and printable tear sheets.

## Capabilities and Constraints

- React 18 + Vite + TypeScript + Tailwind CSS v4 frontend; FastAPI backend. Data from Yahoo Finance, SEC EDGAR, FRED, Bank of Canada, Finnhub and Wikipedia; delayed and end-of-day.
- The terminal command line and function codes (`AAPL GP`, `WEI`) are not a brand commitment and may be removed or demoted; routes and features stay.
- The printable tear sheet must stay printable in light colours.
- Educational only, never investment advice; that disclaimer stays visible.

## Brand Commitments

- The name **Value Finch** and the finch mascot / birdhouse mark stay (the owner made this binding).
- "A project by Reuben Jackaman" credit stays.

## Evidence on Hand

Real live market and company data through the app's own API. No testimonials, user counts, press or partnerships exist; none may be invented.

## Product Principles

1. Explain before impressing: every number earns a plain-English reason.
2. Calm confidence: depth is available, never forced on a first-timer.
3. Show the real data doing its job rather than describing it.
4. Honest by default: sources, delays and "not advice" are always visible.

## Accessibility & Inclusion

Beginners on phones and laptops; WCAG AA contrast, 44px touch targets at phone width, meaning never carried by colour alone (gains and losses always signed).
