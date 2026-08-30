'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup'

export default function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setPending(true)

    try {
      const supabase = createClient()

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

        if (signUpError) {
          throw signUpError
        }

        // With email confirmation switched on there is no session yet.
        if (!data.session) {
          setNotice('Check your inbox to confirm your email, then log in.')
          return
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

        if (signInError) {
          throw signInError
        }
      }

      router.push(next ?? '/dashboard')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field"
          placeholder="you@business.com"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="field"
          placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {notice ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{notice}</p>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Log in'}
      </button>

      <p className="text-center text-sm text-ink-500">
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/signup" className="font-medium text-brand-600 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  )
}
