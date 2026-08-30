import AuthForm from '@/components/AuthForm'
import AuthShell from '@/components/AuthShell'

export const metadata = { title: 'Log in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your apps.">
      <AuthForm mode="login" next={next} />
    </AuthShell>
  )
}
