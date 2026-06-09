"use client";

import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationStore } from '@/lib/store/useNotificationStore';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/lib/hooks/useNotifications';
import Link from 'next/link';

export function NotificationBell() {
  // Initialize the hook to start SSE connection
  useNotifications();
  
  const { unreadCount, fetchUnreadCount } = useNotificationStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  if (!isMounted) return null;

  return (
    <Link href="/notifications" className="relative">
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
    </Link>
  );
}
