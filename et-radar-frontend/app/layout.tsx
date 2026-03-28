import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { ThemeProvider } from 'next-themes'
import { ToastProvider } from '@/context/ToastContext'
import favicon from './favicon.png'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ET Radar',
  description: 'AI-Powered Stock Intelligence',
  icons: {
    icon: favicon.src,
    shortcut: favicon.src,
    apple: favicon.src,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-surface-0 text-content-primary transition-colors`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <ToastProvider>
            <Navbar />
            <div className="pt-12 md:pt-14">
              {children}
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
