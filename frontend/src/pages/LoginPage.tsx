import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { FormField } from "../components/ui/FormField";
import { Card, CardBody } from "../components/ui/Card";
import { Logo } from "../components/ui/Logo";

const DEMO_PASSWORD = "Password123!";
const DEMO_ACCOUNTS = [
  { label: "Buyer 1", email: "buyer1@rfq-demo.com" },
  { label: "Buyer 2", email: "buyer2@rfq-demo.com" },
  { label: "Supplier 1", email: "supplier1@rfq-demo.com" },
  { label: "Supplier 2", email: "supplier2@rfq-demo.com" },
  { label: "Supplier 3", email: "supplier3@rfq-demo.com" },
  { label: "Supplier 4", email: "supplier4@rfq-demo.com" },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDemoEmail, setPendingDemoEmail] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Shared by the real form and the demo-account shortcuts below, so both
  // paths get identical error handling and post-login redirect behavior.
  async function performLogin(loginEmail: string, loginPassword: string) {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(loginEmail, loginPassword);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(redirectTo, { replace: true });
    } catch {
      setError("Invalid email or password.");
    } finally {
      setIsSubmitting(false);
      setPendingDemoEmail(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void performLogin(email, password);
  }

  function handleDemoLogin(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setPendingDemoEmail(demoEmail);
    void performLogin(demoEmail, DEMO_PASSWORD);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50 via-slate-50 to-slate-50" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[560px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-brand-200/50 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block">
            <Logo className="mx-auto mb-4 h-11 w-11" />
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">BidFlow</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
        </div>
        <Card>
          <CardBody>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <FormField label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </FormField>
              <FormField label="Password" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </FormField>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" isLoading={isSubmitting && !pendingDemoEmail} className="mt-2 w-full">
                Sign in
              </Button>
            </form>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <p className="mb-3 text-center text-xs font-medium text-slate-500">Quick demo login</p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="secondary"
                    size="sm"
                    title={account.email}
                    isLoading={pendingDemoEmail === account.email}
                    disabled={isSubmitting && pendingDemoEmail !== account.email}
                    onClick={() => handleDemoLogin(account.email)}
                  >
                    {account.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
        <p className="mt-6 text-center text-xs text-slate-400">Demo credentials in docs/SEED_DATA.md</p>
      </div>
    </div>
  );
}
