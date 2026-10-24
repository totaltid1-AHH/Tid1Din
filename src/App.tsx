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
import { SuperAdminSmsView } from './components/admin/SuperAdminSmsView';
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
  Building2,
  Clock
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

  // Superadmin har tilgang til bedriftsoversikt og SMS-styring
  useEffect(() => {
    if (currentUser?.role === 'superadmin' && currentTab !== 'companies' && currentTab !== 'sms_admin') {
      setCurrentTab('companies');
    }
  }, [currentUser?.role, currentTab]);

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
        <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <TwoFactorModal />
        <LoginView />
      </div>
    );
  }

  const isStaffOrAdmin = currentUser.role === 'hovedadmin' || currentUser.role === 'admin';
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
          {/* Mobil/iPad: full bredde, Desktop: max-w-7xl px-4 */}
          <main className={`w-full max-w-full lg:max-w-7xl lg:mx-auto px-0 sm:px-4 lg:px-8 py-0 sm:py-6 ${currentUser.role === 'superadmin' ? 'pb-8' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'} lg:pb-8`}>
            
            {/* Super-admin portal: Viser bedriftsoversikt eller SMS-styring */}
            {currentUser.role === 'superadmin' ? (
              currentTab === 'sms_admin' ? (
                <SuperAdminSmsView key={`sms_${currentUser.uid}`} />
              ) : (
                <SuperAdminCompaniesView key={`companies_${currentUser.uid}`} />
              )
            ) : (
              <>
                {/* Fanevelging for bedriftsbrukere (hovedadmin, admin og klient) */}
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
              </>
            )}
          </main>
        </div>
      )}

      {/* Bunn-navigasjon på mobil for bedriftsbrukere (skjult for super-admin) */}
      {currentUser.role !== 'superadmin' && (
        <nav
          className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 flex items-center justify-around px-2 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] w-full"
        >
          <button
            onClick={() => handleNavTab('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
              currentTab === 'dashboard' ? 'text-sky-600 font-semibold' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4.5 h-4.5 mb-0.5" />
            <span className="text-[10px]">Oversikt</span>
          </button>

          <button
            onClick={() => handleNavTab('calendar')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
              currentTab === 'calendar' ? 'text-sky-600 font-semibold' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <CalendarIcon className="w-4.5 h-4.5 mb-0.5" />
            <span className="text-[10px]">Kalender</span>
          </button>

          {currentUser.role === 'client' && (
            <button
              onClick={() => handleNavTab('booking')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                currentTab === 'booking' ? 'text-sky-600 font-semibold' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <Clock className="w-4.5 h-4.5 mb-0.5" />
              <span className="text-[10px]">Bestill</span>
            </button>
          )}

          {isStaffOrAdmin && (
            <button
              onClick={() => handleNavTab('journal')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                currentTab === 'journal' ? 'text-sky-600 font-semibold' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <BookOpen className="w-4.5 h-4.5 mb-0.5" />
              <span className="text-[10px]">Journal</span>
            </button>
          )}

          {isStaffOrAdmin && (
            <button
              onClick={() => handleNavTab('clients')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                currentTab === 'clients' ? 'text-sky-600 font-semibold' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <Users className="w-4.5 h-4.5 mb-0.5" />
              <span className="text-[10px]">Klienter</span>
            </button>
          )}

          {isStaffOrAdmin && (
            <button
              onClick={() => handleNavTab('admin_settings')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                currentTab === 'admin_settings' ? 'text-sky-600 font-semibold' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <Settings className="w-4.5 h-4.5 mb-0.5" />
              <span className="text-[10px]">Klinikk</span>
            </button>
          )}
        </nav>
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
