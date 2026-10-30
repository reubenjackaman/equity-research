# Value Finch design notes

Status: implemented. Small data labels use 13px, one step below the 14px planned, because 14px did not fit the tiles.

## How the site is built

- React 18, Vite and TypeScript, with Tailwind CSS v4.
- Styles are Tailwind classes written directly in 20 component and page files. `src/index.css` holds the `.card` and `.btn` classes, and there is no shared colour system.
- Dark mode uses a `dark` class on `<html>`. The printable tear sheet is forced to light.
- Chart colours are hard-coded hex values in `PriceChart`, `CompsTab` and `TearSheet`.

## 1. AI-looking patterns found

Counts are occurrences in `frontend/src`.

### Colour
- Default Tailwind colours everywhere: `slate` 483 times, `blue` 58, `pink`/`orange` 28, `amber` 28.
- Pink-to-orange gradients on the Play Game button, Mystery Company card, Share button and win banner (6 gradient uses in total).
- Gradient text on the "Value Finch" home page title.
- No single source of truth: colours are spread across class names, plus 27 raw hex values.

### Type
- Inter is named as the only font but is never loaded, so visitors get their system font.
- No type scale: 19 arbitrary sizes such as `text-[10px]`.
- Small uppercase, letter-spaced labels used as decoration (9 places).
- Hierarchy relies on grey text more than on size and weight.
- Emoji in the interface: ⚠ in Comps, ✓ and ✕ on the game result.

### Layout
- Home page is entirely centred: logo, title, text, search, pills and card.
- Sector picker is a grid of identical boxes.
- Everything sits in the same bordered card, so pages read as stacked equal blocks.
- Inconsistent corners: `rounded-sm`, `rounded`, `-md`, `-lg`, `-xl`, `-2xl` and `-full` are all used.
- Pill-shaped ticker chips.
- Tap targets are often under 44px, including the theme toggle, tabs, filters and small buttons.

### Effects
- 16 shadows, including heavier ones on the game button, home card and win screen.
- Blurred translucent top bar (`backdrop-blur`).
- `result-pop` scale animation on the win card and `hover:brightness` on buttons.
- Multi-colour mascot artwork with gradients, which competes with the content.

### Copy
- No banned buzzwords found. "Leverage" appears only as the correct name of a ratio category.
- Some lines are too cute for this audience (see "Lines to review" below).

## 2. Design direction

**An independent research note, not a software product.** The reference is a well-set annual report or a small advisory firm's site: warm paper, serif headings, thin rules, tables that feel typeset, and very little colour.

### Colour
All colours become CSS variables in `index.css`, mapped into the Tailwind theme.

| Role | Light | Dark | Contrast on page background |
|---|---|---|---|
| Background | `#FAF8F5` | `#181513` | n/a |
| Raised surface | `#FFFDFA` | `#211D1A` | n/a |
| Subtle fill | `#F1ECE6` | `#2B2622` | n/a |
| Text | `#1F1B1A` | `#F0EAE4` | 16.1 / 15.2 |
| Secondary text | `#5E5450` | `#B5A9A2` | 6.9 / 7.9 |
| Accent (oxblood) | `#7A2E2A` | `#DDA096` | 8.8 / 8.3 |
| Gain | `#2C6549` | `#7FBF9E` | 6.5 / 8.5 |
| Loss | `#9C3B1B` | `#E8A07F` | 6.5 / 8.5 |

All of these pass AA on all three backgrounds, in both themes. White on the accent button is 9.2:1.

- Oxblood is the accent because a house finch is rosy red, so the name and colour belong together. It's used for links, the one solid button style and small highlights.
- Greys are tinted warm, toward the accent.
- Gain and loss are data colours, not accents. They always carry a + or − sign, so meaning never depends on colour alone.

### Type
- Headings: **Source Serif 4**. Body and data: **IBM Plex Sans**, which has clear tabular numbers. Both load from Google Fonts.
- Scale at a ratio of about 1.25: 14, 17, 21, 27, 33, 42, 52px.
- Reading text 17px at 1.6 line-height, capped at about 65 characters.
- Headings at 1.1 to 1.25 line-height, in sentence case, with slight negative tracking at large sizes.
- Exception: dense tables stay at 14px, because statements need the width.

### Layout
- 8px spacing scale, with deliberately varied section spacing.
- One radius across the site: 4px. No pills.
- 1px rules and whitespace replace shadows and most cards. Statements and ratios look like printed tables.
- Solid top bar with a thin bottom rule, no blur.
- Home becomes a left-aligned, asymmetric layout: name and plain statement of purpose on the left, search and today's market on the right, then a ruled sector index instead of a card grid.
- All controls reach 44px at phone width.

### Identity
- The finch stays but is redrawn as a flat, single-colour mark, like a printer's mark.
- The birdhouse home button becomes the same style of line mark.
- The hint finch with its lightbulb stays as one small flat drawing, and only in the game.

### Motion
- Only 150ms colour changes on links and buttons. No pop animation or scroll effects.

### Pages covered
Home, Company with all tabs, Tear Sheet, Game, the five info pages, the not found page, the footer and the top bar. Charts and the football field move to the new palette. Dark mode is kept, using the same variables.

## Decisions needing your input

1. **Personal site or product:** the brief calls this a personal site, but it's currently a research tool with an About page. The plan keeps it as Value Finch and adds a stronger "A project by Reuben Jackaman" line. A true personal site would need a résumé-style home page and content from you.
2. **Play Game button:** you asked for hot pink-orange so people would notice it. This brief removes those colours, so it becomes the single solid oxblood button.
3. **Finch colour:** the pink-orange finch from the last round becomes flat oxblood.
4. **Share grid:** I'd keep 🟩 and ⬆️ in the copied game result, since that's text for group chats, not the site design.
5. **Photo:** a real headshot on the About page would help a lot. I can't create one, so that needs a photo from you.

## Lines to review

- About: "Why I made this", written by me in your voice. Only you know if it's true.
- About: "Why a finch?" is light-hearted and could be cut for recruiters.
- About: the founder line. A sentence on your school and interests would be stronger, but I won't guess.
- Home card: "Can you read the numbers?" could become plain: "Guess the company from its financials."
- Not found page: "This finch flew off" and "Back to the nest" could become plain.
- Privacy: must be updated, because Google Fonts adds a request to Google from each visitor's browser. Hosting the fonts on our own server would avoid that.

No facts, dates, titles or links will change.
