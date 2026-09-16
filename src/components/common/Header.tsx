import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  User, 
  LogOut, 
  Users, 
  Settings, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser, logout, switchUserRole } = useAuth();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  const getRoleBadge = () => {
    if (!currentUser) return null;
    if (currentUser.role === 'hovedadmin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
          <Shield className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-600" />
          Hovedadmin
        </span>
      );
    }
    if (currentUser.role === 'admin') {
      const isRestricted = !currentUser.permissions?.canViewClientName;
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <Shield className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-600" />
          {isRestricted ? 'Admin (Skjult)' : 'Admin'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <User className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-600" />
        #{currentUser.customerNumber || 1000}
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm w-full">
      <div className="w-full sm:max-w-7xl sm:mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20 gap-2">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5 cursor-pointer flex-shrink-0" onClick={() => setCurrentTab('dashboard')}>
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 block leading-none">Tid1Din</span>
          </div>

          {/* Desktop Navigasjon - forstørret ca 60% */}
          {currentUser && (
            <nav className="hidden lg:flex items-center gap-1.5">
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  currentTab === 'dashboard'
                    ? 'bg-sky-50 text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Oversikt
              </button>

              <button
                onClick={() => setCurrentTab('calendar')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
                  currentTab === 'calendar'
                    ? 'bg-sky-50 text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <CalendarIcon className="w-4.5 h-4.5" />
                Kalender & Booking
              </button>

              {(currentUser.role === 'hovedadmin' || currentUser.role === 'admin') && (
                <button
                  onClick={() => setCurrentTab('clients')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
                    currentTab === 'clients'
                      ? 'bg-sky-50 text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-4.5 h-4.5" />
                  Klienter & Journal
                </button>
              )}

              {(currentUser.role === 'hovedadmin' || currentUser.role === 'admin') && (
                <button
                  onClick={() => setCurrentTab('admin_settings')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
                    currentTab === 'admin_settings'
                      ? 'bg-sky-50 text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Settings className="w-4.5 h-4.5" />
                  Klinikk
                </button>
              )}

              {currentUser.role === 'hovedadmin' && (
                <button
                  onClick={() => setCurrentTab('super_admin')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
                    currentTab === 'super_admin'
                      ? 'bg-rose-50 text-rose-700 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <ShieldAlert className="w-4.5 h-4.5 text-rose-600" />
                  Super-admin
                </button>
              )}
            </nav>
          )}

          {/* Brukerprofil & Rollebytter - forstørret ca 60% */}
          {currentUser && (
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-800 hidden xl:inline">{currentUser.displayName}</span>
                {getRoleBadge()}
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                  <span className="hidden xs:inline">2FA</span>
                </span>
              </div>

              {/* Hurtig-rollebytte */}
              <div className="relative">
                <button
                  onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors border border-slate-300 shadow-2xs"
                  title="Test systemet med ulike brukerroller"
                >
                  <Sparkles className="w-4 h-4 text-sky-600 flex-shrink-0" />
                  <span className="hidden sm:inline">Rolle</span>
                </button>

                {showRoleSwitcher && (
                  <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in duration-150">
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Velg testrolle</p>
                    </div>
                    <div className="p-1.5 space-y-1">
                      <button
                        onClick={() => { switchUserRole('u_hovedadmin'); setShowRoleSwitcher(false); }}
                        className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-800 text-sm">Dr. Kari Nordmann</p>
                          <p className="text-[11px] text-indigo-600 font-semibold">Hovedadmin</p>
                        </div>
                        {currentUser.uid === 'u_hovedadmin' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </button>

                      <button
                        onClick={() => { switchUserRole('u_admin_full'); setShowRoleSwitcher(false); }}
                        className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-800 text-sm">Jonas Berg</p>
                          <p className="text-[11px] text-amber-600 font-semibold">Admin (Innsyn)</p>
                        </div>
                        {currentUser.uid === 'u_admin_full' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </button>

                      <button
                        onClick={() => { switchUserRole('u_admin_restricted'); setShowRoleSwitcher(false); }}
                        className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-800 text-sm">Eva Lund</p>
                          <p className="text-[11px] text-rose-600 font-semibold">Admin (Skjult)</p>
                        </div>
                        {currentUser.uid === 'u_admin_restricted' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </button>

                      <button
                        onClick={() => { switchUserRole('u_client_1000'); setShowRoleSwitcher(false); }}
                        className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-800 text-sm">Ola Hansen</p>
                          <p className="text-[11px] text-emerald-600 font-semibold">Klient #1000</p>
                        </div>
                        {currentUser.uid === 'u_client_1000' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Logg ut - forstørret ikon og knapp */}
              <button
                onClick={() => logout()}
                className="p-2 sm:p-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex-shrink-0"
                title="Logg ut"
              >
                <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          )}

        </div>
      </div>
    </header>
  );
};
