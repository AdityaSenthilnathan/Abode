import type { NavItem } from "@/components/app-shell";
import type { Role } from "./session";

/** The header nav for each role (used by every role layout + the shared /messages). */
export function navForRole(role: Role): NavItem[] {
  switch (role) {
    case "owner":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/fix-it", label: "Fix-it" },
        { href: "/notifications", label: "Notifications" },
        { href: "/messages", label: "Messages" },
        { href: "/invites", label: "Invites" },
      ];
    case "employee":
      return [
        { href: "/jobs", label: "Jobs" },
        { href: "/map", label: "Map" },
        { href: "/earnings", label: "Earnings" },
        { href: "/messages", label: "Messages" },
      ];
    case "tenant":
      return [
        { href: "/home", label: "Home" },
        { href: "/requests", label: "Requests" },
        { href: "/dues", label: "Dues" },
        { href: "/notifications", label: "Notifications" },
        { href: "/messages", label: "Messages" },
        { href: "/settings", label: "Settings" },
      ];
  }
}
