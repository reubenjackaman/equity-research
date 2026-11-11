---
name: Value Finch
description: Company research for beginners, laid out as property deed cards on a pale green board.
colors:
  board: "#d6e7da"
  card-stock: "#fdfdf9"
  board-tint: "#eef4ef"
  rule: "#cfd9d1"
  ink: "#16181d"
  ink-soft: "#3f4650"
  muted: "#475158"
  ink-wash: "#e6ece7"
  paper-white: "#ffffff"
  gain: "#137a3f"
  gain-soft: "#e0f1e6"
  loss: "#b8322a"
  loss-soft: "#f8e3e1"
  warn: "#7f5a00"
  warn-soft: "#f8eed2"
  chart-blue: "#1f55b3"
  band-technology: "#1f55b3"
  band-financial-services: "#1d7a46"
  band-healthcare: "#c9352a"
  band-consumer-cyclical: "#e8732a"
  band-consumer-defensive: "#f2b705"
  band-energy: "#7a4424"
  band-industrials: "#6c3d9a"
  band-utilities: "#5fb3e6"
  band-real-estate: "#d64a86"
  band-communication-services: "#13857f"
  band-basic-materials: "#8a9a1e"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "4.25rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 80"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 75"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 800
    lineHeight: 1.5
    letterSpacing: "0.04em"
    fontVariation: "'wdth' 75"
  figure:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.025em"
    fontFeature: "'tnum' 1"
  lead:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.35
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "'tnum' 1"
  table:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  band: "3px"
  control: "6px"
  card: "8px"
  pill: "9999px"
spacing:
  frame-gap: "5px"
  band-inset: "8px"
  row: "6px"
  control-x: "14px"
  gutter: "16px"
  card-pad: "20px"
  section: "40px"
components:
  deed-card:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "0 0 8px"
  deed-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-white}"
    typography: "{typography.title}"
    rounded: "{rounded.band}"
    padding: "8px 12px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-stock}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
  button:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 14px"
  button-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-stock}"
  nav-link:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  nav-link-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-stock}"
  segmented-option:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    padding: "2px 10px"
  segmented-option-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-stock}"
  search-field:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
  ticker-chip:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "4px 12px"
---

# Design System: Value Finch

## Overview

**Creative North Star: "The Deed Card Board"**

Every company is a property deed card a beginner already knows how to read: a coloured band carrying the name, a big price, and a short ruled table of what it is worth. The page is the board those cards sit on, a pale green field; the cards are off-white stock with a dark edge and a thin frame line drawn just inside it. The site refuses both the dark trading-terminal dashboard and the generic white fintech card grid: there is one card anatomy, used for hero movers, index cards, company headers and every content panel alike, so rows compare at a glance.

The system is flat and printed. Colour lives only in the bands; everything a visitor reads is black ink on card stock, set in one family (Archivo) at two widths, condensed heavy caps for card lettering and normal width for reading, with tabular figures everywhere so columns of numbers line up. Interaction is a hard two-state reversal, ink to card and card to ink, never a fade or tint. The signature move is the turn-over: a deed card flips on tap to a back that explains its numbers in plain English, and flips back on a second tap.

Dark mode is the same board at night: deep felt green, dark card stock, light ink, and plain bands that go light with dark lettering. Light is the default; the visitor's choice is remembered under the `vf-theme` key and applied before paint. The printable tear sheet is forced light.

**Key Characteristics:**
- Pale green board ground, off-white card stock, black ink.
- One card anatomy everywhere: dark edge, inset frame line, band, ruled value table.
- Colour only in card bands; sector colour on company pages, plain ink bands elsewhere.
- Archivo only, at 75 to 80% width for lettering and 100% for reading; tabular figures throughout.
- Hard ink/card reversals for hover and active states.
- Cards turn over on tap to explain their numbers.

## Colors

A board-game palette: one green ground, off-white stock, black ink, and a set of flat saturated sector bands that are the only colour on any card.

### Primary
- **Deed Ink** (`ink`): the primary of the whole system. Text, card edges and frame lines (`line-strong` in code), plain bands, the solid primary button, active nav and segmented states, focus rings, text selection, and links. The `--accent` custom property is deliberately set to ink.
- **Soft Ink** (`ink-soft`): the hover colour for an ink-coloured inline link (`--accent-hover`).

### Secondary
- **Sector Bands** (`band-*`): eleven flat saturated colours, one per sector, in `frontend/src/sectors.ts`. A band's lettering is white on the dark bands and ink on the light ones (Consumer Cyclical, Consumer Defensive, Utilities, Basic Materials). Applied by setting `--band` and `--on-band` inline through `bandStyle(sector)`; on a company page the wrapper carries the company's sector, so every panel band on that page takes the sector colour. Anything without a sector gets a plain ink band. Sector bands keep their colour in dark mode.

### Tertiary
- **Gain Green** (`gain`) and **Loss Red** (`loss`), with soft washes (`gain-soft`, `loss-soft`): price moves, chart lines and up/down markers only. Always paired with a sign or a drawn triangle.
- **Caution Ochre** (`warn`, `warn-soft`): warnings and caution notes.
- **Chart Blue** (`chart-blue`, `--info` in code): a data series colour inside charts (index comparison, RSI, SMA overlays). Not used on interface chrome.

### Neutral
- **The Board** (`board`): page ground, the pale green field the cards sit on.
- **Card Stock** (`card-stock`): every card, panel, top bar, footer and control surface; also the lettering on solid ink buttons.
- **Board Tint** (`board-tint`, `--subtle`): quiet hover fill on nav links and menu rows, loading bars, sector chips.
- **Rule** (`rule`, `--line`): the hairlines inside a card's value table and between rows.
- **Muted Ink** (`muted`): row labels, captions, "Tap to turn over" hints, secondary text.
- **Ink Wash** (`ink-wash`, `--accent-soft`): faint neutral fill behind selected or highlighted content.
- **Paper White** (`paper-white`): lettering on dark bands (`--on-band`) and on accent fills (`--on-accent`).

Dark-mode values (in `frontend/src/index.css`, `.dark`) swap every neutral and signal: board `#0e1c15`, card stock `#17221c`, ink `#eef3ef`, and the plain band becomes `#dfe9e2` with `#0e1c15` lettering. They are listed in the sidecar.

### Named Rules
**The Band-Only Colour Rule.** Colour lives in card bands. Everything a visitor reads stays ink on card stock; the only other hues allowed are the gain/loss/caution signals and chart series.

**The Ink Link Rule.** Links are ink with a 3px-offset underline, never a brand colour. Inline links in running text are bold and underlined; the hover darkens to soft ink.

**The Signed Number Rule.** A gain or loss is never carried by colour alone: every change shows a sign (+/-) or a drawn triangle beside the green or red.

## Typography

**Display Font:** Archivo (variable width 62 to 125, weight 400 to 900), with ui-sans-serif, system-ui fallback
**Body Font:** Archivo at normal width
**Label/Mono Font:** none distinct; the old monospace role now resolves to Archivo with tabular figures

**Character:** One grotesk doing two jobs. Squeezed to 75% width at weight 800 and set in caps, it is the lettering printed on a deed card; at full width and weight 400 it is a calm reading face. Tabular figures are on for the whole body so prices and tables align.

### Hierarchy
- **Display** (800, 80% width, 4.25rem at 640px and up, 3.5rem below, line-height 0.95): the home hero headline only, sentence case, held to about 17ch.
- **Headline** (800, 75% width, uppercase, 0.02em tracking, 2.5rem, 1.05): section and page titles ("How the markets did today") and company names in the company header (up to 3.5rem there).
- **Title / Band** (800, 75% width, uppercase, 0.04em tracking, 0.875rem): the lettering inside every band; the hero deed cards set the company name at 1.1875rem.
- **Figure** (800, -0.025em, 2.5rem on cards, 3.5rem in the company header): the big price or index level on a card face.
- **Lead** (400, 1.1875rem, 1.35): the hero sentence and other one-sentence introductions.
- **Body** (400, 1rem, 1.6, max 65ch): reading text and explanations.
- **Table** (400 label / 600 value, 0.875rem, 1.5): ruled value tables; labels muted on the left, values semibold on the right.
- **Label** (400, 0.8125rem, 1.4): captions, hints, column heads, footnotes.

Headings h1 to h3 default to weight 750, -0.01em tracking and balanced wrapping.

### Named Rules
**The Two Widths Rule.** One family, two widths: condensed heavy caps for anything that is a card's lettering (bands, card titles, section headlines, the wordmark), normal width for everything read as sentences or numbers.

## Layout

Pages sit in a centred container up to 1536px wide with 16px side gutters. Content is organised as cards on the board: card grids use 16px gaps (12px for denser panel pairs), sections are separated by 40 to 64px. The home first viewport is a two-column split at 1024px and up (text and search on the left, a fanned hand of three deed cards on the right, at most 46rem wide); below 1024px it stacks and the hand becomes a horizontal snap-scrolling row of cards at 68vw each. Index cards run four across at 1024px and up, two across below. Market board screens use a 12-column grid with 4-column panels. Company sections switch through a horizontally scrolling row of tabs.

Breakpoints follow Tailwind: 640px, 1024px, 1280px. At phone width (639px and below) every button, select, input and `.tap` element is at least 44px tall. Reading text is held to 65ch.

A deed card in the turn-over form keeps a playing-card proportion (5:7); index cards use 3:4 on phones and 5:4 from 640px.

## Elevation & Depth

The system is flat. Cards are printed objects lying on the board; their depth is drawn, not cast: a 1.5px ink edge plus a 1px ink frame line inset 5px inside it (two inset box-shadows). Shadows are reserved for things that leave the board.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 2px 6px rgb(22 24 29 / 0.12)`): the fanned hand of hero cards, dropdown menus (search suggestions, Saved), and the floating Ask Finch button.
- **Frame** (`box-shadow: inset 0 0 0 5px var(--surface), inset 0 0 0 6px var(--line-strong)`): the inset frame line on every deed card and panel. Structural, not elevation.

### Named Rules
**The Lying Flat Rule.** Cards on the board cast no shadow; only a dealt hand, a menu or a floating control lifts, and only with the soft Lift shadow.

## Shapes

Gently rounded, card-like. Cards have 8px corners and a 1.5px ink edge with the inset frame line; bands sit 8px in from the card edge with 3px corners, so the band reads as printed onto the card. Buttons, nav links, chips, segmented controls and the search field use 6px corners and the same 1.5px ink border. The large hero search uses 8px. Fully round shapes are kept to small markers (range dots, the market-open dot) and the floating Ask Finch pill. On the home page the three hero cards are fanned at -5deg, 0 and 5deg, with the centre card raised.

## Components

### Buttons
Solid and unambiguous, like a stamped label.
- **Shape:** 6px corners, 1.5px ink border.
- **Primary:** solid ink with card-stock lettering, weight 700, 8px 16px padding. Used for the one main action in a context (Research on a card back, the search submit).
- **Hover / Focus:** a hard reversal to card stock with ink lettering. Focus shows a 2px ink outline at 2px offset.
- **Secondary:** card stock with ink lettering, weight 600, 6px 14px padding; hover reverses to solid ink. Disabled is 50% opacity.

### Chips
- **Style:** example-ticker chips on the hero ("Apple", "Shopify") are card stock with a 1.5px ink border, 6px corners, semibold; hover reverses to ink. Sector tags on company pages are quiet board-tint fills.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** card stock.
- **Shadow Strategy:** the inset Frame only; Lift only for the hero hand.
- **Border:** 1.5px ink edge.
- **Internal Padding:** content sits 8px in from the edge (inside the frame) plus 12 to 16px of its own; standalone `.card` blocks use 20px.

### Inputs / Fields
- **Style:** the company search is card stock with a 1.5px ink border and a drawn magnifier; the submit button is a solid ink segment inside the field. Hero size is 8px-cornered with 1.125rem text; the top-bar size is 6px-cornered with a `/` key hint.
- **Focus:** a 2px ink outline at 2px offset around the whole field.
- **Suggestions:** a card-stock list with a 1.5px ink border and the Lift shadow; the active row takes board tint.

### Navigation
- **Style:** a sticky card-stock top bar with a 1.5px ink bottom rule, the birdhouse mark and condensed caps wordmark, plain-word links (Markets, Movers, Screener, Learn, Puzzle, Help) in semibold 0.875rem.
- **States:** hover takes board tint; the current page is a solid ink block with card-stock lettering. Company section tabs follow the same ink-block active state.
- **Mobile:** links drop below the bar into a horizontally scrolling row; search goes full width.

### Segmented Control
A row of options inside one 1.5px ink-bordered, 6px-cornered strip (chart ranges, US/Canada). The selected option is solid ink with card-stock lettering; others take board tint on hover.

### Deed Card (signature)
One anatomy for every company, index and panel: band (sector colour or ink) carrying the name in condensed caps; ticker and signed day change; the big figure; a ruled table of muted labels and semibold values; a muted "Tap to turn over" hint. The whole card is a button. Tapping turns it over in 480ms with `cubic-bezier(0.16, 1, 0.3, 1)` around the vertical axis (instant for reduced motion) to a back headed "What these numbers mean", listing each figure with a plain-English sentence. Tapping anywhere on the back turns it back; the only other control on the back is the primary Research button. Content panels (`Panel`) use the same card and band without the flip.

## Do's and Don'ts

### Do:
- **Do** put colour in the band and nowhere else on a card; set it with `bandStyle(sector)`, on the page wrapper for a company page.
- **Do** use the same card anatomy (edge, inset frame, band, figure, ruled table) for every new company, index or data panel.
- **Do** make hover and active states a hard reversal between ink and card stock.
- **Do** sign every change (+/-) or pair it with a drawn triangle, alongside the gain/loss colour.
- **Do** draw icons as inline SVG in one stroke weight that inherit the text colour, as in `Icons.tsx`.
- **Do** keep 44px minimum touch targets at phone width and respect reduced motion on the flip and ticker tape.

### Don't:
- **Don't** colour links, headings or body text; links are ink and underlined.
- **Don't** add a turn-back button to a card; the second tap on the back turns it over.
- **Don't** use typographic glyphs (arrows, triangles, stars typed as characters) as icons.
- **Don't** put small uppercase eyebrow labels above headings; the band is the only label a card carries.
- **Don't** cast shadows from cards lying on the board, and don't use hard offset shadows anywhere.
- **Don't** introduce a second typeface or a monospace; figures use Archivo's tabular numerals.
- **Don't** fade or tint on hover; reverse.
