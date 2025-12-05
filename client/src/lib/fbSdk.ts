declare global {
  interface Window {
    FB: typeof FB;
    fbAsyncInit: () => void;
  }
}

declare namespace FB {
  interface AuthResponse {
    accessToken: string;
    expiresIn: number;
    signedRequest: string;
    userID: string;
    grantedScopes?: string;
  }

  interface StatusResponse {
    status: 'connected' | 'not_authorized' | 'unknown';
    authResponse: AuthResponse | null;
  }

  interface LoginOptions {
    scope?: string;
    return_scopes?: boolean;
    auth_type?: 'rerequest' | 'reauthenticate' | 'reauthorize';
  }

  interface InitParams {
    appId: string;
    cookie?: boolean;
    xfbml?: boolean;
    version: string;
  }

  interface XFBML {
    parse(element?: HTMLElement): void;
  }

  const XFBML: XFBML;

  function init(params: InitParams): void;
  function getLoginStatus(callback: (response: StatusResponse) => void): void;
  function login(callback: (response: StatusResponse) => void, options?: LoginOptions): void;
  function logout(callback: () => void): void;
}

let sdkLoadPromise: Promise<typeof FB> | null = null;
let statusChangeCallback: ((response: FB.StatusResponse) => void) | null = null;

// Set the callback function that will be called when login status changes
export function setStatusChangeCallback(callback: (response: FB.StatusResponse) => void): void {
  statusChangeCallback = callback;
}

// This is the callback called by the fb:login-button onlogin attribute
// It's exposed globally so Facebook's XFBML can call it
function checkLoginState(): void {
  if (window.FB) {
    window.FB.getLoginStatus((response) => {
      console.log('[Facebook SDK] checkLoginState response:', response.status);
      if (statusChangeCallback) {
        statusChangeCallback(response);
      }
    });
  }
}

// Expose checkLoginState globally for the fb:login-button onlogin attribute
(window as any).checkLoginState = checkLoginState;

export function loadFacebookSdk(): Promise<typeof FB> {
  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
  const apiVersion = import.meta.env.VITE_FACEBOOK_API_VERSION || 'v21.0';

  if (!appId) {
    return Promise.reject(new Error('VITE_FACEBOOK_APP_ID is not configured'));
  }

  sdkLoadPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Facebook SDK load timeout'));
    }, 15000);

    if (document.getElementById('facebook-jssdk')) {
      if (window.FB) {
        clearTimeout(timeout);
        resolve(window.FB);
        return;
      }
    }

    window.fbAsyncInit = function() {
      clearTimeout(timeout);
      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: true, // Enable XFBML parsing for fb:login-button
        version: apiVersion,
      });
      console.log('[Facebook SDK] Initialized with app ID:', appId, '(XFBML enabled)');
      resolve(window.FB);
    };

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    
    script.onerror = () => {
      clearTimeout(timeout);
      sdkLoadPromise = null;
      reject(new Error('Failed to load Facebook SDK'));
    };

    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  });

  return sdkLoadPromise;
}

// Parse XFBML elements (like fb:login-button) in the DOM
export function parseXFBML(element?: HTMLElement): void {
  if (window.FB && window.FB.XFBML) {
    window.FB.XFBML.parse(element);
  }
}

export function getLoginStatus(): Promise<FB.StatusResponse> {
  return new Promise((resolve, reject) => {
    loadFacebookSdk()
      .then((FB) => {
        FB.getLoginStatus((response) => {
          resolve(response);
        });
      })
      .catch(reject);
  });
}

export function loginWithFacebook(): Promise<FB.StatusResponse> {
  return new Promise((resolve, reject) => {
    loadFacebookSdk()
      .then((FB) => {
        FB.login((response) => {
          if (response.status === 'connected' && response.authResponse) {
            resolve(response);
          } else {
            reject(new Error(response.status === 'not_authorized' 
              ? 'Facebook login not authorized' 
              : 'Facebook login cancelled'));
          }
        }, { scope: 'email,public_profile' });
      })
      .catch(reject);
  });
}

export function isFacebookSdkConfigured(): boolean {
  return !!import.meta.env.VITE_FACEBOOK_APP_ID;
}

export type { FB };
