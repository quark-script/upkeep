import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * Cloud backup is optional. Without both env vars the app runs exactly as it
 * always has, local-only, and every cloud code path turns itself off rather
 * than throwing somewhere deep in a component.
 */
export const cloudConfigured = Boolean(url && publishableKey)

if (!cloudConfigured) {
  // Silence here is dangerous: a typo'd or missing env var on the host would
  // hide the whole feature, and the user would go on believing a device that
  // signed in once is still backing up.
  console.warn(
    '[upkeep] Cloud backup is off: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
  )
}

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Sign-in is a typed code, never a redirect, so there is nothing in the
        // URL to detect. Leaving this on makes the client parse every page load.
        detectSessionInUrl: false,
      },
    })
  : null

/**
 * Ask for a one-time code by email.
 *
 * `shouldCreateUser: false` matters: without it this call would happily create
 * an account for any address that asked, which is the whole thing we are trying
 * to prevent. Sign-ups are also disabled project-side; this is the second lock.
 */
export async function requestSignInCode(email: string): Promise<void> {
  if (!supabase) throw new Error('Cloud backup is not configured.')
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false },
  })
  if (error) throw new Error(error.message)
}

/** Exchange the emailed 6-digit code for a session. */
export async function verifySignInCode(email: string, code: string): Promise<void> {
  if (!supabase) throw new Error('Cloud backup is not configured.')
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email',
  })
  if (error) throw new Error(error.message)
}
