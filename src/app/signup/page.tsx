import AuthForm from '@/components/AuthForm'
import AuthShell from '@/components/AuthShell'

export const metadata = { title: 'Create an account' }

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="You get a dashboard and a public page. Fill them with whatever you need."
    >
      <AuthForm mode="signup" />
    </AuthShell>
  )
}
