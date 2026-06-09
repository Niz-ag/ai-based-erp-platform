"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { toast } from "sonner";
import { usersApi, notificationsApi, settingsApi } from "@/lib/api";
import { Bell, ShieldCheck, Mail, Smartphone, Monitor, User as UserIcon, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const { user, login } = useAuthStore();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("en");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sso_enabled, setSsoEnabled] = useState(false);
  const [keycloak_url, setKeycloakUrl] = useState("");
  const [keycloak_realm, setKeycloakRealm] = useState("");
  const [keycloak_client_id, setKeycloakClientId] = useState("");
  const [isSavingSso, setIsSavingSso] = useState(false);

  const [smtp_host, setSmtpHost] = useState("");
  const [smtp_port, setSmtpPort] = useState("");
  const [smtp_user, setSmtpUser] = useState("");
  const [smtp_pass, setSmtpPass] = useState("");
  const [smtp_from, setSmtpFrom] = useState("");
  const [smtp_secure, setSmtpSecure] = useState(true);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);

  const [prefs, setPrefs] = useState<any>(null);

  const fetchSettings = async () => {
    try {
      const data = await settingsApi.get();
      if (data?.settings) {
        setSsoEnabled(data.settings.sso_enabled || false);
        setKeycloakUrl(data.settings.keycloak_url || "");
        setKeycloakRealm(data.settings.keycloak_realm || "");
        setKeycloakClientId(data.settings.keycloak_client_id || "");

        setSmtpHost(data.settings.smtp_host || "");
        setSmtpPort(data.settings.smtp_port || "");
        setSmtpUser(data.settings.smtp_user || "");
        setSmtpPass(data.settings.smtp_pass || "");
        setSmtpFrom(data.settings.smtp_from || "");
        setSmtpSecure(data.settings.smtp_secure ?? true);
      }
    } catch (err) {
      console.error("Failed to fetch tenant settings");
    }
  };

  const fetchPrefs = async () => {
    try {
      const data = await notificationsApi.getPreferences();
      setPrefs(data);
    } catch (err) {
      console.error("Failed to fetch notification preferences");
    }
  };

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFirstName(user?.firstName || "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastName(user?.lastName || "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(user?.theme || "light");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguage(user?.language || "en");
      
      fetchPrefs();
      fetchSettings();
    }
  }, [user]);

  const handleSaveSso = async () => {
    setIsSavingSso(true);
    try {
      await settingsApi.update({
        sso_enabled,
        keycloak_url,
        keycloak_realm,
        keycloak_client_id,
      });
      toast.success("SSO configuration saved");
    } catch (err) {
      toast.error("Failed to save SSO configuration");
    } finally {
      setIsSavingSso(false);
    }
  };

  const handleSaveSmtp = async () => {
    setIsSavingSmtp(true);
    try {
      await settingsApi.updateSmtp({
        host: smtp_host,
        port: smtp_port,
        user: smtp_user,
        password: smtp_pass,
        from: smtp_from,
        secure: smtp_secure,
      });
      toast.success("SMTP configuration saved");
    } catch (err) {
      toast.error("Failed to save SMTP configuration");
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${user.id}/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      login({ ...user, avatar: data.avatar });
      toast.success("Profile picture updated");
    } catch (err: any) {
      toast.error("Failed to upload avatar");
    } finally {
      setIsUploading(false);
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
      await usersApi.update(user.id, { firstName, lastName, theme, language });
      // Update local store
      login({
        ...user,
        firstName,
        lastName,
        theme,
        language,
        name: `${firstName} ${lastName}`.trim()
      });
      
      // Apply theme immediately
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
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

      {/* Avatar Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Update your public avatar</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative h-24 w-24 rounded-full border border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
            {user?.avatar ? (
              <img
                src={`${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '')}${user.avatar.startsWith('/') ? user.avatar : '/' + user.avatar}`}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserIcon className="h-10 w-10 text-gray-400" />
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Update your photo. Recommended size 400x400px.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild disabled={isUploading}>
                <label className="cursor-pointer">
                  {isUploading ? "Uploading..." : "Upload Photo"}
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                </label>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Personalization Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Personalization</CardTitle>
          <CardDescription>Customize your dashboard experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Toggle between light and dark UI themes</p>
            </div>
            <Switch 
              checked={theme === 'dark'} 
              onCheckedChange={(val) => setTheme(val ? 'dark' : 'light')}
            />
          </div>
          <div className="flex items-center justify-between border-t pt-6">
            <div className="space-y-1">
              <p className="text-sm font-medium">Display Language</p>
              <p className="text-xs text-muted-foreground">Choose your preferred system language</p>
            </div>
            <select 
              className="px-3 py-2 border rounded-md text-sm"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English (US)</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
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

      {/* SMTP Settings */}
      <Card>
        <CardHeader>
          <CardTitle>SMTP Settings</CardTitle>
          <CardDescription>Configure outgoing email server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Host</Label>
              <Input 
                placeholder="smtp.example.com" 
                value={smtp_host}
                onChange={(e) => setSmtpHost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input 
                placeholder="587" 
                value={smtp_port}
                onChange={(e) => setSmtpPort(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Input 
                placeholder="user@example.com" 
                value={smtp_user}
                onChange={(e) => setSmtpUser(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input 
                type="password"
                placeholder="••••••••" 
                value={smtp_pass}
                onChange={(e) => setSmtpPass(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>From Email</Label>
            <Input 
              placeholder="noreply@example.com" 
              value={smtp_from}
              onChange={(e) => setSmtpFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Secure Connection (SSL/TLS)</Label>
              <p className="text-xs text-muted-foreground font-normal">Use encrypted connection for email delivery</p>
            </div>
            <Switch 
              checked={smtp_secure} 
              onCheckedChange={(val) => setSmtpSecure(val)}
            />
          </div>
          <Button variant="outline" onClick={handleSaveSmtp} disabled={isSavingSmtp}>
            {isSavingSmtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save SMTP Config
          </Button>
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
              variant={sso_enabled ? "default" : "outline"}
              onClick={() => setSsoEnabled(!sso_enabled)}
            >
              {sso_enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
          {sso_enabled && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Keycloak URL</Label>
                <Input 
                  placeholder="http://localhost:8080" 
                  value={keycloak_url}
                  onChange={(e) => setKeycloakUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Realm</Label>
                <Input 
                  placeholder="amdox" 
                  value={keycloak_realm}
                  onChange={(e) => setKeycloakRealm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input 
                  placeholder="amdox-app" 
                  value={keycloak_client_id}
                  onChange={(e) => setKeycloakClientId(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={handleSaveSso} disabled={isSavingSso}>
                {isSavingSso ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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