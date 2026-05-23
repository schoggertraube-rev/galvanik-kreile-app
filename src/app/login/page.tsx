import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage({ searchParams }: { searchParams: { message?: string } }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">WerkstattCockpit</CardTitle>
          <CardDescription>Bitte logge dich ein, um auf das System zuzugreifen.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="E-Mail Adresse"
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Passwort"
                required
              />
            </div>
            <Button formAction={login} className="w-full bg-blue-900 hover:bg-blue-800" type="submit">
              Einloggen
            </Button>
            {searchParams?.message && (
              <p className="text-sm text-red-500 text-center font-bold bg-red-50 p-2 rounded">{searchParams.message}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
