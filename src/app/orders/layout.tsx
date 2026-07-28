/**
 * The canonical list may be used because it reads only tenant-scoped orders
 * and renders explicit loading/error states. Detail routes remain independently
 * fail-closed until their evidence and receipt contracts are complete.
 */
export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
