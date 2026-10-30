import { ReactNode, useEffect } from"react";
import { Link } from"react-router-dom";
import { FinchLogo } from"../components/Finch";

const UPDATED = "October 30, 2026";
const GITHUB = "https://github.com/reubenjackaman";
const REPO = `${GITHUB}/equity-research`;

function Page({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Value Finch`;
  }, [title]);

  return (
    <article className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      {intro && <p className="prose-width mt-4 text-lg text-muted">{intro}</p>}
      <div className="prose-width mt-8 space-y-4">{children}</div>
    </article>
  );
}

function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-32 pt-6 text-lg">
      {children}
    </h2>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
      {children}
    </a>
  );
}

export function HowItWorks() {
  return (
    <Page title="How it works" intro="Where the numbers come from, how they're calculated, and where they fall short.">
      <H2>Where the data comes from</H2>
      <Bullets
        items={[
          <><b>SEC EDGAR:</b> financial statements for companies that file with the US regulator, taken from the filings themselves.</>,
          <><b>Yahoo Finance:</b> share prices, price history, and statements for companies EDGAR doesn't cover, including most TSX listings.</>,
          <><b>Finnhub:</b> company news and peer lists, plus backup company details.</>,
          <><b>Wikipedia:</b> a backup company description when no other is available.</>,
        ]}
      />
      <p>Prices and overviews are refreshed about every 15 minutes, so they can lag the market. Anything that can't be found shows as N/A rather than a guess.</p>

      <H2>Ratios</H2>
      <p>
        Ratios are calculated here from the raw statements, not copied from another site. Each one shows its formula, the numbers that went
        into it, and its trend over time. Trailing twelve-month figures are the last full year, plus this year so far, minus the same period last year.
      </p>

      <H2>DCF valuation</H2>
      <p>
        The discounted cash flow model projects a company's free cash flow, discounts it to today at the WACC, and adds a terminal value. The
        defaults are only a starting point: a 5% equity risk premium, 2.5% long-term growth, and the 10-year Treasury yield as the risk-free
        rate. Change any assumption and the value updates. The Excel export uses live formulas, so you can check the model cell by cell.
      </p>

      <H2>Comparable companies</H2>
      <p>
        Comps start from a suggested list of similar companies, which you can edit. Each peer is measured with the same formulas, and the
        peer median multiple is applied to the company's own figures to get an implied share price.
      </p>

      <H2>The football field and tear sheet</H2>
      <p>The Summary tab places each valuation method's range beside today's price, and the tear sheet turns the research into one printable page.</p>

      <H2>Mystery Company</H2>
      <p>
        Everyone gets the same large company each day. Clues come from a saved market snapshot, so they show figures as of the date on the game
        page. Hints use up a guess, and the server hides names and other capitalized words before a hint reaches your browser.
      </p>

      <H2>How the math is checked</H2>
      <p>Statements, ratios and the Excel model are tested against Apple's reported figures. That catches formula mistakes, but it can't promise every number for every company is right.</p>

      <H2>Known limits</H2>
      <Bullets
        items={[
          "Analyst price targets aren't available on the live site.",
          "Browse by sector uses a saved snapshot, so its figures can be out of date and some filters are limited.",
          "Companies with unusual share structures, recent listings or foreign filings may have gaps.",
          "The site can take up to a minute to wake up if nobody has used it recently.",
        ]}
      />
      <p>A valuation is an estimate built on assumptions, not a fact. For anything important, check the original filing.</p>
    </Page>
  );
}

export function About() {
  return (
    <Page title="About">
      <div className="flex items-center gap-4">
        <FinchLogo className="h-12 w-12 shrink-0 text-accent" />
        <p className="text-lg">Value Finch is a free research site for US and Canadian public companies.</p>
      </div>

      <H2>Why I made this</H2>
      <p>
        Lots of finance sites will hand you a number. Far fewer show you how they got it. I wanted one place to go from a company's filings to a
        valuation, with every formula visible, so the work can be checked and learned from.
      </p>
      <p>That's why ratios show their math, DCF assumptions can be changed, and the Excel export uses live formulas. Mystery Company came from the idea that reading financial numbers can be fun too.</p>

      <H2>Why a finch?</H2>
      <p>Finches are small, sharp-eyed and very good at cracking things open. It seemed like a fair goal for a research tool.</p>

      <H2>About the founder</H2>
      <p>I'm Reuben Jackaman, a second-year commerce student and the founder of Value Finch.</p>
      <p>
        You can see the code on <A href={REPO}>GitHub</A>, or <Link to="/contact" className="font-medium text-accent underline">get in touch</Link>.
      </p>
    </Page>
  );
}

export function Contact() {
  return (
    <Page title="Contact" intro="Found a wrong number, a bug, or have an idea? I'd like to hear about it.">
      <div className="card">
        <h2 className="font-semibold">Report a problem or suggest something</h2>
        <p className="mt-1 text-sm text-muted">
          Open an issue on <A href={`${REPO}/issues`}>GitHub</A>. If it's about a number, please include the ticker and the tab you were on.
        </p>
      </div>
      <div className="card">
        <h2 className="font-semibold">Find me online</h2>
        <p className="mt-1 text-sm text-muted">
          <A href={GITHUB}>github.com/reubenjackaman</A>
        </p>
      </div>
      <p className="text-sm text-muted">I can't give investment advice or recommend stocks.</p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms of use" intro={`Last updated ${UPDATED}`}>
      <p>By using Value Finch, you agree to these terms. If you don't agree, please don't use the site.</p>

      <H2 id="disclaimer">Not investment advice</H2>
      <p>
        Value Finch is for educational purposes only. Nothing on it is investment, financial, legal or tax advice, or a recommendation to buy or
        sell any security. Valuations are estimates based on assumptions and can be wrong. Any investment decision is yours, and you may
        want to speak with a licensed professional first.
      </p>

      <H2>Data accuracy</H2>
      <p>Data comes from third parties and may be delayed, incomplete or incorrect. It's provided as is, with no promise that it's accurate or up to date. Please check important figures against the original filings.</p>

      <H2>Using the site</H2>
      <p>You may use Value Finch for personal, non-commercial purposes. Please don't try to disrupt the site, get around its limits, or copy its data in bulk.</p>

      <H2>Third-party content</H2>
      <p>News articles and data belong to their owners. Links to other sites are for convenience, and Value Finch isn't responsible for their content.</p>

      <H2>Availability</H2>
      <p>This is a free project. Features can change or stop at any time, and the site may sometimes be unavailable.</p>

      <H2>Limit of liability</H2>
      <p>To the extent the law allows, Value Finch and its creator aren't liable for any loss or damage from using the site or relying on its content, including investment losses.</p>

      <H2>Changes</H2>
      <p>These terms may change. The date at the top shows the latest version, and continuing to use the site means you accept it.</p>
    </Page>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy" intro={`Last updated ${UPDATED}`}>
      <p>Value Finch has no accounts, ads or analytics trackers, and it doesn't ask for your name, email or payment details.</p>

      <H2>Saved on your device</H2>
      <p>Your saved companies, recent searches, DCF assumptions, theme and game progress stay in your own browser. They aren't sent to an account, and clearing your browser's site data removes them.</p>

      <H2>What the server sees</H2>
      <p>To answer a request, the site's server receives what any website does, such as your IP address and the pages you request. The hosting provider, Render, may keep these in standard logs.</p>

      <H2>Other services</H2>
      <p>The site's fonts load from Google Fonts, so your browser also contacts Google, which receives your IP address. Tickers you look up are sent from the server to data providers such as SEC EDGAR, Yahoo Finance and Finnhub to fetch results. Opening a news link takes you to that publisher's site, under its own privacy policy.</p>

      <H2>Questions</H2>
      <p>See the <Link to="/contact" className="font-medium text-accent underline">contact page</Link>.</p>
    </Page>
  );
}

export function NotFound() {
  return (
    <Page title="Page not found">
            <p>That page doesn't exist.</p>
      <Link to="/" className="font-medium text-accent underline">Back to home</Link>
    </Page>
  );
}
