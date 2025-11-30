import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Lock, Music, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
import { useState } from "react";

function getBackendUrl() {
  const isCapacitor = !!(window as any).Capacitor;
  if (isCapacitor) {
    return "https://lyricsensei.com";
  }
  return window.location.origin;
}

export default function ResetPassword() {
  // FIXED: Get token from URL path parameter
  const [match, params] = useRoute("/auth/reset-password/:token");
  const token = params?.token;
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast({
        title: "Invalid Link",
        description: "This password reset link is invalid",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const backendUrl = getBackendUrl();
      const fullUrl = !!(window as any).Capacitor
        ? `${backendUrl}/api/auth/reset-password`
        : "/api/auth/reset-password";

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to reset password",
          variant: "destructive",
        });
        return;
      }

      setIsSuccess(true);
      toast({
        title: "Success",
        description: "Password reset successfully",
      });

      setTimeout(() => {
        setLocation("/auth/login");
      }, 2000);
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

  if (!match || !token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="w-full max-w-md">
          <Card className="p-6 space-y-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Invalid Reset Link</h2>
              <p className="text-sm text-muted-foreground">
                This password reset link is invalid or has expired.
              </p>
            </div>
            <Button
              onClick={() => setLocation("/auth/forgot-password")}
              className="w-full"
              data-testid="button-request-new-link"
            >
              Request New Link
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="w-full max-w-md">
          <Card className="p-6 space-y-4 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Password Reset Successful</h2>
              <p className="text-sm text-muted-foreground">
                Your password has been reset. Redirecting to login...
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

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
            <h2 className="text-xl font-semibold">Create New Password</h2>
            <p className="text-sm text-muted-foreground">
              Enter a new password for your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                New Password
              </label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-new-password"
                />
              </div>
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-confirm-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-reset-password"
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
