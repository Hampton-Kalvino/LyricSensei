import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export function PremiumBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <Card className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-primary/20">
      <div className="flex items-center justify-between p-4 gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Upgrade to Premium</h3>
            <p className="text-xs text-muted-foreground">
              Remove ads and unlock unlimited translations for just $4.99/month
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pricing">
            <Button size="sm" data-testid="button-upgrade-banner">
              Upgrade Now
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsVisible(false)}
            data-testid="button-close-banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
