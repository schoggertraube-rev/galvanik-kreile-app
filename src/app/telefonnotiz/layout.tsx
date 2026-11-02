import "./telefonnotiz.css";
import { TelefonnotizLayoutBoundary } from "@/modules/eingang/public";
import { telefonnotizFraunces, telefonnotizManrope } from "../fonts/localFonts";

export default function TelefonnotizLayout({ children }: { children: React.ReactNode }) {
  return (
    <TelefonnotizLayoutBoundary className={`${telefonnotizFraunces.variable} ${telefonnotizManrope.variable}`}>
      {children}
    </TelefonnotizLayoutBoundary>
  );
}
