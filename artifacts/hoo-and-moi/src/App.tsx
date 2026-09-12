import { type ReactNode } from 'react';
import { ArrowUpRight, MoveRight } from 'lucide-react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Home() {
  const [hasBegun, setHasBegun] = useState(false);

  const begin = () => {
    setHasBegun(true);
    window.setTimeout(() => {
      document.getElementById('the-beginning')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  return (
    <main className={`hoo-page ${hasBegun ? 'hoo-begun' : ''}`} data-testid="page-welcome">
      <div className="hoo-shell">
        <nav className="hoo-nav" aria-label="Primary navigation" data-testid="navigation-primary">
          <a className="hoo-mark" href="/" data-testid="link-brand-home" aria-label="hoo-and-moi home">
            <span className="hoo-mark-dot" aria-hidden="true" />
            <span data-testid="text-brand-name">hoo-and-moi</span>
          </a>
          <a className="hoo-nav-link" href="#the-beginning" data-testid="link-the-beginning">the beginning</a>
          <button className="hoo-nav-action" type="button" onClick={begin} data-testid="button-nav-begin">
            begin
          </button>
        </nav>

        <section className="hoo-hero" aria-labelledby="welcome-heading" data-testid="section-welcome">
          <div>
            <div className="hoo-kicker" data-testid="text-kicker">a place for what comes next</div>
            <h1 className="hoo-title" id="welcome-heading" data-testid="heading-welcome">
              hoo
              <br />
              <em data-testid="text-brand-moi">and moi</em>
            </h1>
            <p className="hoo-intro" data-testid="text-welcome-intro">
              Nothing is decided yet. That is the point. This is a warm, open
              starting line for something worth making.
            </p>
            <div className="hoo-hero-actions">
              <button className="hoo-cta" type="button" onClick={begin} data-testid="button-begin">
                {hasBegun ? 'you are here' : 'begin here'}
                {hasBegun ? <ArrowUpRight size={16} aria-hidden="true" /> : <MoveRight size={16} aria-hidden="true" />}
              </button>
              <span className="hoo-local-status" role="status" aria-live="polite" data-testid="status-beginning">
                {hasBegun ? 'a first step, kept locally.' : 'no account. no plan. just a start.'}
              </span>
            </div>
          </div>

          <div className="hoo-orbit" aria-label="A playful mark for a product in progress" data-testid="display-orbit-mark">
            <div className="hoo-orbit-note one" data-testid="text-orbit-note-one">make room<br />for wonder</div>
            <div className="hoo-orbit-note two" data-testid="text-orbit-note-two">small start<br />big sky</div>
            <div className="hoo-orbit-note three" data-testid="text-orbit-note-three">still becoming</div>
            <div className="hoo-orbit-core" aria-hidden="true" data-testid="display-orbit-core">h<span>+</span>m</div>
          </div>
        </section>

        <section className="hoo-manifesto" id="the-beginning" aria-labelledby="manifesto-heading" data-testid="section-manifesto">
          <div>
            <div className="hoo-eyebrow" data-testid="text-manifesto-eyebrow">01 / open field</div>
            <h2 className="hoo-manifesto-title" id="manifesto-heading" data-testid="heading-manifesto">
              A name before a map.
            </h2>
          </div>
          <p className="hoo-manifesto-copy" data-testid="text-manifesto-copy">
            hoo-and-moi is ready to hold the next idea, the next draft, the next
            small brave thing. For now, it only asks one question: what do you
            want to begin?
          </p>
        </section>

        <footer className="hoo-footer" data-testid="footer-welcome">
          <span className="hoo-footer-note" data-testid="text-footer-note">made for the first step</span>
          <a className="hoo-link" href="#welcome-heading" data-testid="link-back-to-top">
            back to top <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </footer>
      </div>
    </main>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
