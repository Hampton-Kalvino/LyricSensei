import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// --- Guest User ID Management ---
let guestUserId: string | null = null;

// Initialize from localStorage on app load (for persistence)
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('guestUserId');
  if (stored && stored.startsWith('guest-')) {
    guestUserId = stored;
    console.log('[Guest Auth] Loaded guest ID from localStorage:', guestUserId);
  }
}

export function setGuestUserId(id: string) {
  guestUserId = id;
  if (typeof window !== 'undefined') {
    localStorage.setItem('guestUserId', id);
    console.log('[Guest Auth] Set guest ID:', id);
  }
}

export function getGuestUserId() {
  return guestUserId;
}

export function clearGuestUserId() {
  guestUserId = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('guestUserId');
    console.log('[Guest Auth] Cleared guest ID');
  }
}
// --- End Guest User ID Management ---

// --- Authenticated User ID Management (for mobile fallback) ---
let authenticatedUserId: string | null = null;

// Initialize from localStorage on app load
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('authenticatedUserId');
  if (stored) {
    authenticatedUserId = stored;
    console.log('[Auth] Loaded authenticated user ID from localStorage:', authenticatedUserId);
  }
}

export function setAuthenticatedUserId(id: string) {
  authenticatedUserId = id;
  if (typeof window !== 'undefined') {
    localStorage.setItem('authenticatedUserId', id);
    console.log('[Auth] Stored authenticated user ID:', id);
  }
}

export function clearAuthenticatedUserId() {
  authenticatedUserId = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authenticatedUserId');
    console.log('[Auth] Cleared authenticated user ID');
  }
}
// --- End Authenticated User ID Management ---


// Detect if running in Capacitor (mobile app)
const isCapacitor = !!(window as any).Capacitor;

// Get backend URL - use lyricsensei.com for production, same origin for web
const getBackendUrl = () => {
  // For Android/Capacitor, use the verified custom domain
  if (isCapacitor) {
    return "https://lyricsensei.com";
  }
  
  // For web, use current origin (same server)
  return window.location.origin;
};

const BACKEND_URL = getBackendUrl();

export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  // For Capacitor (Android), use the custom domain
  // For web browser, use relative URL (same origin)
  const fullUrl = isCapacitor && !url.startsWith("http") 
    ? `${BACKEND_URL}${url}`
    : url;
  
  console.log(`[API Request] ${method} ${fullUrl}`);
  
  try {
    const headers: Record<string, string> = {
      ...(data ? { "Content-Type": "application/json" } : {}),
      "Accept": "application/json",
    };
    
    // Add guest ID header if available
    if (guestUserId) {
      headers['X-Guest-Id'] = guestUserId;
    }
    
    // Add authenticated user ID header for mobile fallback auth
    if (authenticatedUserId) {
      headers['X-User-Id'] = authenticatedUserId;
    }

    const res = await fetch(fullUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      mode: "cors",
    });

    console.log(`[API Response] ${res.status} ${res.statusText}`);
    await throwIfResNotOk(res);
    return await res.json();
  } catch (error) {
    console.error(`[API Error] ${method} ${fullUrl}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> = 
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const fullUrl = isCapacitor && !url.startsWith("http")
      ? `${BACKEND_URL}${url}`
      : url;
    
    console.log(`[API Request] GET ${fullUrl}`);
    
    try {
      const headers: Record<string, string> = {
        "Accept": "application/json",
      };
      
      if (guestUserId) {
        headers['X-Guest-Id'] = guestUserId;
      }
      
      if (authenticatedUserId) {
        headers['X-User-Id'] = authenticatedUserId;
      }
      
      const res = await fetch(fullUrl, {
        headers,
        credentials: "include",
        mode: "cors",
      });

      console.log(`[API Response] ${res.status} ${res.statusText}`);

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error(`[API Error] GET ${fullUrl}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
