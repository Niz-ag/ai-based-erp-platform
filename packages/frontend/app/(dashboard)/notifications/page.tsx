"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { Bell, Check, Trash2, Settings, Mail, MessageSquare, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type TabType = "list" | "preferences";

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("list");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: notificationsData, isLoading: notificationsLoading, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.getAll(),
  });

  const { data: preferencesData, isLoading: preferencesLoading, refetch: refetchPrefs } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => notificationsApi.getPreferences(),
  });

  const [localPrefs, setLocalPrefs] = useState<any>(null);

  React.useEffect(() => {
    if (preferencesData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalPrefs(preferencesData);
    }
  }, [preferencesData]);

  const handleUpdatePrefs = async () => {
    if (!localPrefs) return;
    setIsSubmitting(true);
    try {
      await notificationsApi.updatePreferences(localPrefs);
      toast.success("Preferences saved successfully");
      refetchPrefs();
    } catch (err) {
      toast.error("Failed to save preferences");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationsApi.delete(id);
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'WARNING': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'ERROR': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Manage your alerts and preferences</p>
        </div>
        {activeTab === "list" && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <Check className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b">
        {[{ id: "list", label: "Inbox", icon: Bell }, { id: "preferences", label: "Settings", icon: Settings }].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab.id ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "list" && (
        <div className="rounded-lg border bg-white shadow-sm divide-y">
          {notificationsLoading ? (
            <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-blue-600" /></div>
          ) : notificationsData && notificationsData.length > 0 ? (
            notificationsData.map((n: any) => (
              <div key={n.id} className={`p-4 flex items-start gap-4 ${!n.isRead ? 'bg-blue-50/50' : ''}`}>
                <div className="mt-1">{getNotificationIcon(n.type)}</div>
                <div className="flex-1">
                  <p className={`text-sm ${!n.isRead ? 'font-semibold' : ''}`}>{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-1">
                  {!n.isRead && (
                    <Button variant="ghost" size="icon" onClick={() => handleMarkRead(n.id)}><Check className="h-4 w-4" /></Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(n.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-muted-foreground">No notifications.</div>
          )}
        </div>
      )}

      {activeTab === "preferences" && (
        <div className="max-w-2xl space-y-6">
          <div className="p-6 bg-white border rounded-lg shadow-sm">
            <h3 className="font-semibold mb-4">Channels</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Email Notifications</span>
                <input 
                  type="checkbox" 
                  className="h-5 w-5" 
                  checked={localPrefs?.emailEnabled ?? false} 
                  onChange={(e) => setLocalPrefs({ ...localPrefs, emailEnabled: e.target.checked })}
                />
              </div>
              <div className="flex justify-between items-center">
                <span>Push Notifications</span>
                <input 
                  type="checkbox" 
                  className="h-5 w-5" 
                  checked={localPrefs?.pushEnabled ?? false}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, pushEnabled: e.target.checked })}
                />
              </div>
              <div className="flex justify-between items-center">
                <span>In-App Notifications</span>
                <input 
                  type="checkbox" 
                  className="h-5 w-5" 
                  checked={localPrefs?.inAppEnabled ?? false}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, inAppEnabled: e.target.checked })}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleUpdatePrefs} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
