import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { EMAIL_REGEX, STRONG_PASSWORD_REGEX } from '@/utils/validation'
import { extractApiError } from '@/utils/error'

interface FormState {
  fullName: string
  email: string
  password: string
  orgName: string
}

export default function RegisterPage() {
  const { register } = useAuth()
  const [form, setForm] = useState<FormState>({
    fullName: '',
    email: '',
    password: '',
    orgName: '',
  })
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function set(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  function validate() {
    const e: Partial<FormState> = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.email) {
      e.email = 'Email is required'
    } else if (!EMAIL_REGEX.test(form.email)) {
      e.email = 'Enter a valid email address'
    }
    if (!form.password) {
      e.password = 'Password is required'
    } else if (!STRONG_PASSWORD_REGEX.test(form.password)) {
      e.password = 'Min 8 chars with uppercase, lowercase, number & special character'
    }
    if (!form.orgName.trim()) e.orgName = 'Organisation name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await register(form)
      toast.success('Account created! Please sign in.')
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Set up your workspace in seconds</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              placeholder="Jane Doe"
              value={form.fullName}
              onChange={set('fullName')}
              autoComplete="name"
              aria-invalid={!!errors.fullName}
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 chars, uppercase, number & symbol"
                value={form.password}
                onChange={set('password')}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="orgName">Organisation name</Label>
            <Input
              id="orgName"
              placeholder="Acme Corp"
              value={form.orgName}
              onChange={set('orgName')}
              aria-invalid={!!errors.orgName}
            />
            {errors.orgName && <p className="text-xs text-destructive">{errors.orgName}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create account
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-foreground underline underline-offset-4 hover:text-primary">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
