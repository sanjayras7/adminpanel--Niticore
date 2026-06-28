import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Niticore Admin',
  description: 'Niticore Super Admin Panel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
