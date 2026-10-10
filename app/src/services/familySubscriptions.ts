const subscriptions = new Set<() => void>();
export function registerFamilySubscriptions(...callbacks: (() => void)[]): () => void {
  let active = true;
  const dispose = () => { if (!active) return; active = false; subscriptions.delete(dispose); callbacks.forEach(callback => callback()); };
  subscriptions.add(dispose);
  return dispose;
}
export function stopFamilySubscriptions(): void {
  [...subscriptions].forEach(dispose => dispose());
}
