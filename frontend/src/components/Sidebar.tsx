import React from 'react';
import { 
  FileSearch, 
  PlusCircle, 
  History, 
  Settings, 
  ShieldCheck, 
  X,
  FileCheck,
  ChevronDown,
  Layers,
  Database,
  Terminal,
  Activity
} from 'lucide-react';

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
    { id: '/', label: 'Audit Workspace', icon: FileSearch, badge: null },
    { id: '/audit/new', label: 'New Audit', icon: PlusCircle, badge: 'NEW' },
    { id: '/history', label: 'Audit History', icon: History, badge: null },
  ];

  const secondaryNav = [
    { id: '/settings', label: 'Settings & Model', icon: Settings, badge: null },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Persistent Sidebar */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#FFFFFF] border-r border-[#E2E5E0] flex flex-col justify-between
        transition-transform duration-150 ease-in-out select-none
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header / Brand Wordmark & Workspace Selector */}
        <div>
          <div className="h-14 px-4 flex items-center justify-between border-b border-[#E2E5E0]">
            <div 
              onClick={() => { navigate('/'); setIsOpenMobile(false); }}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-7 h-7 rounded bg-[#202522] flex items-center justify-center text-[#FFFFFF] shadow-xs">
                <ShieldCheck className="w-4 h-4 text-[#FFFFFF]" strokeWidth={2.4} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[12.5px] tracking-[0.06em] text-[#1C211E] uppercase">
                    SECOND OPINION
                  </span>
                </div>
                <span className="text-[10px] text-[#707770] font-mono tracking-wider -mt-0.5">
                  AI AUDITING PLATFORM
                </span>
              </div>
            </div>

            <button 
              onClick={() => setIsOpenMobile(false)} 
              className="lg:hidden text-[#707770] hover:text-[#202522] p-1 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Context Switcher / Workspace Badge */}
          <div className="p-3">
            <div className="px-3 py-2 rounded bg-[#F7F8F6] border border-[#E2E5E0] flex items-center justify-between text-[11px] text-[#484F49]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#326B55]" />
                <span className="font-semibold text-[#1C211E]">Default Ledger</span>
              </div>
              <span className="font-mono text-[10px] text-[#707770] bg-[#FFFFFF] px-1.5 py-0.2 rounded border border-[#E2E5E0]">
                SQLite
              </span>
            </div>
          </div>

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

            <div>
              <span className="px-3 text-[10px] font-bold text-[#8A928A] uppercase tracking-wider block mb-1">
                System & Preferences
              </span>
              <nav className="space-y-0.5">
                {secondaryNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentRoute === item.id;

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
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Diagnostics & Operational Status Footer */}
        <div className="p-3.5 border-t border-[#E2E5E0] bg-[#FAFAF9] text-[11px] text-[#707770] space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#8A928A]">Audit Engine</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#326B55] animate-pulse" />
              <span className="font-medium text-[#1C211E]">Hybrid Deterministic</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#EAECE8]">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-[#326B55]" />
              <span>Grounding Ledger</span>
            </span>
            <span className="font-mono text-[#1C211E] font-semibold">100% Traceable</span>
          </div>
        </div>
      </aside>
    </>
  );
};
