"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/features/admin/auth/sign-out-button";
import type { ActionResult } from "@/features/admin/auth/types";

interface AdminNavItem {
  href: string;
  label: string;
  /** Optional trailing badge, e.g. the Calendar "(connected/total)" count. */
  badge?: string;
}

interface AdminNavProps {
  items: AdminNavItem[];
  signOutAction: () => Promise<ActionResult>;
  logoUrl: string | null;
  tenantName: string;
}

const MOBILE_PANEL_ID = "admin-nav-mobile";

export function AdminNav({
  items,
  signOutAction,
  logoUrl,
  tenantName,
}: AdminNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Exact match for the index route so "Reservations" isn't active on every
  // sub-page; prefix match (with a trailing slash) for the rest.
  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (href: string) =>
    cn(
      "transition-colors",
      isActive(href)
        ? "font-semibold text-brand"
        : "text-ink-muted hover:text-ink",
    );

  // Opens the tenant's public booking site (the subdomain root) in a new tab
  // so the admin keeps their current session tab open. Plain anchor + full
  // document load — the public site lives outside the /admin route tree.
  const renderBookingSiteLink = (onClick?: () => void) => (
    <a
      href="/"
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-brand px-3 font-medium transition",
        "bg-surface-muted text-ink hover:bg-border",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
      )}
    >
      Booking site
      <ExternalLinkIcon />
    </a>
  );

  const renderLink = (item: AdminNavItem, onClick?: () => void) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={onClick}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={linkClass(item.href)}
    >
      {item.label}
      {item.badge && (
        <span className="ml-1 text-xs text-ink-muted">{item.badge}</span>
      )}
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
      {/* Logo — links back to the admin home (the dashboard) */}
      <Link
        href="/admin/dashboard"
        onClick={() => setOpen(false)}
        className="flex items-center gap-3"
      >
        {logoUrl ? (
          // Plain <img> mirrors the public booking site; next/image isn't used
          // for tenant logos.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={tenantName}
            className="h-10 w-auto object-contain sm:h-14"
          />
        ) : (
          <span className="font-display text-lg font-semibold">{tenantName}</span>
        )}
      </Link>

      {/* Desktop nav */}
      <nav className="hidden items-center gap-4 text-sm md:flex">
        {items.map((item) => renderLink(item))}
        <span aria-hidden className="h-4 w-px bg-border" />
        {renderBookingSiteLink()}
        <SignOutButton signOutAction={signOutAction} />
      </nav>

      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={MOBILE_PANEL_ID}
        aria-label={open ? "Close menu" : "Open menu"}
        className="text-ink-muted transition-colors hover:text-ink md:hidden"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {/* Mobile panel */}
      <div
        id={MOBILE_PANEL_ID}
        className={cn(
          "absolute inset-x-0 top-full origin-top border-b border-border bg-surface md:hidden",
          "transition-all duration-200 ease-out motion-reduce:transition-none",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0",
        )}
      >
        <nav className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 text-sm sm:px-6">
          {items.map((item) => renderLink(item, () => setOpen(false)))}
          <span aria-hidden className="h-px w-full bg-border" />
          <span>{renderBookingSiteLink(() => setOpen(false))}</span>
          <SignOutButton signOutAction={signOutAction} />
        </nav>
      </div>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
