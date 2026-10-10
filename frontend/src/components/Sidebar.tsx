import React from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  X,
  Activity
} from 'lucide-react';
import { LogoIcon } from './Logo';

interface SidebarProps {
  currentRoute: string;
  navigate: (route: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  navigate,
  isOpenMobile,
  setIsOpenMobile
}) => {
  const mainNav = [
    { id: '/', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: '/audit/new', label: 'New Audit', icon: PlusCircle, badge: 'NEW' },
    { id: '/history', label: 'History', icon: History, badge: null },
  ];


  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Persistent Sidebar (Section 3) */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-[240px] bg-white border-r border-[var(--line)] flex flex-col justify-between
        p-[28px_20px_24px] transition-transform duration-200 ease-in-out select-none
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Top Header & Navigation */}
        <div className="space-y-8">
          {/* Logo & Brand Lockup */}
          <div className="flex items-center justify-between">
            <div 
              onClick={() => { navigate('/'); setIsOpenMobile(false); }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <LogoIcon size={36} />
              <div className="flex flex-col">
                <span className="font-extrabold text-[16px] text-[var(--ink)] tracking-[-0.01em] leading-tight">
                  Second Opinion
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] font-normal leading-tight mt-0.5">
                  AI auditing platform
                </span>
              </div>
            </div>

            <button 
              onClick={() => setIsOpenMobile(false)} 
              className="lg:hidden text-[var(--text-secondary)] hover:text-[var(--ink)] p-1 rounded-lg hover:bg-[var(--surface-hover)]"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isAuditResults = currentRoute.startsWith('/audit/') && currentRoute !== '/audit/new';
              const isActive = item.id === '/' 
                ? (currentRoute === '/' || currentRoute === '') 
                : item.id === '/history'
                ? (currentRoute === '/history' || isAuditResults)
                : currentRoute === item.id;

<<<<<<< HEAD
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.id);
                    setIsOpenMobile(false);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    w-full h-10 flex items-center justify-between px-3 rounded-[8px] text-[14px] transition-colors text-left
                    ${isActive 
                      ? 'bg-[var(--surface-hover)] text-[var(--ink)] font-bold' 
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] font-semibold'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isActive ? 2.2 : 1.9} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-extrabold tracking-[0.04em] px-2 py-0.5 rounded-full bg-[var(--accent-tint)] text-[var(--accent-text)]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom "Audit Engine" card: pinned to the bottom, hairline border, radius 12px, padding 16px */}
        <div className="border border-[var(--line)] rounded-[12px] p-4 bg-white space-y-2.5">
=======
          {/* Navigation Links */}
          <div className="px-3 py-1 space-y-4">
            <div>
              <span className="px-3 text-[10px] font-bold text-[#8A928A] uppercase tracking-wider block mb-1">
                Workspace
              </span>
              <nav className="space-y-0.5">
                {mainNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentRoute === item.id || 
                    (item.id !== '/' && currentRoute.startsWith(item.id));

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        navigate(item.id);
                        setIsOpenMobile(false);
                      }}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 rounded text-[13px] font-medium transition-all text-left
                        ${isActive 
                          ? 'bg-[#EBF2EE] text-[#326B55] font-semibold' 
                          : 'text-[#484F49] hover:bg-[#F7F8F6] hover:text-[#1C211E]'}
                      `}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#326B55]' : 'text-[#707770]'}`} strokeWidth={1.9} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#326B55] text-white">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>


        {/* Diagnostics & Operational Status Footer */}
        <div className="p-3.5 border-t border-[#E2E5E0] bg-[#FAFAF9] text-[11px] text-[#707770] space-y-2">
>>>>>>> a153fb0 (feat: upgrade verification engine to hybrid deterministic with Gemini fallback)
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-[var(--ink)]">
              Audit engine
            </span>
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-[#EEF0F3] rounded-full h-1 overflow-hidden">
            <div 
              className="bg-[var(--ink)] h-1 rounded-full" 
              style={{ width: '78%' }}
            />
          </div>
          
          <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)] font-normal">
            <span>SQLite persistent</span>
            <span>100% traceable</span>
          </div>
        </div>
      </aside>
    </>
  );
};
