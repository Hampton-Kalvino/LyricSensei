import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

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
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    // For Capacitor (Android), use the custom domain
    // For web browser, use relative URL (same origin)
    const fullUrl = isCapacitor && !url.startsWith("http")
      ? `${BACKEND_URL}${url}`
      : url;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
