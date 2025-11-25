import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t bg-background/50 py-4 px-4 mt-auto" style={{ paddingBottom: `calc(1rem + var(--safe-area-inset-bottom))`, paddingLeft: `calc(1rem + var(--safe-area-inset-left))`, paddingRight: `calc(1rem + var(--safe-area-inset-right))` }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <p className="text-xs text-muted-foreground">© 2025 Lyric Sensei. All rights reserved.</p>
        <nav className="flex items-center gap-4">
          <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-terms">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
