import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DiagnosticOS — Diagnostic Centre Management',
  description: 'Cloud-based LIS for diagnostic centres. Reception, Lab, Radiology, and Results — all in one platform.',
}

import { AuthProvider } from '@/components/AuthProvider'
import RootWrapper from '@/components/RootWrapper'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <RootWrapper>
            {children}
          </RootWrapper>
        </AuthProvider>
      </body>
    </html>
  )
}
