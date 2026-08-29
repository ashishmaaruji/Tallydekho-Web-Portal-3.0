// Local Queue — stores pending entries when offline or API not ready
// Mirrors the offline-first pattern used in the mobile app

const QUEUE_KEY = 'td_pending_queue';

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; }
  catch { return []; }
}

export function addToQueue(type, data) {
  const queue = getQueue();
  const entry = {
    id: Date.now(),
    type,          // 'sales_invoice' | 'purchase_invoice' | 'voucher' etc.
    data,
    status: 'pending', // pending | synced | failed
    createdAt: new Date().toISOString(),
  };
  queue.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return entry;
}

export function markSynced(id) {
  const queue = getQueue().map(e => e.id === id ? { ...e, status: 'synced' } : e);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearSynced() {
  const queue = getQueue().filter(e => e.status !== 'synced');
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getPendingCount() {
  return getQueue().filter(e => e.status === 'pending').length;
}
