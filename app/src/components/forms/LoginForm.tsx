import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);

    const { error } = await signIn(email, password);

    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
  }

  return (
    <div className={cn("mx-auto w-full max-w-5xl", className)} {...props}>
      <Card className="overflow-hidden rounded-md bg-background shadow-none">
        <form onSubmit={handleSubmit}>
          <CardContent className="grid p-0 md:grid-cols-2">
            {/* Left side - Form */}
            <div className="flex flex-col border-r">
              {/* Header */}
              <CardHeader className="space-y-4 p-6">
                <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
                  Authentication
                </p>

                <div className="space-y-2">
                  <CardTitle className="text-2xl font-semibold tracking-tight">
                    Welcome back
                  </CardTitle>

                  <CardDescription className="text-sm text-muted-foreground">
                    Sign in to start sharing knowledge.
                  </CardDescription>
                </div>
              </CardHeader>

              {/* Form Fields */}
              <div className="flex-1 border-t p-6">
                <FieldGroup className="space-y-5">
                  <Field className="space-y-2">
                    <FieldLabel required className="mono-micro">
                      Email
                    </FieldLabel>

                    <Input
                      id="email"
                      type="email"
                      placeholder="me@example.com"
                      autoComplete="email"
                      className="h-10 rounded-md"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>

                  <Field className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FieldLabel required className="mono-micro">
                        Password
                      </FieldLabel>

                      <Link
                        to="/forgot-password"
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      className="h-10 rounded-md"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Field>
                </FieldGroup>
              </div>

              {/* Footer */}
              <CardFooter className="flex flex-col gap-5 border-t p-6">
                <Button
                  type="submit"
                  className="btn-pri w-full"
                  disabled={submitting}
                >
                  {submitting ? "Signing in..." : "Sign in"}
                </Button>

                <FieldDescription className="text-center text-sm">
                  Don't have an account?{" "}
                  <Link
                    to="/register"
                    className="font-medium text-foreground transition-colors hover:underline"
                  >
                    Create one
                  </Link>
                </FieldDescription>
              </CardFooter>
            </div>

            {/* Right side - Image */}
            <div className="relative hidden md:flex md:items-center md:justify-center">
              <img
                src="/assets/atom/atom-arrow-2.png"
                alt="Login to start contributing"
                className="absolute object-cover p-8"
              />
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
