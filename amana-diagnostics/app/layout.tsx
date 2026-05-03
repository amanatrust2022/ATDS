import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Amana Trust Diagnostics & Clinical Services',
  description: 'Laboratory and Radiology Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
