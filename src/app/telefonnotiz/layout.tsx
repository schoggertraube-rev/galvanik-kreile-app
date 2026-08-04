import "./telefonnotiz.css";
import { Fraunces, Manrope } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-telefonnotiz-fraunces",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-telefonnotiz-manrope",
});

export default function TelefonnotizLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${manrope.variable}`}>
      {children}
    </div>
  );
}
