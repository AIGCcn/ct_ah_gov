import { auth } from '@/auth'
import { LoginButton } from '@/components/login-button'
import { LoginForm } from '@/components/login-form'
import { Separator } from '@/components/ui/separator'
import { redirect } from 'next/navigation'
export default async function SignUpPage() {
  const session = await auth()
  // redirect to home if user is already logged in
  if (session?.user) {
    redirect('/')
  }
  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col items-center justify-center py-10">
      <div className="mb-6 flex flex-col items-center">
        <img
          src="/logo.png"
          alt="视听政策百问"
          className="h-[72px] w-[72px] drop-shadow-lg"
        />
        <h1 className="mt-3 text-xl font-bold tracking-tight">
          视听政策百问
        </h1>
      </div>
      <div className="w-full max-w-sm">
        <LoginForm action="sign-up" />
        <Separator className="my-4" />
        <div className="flex justify-center">
          <LoginButton />
        </div>
      </div>
    </div>
  )
}
