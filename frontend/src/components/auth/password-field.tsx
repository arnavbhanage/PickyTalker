"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordField({ name = "password", label = "Password", newPassword = false }: { name?: string; label?: string; newPassword?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="auth-field">
    <Label htmlFor={name}>{label}</Label>
    <div className="auth-password">
      <Input id={name} name={name} type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"} required minLength={newPassword ? 8 : undefined} placeholder="••••••••" />
      <Button type="button" variant="ghost" size="icon" aria-label={visible ? "Hide " + label.toLowerCase() : "Show " + label.toLowerCase()} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button>
    </div>
  </div>;
}
