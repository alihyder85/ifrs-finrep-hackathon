"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileSpreadsheet,
  LayoutDashboard,
  MessageSquare,
  Download,
} from "lucide-react";

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: FileSpreadsheet,
  },
  {
    label: "Commentary",
    href: "/commentary",
    icon: MessageSquare,
    disabled: true,
  },
  {
    label: "Export",
    href: "/export",
    icon: Download,
    disabled: true,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-52 border-r bg-muted/30 shrink-0">
      {/* App logo / name */}
      <div className="h-12 flex items-center px-4 border-b">
        <span className="text-sm font-semibold tracking-tight">
          FinRep Review
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon, disabled }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={disabled ? "#" : href}
              aria-disabled={disabled}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-background text-foreground font-medium shadow-sm border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                disabled && "pointer-events-none opacity-40"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t">
        <p className="text-[10px] text-muted-foreground">
          Internal use only
        </p>
      </div>
    </aside>
  );
}
