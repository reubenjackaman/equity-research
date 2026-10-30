import { useEffect } from"react";
import { Route, Routes, useLocation } from"react-router-dom";
import Footer from"./components/Footer";
import TopBar from"./components/TopBar";
import Company from"./pages/Company";
import Game from"./pages/Game";
import Home from"./pages/Home";
import { About, Contact, HowItWorks, NotFound, Privacy, Terms } from"./pages/Info";
import TearSheet from"./pages/TearSheet";
import { useTheme } from"./theme";

export default function App() {
  const { theme, toggle } = useTheme();
  const { pathname: path, hash } = useLocation();

  // New pages start at the top; links to a section (like #disclaimer) go to that section.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [path, hash]);

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
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
