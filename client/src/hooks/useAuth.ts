import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest, setGuestUserId, clearGuestUserId, setAuthenticatedUserId, clearAuthenticatedUserId } from "@/lib/queryClient";

interface AuthUser {
  id: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  isPremium?: boolean;
  isGuest?: boolean;
  authProvider?: string;
  createdAt?: string;
  country?: string;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  // Sync authenticated user ID for mobile header-based auth
  useEffect(() => {
    if (user && !user.isGuest && user.id) {
      setAuthenticatedUserId(user.id);
      console.log('[Auth] Set authenticated user ID:', user.id);
    } else if (!user) {
      clearAuthenticatedUserId();
    }
  }, [user]);

  async function loginAsGuest() {
    try {
      const response: any = await apiRequest('POST', '/api/auth/guest');
      if (response && response.user) {
        setGuestUserId(response.user.id);
        
        // Invalidate the user query to refetch and update auth state
        await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      }
      return response;
    } catch (error) {
      console.error('Guest login failed:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      // If authenticated user, call logout endpoint
      if (user && !user.isGuest) {
        await apiRequest('POST', '/api/auth/logout');
      }
      
      // Clear guest ID
      clearGuestUserId();
      
      // Clear user query
      queryClient.setQueryData(['/api/auth/user'], null);
      
      // Invalidate to refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  return {
    user: user as AuthUser | undefined,
    isLoading,
    isAuthenticated: !!user,
    loginAsGuest,
    logout, // Add logout function
  };
}
