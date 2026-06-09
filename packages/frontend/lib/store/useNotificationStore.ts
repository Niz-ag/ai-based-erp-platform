import { create } from 'zustand';
import { notificationsApi } from '@/lib/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  isRead: boolean;
}

interface NotificationStore {
  unreadCount: number;
  notifications: Notification[];
  setUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  addNotification: (notification: Notification) => void;
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set, get) => {
  return {
    unreadCount: 0,
    notifications: [],
    setUnreadCount: (count) => set({ unreadCount: count }),
    incrementUnreadCount: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
    addNotification: (notification) => 
      set((state) => {
        // Prevent duplicates
        if (state.notifications.some(n => n.id === notification.id)) return state;
        return { 
          notifications: [notification, ...state.notifications].slice(0, 50),
          unreadCount: state.unreadCount + 1
        };
      }),
    fetchUnreadCount: async () => {
      try {
        const data = await notificationsApi.getUnreadCount();
        set({ unreadCount: data });
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    },
    fetchNotifications: async () => {
      try {
        const data = await notificationsApi.getAll();
        set({ notifications: data });
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    },
    markAsRead: async (id) => {
      try {
        await notificationsApi.markAsRead(id);
        set((state) => ({
          unreadCount: Math.max(0, state.unreadCount - 1),
          notifications: state.notifications.map((n) => 
            n.id === id ? { ...n, isRead: true } : n
          ),
        }));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
  };
});
