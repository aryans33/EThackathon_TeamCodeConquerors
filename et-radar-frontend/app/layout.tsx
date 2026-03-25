import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import Navbar from '@/components/Navbar'
import DemoModeBanner from '@/components/DemoModeBanner'

import { ThemeProvider } from "@/components/ThemeProvider"

export const metadata: Metadata = {
  title: 'ET Radar',
  description: 'Stock Intelligence Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <body className="bg-brand-bg text-brand-text min-h-screen flex flex-col relative transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <DemoModeBanner />
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 flex flex-col">
            {children}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
