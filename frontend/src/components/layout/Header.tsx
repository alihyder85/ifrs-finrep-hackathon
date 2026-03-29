import { Separator } from "@/components/ui/separator";

export function Header() {
  return (
    <header className="h-12 flex items-center justify-between px-6 border-b bg-background shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
          Finance Reporting Review
        </span>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-xs text-muted-foreground">Internal Tool</span>
      </div>

      {/* Future: user avatar / profile dropdown */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
          <span className="text-[10px] font-medium text-muted-foreground">
            FI
          </span>
        </div>
      </div>
    </header>
  );
}
