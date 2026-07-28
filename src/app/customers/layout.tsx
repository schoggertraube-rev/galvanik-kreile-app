/**
 * The canonical customer list may be used because it reads tenant-scoped
 * customer records and a tenant-scoped order count. Create/edit/detail routes
 * remain independently fail-closed until their receipt contracts are complete.
 */
export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
