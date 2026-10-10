import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardPage } from './pages/DashboardPage';
import { NewAuditPage } from './pages/NewAuditPage';
import { AuditResultsPage } from './pages/AuditResultsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlusCircle } from 'lucide-react';

export function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return window.location.pathname || '/';
  });
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);

  // Sync route with browser history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (route: string) => {
    window.history.pushState({}, '', route);
    setCurrentRoute(route);
    window.scrollTo(0, 0);
  };

  // Determine active view
  let pageContent: React.ReactNode = null;
  let topBarTitle = 'Audit Workspace';
  let breadcrumbs: { label: string; href?: string }[] = [];
  let topBarActions: React.ReactNode = null;

  if (currentRoute === '/' || currentRoute === '') {
    topBarTitle = 'Audit Workspace';
    pageContent = <DashboardPage navigate={navigate} />;
    topBarActions = (
      <button
        onClick={() => navigate('/audit/new')}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#326B55] hover:bg-[#285644] text-[#FFFFFF] rounded text-[12px] font-medium transition-colors"
      >
        <PlusCircle className="w-3.5 h-3.5" />
        <span>New Audit</span>
      </button>
    );
  } else if (currentRoute === '/audit/new') {
    topBarTitle = 'New Audit';
    breadcrumbs = [{ label: 'Workspace', href: '/' }];
    pageContent = <NewAuditPage navigate={navigate} />;
  } else if (currentRoute.startsWith('/audit/')) {
    const auditId = currentRoute.replace('/audit/', '');
    topBarTitle = `Audit Ledger`;
    breadcrumbs = [
      { label: 'Workspace', href: '/' },
      { label: 'Audits', href: '/history' }
    ];
    pageContent = <AuditResultsPage auditId={auditId} navigate={navigate} />;
  } else if (currentRoute === '/history') {
    topBarTitle = 'Audit History';
    breadcrumbs = [{ label: 'Workspace', href: '/' }];
    pageContent = <HistoryPage navigate={navigate} />;
  } else if (currentRoute === '/settings') {
    topBarTitle = 'Settings & Diagnostics';
    breadcrumbs = [{ label: 'Workspace', href: '/' }];
    pageContent = <SettingsPage />;
  } else {
    topBarTitle = 'Not Found';
    pageContent = (
      <div className="p-12 text-center text-[#707770]">
        <h3 className="text-[16px] font-semibold text-[#202522]">Page Not Found</h3>
        <p className="text-[13px] mt-1 mb-4">The requested route does not exist.</p>
        <button
          onClick={() => navigate('/')}
          className="px-3 py-1.5 bg-[#326B55] text-white rounded text-[12px]"
        >
          Return to Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8F6] text-[#202522] flex">
      {/* Fixed Desktop Sidebar */}
      <Sidebar
        currentRoute={currentRoute}
        navigate={navigate}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <TopBar
          title={topBarTitle}
          breadcrumbs={breadcrumbs}
          actions={topBarActions}
          onOpenMobileMenu={() => setIsOpenMobile(true)}
          navigate={navigate}
        />

        <main className="flex-1 overflow-x-hidden">
          {pageContent}
        </main>
      </div>
    </div>
  );
}

export default App;
