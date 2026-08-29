// Tiny shared store so the sidebar badge and the notifications page agree.
import { useState, useEffect } from 'react';
import { NOTIFICATIONS } from './derived';

let items = NOTIFICATIONS.map(n => ({ ...n }));
const listeners = new Set();
const emit = () => listeners.forEach(l => l(items));

export function markAllRead() {
  items = items.map(n => ({ ...n, read: true }));
  emit();
}
export function markRead(id) {
  items = items.map(n => (n.id === id ? { ...n, read: true } : n));
  emit();
}

export function useNotifications() {
  const [list, setList] = useState(items);
  useEffect(() => {
    listeners.add(setList);
    return () => listeners.delete(setList);
  }, []);
  return { items: list, unread: list.filter(n => !n.read).length, markAllRead, markRead };
}
