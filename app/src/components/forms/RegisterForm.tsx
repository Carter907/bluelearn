import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { signUp } from "@/lib/auth";
import { validateRegister } from "@/lib/authValidation";
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
import { Checkbox } from "@/components/ui/checkbox";

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validateRegister({
      username,
      email,
      password,
      confirmPassword,
      acceptedPolicies,
    });
    if (errors) {
      toast.error(Object.values(errors)[0]);
      return;
    }

    setSubmitting(true);
    const { data, error } = await signUp(email, password, username);

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    // with a session, useRedirectIfAuthed handles it. navigating here too would
    // race that and abort the destination loader mid-flight.
    if (!data.session) navigate({ to: "/" });
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
                    Get started
                  </CardTitle>

                  <CardDescription className="text-sm text-muted-foreground">
                    Create an account to start sharing knowledge.
                  </CardDescription>
                </div>
              </CardHeader>

              {/* Form Fields */}
              <div className="flex-1 border-t p-6">
                <FieldGroup className="space-y-5">
                  <Field className="space-y-2">
                    <FieldLabel className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                      Username
                    </FieldLabel>

                    <Input
                      id="username"
                      type="text"
                      autoComplete="username"
                      placeholder="Choose a username"
                      className="h-10 rounded-md"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </Field>

                  <Field className="space-y-2">
                    <FieldLabel className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                      Email
                    </FieldLabel>

                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="me@example.com"
                      className="h-10 rounded-md"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Field className="space-y-2">
                      <FieldLabel className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                        Password
                      </FieldLabel>

                      <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        className="h-10 rounded-md"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </Field>

                    <Field className="space-y-2">
                      <FieldLabel className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                        Confirm Password
                      </FieldLabel>

                      <Input
                        id="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        className="h-10 rounded-md"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </Field>
                  </div>

                  <FieldDescription className="text-xs text-muted-foreground">
                    Passwords must be at least{" "}
                    <span className="font-medium text-foreground">
                      8 characters
                    </span>{" "}
                    long.
                  </FieldDescription>
                </FieldGroup>
              </div>

              {/* Footer */}
              <CardFooter className="flex flex-col gap-5 border-t p-6">
                <Field orientation="horizontal">
                  <Checkbox
                    id="policies-checkbox"
                    name="policies-checkbox"
                    className="border-primary"
                    checked={acceptedPolicies}
                    onCheckedChange={(isTicked) =>
                      setAcceptedPolicies(isTicked === true)
                    }
                  />

                  <FieldLabel htmlFor="policies-checkbox" className="block">
                    I have read and agree to the{" "}
                    <a
                      href="https://bluelearn.org/terms"
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      Terms of Service
                    </a>{" "}
                    and the{" "}
                    <a
                      href="https://bluelearn.org/privacy"
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      Privacy Policy
                    </a>
                  </FieldLabel>
                </Field>

                <Button
                  type="submit"
                  className="btn-pri w-full"
                  disabled={submitting}
                >
                  {submitting ? "Creating account..." : "Create account"}
                </Button>

                <FieldDescription className="text-center text-sm">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="font-medium text-foreground transition-colors hover:underline"
                  >
                    Sign in
                  </Link>
                </FieldDescription>
              </CardFooter>
            </div>

            {/* Right side - Image */}
            <div className="relative hidden md:flex md:items-center md:justify-center">
              <img
                src="/assets/atom/atom-cube-3.png"
                alt="Register to start contributing"
                className="absolute object-cover p-8"
              />
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
