import React, { useState } from 'react';
import { Menu, Search, Bell } from 'lucide-react';

interface TopBarProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  onOpenMobileMenu: () => void;
  navigate: (route: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  breadcrumbs = [],
  actions,
  onOpenMobileMenu,
  navigate
}) => {
  const [searchValue, setSearchValue] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate('/history');
    }
  };

  const isDashboard = !breadcrumbs || breadcrumbs.length === 0;

  return (
    <header className="h-[64px] bg-white border-b border-[var(--line)] px-6 lg:px-10 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Mobile Toggle & Breadcrumbs / Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--ink)] rounded-[8px] hover:bg-[var(--surface-hover)]"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {isDashboard ? (
          <h1 className="text-[15px] font-bold text-[var(--ink)] m-0 leading-tight">
            Audit workspace
          </h1>
        ) : (
          <nav className="flex items-center gap-2 text-[13px]" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {crumb.href ? (
                  <button
                    onClick={() => navigate(crumb.href!)}
                    className="text-[var(--text-secondary)] hover:text-[var(--ink)] transition-colors font-medium"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-[var(--text-secondary)]">{crumb.label}</span>
                )}
                <span className="text-[var(--text-secondary)] font-normal">/</span>
              </React.Fragment>
            ))}
            <span className="text-[13px] font-bold text-[var(--ink)]" aria-current="page">
              {title}
            </span>
          </nav>
        )}
      </div>

      {/* Right: Search, Notifications & User Avatar */}
      <div className="flex items-center gap-3">
        {/* Search input: 280px wide, 38px high, radius 10px, background --surface-alt, hairline border */}
        <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative">
          <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search audits, claims, sources..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 pr-4 w-[280px] h-[38px] rounded-[10px] bg-[var(--surface-alt)] border border-[var(--line)] text-[13px] text-[var(--ink)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] transition-all"
          />
        </form>

        {/* Notification bell: 38px square, hairline border, radius 10px, 7px green dot top right */}
        <button 
          className="w-[38px] h-[38px] rounded-[10px] bg-white border border-[var(--line)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-colors relative"
          aria-label="View notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="w-[7px] h-[7px] rounded-full bg-[var(--accent)] absolute top-2 right-2 ring-1 ring-white" />
        </button>

        {/* Avatar: 34px circle, --ink background, white 'A' */}
        <div 
          className="w-[34px] h-[34px] rounded-full bg-[var(--ink)] text-white flex items-center justify-center font-bold text-[13px] cursor-pointer hover:opacity-90 transition-opacity select-none"
          title="Auditor Account"
          aria-label="User account"
        >
          A
        </div>

        {/* Actions (if any, but duplicate New Audit button removed) */}
        {actions && (
          <div className="flex items-center gap-2 pl-1 border-l border-[var(--line)] ml-1">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};
