import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Mail, Lock, User, Music2, Music, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { clearGuestUserId, setAuthenticatedUserId, clearAuthenticatedUserId } from "@/lib/queryClient";
import { Capacitor } from "@capacitor/core";
import { isFacebookSdkConfigured } from "@/lib/fbSdk";
import { FacebookLoginButton } from "@/components/facebook-login-button";

// Check if running in native mobile app (Android/iOS) vs web
// Use Capacitor's isNativePlatform() which properly distinguishes native from web
// Safe check that defaults to false if Capacitor is not available
const isNativePlatform = (() => {
  try {
    return typeof Capacitor !== 'undefined' && 
           typeof Capacitor.isNativePlatform === 'function' && 
           Capacitor.isNativePlatform();
  } catch {
    return false;
  }
})();

// Get backend URL based on Capacitor environment
function getBackendUrl() {
  if (isNativePlatform) {
    return "https://lyricsensei.com";
  }
  return window.location.origin;
}

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Check for error query parameter from OAuth redirects
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error === 'facebook_not_configured') {
      toast({
        title: "Facebook Login Unavailable",
        description: "Facebook login is not yet configured. Please use another login method.",
        variant: "destructive",
      });
      // Clean up the URL
      window.history.replaceState({}, '', '/auth/login');
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = isSignUp ? "/api/auth/signup" : "/api/auth/login";
      const backendUrl = getBackendUrl();
      const fullUrl = isNativePlatform ? `${backendUrl}${endpoint}` : endpoint;
      
      const payload = isSignUp
        ? { email, password, username, firstName, lastName }
        : { email, password };

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Authentication failed",
          variant: "destructive",
        });
        return;
      }

      const { user } = await response.json();
      toast({
        title: "Success",
        description: isSignUp ? "Account created successfully" : "Logged in successfully",
      });
      
      // Clear guest ID so it stops being sent in headers
      clearGuestUserId();
      
      // Store authenticated user ID for mobile (header-based auth fallback)
      if (user?.id) {
        setAuthenticatedUserId(user.id);
      }
      
      // Set user data in cache immediately so auth state updates right away
      queryClient.setQueryData(["/api/auth/user"], user);
      
      // Redirect to home (authenticated users will see Home page)
      setLocation("/");
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

  const handleGuestMode = async () => {
    setIsLoading(true);
    try {
      const backendUrl = getBackendUrl();
      const fullUrl = isNativePlatform ? `${backendUrl}/api/auth/guest` : "/api/auth/guest";
      
      const response = await fetch(fullUrl, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Guest login failed");
      }

      const data = await response.json();
      toast({
        title: "Welcome!",
        description: "You're now in guest mode. You can upgrade anytime!",
      });
      
      // Clear authenticated user ID for guest mode
      clearAuthenticatedUserId();
      
      // Set guest user data in cache immediately so auth state updates right away
      queryClient.setQueryData(["/api/auth/user"], data.user || { id: data.id, isGuest: true, username: 'Guest', isPremium: false });
      
      setLocation("/");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to enter guest mode",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const handleAppleLogin = () => {
    toast({
      title: "Coming Soon",
      description: "Apple login will be available soon.",
      variant: "default",
    });
  };

  // Process Facebook token from native SDK
  const processFacebookToken = async (token: string, userId: string) => {
    setIsFacebookLoading(true);
    try {
      const backendUrl = getBackendUrl();
      const fullUrl = isNativePlatform ? `${backendUrl}/api/auth/facebook/token` : "/api/auth/facebook/token";
      
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessToken: token, userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Facebook authentication failed");
      }

      const { user } = await response.json();
      toast({
        title: "Success",
        description: "Logged in with Facebook successfully",
      });
      
      clearGuestUserId();
      if (user?.id) {
        setAuthenticatedUserId(user.id);
      }
      queryClient.setQueryData(["/api/auth/user"], user);
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Facebook login failed",
        variant: "destructive",
      });
    } finally {
      setIsFacebookLoading(false);
    }
  };

  // Listen for native Facebook SDK events (from MainActivity.java)
  useEffect(() => {
    const clearFacebookTimeout = () => {
      const timeoutId = (window as any).__fbLoginTimeout;
      if (timeoutId) {
        clearTimeout(timeoutId);
        delete (window as any).__fbLoginTimeout;
      }
    };

    const onNativeFacebookSuccess = (event: CustomEvent) => {
      clearFacebookTimeout();
      const { token, userId } = event.detail;
      console.log("[Facebook] Native login success, processing token...");
      processFacebookToken(token, userId);
    };

    const onNativeFacebookCancelled = () => {
      clearFacebookTimeout();
      console.log("[Facebook] Native login cancelled");
      setIsFacebookLoading(false);
      toast({
        title: "Cancelled",
        description: "Facebook login was cancelled",
        variant: "default",
      });
    };

    const onNativeFacebookError = (event: CustomEvent) => {
      clearFacebookTimeout();
      console.error("[Facebook] Native login error:", event.detail.error);
      setIsFacebookLoading(false);
      toast({
        title: "Error",
        description: event.detail.error || "Facebook login failed",
        variant: "destructive",
      });
    };

    window.addEventListener('facebook-login-success', onNativeFacebookSuccess as EventListener);
    window.addEventListener('facebook-login-cancelled', onNativeFacebookCancelled);
    window.addEventListener('facebook-login-error', onNativeFacebookError as EventListener);

    return () => {
      window.removeEventListener('facebook-login-success', onNativeFacebookSuccess as EventListener);
      window.removeEventListener('facebook-login-cancelled', onNativeFacebookCancelled);
      window.removeEventListener('facebook-login-error', onNativeFacebookError as EventListener);
    };
  }, []);

  // Handler for native mobile Facebook login
  const handleNativeFacebookLogin = async () => {
    setIsFacebookLoading(true);
    
    // Set a timeout to reset loading state if no response
    const timeoutId = setTimeout(() => {
      setIsFacebookLoading(false);
      toast({
        title: "Timeout",
        description: "Facebook login timed out. Please try again.",
        variant: "destructive",
      });
    }, 30000);
    
    // Store timeout ID to clear it on success/error
    (window as any).__fbLoginTimeout = timeoutId;
    
    try {
      // Access the Facebook LoginManager through the Android bridge
      const LoginManager = (window as any).facebookLoginManager;
      if (LoginManager) {
        LoginManager.logInWithReadPermissions(['email', 'public_profile']);
      } else {
        // Native SDK should handle login via MainActivity.java
        // The native code will dispatch events back to the WebView
        console.log("[Facebook] Waiting for native SDK login...");
      }
    } catch (error) {
      clearTimeout(timeoutId);
      setIsFacebookLoading(false);
      toast({
        title: "Error",
        description: "Failed to start Facebook login",
        variant: "destructive",
      });
    }
  };

  // Handlers for the official Facebook Login Button widget (web)
  const handleFacebookSuccess = (accessToken: string, userId: string) => {
    console.log("[Facebook Web] Login button success, exchanging token...");
    processFacebookToken(accessToken, userId);
  };

  const handleFacebookError = (error: string) => {
    console.error("[Facebook Web] Login button error:", error);
    toast({
      title: "Facebook Login Failed",
      description: error || "Failed to login with Facebook",
      variant: "destructive",
    });
  };

  const handleFacebookCancel = () => {
    console.log("[Facebook Web] Login cancelled");
    toast({
      title: "Cancelled",
      description: "Facebook login was cancelled",
      variant: "default",
    });
  };

  const handleTwitterLogin = () => {
    toast({
      title: "Coming Soon",
      description: "Twitter login will be available soon.",
      variant: "default",
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <Music className="h-16 w-16 text-primary" />
          <h1 className="text-2xl font-bold text-center">Lyric Sensei</h1>
        </div>

        {/* Auth Card */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isSignUp
                ? "Sign up to start learning languages through music"
                : "Sign in to your account"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3" data-testid="form-auth">
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">First Name</label>
                    <Input
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      data-testid="input-firstname"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Last Name</label>
                    <Input
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      data-testid="input-lastname"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Username
                  </label>
                  <Input
                    placeholder="Choose your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    data-testid="input-username"
                  />
                </div>
              </>
            )}

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
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-password-visibility"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            
            {!isSignUp && (
              <div className="text-right">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setLocation("/auth/forgot-password")}
                  data-testid="button-forgot-password"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-submit-auth"
            >
              {isLoading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* OAuth Buttons Grid */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              data-testid="button-google-login"
            >
              <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAppleLogin}
              disabled={isLoading}
              data-testid="button-apple-login"
            >
              <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 13.5c-.91 2.92.37 5.25 2.85 6.75.56.37 1.14.69 1.74.94-.84 2.65-2.87 4.45-5.09 4.45-1.62 0-3.06-.85-3.93-2.3-.75 1.38-2.26 2.3-4 2.3-2.95 0-5.35-2.4-5.35-5.35 0-2.94 2.4-5.35 5.35-5.35 1.74 0 3.25.92 4 2.3.87-1.45 2.31-2.3 3.93-2.3 1.53 0 2.9.65 3.85 1.7 1.52-1.21 3.44-1.91 5.57-1.91 2.67 0 5.04 1.14 6.73 2.97-.4-.05-.8-.08-1.21-.08-2.3 0-4.41.94-5.93 2.46zm-4.37-4.5c-1.21 0-2.2-.99-2.2-2.2s.99-2.2 2.2-2.2 2.2.99 2.2 2.2-.99 2.2-2.2 2.2z"/>
              </svg>
              Apple
            </Button>

            {isNativePlatform ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleNativeFacebookLogin}
                disabled={isLoading || isFacebookLoading}
                data-testid="button-facebook-login-native"
              >
                {isFacebookLoading ? (
                  <div className="h-4 w-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                )}
                {isFacebookLoading ? "Connecting..." : "Facebook"}
              </Button>
            ) : (
              <FacebookLoginButton
                onSuccess={handleFacebookSuccess}
                onError={handleFacebookError}
                onCancel={handleFacebookCancel}
                disabled={isLoading}
              />
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleTwitterLogin}
              disabled={isLoading}
              data-testid="button-twitter-login"
            >
              <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.953 4.57a10 10 0 002.856-3.515a10 10 0 01-2.836.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827a4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417a9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
              Twitter
            </Button>
          </div>

          {/* Guest Mode */}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleGuestMode}
            disabled={isLoading}
            data-testid="button-guest-mode"
          >
            <Music2 className="h-4 w-4 mr-2" />
            Continue as Guest
          </Button>

          {/* Toggle Sign Up / Login */}
          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setEmail("");
                setPassword("");
                setUsername("");
              }}
              className="text-primary hover:underline font-medium"
              data-testid="button-toggle-auth-mode"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
