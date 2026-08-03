'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

// Convert base64 string to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// VAPID public key - must be set as env variable
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export function PWARegister() {
  const { user } = useAuth();

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then(async (registration) => {
          // If user is logged in and VAPID key is configured, subscribe to push
          if (user && VAPID_PUBLIC_KEY) {
            try {
              const existingSub = await registration.pushManager.getSubscription();
              if (!existingSub) {
                const sub = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
                // Save subscription to database
                const keys = sub.getKey('p256dh');
                const authKeys = sub.getKey('auth');
                await supabase.from('push_subscriptions').upsert({
                  user_id: user.id,
                  endpoint: sub.endpoint,
                  p256dh_key: keys ? btoa(String.fromCharCode(...new Uint8Array(keys))) : '',
                  auth_key: authKeys ? btoa(String.fromCharCode(...new Uint8Array(authKeys))) : '',
                }, { onConflict: 'user_id,endpoint' });
              }
            } catch (err) {
              console.warn('Push aboneliği başarısız:', err);
            }
          }
        })
        .catch((err) => {
          console.warn('Service Worker kaydedilemedi:', err);
        });

      // Listen for messages from service worker (emergency notifications)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'EMERGENCY_NOTIFICATION') {
          // Dispatch custom event for the app to handle — the dashboard shell
          // picks this up and shows the full-screen overlay + alarm
          window.dispatchEvent(new CustomEvent('emergency-notification', { detail: event.data }));
        }
      });
    }
  }, [user]);

  return null;
}
