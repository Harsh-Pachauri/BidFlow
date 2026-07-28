import { useState, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/Button";
import { ListIcon, PlusIcon, MenuIcon, XIcon } from "./ui/icons";
import { Logo } from "./ui/Logo";

function SidebarLink({
  to,
  icon,
  children,
  onNavigate,
}: {
  to: string;
  icon: ReactNode;
  children: string;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

// A fixed-height flex shell (sidebar + independently-scrolling content) is
// the standard B2B SaaS pattern -- sidebar navigation never needs its own
// scrollbar. The mobile drawer is plain CSS transform + transition off one
// boolean, not a library: cheap to explain, nothing to animate wrong.
export function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={closeSidebar} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-slate-200 bg-white lg:static lg:flex ${
          sidebarOpen ? "flex" : "hidden"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-b from-brand-50/60 to-transparent px-5 py-4">
          <Link to="/dashboard" className="flex items-center gap-2" onClick={closeSidebar}>
            <Logo className="h-8 w-8 shrink-0" />
            <span className="text-sm font-semibold text-slate-900">BidFlow</span>
          </Link>
          <button
            type="button"
            className="shrink-0 text-slate-400 hover:text-slate-600 lg:hidden"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            <XIcon />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <SidebarLink to="/dashboard" icon={<ListIcon />} onNavigate={closeSidebar}>
            Auctions
          </SidebarLink>
          {user?.role === "BUYER" && (
            <SidebarLink to="/rfqs/new" icon={<PlusIcon />} onNavigate={closeSidebar}>
              Create RFQ
            </SidebarLink>
          )}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3">
            <p className="text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.role === "BUYER" ? "Buyer" : "Supplier"}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={logout} className="w-full">
            Log out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            className="text-slate-500 hover:text-slate-700"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
