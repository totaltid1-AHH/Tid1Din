import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/common/Sidebar';
import { TwoFactorModal } from './components/auth/TwoFactorModal';
import { LoginView } from './components/auth/LoginView';
import { CalendarView } from './components/calendar/CalendarView';
import { ClientDashboard } from './components/dashboard/ClientDashboard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { ClientListView } from './components/clients/ClientListView';
import { SuperAdminPanel } from './components/admin/SuperAdminPanel';
import { SuperAdminSettingsView } from './components/admin/SuperAdminSettingsView';
import { ShieldCheck, ShieldAlert, Lock, Calendar as CalendarIcon, LayoutDashboard, Users, Settings } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentUser, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Laster Tid1Din...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <TwoFactorModal />
        <LoginView />
        <footer className="py-3 text-center text-xs text-slate-400 border-t border-slate-200">
          Tid1Din &bull; Sikker kundeoppfølging & booking
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between md:pl-64">
      <TwoFactorModal />
      
      {/* Svart sidefeltmeny (venstre side på desktop, topplinje + skuff på mobil) */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <div className="w-full flex-1">
        {/* Mobil: full bredde (w-full, px-0), Desktop: max-w-7xl px-4. Padding i bunn sikrer at innhold ikke havner under den faste menyen */}
        <main className="w-full max-w-full md:max-w-7xl md:mx-auto px-0 sm:px-4 lg:px-8 py-0 sm:py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
          {/* Fanevelging basert på aktiv fane og rolle */}
          {currentTab === 'calendar' && (
            <CalendarView />
          )}

          {currentTab === 'clients' && (currentUser.role === 'hovedadmin' || currentUser.role === 'admin') && (
            <ClientListView />
          )}

          {currentTab === 'admin_settings' && (currentUser.role === 'hovedadmin' || currentUser.role === 'admin') && (
            <SuperAdminPanel />
          )}

          {currentTab === 'super_admin' && currentUser.role === 'hovedadmin' && (
            <SuperAdminSettingsView />
          )}

          {currentTab === 'dashboard' && (
            <>
              {currentUser.role === 'client' ? (
                <ClientDashboard onNavigateToCalendar={() => setCurrentTab('calendar')} />
              ) : (
                <AdminDashboard onNavigateToCalendar={() => setCurrentTab('calendar')} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Bunn-navigasjon på mobil: Alltid fastmontert på bunnen (fixed z-50, hardware-accelerert) */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl flex items-center justify-around px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] w-full max-w-full"
        style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
      >
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
            currentTab === 'dashboard' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5 flex-shrink-0" />
          <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Oversikt</span>
        </button>

        <button
          onClick={() => setCurrentTab('calendar')}
          className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
            currentTab === 'calendar' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarIcon className="w-5 h-5 mb-0.5 flex-shrink-0" />
          <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Kalender</span>
        </button>

        {(currentUser.role === 'hovedadmin' || currentUser.role === 'admin') && (
          <button
            onClick={() => setCurrentTab('clients')}
            className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
              currentTab === 'clients' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-5 h-5 mb-0.5 flex-shrink-0" />
            <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Klienter</span>
          </button>
        )}

        {(currentUser.role === 'hovedadmin' || currentUser.role === 'admin') && (
          <button
            onClick={() => setCurrentTab('admin_settings')}
            className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
              currentTab === 'admin_settings' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-5 h-5 mb-0.5 flex-shrink-0" />
            <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Klinikk</span>
          </button>
        )}

        {currentUser.role === 'hovedadmin' && (
          <button
            onClick={() => setCurrentTab('super_admin')}
            className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
              currentTab === 'super_admin' ? 'text-rose-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-5 h-5 mb-0.5 flex-shrink-0" />
            <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Super</span>
          </button>
        )}
      </nav>

      {/* Skjult på mobil for å frigjøre maksimal skjermplass, synlig på større skjermer */}
      <footer className="hidden sm:block border-t border-slate-200 bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Tid1Din</span>
            <span>&bull;</span>
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              End-to-End Sikret
            </span>
          </div>
          <p className="text-slate-400">
            Sikkert kundeoppfølgings- og bookingsystem
          </p>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
