import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { useNotificationStore } from '@/lib/store/useNotificationStore';
import { toast } from 'sonner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export function useNotifications() {
  const { user } = useAuthStore();
  const { addNotification, fetchUnreadCount } = useNotificationStore();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!user) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Initial fetch of unread count
    fetchUnreadCount();

    const token = localStorage.getItem('token');
    if (!token) return;

    // Connect to SSE stream
    // Note: EventSource doesn't support custom headers directly. 
    // We might need to pass the token as a query parameter or use a polyfill.
    // However, for this implementation, we'll assume the backend can handle token in query param
    // or we use a workaround if needed.
    // NestJS JwtAuthGuard usually expects Bearer token in header.
    
    // Workaround for EventSource with Auth: Use a custom EventSource if needed, 
    // but many browsers support it via query param if the backend is configured.
    // Let's try passing it as a query param and see if the backend needs adjustment.
    
    const url = `${API_BASE_URL}/notifications/stream?token=${token}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('Notifications stream connected');
          return;
        }

        // It's a real notification
        addNotification(data);
        
        // Show toast
        toast.info(data.title, {
          description: data.message,
          duration: 5000,
        });
      } catch (error) {
        console.error('Error parsing notification data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      eventSource.close();
      
      // Retry connection after some time
      setTimeout(() => {
        if (user) {
          // Trigger re-run of this effect
        }
      }, 5000);
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [user, addNotification, fetchUnreadCount]);

  return null;
}
