import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Star, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import logoImage from "@assets/ChatGPT Image Nov 5, 2025, 05_37_31 PM_1762887933822.png";

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const isPremium = (user as any)?.isPremium ?? false;
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('year');

  const features = {
    free: [
      t('pricing.freeFeature1'),
      t('pricing.freeFeature2'),
      t('pricing.freeFeature3'),
      t('pricing.freeFeature4'),
      t('pricing.freeFeature5'),
    ],
    premium: [
      t('pricing.premiumFeature1'),
      t('pricing.premiumFeature2'),
      t('pricing.premiumFeature3'),
      t('pricing.premiumFeature4'),
      t('pricing.premiumFeature5'),
      t('pricing.premiumFeature6'),
    ],
  };

  const handleUpgrade = () => {
    if (!isAuthenticated) {
      setLocation('/');
      return;
    }
    setLocation(`/checkout?interval=${billingInterval}`);
  };

  const monthlyPrice = 4.99;
  const yearlyPrice = 29.99;
  const monthlyEquivalent = (yearlyPrice / 12).toFixed(2);
  const savings = ((1 - yearlyPrice / (monthlyPrice * 12)) * 100).toFixed(0);

  return (
    <div className="min-h-screen p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-6">
          <img 
            src={logoImage} 
            alt="LyricSync Logo" 
            className="h-40 md:h-56 lg:h-64 w-auto object-contain mx-auto"
            data-testid="img-pricing-logo"
          />
          <h1 className="text-4xl md:text-5xl font-bold">
            {t('pricing.title')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('pricing.description')}
          </p>

          {/* Billing Interval Toggle */}
          <div className="flex items-center justify-center gap-3 p-1 bg-muted rounded-lg max-w-md mx-auto">
            <Button
              variant={billingInterval === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingInterval('month')}
              className="flex-1"
              data-testid="button-monthly-billing"
            >
              {t('pricing.monthly')}
            </Button>
            <Button
              variant={billingInterval === 'year' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingInterval('year')}
              className="flex-1 relative"
              data-testid="button-yearly-billing"
            >
              {t('pricing.yearly')}
              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                {t('pricing.save')} {savings}%
              </span>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <Card className="p-8 relative">
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold">{t('pricing.freeTitle')}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{t('pricing.freePrice')}</span>
                  <span className="text-muted-foreground">{t('pricing.perMonth')}</span>
                </div>
              </div>

              <ul className="space-y-3">
                {features.free.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                size="lg"
                className="w-full"
                disabled={!isPremium}
              >
                {isPremium ? t('pricing.currentPlan') : t('pricing.active')}
              </Button>
            </div>
          </Card>

          {/* Premium Plan */}
          <Card className="p-8 relative border-primary shadow-lg">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-sm font-medium rounded-bl-lg rounded-tr-lg">
              <div className="flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                {t('pricing.popular')}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  {t('pricing.premiumTitle')}
                  <Star className="h-5 w-5 text-primary fill-primary" />
                </h3>
                <div className="mt-4">
                  {billingInterval === 'month' ? (
                    <>
                      <span className="text-4xl font-bold" data-testid="text-price-monthly">${monthlyPrice}</span>
                      <span className="text-muted-foreground">{t('pricing.perMonth')}</span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold" data-testid="text-price-yearly">${monthlyEquivalent}</span>
                        <span className="text-muted-foreground">{t('pricing.perMonth')}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        ${yearlyPrice} {t('pricing.billedYearly')}
                      </div>
                      <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
                        <Sparkles className="h-4 w-4" />
                        {t('pricing.save')} ${(monthlyPrice * 12 - yearlyPrice).toFixed(2)}/year
                      </div>
                    </>
                  )}
                </div>
              </div>

              <ul className="space-y-3">
                {features.premium.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                className="w-full"
                onClick={handleUpgrade}
                disabled={isPremium}
                data-testid="button-upgrade-premium"
              >
                {isPremium ? t('pricing.currentPlan') : t('pricing.upgradeToPremium')}
              </Button>
            </div>
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>{t('pricing.footer')}</p>
        </div>
      </div>
    </div>
  );
}
