import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Word Family - 应单词表",
  description: "Word Family Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
