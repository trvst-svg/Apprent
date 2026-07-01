'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Bell, Check, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string;
  createdAt: string;
}

export default function NotificationBell() {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (token && user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // poll every 30s
      return () => clearInterval(interval);
    }
  }, [token, user]);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch('/api/v1/notifications?limit=5', { token: token || undefined });
      const countRes = await apiFetch<{ count: number }>('/api/v1/notifications/unread-count', { token: token || undefined });
      setNotifications(res.data || []);
      setUnreadCount(countRes.count || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/api/v1/notifications/${id}`, {
        method: 'PUT',
        token: token || undefined,
      });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch('/api/v1/notifications/all', {
        method: 'PUT',
        token: token || undefined,
      });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-100 rounded-full"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 hover:bg-red-700 text-zinc-50 border-2 border-zinc-950 font-mono text-[9px]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <Card className="absolute right-0 mt-2 w-80 bg-zinc-900 border-zinc-800 shadow-2xl z-50 overflow-hidden text-zinc-100">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="font-bold text-sm text-zinc-200">Alert System Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold animate-pulse"
                >
                  <Check className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-800/60">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                  <BellOff className="h-8 w-8 text-zinc-700" />
                  No new security alerts or notifications.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 text-xs transition-colors hover:bg-zinc-800/40 relative ${
                      !n.read ? 'bg-zinc-800/20' : ''
                    }`}
                  >
                    {!n.read && (
                      <span className="absolute top-4 left-2 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    )}
                    <div className="pl-3">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-zinc-300">{n.title}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-zinc-400 mt-1">{n.message}</p>
                      <div className="flex gap-3 mt-2">
                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => {
                              markAsRead(n.id);
                              setIsOpen(false);
                            }}
                            className="text-[10px] text-indigo-400 hover:underline font-semibold"
                          >
                            View details
                          </Link>
                        )}
                        {!n.read && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 font-semibold"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
