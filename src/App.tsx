import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/common/Sidebar';
import { TwoFactorModal } from './components/auth/TwoFactorModal';
import { TwoFactorSetupModal } from './components/auth/TwoFactorSetupModal';
import { LoginView } from './components/auth/LoginView';
import { CalendarView } from './components/calendar/CalendarView';
import { UserCalendarView } from './components/calendar/UserCalendarView';
import { BookingView } from './components/calendar/BookingView';
import { ClientDashboard } from './components/dashboard/ClientDashboard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { ClientListView } from './components/clients/ClientListView';
import { SuperAdminPanel } from './components/admin/SuperAdminPanel';
import { SuperAdminSettingsView } from './components/admin/SuperAdminSettingsView';
import { SuperAdminCompaniesView } from './components/admin/SuperAdminCompaniesView';
import { JournalView } from './components/journal/JournalView';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Calendar as CalendarIcon, 
  LayoutDashboard, 
  Users, 
  Settings, 
  BookOpen,
  Building2
} from 'lucide-react';

const AppContent: React.FC = () => {
  const { 
    currentUser, 
    activeCompany,
    isLoading, 
    is2FASetupModalOpen, 
    setup2FAUser, 
    close2FASetupModal, 
    updateUser2FA 
  } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [bookingInitialDate, setBookingInitialDate] = useState<string | undefined>(undefined);
  const [selectedJournalClientId, setSelectedJournalClientId] = useState<string | null>(null);

  // Superadmin lander som standard på "Bedrifter" ved innlogging
  useEffect(() => {
    if (currentUser?.role === 'superadmin' && currentTab === 'dashboard') {
      setCurrentTab('companies');
    }
  }, [currentUser?.role, currentUser?.uid]);

  // Sikre at dersom rollen endres til 'client', blir eventuelle admin-faner automatisk tilbakestilt til 'dashboard'
  useEffect(() => {
    if (currentUser?.role === 'client') {
      if (['clients', 'journal', 'admin_settings', 'super_admin', 'companies'].includes(currentTab)) {
        setCurrentTab('dashboard');
      }
    }
  }, [currentUser?.role, currentUser?.uid, currentTab]);

  const handleNavTab = (tab: string) => {
    setBookingInitialDate(undefined);
    setCurrentTab(tab);
  };

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
          Tid1Din &bull; Sikker flerbedriftsapp for kundeoppfølging & booking
        </footer>
      </div>
    );
  }

  const isStaffOrAdmin = currentUser.role === 'superadmin' || currentUser.role === 'hovedadmin' || currentUser.role === 'admin';
  const isJournalTab = currentTab === 'journal';

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col justify-between lg:pl-64 ${isJournalTab ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : ''}`}>
      <TwoFactorModal />
      <TwoFactorSetupModal
        isOpen={is2FASetupModalOpen}
        user={setup2FAUser}
        onClose={close2FASetupModal}
        onSave={async (enabled, secret) => {
          if (setup2FAUser) {
            await updateUser2FA(setup2FAUser.uid, enabled, secret);
          }
        }}
      />
      
      {/* Svart sidefeltmeny (venstre side på desktop, topplinje + skuff på mobil/iPad stående) */}
      <Sidebar currentTab={currentTab} setCurrentTab={handleNavTab} />

      {/* Super-admin statusbanner når man er inne i en spesifikk klinikk */}
      {currentUser.role === 'superadmin' && activeCompany && currentTab !== 'companies' && (
        <div className="bg-indigo-950 text-indigo-100 px-3 sm:px-6 py-2 text-xs flex items-center justify-between border-b border-indigo-800/80">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span className="truncate">
              Aktiv klinikk: <strong className="text-white font-bold">{activeCompany.name}</strong> 
              {activeCompany.treatmentPlace ? ` (${activeCompany.treatmentPlace})` : ''}
            </span>
          </div>
          <button
            onClick={() => handleNavTab('companies')}
            className="text-[11px] font-bold text-indigo-300 hover:text-white underline whitespace-nowrap ml-3"
          >
            Se alle bedrifter &rarr;
          </button>
        </div>
      )}

      {isJournalTab ? (
        <div className="w-full flex-1 flex flex-col overflow-hidden min-h-0">
          {isStaffOrAdmin && (
            <JournalView 
              key={`journal_${selectedJournalClientId || 'all'}`}
              initialClientId={selectedJournalClientId}
              onNavigateToCalendar={() => setCurrentTab('calendar')}
            />
          )}
        </div>
      ) : (
        <div className="w-full flex-1">
          {/* Mobil/iPad: full bredde, Desktop: max-w-7xl px-4. Padding i bunn sikrer at innhold ikke havner under den faste menyen */}
          <main className="w-full max-w-full lg:max-w-7xl lg:mx-auto px-0 sm:px-4 lg:px-8 py-0 sm:py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
            
            {/* Flerbedriftsadministrasjon (Kun superadmin) */}
            {currentTab === 'companies' && currentUser.role === 'superadmin' && (
              <SuperAdminCompaniesView 
                key={`companies_${currentUser.uid}`}
                onSelectCompanyAndNavigate={(compId, targetTab) => handleNavTab(targetTab)}
              />
            )}

            {/* Fanevelging basert på aktiv fane og rolle */}
            {currentTab === 'calendar' && (
              currentUser.role === 'client' ? (
                <UserCalendarView 
                  key={`client_cal_${currentUser.uid}`}
                  onNavigateToBooking={(dateStr) => {
                    setBookingInitialDate(dateStr);
                    setCurrentTab('booking');
                  }} 
                />
              ) : (
                <CalendarView key={`admin_cal_${currentUser.uid}`} />
              )
            )}

            {currentTab === 'booking' && (
              <BookingView 
                key={`booking_${currentUser.uid}_${bookingInitialDate || 'default'}`}
                onNavigateToCalendar={() => setCurrentTab('calendar')}
                onNavigateToDashboard={() => setCurrentTab('dashboard')}
                initialDate={bookingInitialDate}
              />
            )}

            {currentTab === 'clients' && isStaffOrAdmin && (
              <ClientListView 
                key={`clients_${currentUser.uid}`}
                onOpenJournal={(clientId) => {
                  setSelectedJournalClientId(clientId);
                  setCurrentTab('journal');
                }}
              />
            )}

            {currentTab === 'admin_settings' && isStaffOrAdmin && (
              <SuperAdminPanel key={`settings_${currentUser.uid}`} />
            )}

            {currentTab === 'super_admin' && currentUser.role === 'superadmin' && (
              <SuperAdminSettingsView key={`super_${currentUser.uid}`} />
            )}

            {currentTab === 'dashboard' && (
              <>
                {currentUser.role === 'client' ? (
                  <ClientDashboard 
                    key={`client_dash_${currentUser.uid}`}
                    onNavigateToCalendar={() => setCurrentTab('calendar')}
                    onNavigateToBooking={() => {
                      setBookingInitialDate(undefined);
                      setCurrentTab('booking');
                    }}
                  />
                ) : (
                  <AdminDashboard 
                    key={`admin_dash_${currentUser.uid}`}
                    onNavigateToCalendar={() => setCurrentTab('calendar')} 
                    onNavigateToJournal={(clientId) => {
                      setSelectedJournalClientId(clientId);
                      setCurrentTab('journal');
                    }}
                  />
                )}
              </>
            )}
          </main>
        </div>
      )}

      {/* Bunn-navigasjon på mobil: Alltid fastmontert på bunnen (fixed z-50, hardware-accelerert) */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl flex items-center justify-around px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] w-full max-w-full"
        style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
      >
        {currentUser.role === 'superadmin' ? (
          <>
            <button
              onClick={() => handleNavTab('companies')}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
                currentTab === 'companies' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-5 h-5 mb-0.5 flex-shrink-0" />
              <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Bedrifter</span>
            </button>

            <button
              onClick={() => handleNavTab('dashboard')}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
                currentTab === 'dashboard' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5 flex-shrink-0" />
              <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Oversikt</span>
            </button>

            <button
              onClick={() => handleNavTab('calendar')}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
                currentTab === 'calendar' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarIcon className="w-5 h-5 mb-0.5 flex-shrink-0" />
              <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Kalender</span>
            </button>

            <button
              onClick={() => handleNavTab('journal')}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
                currentTab === 'journal' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BookOpen className="w-5 h-5 mb-0.5 flex-shrink-0" />
              <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Journal</span>
            </button>

            <button
              onClick={() => handleNavTab('clients')}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
                currentTab === 'clients' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-5 h-5 mb-0.5 flex-shrink-0" />
              <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Klienter</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleNavTab('dashboard')}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
                currentTab === 'dashboard' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5 flex-shrink-0" />
              <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Oversikt</span>
            </button>

            <button
              onClick={() => handleNavTab('calendar')}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
                currentTab === 'calendar' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarIcon className="w-5 h-5 mb-0.5 flex-shrink-0" />
              <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Kalender</span>
            </button>

            {isStaffOrAdmin && (
              <button
                onClick={() => handleNavTab('journal')}
                className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
                  currentTab === 'journal' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BookOpen className="w-5 h-5 mb-0.5 flex-shrink-0" />
                <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Journal</span>
              </button>
            )}

            {isStaffOrAdmin && (
              <button
                onClick={() => handleNavTab('clients')}
                className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
                  currentTab === 'clients' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-5 h-5 mb-0.5 flex-shrink-0" />
                <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Klienter</span>
              </button>
            )}

            {isStaffOrAdmin && (
              <button
                onClick={() => handleNavTab('admin_settings')}
                className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-colors ${
                  currentTab === 'admin_settings' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Settings className="w-5 h-5 mb-0.5 flex-shrink-0" />
                <span className="text-[11px] font-medium truncate w-full text-center block leading-tight">Klinikk</span>
              </button>
            )}
          </>
        )}
      </nav>

      {/* Skjult på mobil og ved Journal-fane for å frigjøre maksimal skjermplass */}
      {!isJournalTab && (
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
              Sikkert flerbedrifts kundeoppfølgings- og bookingsystem
            </p>
          </div>
        </footer>
      )}
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
