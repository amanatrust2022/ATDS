import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono, IBM_Plex_Serif } from 'next/font/google'
import './globals.css'

/**
 * Fonts are bundled at build time rather than fetched from Google at runtime.
 *
 * The stylesheet used to open with an @import to fonts.googleapis.com. That
 * blocks the first paint, and on a clinic machine with no internet — which is
 * the whole premise of local mode — the faces never arrived at all. next/font
 * self-hosts them into the build output, so the build machine needs the
 * network once and the clinic never does.
 *
 * Playfair Display was in that @import in three weights and referenced zero
 * times in the codebase. The display face is IBM Plex Serif: same superfamily
 * as the sans and mono already in use, and the right register for a document
 * a patient carries out of the building.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-face-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-face-mono',
  display: 'swap',
})

const plexSerif = IBM_Plex_Serif({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-face-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  // The template gives every screen its own tab. Before this, thirty routes
  // shared one title, so a row of pinned tabs and the whole back-button history
  // read 'Redian — Diagnostic Centre Management' over and over.
  title: {
    default: 'Redian — Diagnostic Centre Management',
    template: '%s · Redian',
  },
  description: 'Cloud-based LIS for diagnostic centres. Reception, Lab, Radiology, and Results — all in one platform.',
  manifest: '/manifest.json',
}

/** Without this the app renders at desktop width on every tablet and phone. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1017' },
  ],
}

import { AuthProvider } from '@/components/AuthProvider'
import RootWrapper from '@/components/RootWrapper'
import { NoticeProvider } from '@/components/Notices'
import { AppearanceProvider, appearanceBootScript } from '@/components/ui'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] || '';
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || '';

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} ${plexSerif.variable}`}
    >
      <body suppressHydrationWarning>
        {/* Sets the theme on <html> before the first paint. In an effect it
            would be too late and the page would flash the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: appearanceBootScript }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__SUPABASE_URL__ = ${JSON.stringify(supabaseUrl)};
              window.__SUPABASE_ANON_KEY__ = ${JSON.stringify(supabaseAnonKey)};
            `,
          }}
        />
        <AppearanceProvider>
          <AuthProvider>
            <NoticeProvider>
              <RootWrapper>
                {children}
              </RootWrapper>
            </NoticeProvider>
          </AuthProvider>
        </AppearanceProvider>
      </body>
    </html>
  )
}
