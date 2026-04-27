import type { Metadata } from "next";
import { Playfair_Display, Nunito_Sans } from "next/font/google";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = settings?.siteTitle?.trim() || "Mindy Hu Photography";
  const description =
    settings?.tagline?.trim() || "Portrait photography by Mindy Hu";
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL || "https://mindyhuphotography.com",
    ),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: "/og-image.jpg",
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.jpg"],
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="font-sans text-gray-900 bg-white antialiased">
        {children}
      </body>
    </html>
  );
}
