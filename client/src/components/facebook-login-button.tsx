import { useEffect, useRef, useState } from "react";
import { loadFacebookSdk, parseXFBML, setStatusChangeCallback, isFacebookSdkConfigured } from "@/lib/fbSdk";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface FacebookLoginButtonProps {
  onSuccess: (accessToken: string, userId: string) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  className?: string;
}

export function FacebookLoginButton({ 
  onSuccess, 
  onError, 
  onCancel,
  disabled = false,
  className = ""
}: FacebookLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFacebookSdkConfigured()) {
      setSdkError("Facebook App ID not configured");
      setIsLoading(false);
      return;
    }

    setStatusChangeCallback((response) => {
      console.log("[FacebookLoginButton] Status change:", response.status);
      
      if (response.status === 'connected' && response.authResponse) {
        onSuccess(response.authResponse.accessToken, response.authResponse.userID);
      } else if (response.status === 'not_authorized') {
        onError("Facebook login not authorized. Please grant permissions.");
      } else {
        if (onCancel) {
          onCancel();
        }
      }
    });

    loadFacebookSdk()
      .then(() => {
        console.log("[FacebookLoginButton] SDK loaded, parsing XFBML");
        setSdkReady(true);
        setIsLoading(false);
        
        setTimeout(() => {
          if (containerRef.current) {
            parseXFBML(containerRef.current);
          }
        }, 100);
      })
      .catch((error) => {
        console.error("[FacebookLoginButton] SDK load error:", error);
        setSdkError(error.message);
        setIsLoading(false);
      });

    return () => {
      setStatusChangeCallback(() => {});
    };
  }, [onSuccess, onError, onCancel]);

  useEffect(() => {
    if (sdkReady && containerRef.current) {
      parseXFBML(containerRef.current);
    }
  }, [sdkReady]);

  if (isLoading) {
    return (
      <Button 
        variant="outline" 
        className={`w-full ${className}`} 
        disabled
        data-testid="button-facebook-loading"
      >
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading Facebook...
      </Button>
    );
  }

  if (sdkError) {
    return (
      <Button 
        variant="outline" 
        className={`w-full ${className}`} 
        disabled
        onClick={() => onError(sdkError)}
        data-testid="button-facebook-error"
      >
        <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        Facebook Unavailable
      </Button>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`facebook-login-container ${className}`}
      data-testid="container-facebook-login"
    >
      <div 
        className="fb-login-button" 
        data-width="100%"
        data-size="large" 
        data-button-type="login_with"
        data-layout="default"
        data-auto-logout-link="false"
        data-use-continue-as="true"
        data-scope="public_profile,email"
        data-onlogin="checkLoginState();"
      />
      <style>{`
        .facebook-login-container {
          display: flex;
          justify-content: center;
          min-height: 40px;
        }
        .facebook-login-container .fb-login-button {
          width: 100%;
        }
        .facebook-login-container .fb-login-button > span {
          width: 100% !important;
        }
        .facebook-login-container .fb-login-button iframe {
          width: 100% !important;
        }
      `}</style>
    </div>
  );
}
