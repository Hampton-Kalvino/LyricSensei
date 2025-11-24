import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest, setGuestUserId } from "@/lib/queryClient";

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

  async function loginAsGuest() {
    try {
      const response: any = await apiRequest('POST', '/api/auth/guest');
      if (response && response.user) {
        setGuestUserId(response.user.id);
        // Store in localStorage for persistence
        localStorage.setItem('guestUserId', response.user.id);
        
        // Invalidate the user query to refetch and update auth state
        await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      }
      return response;
    } catch (error) {
      console.error('Guest login failed:', error);
      throw error;
    }
  }

  return {
    user: user as AuthUser | undefined,
    isLoading,
    isAuthenticated: !!user,
    loginAsGuest, // Expose the new function
  };
}
