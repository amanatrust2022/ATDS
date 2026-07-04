import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (typeof window !== 'undefined' && browserClient) {
    return browserClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  if (
    typeof window !== 'undefined' &&
    (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder'))
  ) {
    console.error(
      '🚨 [DiagnosticOS Configuration Warning] Supabase credentials have fallback/placeholder values! ' +
      'Please make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment configuration ' +
      '(Vercel or Github secrets) and redeploy.'
    );
  }

  const client = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )

  if (typeof window !== 'undefined') {
    browserClient = client
  }

  return client
}
