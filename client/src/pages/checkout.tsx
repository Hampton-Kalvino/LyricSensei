import { useEffect, useState, useCallback } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { useLocation } from 'wouter';
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import logoImage from "@assets/ChatGPT Image Nov 5, 2025, 05_37_31 PM_1762887933822.png";

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

export default function Checkout() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Check if Stripe is configured
  if (!stripePromise) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center space-y-4">
          <img 
            src={logoImage} 
            alt="LyricSync Logo" 
            className="h-32 w-auto object-contain mx-auto"
            data-testid="img-checkout-logo"
          />
          <h2 className="text-xl font-semibold">Stripe Not Configured</h2>
          <p className="text-sm text-muted-foreground">
            Payment processing is not available. Please configure Stripe environment variables to enable subscriptions.
          </p>
        </Card>
      </div>
    );
  }
  
  // Parse URL parameters
  const params = new URLSearchParams(window.location.search);
  const interval = (params.get('interval') as 'month' | 'year' | null) || 'month';

  // Fetch client secret for embedded checkout
  const fetchClientSecret = useCallback(async () => {
    try {
      const data = await apiRequest("POST", "/api/create-subscription", { interval });
      const response = data as { clientSecret?: string; alreadySubscribed?: boolean };
      
      if (response.alreadySubscribed) {
        toast({
          title: t('checkout.alreadySubscribed'),
          description: t('checkout.alreadySubscribedDescription'),
        });
        setLocation('/account');
        return null;
      }
      
      if (!response.clientSecret) {
        throw new Error('No client secret returned');
      }
      
      return response.clientSecret;
    } catch (error: any) {
      console.error("Checkout session error:", error);
      toast({
        title: t('checkout.error'),
        description: error.message || t('checkout.errorDescription'),
        variant: "destructive",
      });
      setTimeout(() => setLocation('/pricing'), 2000);
      return null;
    }
  }, [interval, toast, setLocation, t]);

  useEffect(() => {
    fetchClientSecret().then((secret) => {
      if (secret) {
        setClientSecret(secret);
      }
      setIsLoading(false);
    });
  }, [fetchClientSecret]);

  // Loading state - waiting for client secret
  if (isLoading || !clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-6">
          <img 
            src={logoImage} 
            alt="LyricSync Logo" 
            className="h-40 md:h-56 lg:h-64 w-auto object-contain mx-auto"
            data-testid="img-checkout-logo"
          />
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <div>
            <h2 className="text-xl font-semibold mb-2">{t('checkout.preparingCheckout')}</h2>
            <p className="text-sm text-muted-foreground">{t('checkout.loadingPaymentForm')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Embedded checkout form
  return (
    <div className="min-h-screen p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <img 
            src={logoImage} 
            alt="LyricSync Logo" 
            className="h-32 md:h-40 lg:h-48 w-auto object-contain mx-auto"
            data-testid="img-checkout-logo"
          />
          <h1 className="text-3xl font-bold">{t('checkout.title')}</h1>
          <p className="text-muted-foreground">
            {interval === 'year' ? t('checkout.yearlySubscription') : t('checkout.monthlySubscription')}
          </p>
        </div>

        <Card className="p-6 md:p-8">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          <p>{t('checkout.termsAgreement')}</p>
          <p className="mt-1">{t('checkout.cancelAnytime')}</p>
        </div>
      </div>
    </div>
  );
}
