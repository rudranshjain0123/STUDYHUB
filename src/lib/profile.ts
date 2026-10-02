import { cn } from "@/lib/utils";

export const AVATAR_COLORS = [
  { value: "teal", label: "Teal", className: "bg-teal text-white" },
  { value: "indigo", label: "Indigo", className: "bg-indigo-600 text-white" },
  { value: "rose", label: "Rose", className: "bg-rose-600 text-white" },
  { value: "amber", label: "Amber", className: "bg-amber-500 text-amber-950" },
  { value: "emerald", label: "Emerald", className: "bg-emerald-600 text-white" },
  { value: "slate", label: "Slate", className: "bg-slate-700 text-white" },
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number]["value"];

export function avatarColorClass(value: string | null | undefined) {
  return (
    AVATAR_COLORS.find((color) => color.value === value)?.className ?? AVATAR_COLORS[0].className
  );
}

export function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase()).join("");
  return initials || "SH";
}

export function avatarClass(value: string | null | undefined, className?: string) {
  return cn(avatarColorClass(value), "font-semibold tracking-wide", className);
}
