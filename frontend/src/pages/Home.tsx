import { useEffect } from"react";
import { Link } from"react-router-dom";
import Explore from"../components/Explore";
import SearchBar from"../components/SearchBar";

const EXAMPLES = ["AAPL", "MSFT", "NVDA", "SHOP.TO", "RY.TO", "CNR.TO"];

export default function Home() {
  useEffect(() => {
    document.title = "Value Finch · Company research and valuation";
  }, []);

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 pt-12 sm:pt-16 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-16">
        <div>
          <p className="font-serif text-lg font-semibold text-accent">Value Finch</p>
          <h1 className="mt-4 text-3xl sm:text-4xl">Equity research on US and Canadian companies.</h1>
          <p className="prose-width mt-6 text-muted">
            Financial statements, ratios, DCF and comparable-company valuation for US and TSX listings. A project by Reuben Jackaman.
          </p>
        </div>
        <div className="pb-1">
          <SearchBar large />
          <p className="mt-3 flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span>Try</span>
            {EXAMPLES.map((t) => (
              <Link key={t} to={`/company/${t}`} className="tap font-medium text-ink underline decoration-line-strong transition-colors hover:text-accent">
                {t}
              </Link>
            ))}
          </p>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="flex flex-col gap-3 border-y border-line py-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
          <div>
            <h2 className="text-lg">Mystery Company</h2>
            <p className="mt-1 text-muted">Guess today's company from its financials. You get six guesses.</p>
          </div>
          <Link to="/game" className="tap shrink-0 font-medium text-accent underline transition-colors hover:text-accent-hover">
            Play today's puzzle
          </Link>
        </div>
      </section>
      <Explore />
    </>
  );
}
