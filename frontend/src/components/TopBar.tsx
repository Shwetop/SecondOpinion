import React from 'react';
import { Menu, ChevronRight, Activity, ShieldCheck } from 'lucide-react';

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
  return (
    <header className="h-14 bg-[#FFFFFF] border-b border-[#E2E5E0] px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 -ml-1 text-[#707770] hover:text-[#1C211E] rounded hover:bg-[#F7F8F6]"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-[13px]">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {crumb.href ? (
                <button
                  onClick={() => navigate(crumb.href!)}
                  className="text-[#707770] hover:text-[#1C211E] transition-colors font-medium"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-[#707770]">{crumb.label}</span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-[#A5ABA4]" />
            </React.Fragment>
          ))}
          <h1 className="text-[14px] font-bold text-[#1C211E] m-0 leading-tight">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Subtle System Status Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F7F8F6] border border-[#E2E5E0] text-[11px] text-[#5A625A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#326B55]" />
          <span>Deterministic Provenance Verified</span>
        </div>

        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};
