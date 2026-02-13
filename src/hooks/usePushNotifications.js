import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = 'BGYTlBv2p2G7U_bQkQs_kzlhX6_ahMZd9nv6f0CUj21vyjeMyI5IT5bnv5mtN0IW63ISx68E4nYu9StO7XJRKEE';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushNotifications(userId) {
  const [pushPermission, setPushPermission] = useState('default');
  const [pushSubscription, setPushSubscription] = useState(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !userId) return null;

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== 'granted') return null;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      setPushSubscription(subscription);

      // Store in database
      const subJson = subscription.toJSON();
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: subJson.endpoint,
        auth: subJson.keys.auth,
        p256dh: subJson.keys.p256dh,
      }, { onConflict: 'user_id,endpoint' });

      return subscription;
    } catch (err) {
      console.error('Push subscription error:', err);
      return null;
    }
  }, [userId]);

  return { pushPermission, pushSubscription, subscribeToPush };
}
