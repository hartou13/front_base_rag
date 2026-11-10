"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "@/lib/api";
import { setToken, setUser } from "@/lib/auth";

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm: "",
    language: "fr",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await signup({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
        language: form.language,
      });
      setToken(res.token);
      setUser({ first_name: res.first_name, last_name: res.last_name, email: res.email });
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create an account"
      description="Then create a collection, add your documents and start asking."
      footer={{ text: "Already have an account?", href: "/login", label: "Log in" }}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="first_name">First name</Label>
            <Input id="first_name" autoComplete="given-name" required value={form.first_name} onChange={update("first_name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last name</Label>
            <Input id="last_name" autoComplete="family-name" required value={form.last_name} onChange={update("last_name")} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={update("email")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={update("password")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={form.confirm}
            onChange={update("confirm")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <select
            id="language"
            value={form.language}
            onChange={update("language")}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="whitespace-pre-line text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
