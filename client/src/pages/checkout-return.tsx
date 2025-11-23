import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from 'wouter';
import { useTranslation } from "react-i18next";
import { CheckCircle, Loader2, XCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import logoImage from "@assets/ChatGPT Image Nov 5, 2025, 05_37_31 PM_1762887933822.png";

export default function CheckoutReturn() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  // Parse URL parameters
  const params = new URLSearchParams(window.location.search);
  const session_id = params.get('session_id');
  const interval = params.get('interval') || 'month';

  // Guard: No session_id means invalid access
  if (!session_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <div className="space-y-6">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto" />
            <div>
              <h2 className="text-2xl font-bold mb-2">{t('checkout.invalidSession')}</h2>
              <p className="text-muted-foreground">{t('checkout.invalidSessionDescription')}</p>
            </div>
            <Button onClick={() => setLocation('/pricing')} data-testid="button-back-to-pricing">
              {t('checkout.backToPricing')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Verify subscription status after checkout completion
  const { data: subscriptionStatus, isLoading: isCheckingStatus, error, refetch } = useQuery<{
    subscriptionId?: string;
    status?: string;
    isPremium?: boolean;
  }>({
    queryKey: [`/api/subscription-status?session_id=${session_id}`],
    enabled: !!session_id,
    retry: 3,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (subscriptionStatus?.isPremium) {
      // Invalidate user query to fetch updated premium status
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      // Subscription activated successfully
      setTimeout(() => {
        toast({
          title: t('checkout.paymentSuccess'),
          description: t('checkout.paymentSuccessDescription'),
        });
        setLocation('/account');
      }, 2000);
    }
  }, [subscriptionStatus, toast, setLocation, t]);

  // API error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <div className="space-y-6">
            <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            <div>
              <h2 className="text-2xl font-bold mb-2">{t('checkout.verificationFailed')}</h2>
              <p className="text-muted-foreground">{t('checkout.verificationFailedDescription')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                onClick={() => refetch()}
                className="flex-1"
                data-testid="button-retry"
              >
                {t('checkout.retry')}
              </Button>
              <Button 
                onClick={() => setLocation('/pricing')}
                className="flex-1"
                data-testid="button-back-to-pricing"
              >
                {t('checkout.backToPricing')}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Verifying state
  if (isCheckingStatus) {
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
            <h2 className="text-xl font-semibold mb-2">{t('checkout.verifyingPayment')}</h2>
            <p className="text-sm text-muted-foreground">{t('checkout.pleaseWait')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Payment not completed or failed
  if (!subscriptionStatus?.isPremium) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <div className="space-y-6">
            <XCircle className="w-16 h-16 text-orange-500 mx-auto" />
            <div>
              <h2 className="text-2xl font-bold mb-2">{t('checkout.paymentNotCompleted')}</h2>
              <p className="text-muted-foreground">{t('checkout.paymentNotCompletedDescription')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                onClick={() => setLocation('/account')}
                className="flex-1"
                data-testid="button-check-account"
              >
                {t('checkout.checkAccount')}
              </Button>
              <Button 
                onClick={() => setLocation(`/checkout?interval=${interval}`)}
                className="flex-1"
                data-testid="button-try-again"
              >
                {t('checkout.tryAgain')}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Success state - only shown when subscriptionStatus.isPremium === true
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="p-8 max-w-md text-center">
        <div className="space-y-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold mb-2">{t('checkout.paymentSuccess')}</h2>
            <p className="text-muted-foreground">{t('checkout.paymentSuccessDescription')}</p>
          </div>
          <Button onClick={() => setLocation('/account')} data-testid="button-go-to-account">
            {t('checkout.goToAccount')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
