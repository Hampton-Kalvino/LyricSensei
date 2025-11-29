import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Mail, Music, ArrowLeft } from "lucide-react";

function getBackendUrl() {
  const isCapacitor = !!(window as any).Capacitor;
  if (isCapacitor) {
    return "https://lyricsensei.com";
  }
  return window.location.origin;
}

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const backendUrl = getBackendUrl();
      const fullUrl = !!(window as any).Capacitor 
        ? `${backendUrl}/api/auth/forgot-password` 
        : "/api/auth/forgot-password";

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to send reset email",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitted(true);
      toast({
        title: "Success",
        description: "Password reset link sent to your email",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <Music className="h-16 w-16 text-primary" />
          <h1 className="text-2xl font-bold text-center">Lyric Sensei</h1>
        </div>

        {/* Card */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold">Reset Password</h2>
            <p className="text-sm text-muted-foreground">
              {isSubmitted
                ? "Check your email for a reset link"
                : "Enter your email to receive a password reset link"}
            </p>
          </div>

          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-forgot-email"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-send-reset"
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="flex justify-center mb-4">
                <Mail className="h-12 w-12 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                We've sent a password reset link to <strong>{email}</strong>. 
                Check your email and follow the link to reset your password.
              </p>
              <p className="text-xs text-muted-foreground">
                The reset link will expire in 1 hour.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Didn't receive an email? Check your spam folder.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full mt-6"
                onClick={() => setIsSubmitted(false)}
                data-testid="button-try-again"
              >
                Try Another Email
              </Button>
            </div>
          )}

          {/* Back to Login */}
          <button
            type="button"
            onClick={() => setLocation("/auth/login")}
            className="w-full flex items-center justify-center gap-2 text-sm text-primary hover:underline"
            data-testid="button-back-to-login"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </button>
        </Card>
      </div>
    </div>
  );
}
