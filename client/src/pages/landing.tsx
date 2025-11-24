import { Button } from "@/components/ui/button";
import { Music2, Globe, Headphones, Star, Music } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth"; // Import the useAuth hook

export default function Landing() {
  const { t } = useTranslation();
  const { loginAsGuest } = useAuth(); // Get the loginAsGuest function

  const handleGuestLogin = async () => {
    try {
      await loginAsGuest();
      // No redirect needed. The app will re-render automatically.
    } catch (error) {
      console.error("Failed to log in as guest:", error);
      // Optionally, show a toast or error message to the user here
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-center mb-6">
              <Music className="h-24 w-24 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              Lyric Sensei
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing.heroSubtitle')}
            </p>
          </div>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {t('landing.heroDescription')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="text-lg"
              onClick={() => window.location.href = "/#/auth/login"}
              data-testid="button-login"
            >
              {t('landing.getStarted')}
            </Button>
            <Button
              size="lg"
              className="text-lg"
              variant="outline"
              onClick={handleGuestLogin} // Use the correct handler
              data-testid="button-guest"
            >
              Continue as Guest
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-16 text-left">
            <div className="space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Music2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{t('landing.feature1Title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('landing.feature1Description')}
              </p>
            </div>

            <div className="space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{t('landing.feature2Title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('landing.feature2Description')}
              </p>
            </div>

            <div className="space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Headphones className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{t('landing.feature3Title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('landing.feature3Description')}
              </p>
            </div>
          </div>

          {/* Premium CTA */}
          <div className="mt-16 p-8 rounded-lg border bg-card">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Star className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold">{t('landing.premiumTitle')}</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              {t('landing.premiumSubtitle')}
            </p>
            <p className="text-2xl font-bold text-primary mb-4">{t('pricing.premiumPrice')}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-6 px-6">
        <div className="max-w-4xl mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; 2025 LyricSync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
