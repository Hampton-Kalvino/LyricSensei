import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

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
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  return {
    user: user as AuthUser | undefined,
    isLoading,
    isAuthenticated: !!user,
  };
}
