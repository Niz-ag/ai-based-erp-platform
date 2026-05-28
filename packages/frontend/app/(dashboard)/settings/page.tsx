"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { toast } from "sonner";
import { usersApi, notificationsApi } from "@/lib/api";
import { Bell, ShieldCheck, Mail, Smartphone, Monitor } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const { user, login } = useAuthStore();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [prefs, setPrefs] = useState<any>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user?.firstName || "");
      setLastName(user?.lastName || "");
      fetchPrefs();
    }
  }, [user]);

  const fetchPrefs = async () => {
    try {
      const data = await notificationsApi.getPreferences();
      setPrefs(data);
    } catch (err) {
      console.error("Failed to fetch notification preferences");
    }
  };

  const handleUpdatePrefs = async (key: string, value: boolean) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    try {
      await notificationsApi.updatePreferences(newPrefs);
      toast.success("Preferences updated");
    } catch (err) {
      toast.error("Failed to update preferences");
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdating(true);
    try {
      await usersApi.update(user.id, { firstName, lastName });
      // Update local store
      login({
        ...user,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim()
      });
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error("Failed to update profile", { description: err.message });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application preferences</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input 
                id="firstName" 
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input 
                id="lastName" 
                value={lastName} 
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={user?.email || ''} disabled />
          </div>
          <Button onClick={handleUpdateProfile} disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Notification Channels
          </CardTitle>
          <CardDescription>Choose how you want to receive business alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><Mail className="h-4 w-4 text-blue-600" /></div>
              <div>
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Receive daily summaries and critical alerts</p>
              </div>
            </div>
            <Switch 
              checked={prefs?.emailEnabled ?? true} 
              onCheckedChange={(val) => handleUpdatePrefs('emailEnabled', val)}
            />
          </div>
          <div className="flex items-center justify-between border-t pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg"><Monitor className="h-4 w-4 text-purple-600" /></div>
              <div>
                <p className="text-sm font-medium">In-App Notifications</p>
                <p className="text-xs text-muted-foreground">Real-time alerts within the dashboard</p>
              </div>
            </div>
            <Switch 
              checked={prefs?.inAppEnabled ?? true} 
              onCheckedChange={(val) => handleUpdatePrefs('inAppEnabled', val)}
            />
          </div>
          <div className="flex items-center justify-between border-t pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg"><Smartphone className="h-4 w-4 text-green-600" /></div>
              <div>
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground">Instant notifications on your device</p>
              </div>
            </div>
            <Switch 
              checked={prefs?.pushEnabled ?? false} 
              onCheckedChange={(val) => handleUpdatePrefs('pushEnabled', val)}
            />
          </div>
        </CardContent>
      </Card>

      {/* SSO Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Single Sign-On (SSO)</CardTitle>
          <CardDescription>Configure Keycloak or SAML authentication</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable SSO</p>
              <p className="text-sm text-muted-foreground">Allow users to login via Keycloak</p>
            </div>
            <Button 
              variant={ssoEnabled ? "default" : "outline"}
              onClick={() => setSsoEnabled(!ssoEnabled)}
            >
              {ssoEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
          {ssoEnabled && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Keycloak URL</Label>
                <Input placeholder="http://localhost:8080" />
              </div>
              <div className="space-y-2">
                <Label>Realm</Label>
                <Input placeholder="amdox" />
              </div>
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input placeholder="amdox-app" />
              </div>
              <Button variant="outline" onClick={() => toast.success("SSO settings saved")}>
                Save SSO Config
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive">Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}