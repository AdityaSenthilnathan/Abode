import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const showDev = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";
  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-6 px-6 py-24">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Abode</h1>
        <p className="text-sm opacity-60">Welcome back.</p>
      </div>
      <LoginForm showDev={showDev} />
    </div>
  );
}
