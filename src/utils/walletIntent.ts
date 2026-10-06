export type WalletIntent = { userId: string; amount: number; reason: string; key: string };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const storageKey = (userId: string) => `mota_wallet_intent:${userId}`;
export function readWalletIntent(storage: Storage, userId: string): WalletIntent | null {
  const raw = storage.getItem(storageKey(userId));
  if (!raw) return null;
  try { const value = JSON.parse(raw); if (value.userId === userId && Number.isSafeInteger(value.amount) && value.amount > 0 && typeof value.reason === 'string' && typeof value.key === 'string' && value.key.length >= 16) return value; } catch { /* Fail closed for a potentially unresolved operation. */ }
  throw Error('The saved wallet operation could not be read. Reconcile this account’s transactions before starting another top-up.');
}
export function getWalletIntent(storage: Storage, userId: string, amount: number, reason: string, createKey: () => string): WalletIntent {
  const existing = readWalletIntent(storage, userId);
  if (existing) {
    if (existing.amount !== amount || existing.reason !== reason) throw Error('An earlier top-up is awaiting confirmation. Retry its original amount and reason before starting another.');
    return existing;
  }
  const next = { userId, amount, reason, key: createKey() };
  storage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}
export function completeWalletIntent(storage: Storage, intent: WalletIntent) {
  if (readWalletIntent(storage, intent.userId)?.key === intent.key) storage.removeItem(storageKey(intent.userId));
}
