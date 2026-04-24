import { Inter, Outfit } from "next/font/google";
import "./globals.css";

// Inter for UI text; Outfit for a playful, hackathon-style hero title.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata = {
  title: "Meme Studio — serverless memes (Vercel + S3 + Lambda)",
  description:
    "Upload an image, add context, get three captioned memes. Next.js, presigned S3 upload, event-driven Lambda + Sharp, job manifest in S3.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
