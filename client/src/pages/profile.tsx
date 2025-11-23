import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, MapPin, LogOut, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Profile() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    username: user?.username || "",
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    country: user?.country || "",
  });
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth/login");
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setLocation("/auth/login");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const getInitials = () => {
    const first = user?.firstName?.[0] || "";
    const last = user?.lastName?.[0] || "";
    return (first + last).toUpperCase();
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">Manage your account and settings</p>
        </div>

        {/* Profile Card */}
        <Card className="p-6 space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.profileImageUrl || ""} alt={user.username} />
              <AvatarFallback>{getInitials() || "U"}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{user.username}</h2>
              <p className="text-muted-foreground">{user.email}</p>
              {user.isGuest && (
                <div className="text-sm bg-primary/20 text-primary px-3 py-1 rounded-full w-fit">
                  Guest Mode
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {isEditing ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <Input
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      placeholder="First name"
                      data-testid="input-profile-firstname"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <Input
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      placeholder="Last name"
                      data-testid="input-profile-lastname"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <Input
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    placeholder="Your username"
                    data-testid="input-profile-username"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Country</label>
                  <Input
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    placeholder="Your country"
                    data-testid="input-profile-country"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Profile Picture
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProfileImage(e.target.files?.[0] || null)}
                    data-testid="input-profile-picture"
                  />
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG or GIF. Max 10MB.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    data-testid="button-save-profile"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    data-testid="button-cancel-profile"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      First Name
                    </label>
                    <p className="font-medium">{user.firstName || "—"}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Last Name
                    </label>
                    <p className="font-medium">{user.lastName || "—"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                  <p className="font-medium">{user.email}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Country
                  </label>
                  <p className="font-medium">{user.country || "—"}</p>
                </div>

                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  data-testid="button-edit-profile"
                >
                  Edit Profile
                </Button>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="border-t"></div>

          {/* Account Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Account Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Premium Status</span>
                <span className="font-medium">
                  {user.isPremium ? "✓ Premium" : "Free Tier"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auth Method</span>
                <span className="font-medium capitalize">
                  {user.authProvider === "guest" ? "Guest Mode" : user.authProvider}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Member Since</span>
                <span className="font-medium">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Logout */}
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </Card>
      </div>
    </div>
  );
}
