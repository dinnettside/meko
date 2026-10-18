import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

// The bar at the top of every page: the name, links to the examples and to how it works, and the light and dark switch.
export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="font-serif text-2xl font-semibold tracking-tight">Meko</span>
          <span className="hidden text-sm text-muted sm:inline">Fact-checked explainer videos</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#examples" className="text-muted transition-colors hover:text-fg">
            Examples
          </a>
          <a href="#how" className="text-muted transition-colors hover:text-fg">
            How it works
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-8">
        <p>Meko, built for the Nebius x NVIDIA Global AI Hackathon.</p>
        <p>Open source under the MIT license. Every picture is drawn in code.</p>
      </div>
    </footer>
  );
}
