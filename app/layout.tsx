import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "עורך וידאו AI | AI Video Editor",
  description: "עורך וידאו מבוסס בינה מלאכותית עם יצירת תמונות ממוזערות אוטומטית",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800;900&family=Heebo:wght@400;600;700;800;900&family=Rubik:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
