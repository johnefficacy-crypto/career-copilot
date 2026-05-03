import type { Metadata } from "next"
import { Playfair_Display, DM_Sans, DM_Mono } from "next/font/google"
import "./globals.css"

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600"],
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500"],
})

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "Career Copilot — Your AI Govt Exam Companion",
  description:
    "Track notifications, match eligibility, get a personalised study plan, and prepare smarter for UPSC, SEBI, RBI, SSC, IBPS and every other government exam.",
  keywords: "government exam, UPSC, SEBI, RBI, SSC, IBPS, study plan, eligibility, notifications",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <body className="min-h-screen bg-[#0c0c0c] text-white antialiased font-sans">
        {children}
      </body>
    </html>
  )
}