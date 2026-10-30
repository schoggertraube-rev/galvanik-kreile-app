/** Kurzes haptisches Signal auf Touch-Geräten (falls vom Gerät unterstützt). Kein Ton, kein Zwang. */
export function tippen(ms = 8): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && matchMedia('(pointer:coarse)').matches) navigator.vibrate(ms);
}
