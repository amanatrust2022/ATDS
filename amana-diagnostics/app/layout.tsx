import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DiagnosticOS — Diagnostic Centre Management',
  description: 'Cloud-based LIS for diagnostic centres. Reception, Lab, Radiology, and Results — all in one platform.',
  manifest: '/manifest.json',
}

import { AuthProvider } from '@/components/AuthProvider'
import RootWrapper from '@/components/RootWrapper'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__SUPABASE_URL__ = ${JSON.stringify(supabaseUrl)};
              window.__SUPABASE_ANON_KEY__ = ${JSON.stringify(supabaseAnonKey)};
            `,
          }}
        />
        <AuthProvider>
          <RootWrapper>
            {children}
          </RootWrapper>
        </AuthProvider>
      </body>
    </html>
  )
}
