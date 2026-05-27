"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api";

import { ShieldCheck } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const tokenFromUrl = searchParams.get("token");
  const { login, isAuthenticated } = useAuthStore();
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (isAuthenticated && !tokenFromUrl) {
      router.push(redirect);
    }

    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);
      // Fetch user data would happen here or in AuthProvider
      // For now we just refresh to let AuthProvider handle it
      window.location.href = redirect;
    }
  }, [isAuthenticated, tokenFromUrl, router, redirect]);

  const handleSSOLogin = () => {
    const ssoUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/auth/sso/login`;
    window.location.href = ssoUrl;
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await authApi.login({ ...data, mfaCode: mfaRequired ? mfaCode : undefined });

      if (response.mfaRequired) {
        setMfaRequired(true);
        toast.info("MFA Required", { description: "Please enter your verification code" });
        return;
      }

      localStorage.setItem("token", response.access_token);

      login({
        id: response.user.id,
        email: response.user.email,
        firstName: response.user.firstName,
        lastName: response.user.lastName,
        name: `${response.user.firstName || ""} ${response.user.lastName || ""}`.trim() || response.user.email,
        role: response.user.role.toLowerCase() as any,
        tenant: response.user.tenant,
      });

      toast.success("Welcome back!", { description: "Login successful" });
      router.push(redirect);
    } catch (err: any) {
      toast.error("Login failed", { description: err.message || "Invalid credentials" });
      setError("root", { message: err.message || "Login failed" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-blue-600">AMDOX</span>
            <span className="text-gray-600">ERP</span>
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {mfaRequired ? "Two-Factor Authentication" : "Sign in to your account"}
          </p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm space-y-6">
          {!mfaRequired ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {errors.root && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{errors.root.message}</div>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <input
                    id="email"
                    {...register("email")}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                    placeholder="admin@amdox.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    {...register("password")}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <p className="text-sm text-muted-foreground">Enter the 6-digit code (Demo: 123456)</p>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  maxLength={6}
                  className="w-full text-center text-2xl tracking-[1em] font-mono h-12 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  autoFocus
                />
                <Button 
                  className="w-full" 
                  disabled={mfaCode.length < 6 || isSubmitting}
                  onClick={() => onSubmit(getValues())}
                >
                  {isSubmitting ? "Verifying..." : "Verify Code"}
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-xs"
                  onClick={() => setMfaRequired(false)}
                >
                  Back to Login
                </Button>
              </div>
            </div>
          )}

          {!mfaRequired && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSSOLogin}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Enterprise SSO (Keycloak)
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}