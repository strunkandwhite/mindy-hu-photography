import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mindy Hu Photography",
  description: "Portrait photography by Mindy Hu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans text-gray-900 bg-white antialiased">
        {children}
      </body>
    </html>
  );
}
