import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, LogOut, Palette, Settings, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { changeOwnPasscode } from "@/lib/auth.functions";
import { AVATAR_COLORS, avatarClass, initialsForName } from "@/lib/profile";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  displayName: string;
  avatarColor: string;
  classSection: string | null;
  rollNumber: string | null;
  onSignOut: () => void;
};

export function ProfileMenu({
  userId,
  displayName,
  avatarColor,
  classSection,
  rollNumber,
  onSignOut,
}: Props) {
  const queryClient = useQueryClient();
  const changePasscode = useServerFn(changeOwnPasscode);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [name, setName] = useState(displayName);
  const [color, setColor] = useState(avatarColor);
  const [section, setSection] = useState(classSection ?? "");
  const [roll, setRoll] = useState(rollNumber ?? "");
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");

  function openProfile() {
    setName(displayName);
    setColor(avatarColor);
    setSection(classSection ?? "");
    setRoll(rollNumber ?? "");
    setProfileOpen(true);
  }

  const updateProfile = useMutation({
    mutationFn: async () => {
      const cleanName = name.trim();
      if (cleanName.length < 2) throw new Error("Display name must be at least 2 characters.");
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: cleanName,
          avatar_color: color,
          class_section: section.trim() || null,
          roll_number: roll.trim() || null,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated.");
      void queryClient.invalidateQueries({ queryKey: ["session-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["class-directory"] });
      setProfileOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updatePasscode = useMutation({
    mutationFn: async () => {
      if (newPasscode !== confirmPasscode) throw new Error("New passcodes do not match.");
      const result = await changePasscode({ data: { currentPasscode, newPasscode } });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      toast.success("Passcode changed.");
      setCurrentPasscode("");
      setNewPasscode("");
      setConfirmPasscode("");
      setPasscodeOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-10 gap-2 rounded-full px-2"
            aria-label="Open profile menu"
          >
            <Avatar className="size-8">
              <AvatarFallback className={avatarClass(avatarColor)}>
                {initialsForName(displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
              {displayName}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="size-8">
                <AvatarFallback className={avatarClass(avatarColor)}>
                  {initialsForName(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[classSection, rollNumber ? `Roll ${rollNumber}` : null]
                    .filter(Boolean)
                    .join(" · ") || "StudyHub member"}
                </p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openProfile}>
            <UserRound className="size-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPasscodeOpen(true)}>
            <KeyRound className="size-4" />
            Change passcode
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut}>
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Set the name and badge your classmates see across StudyHub.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              updateProfile.mutate();
            }}
          >
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
              <Avatar className="size-12">
                <AvatarFallback className={avatarClass(color, "text-base")}>
                  {initialsForName(name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{name || "StudyHub member"}</p>
                <p className="text-xs text-muted-foreground">
                  {[section, roll ? `Roll ${roll}` : null].filter(Boolean).join(" · ") ||
                    "Class details optional"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-name">Display name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={60}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-section">Class / section</Label>
                <Input
                  id="profile-section"
                  value={section}
                  onChange={(event) => setSection(event.target.value)}
                  maxLength={40}
                  placeholder="e.g. 9-B"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-roll">Roll number</Label>
                <Input
                  id="profile-roll"
                  value={roll}
                  onChange={(event) => setRoll(event.target.value)}
                  maxLength={40}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="size-4 text-teal" />
                Avatar color
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {AVATAR_COLORS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setColor(item.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2 text-sm transition-colors hover:border-primary/50",
                      color === item.value && "border-primary ring-2 ring-ring/30",
                    )}
                  >
                    <span className={cn("size-5 rounded-full", item.className)} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={updateProfile.isPending}>
                <Settings className="size-4" />
                Save profile
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={passcodeOpen} onOpenChange={setPasscodeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change passcode</DialogTitle>
            <DialogDescription>
              Enter your current passcode once, then choose a new private passcode.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              updatePasscode.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="current-passcode">Current passcode</Label>
              <Input
                id="current-passcode"
                type="password"
                value={currentPasscode}
                onChange={(event) => setCurrentPasscode(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-passcode">New passcode</Label>
              <Input
                id="new-passcode"
                type="password"
                minLength={6}
                value={newPasscode}
                onChange={(event) => setNewPasscode(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-passcode">Confirm new passcode</Label>
              <Input
                id="confirm-passcode"
                type="password"
                minLength={6}
                value={confirmPasscode}
                onChange={(event) => setConfirmPasscode(event.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updatePasscode.isPending}>
                <KeyRound className="size-4" />
                Update passcode
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
