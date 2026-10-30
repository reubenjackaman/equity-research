import { Route, Routes, useLocation } from "react-router-dom";
import TopBar from "./components/TopBar";
import Company from "./pages/Company";
import Game from "./pages/Game";
import Home from "./pages/Home";
import TearSheet from "./pages/TearSheet";
import { useTheme } from "./theme";

export default function App() {
  const { theme, toggle } = useTheme();
  const path = useLocation().pathname;

  // The tear sheet is a standalone printable page, without the site header and footer.
  if (path.endsWith("/tearsheet")) {
    return (
      <Routes>
        <Route path="/company/:ticker/tearsheet" element={<TearSheet />} />
      </Routes>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar theme={theme} onToggleTheme={toggle} />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/company/:ticker" element={<Company theme={theme} />} />
          <Route path="/game" element={<Game />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Built by Reuben Jackaman · For educational purposes only. Not investment advice. Data from SEC EDGAR,
        Yahoo Finance and Finnhub may be delayed or incomplete.
      </footer>
    </div>
  );
}
