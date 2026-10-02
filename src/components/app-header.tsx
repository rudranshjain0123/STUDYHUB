import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, ClipboardList, HelpCircle, ShieldCheck, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SmartSearch } from "@/components/smart-search";
import { ProfileMenu } from "@/components/profile-menu";

type Props = {
  userId: string;
  displayName: string;
  avatarColor: string;
  classSection: string | null;
  rollNumber: string | null;
  isAdmin: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  searching: boolean;
  showSearch?: boolean;
};

export function AppHeader({
  userId,
  displayName,
  avatarColor,
  classSection,
  rollNumber,
  isAdmin,
  query,
  onQueryChange,
  searching,
  showSearch = true,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <BookOpenCheck className="size-5 text-highlight" />
          <span className="font-display text-xl font-semibold text-primary">StudyHub</span>
        </Link>

        {showSearch ? (
          <div className="order-3 w-full sm:order-none sm:mx-4 sm:w-auto sm:flex-1">
            <SmartSearch value={query} onChange={onQueryChange} searching={searching} />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <nav className="order-4 flex w-full flex-wrap items-center gap-1 sm:order-none sm:w-auto">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/members">
              <UsersRound className="size-4" />
              Members
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/requests">
              <ClipboardList className="size-4" />
              Requests
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/doubts">
              <HelpCircle className="size-4" />
              Doubts
            </Link>
          </Button>
          {isAdmin ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin">
                <ShieldCheck className="size-4" />
                Admin
              </Link>
            </Button>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ProfileMenu
            userId={userId}
            displayName={displayName}
            avatarColor={avatarColor}
            classSection={classSection}
            rollNumber={rollNumber}
            onSignOut={() => void signOut()}
          />
        </div>
      </div>
    </header>
  );
}
