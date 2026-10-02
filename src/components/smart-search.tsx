import { Loader2, Search, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (value: string) => void;
  searching: boolean;
};

export function SmartSearch({ value, onChange, searching }: Props) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Try “Hindi lit notebook notes from Ehaan” or “Ch 3 algebra homework”"
        aria-label="Smart search"
        className="h-10 pr-20 pl-9"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {searching ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <Sparkles className="size-4 text-highlight" aria-hidden />
        )}
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onChange("")}
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
