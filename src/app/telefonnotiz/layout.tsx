import "./telefonnotiz.css";

export default function TelefonnotizLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Google Fonts: Fraunces + Manrope */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      {children}
    </>
  );
}
