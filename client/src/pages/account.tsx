import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Mail, Calendar, CreditCard, AlertCircle, User, Edit2, Save, Globe, LogOut, Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, Redirect, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateUserProfileSchema, type UpdateUserProfile } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import logoImage from "@assets/ChatGPT Image Nov 5, 2025, 05_37_31 PM_1762887933822.png";

export default function Account() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Redirect unauthenticated users to landing page
  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }
  
  const isGuest = (user as any)?.isGuest ?? false;
  const authProvider = (user as any)?.authProvider;

  const isPremium = (user as any)?.isPremium ?? false;
  const email = (user as any)?.email ?? "user@example.com";
  const firstName = (user as any)?.firstName;
  const lastName = (user as any)?.lastName;
  const username = (user as any)?.username;
  const country = (user as any)?.country;
  const profileImageUrl = (user as any)?.profileImageUrl;

  const form = useForm<UpdateUserProfile>({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: {
      username: username || "",
      country: country || "",
      firstName: firstName || "",
      lastName: lastName || "",
      profileImageUrl: profileImageUrl || "",
    },
  });

  const onSubmit = async (data: UpdateUserProfile) => {
    setIsLoading(true);
    try {
      const submitData = { ...data };
      
      // If a file was selected, convert it to data URL
      if (fileInputRef.current?.files?.[0]) {
        const file = fileInputRef.current.files[0];
        
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File Too Large",
            description: "Image must be less than 10MB.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          submitData.profileImageUrl = dataUrl;
        } catch (readError) {
          console.error("File read error:", readError);
          toast({
            title: "Image Upload Failed",
            description: "Could not process the image file.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }
      
      await apiRequest("PUT", "/api/user/profile", submitData);
      
      // Invalidate user query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      
      setIsEditingProfile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({
        title: "Update Failed",
        description: error.message || "Could not update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setLocation("#/auth/login");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest("POST", "/api/create-portal-session") as { url: string };
      window.location.href = data.url;
    } catch (error) {
      console.error("Portal error:", error);
      toast({
        title: t('account.portalError'),
        description: t('account.portalErrorDescription'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm(t('account.cancelConfirmation'))) {
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await apiRequest("POST", "/api/create-portal-session") as { url: string };
      window.location.href = data.url;
    } catch (error) {
      console.error("Portal error:", error);
      toast({
        title: t('account.portalError'),
        description: t('account.portalErrorDescription'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetTranslations = async () => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/user/reset-translations");
      toast({
        title: "Translation Count Reset",
        description: "Your daily translation count has been reset to 0.",
      });
      window.location.reload();
    } catch (error) {
      console.error("Reset error:", error);
      toast({
        title: "Reset Failed",
        description: "Could not reset translation count. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-4">
          <img 
            src={logoImage} 
            alt="LyricSync Logo" 
            className="h-32 md:h-48 lg:h-56 w-auto object-contain"
            data-testid="img-account-logo"
          />
          <div>
            <h1 className="text-3xl font-bold">{t('account.title')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('account.description')}
            </p>
          </div>
        </div>

        {/* Edit Profile Section */}
        <Card className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Profile</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                data-testid="button-toggle-edit-profile"
              >
                {isEditingProfile ? <Save className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                <span className="ml-2">{isEditingProfile ? "Cancel" : "Edit"}</span>
              </Button>
            </div>

            <Separator />

            {isEditingProfile ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="flex items-start gap-6">
                    <div className="flex flex-col items-center gap-3">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={form.watch("profileImageUrl") || undefined} />
                        <AvatarFallback className="text-2xl">
                          {(form.watch("username") || firstName || "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <Label htmlFor="profile-picture" className="text-sm">Profile Picture</Label>
                        <Input 
                          id="profile-picture"
                          type="file"
                          accept="image/*"
                          ref={fileInputRef}
                          data-testid="input-profile-picture-file"
                        />
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG or GIF. Max 10MB.
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="John"
                                  data-testid="input-first-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="Doe"
                                  data-testid="input-last-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="musiclover123"
                                data-testid="input-username"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="United States"
                                data-testid="input-country"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditingProfile(false)}
                      disabled={isLoading}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      data-testid="button-save-profile"
                    >
                      {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="flex items-start gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profileImageUrl || undefined} />
                  <AvatarFallback className="text-2xl">
                    {(username || firstName || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{t('account.email')}</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-user-email">
                        {email}
                      </p>
                    </div>
                  </div>

                  {(firstName || lastName) && (
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{t('account.name')}</p>
                        <p className="text-sm text-muted-foreground" data-testid="text-user-name">
                          {firstName} {lastName}
                        </p>
                      </div>
                    </div>
                  )}

                  {username && (
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Username</p>
                        <p className="text-sm text-muted-foreground" data-testid="text-username">
                          @{username}
                        </p>
                      </div>
                    </div>
                  )}

                  {country && (
                    <div className="flex items-start gap-3">
                      <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Country</p>
                        <p className="text-sm text-muted-foreground" data-testid="text-country">
                          {country}
                        </p>
                      </div>
                    </div>
                  )}

                  {isPremium && (
                    <div className="pt-2">
                      <Badge variant="default" className="gap-1">
                        <Crown className="h-3 w-3" />
                        {t('account.premium')}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Subscription Information */}
        <Card className="p-6">
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">{t('account.subscription')}</h2>
            <Separator />

            {isPremium ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('account.currentPlan')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('account.premiumPlan')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('account.nextBillingDate')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('account.billingDateAvailable')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleManageSubscription}
                    disabled={isLoading}
                    data-testid="button-manage-subscription"
                  >
                    {isLoading ? t('account.loading') : t('account.manageSubscription')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelSubscription}
                    disabled={isLoading}
                    data-testid="button-cancel-subscription"
                  >
                    {isLoading ? t('account.loading') : t('account.cancelSubscription')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('account.free')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('account.freeLimitInfo')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link href="/pricing">
                    <Button data-testid="button-upgrade-account">
                      {t('account.upgradeToPremium')}
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={handleResetTranslations}
                    disabled={isLoading}
                    data-testid="button-reset-translations"
                  >
                    {isLoading ? t('account.loading') : 'Reset Daily Limit'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Account Management & Guest Options */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              {isGuest ? "Your Account" : "Account Information"}
            </h2>
            <Separator />
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Email Address</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-account-email">
                    {email}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Account Type</p>
                  <p className="text-sm text-muted-foreground capitalize" data-testid="text-account-type">
                    {isGuest ? "Guest Mode" : authProvider || "Registered"}
                  </p>
                </div>
              </div>
            </div>

            {isGuest && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Upgrade Your Account</p>
                  <div className="flex flex-col gap-2">
                    <Link href="/auth/login">
                      <Button variant="default" className="w-full" data-testid="button-signup-full-account">
                        Sign Up with Email
                      </Button>
                    </Link>
                    
                    <Link href="/auth/login">
                      <Button variant="outline" className="w-full gap-2" data-testid="button-signin-google">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
                        </svg>
                        Sign Up with Google
                      </Button>
                    </Link>
                  </div>
                </div>
              </>
            )}

          </div>
        </Card>

        {/* Benefits Summary */}
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="font-semibold">
              {isPremium ? t('pricing.premiumTitle') : t('pricing.premiumTitle')}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className={isPremium ? "text-primary" : ""}>✓</span>
                {t('pricing.premiumFeature2')}
              </li>
              <li className="flex items-center gap-2">
                <span className={isPremium ? "text-primary" : ""}>✓</span>
                {t('pricing.premiumFeature3')}
              </li>
              <li className="flex items-center gap-2">
                <span className={isPremium ? "text-primary" : ""}>✓</span>
                {t('pricing.premiumFeature4')}
              </li>
              <li className="flex items-center gap-2">
                <span className={isPremium ? "text-primary" : ""}>✓</span>
                {t('pricing.premiumFeature5')}
              </li>
              <li className="flex items-center gap-2">
                <span className={isPremium ? "text-primary" : ""}>✓</span>
                {t('pricing.premiumFeature6')}
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
