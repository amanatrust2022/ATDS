import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | undefined

/** The project URL and anon key this build talks to, resolved the one way. */
export function supabaseConfig(): { url: string; anonKey: string } {
  const defaultUrl = 'https://okjwqvdvrqqhvvmvkikc.supabase.co';
  const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9randxdmR2cnFxaHZ2bXZraWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTc5ODksImV4cCI6MjA5MzMzMzk4OX0.iI29dydtOzCJWEiz58gIcsaZiDnyqOA4zEVm3MX8FOY';

  const supabaseUrl = (typeof window !== 'undefined' && (window as any).__SUPABASE_URL__) || 
                      process.env['NEXT_PUBLIC_SUPABASE_URL'] || 
                      defaultUrl;
  const supabaseAnonKey = (typeof window !== 'undefined' && (window as any).__SUPABASE_ANON_KEY__) || 
                          process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || 
                          defaultKey;
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}

export function createClient() {
  if (typeof window !== 'undefined' && browserClient) {
    return browserClient
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = supabaseConfig();

  if (
    typeof window !== 'undefined' &&
    (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder'))
  ) {
    console.error(
      '🚨 [Redian Configuration Warning] Supabase credentials have fallback/placeholder values! ' +
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
