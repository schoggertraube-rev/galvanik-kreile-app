import type { ReactNode } from "react";

export type TelefonnotizLayoutBoundaryProps = {
  children: ReactNode;
  className: string;
};

export function TelefonnotizLayoutBoundary({
  children,
  className,
}: TelefonnotizLayoutBoundaryProps) {
  return (
    <div className={className} data-spec-id="telefonnotiz.layout">
      {children}
    </div>
  );
}
