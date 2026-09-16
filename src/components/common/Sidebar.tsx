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
  LayoutDashboard,
  CheckCircle2, 
  Sparkles,
  Menu,
  X,
  Lock
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser, logout, switchUserRole } = useAuth();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleBadge = () => {
    if (!currentUser) return null;
    if (currentUser.role === 'hovedadmin') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          Hovedadmin
        </span>
      );
    }
    if (currentUser.role === 'admin') {
      const isRestricted = !currentUser.permissions?.canViewClientName;
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-700/60">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          {isRestricted ? 'Admin (Skjult)' : 'Admin'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
        <User className="w-3.5 h-3.5 text-emerald-400" />
        #{currentUser.customerNumber || 1000}
      </span>
    );
  };

  const handleNavClick = (tab: string) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
  };

  const renderNavLinks = () => {
    if (!currentUser) return null;

    return (
      <nav className="space-y-1.5 px-3">
        <button
          onClick={() => handleNavClick('dashboard')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            currentTab === 'dashboard'
              ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-900'
          }`}
        >
          <LayoutDashboard className="w-4.5 h-4.5 flex-shrink-0" />
          <span>Oversikt</span>
        </button>

        <button
          onClick={() => handleNavClick('calendar')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            currentTab === 'calendar'
              ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-900'
          }`}
        >
          <CalendarIcon className="w-4.5 h-4.5 flex-shrink-0" />
          <span>Kalender & Booking</span>
        </button>

        {(currentUser.role === 'hovedadmin' || currentUser.role === 'admin') && (
          <button
            onClick={() => handleNavClick('clients')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              currentTab === 'clients'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-4.5 h-4.5 flex-shrink-0" />
            <span>Klienter & Journal</span>
          </button>
        )}

        {(currentUser.role === 'hovedadmin' || currentUser.role === 'admin') && (
          <button
            onClick={() => handleNavClick('admin_settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              currentTab === 'admin_settings'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Settings className="w-4.5 h-4.5 flex-shrink-0" />
            <span>Klinikk</span>
          </button>
        )}

        {currentUser.role === 'hovedadmin' && (
          <button
            onClick={() => handleNavClick('super_admin')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              currentTab === 'super_admin'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                : 'text-rose-400 hover:text-rose-300 hover:bg-slate-900'
            }`}
          >
            <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0" />
            <span>Super-admin</span>
          </button>
        )}
      </nav>
    );
  };

  const renderUserSection = () => {
    if (!currentUser) return null;

    return (
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        <div className="px-1 py-1 mb-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-white truncate max-w-[140px]">{currentUser.displayName}</p>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400" title="2FA aktivert">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>2FA</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {getRoleBadge()}
          </div>
        </div>

        {/* Hurtig-rollebytte */}
        <div className="relative mb-2">
          <button
            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
              <span>Bytt testrolle</span>
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Demo</span>
          </button>

          {showRoleSwitcher && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 py-2 z-50 animate-in fade-in duration-150">
              <div className="px-3.5 py-1.5 border-b border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Velg testrolle</p>
              </div>
              <div className="p-1.5 space-y-1">
                <button
                  onClick={() => { switchUserRole('u_hovedadmin'); setShowRoleSwitcher(false); }}
                  className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 flex items-center justify-between transition-colors text-slate-200"
                >
                  <div>
                    <p className="font-bold text-white text-sm">Dr. Kari Nordmann</p>
                    <p className="text-[11px] text-indigo-400 font-semibold">Hovedadmin</p>
                  </div>
                  {currentUser.uid === 'u_hovedadmin' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </button>

                <button
                  onClick={() => { switchUserRole('u_admin_full'); setShowRoleSwitcher(false); }}
                  className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 flex items-center justify-between transition-colors text-slate-200"
                >
                  <div>
                    <p className="font-bold text-white text-sm">Jonas Berg</p>
                    <p className="text-[11px] text-amber-400 font-semibold">Admin (Innsyn)</p>
                  </div>
                  {currentUser.uid === 'u_admin_full' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </button>

                <button
                  onClick={() => { switchUserRole('u_admin_restricted'); setShowRoleSwitcher(false); }}
                  className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 flex items-center justify-between transition-colors text-slate-200"
                >
                  <div>
                    <p className="font-bold text-white text-sm">Eva Lund</p>
                    <p className="text-[11px] text-rose-400 font-semibold">Admin (Skjult)</p>
                  </div>
                  {currentUser.uid === 'u_admin_restricted' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </button>

                <button
                  onClick={() => { switchUserRole('u_client_1000'); setShowRoleSwitcher(false); }}
                  className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 flex items-center justify-between transition-colors text-slate-200"
                >
                  <div>
                    <p className="font-bold text-white text-sm">Ola Hansen</p>
                    <p className="text-[11px] text-emerald-400 font-semibold">Klient #1000</p>
                  </div>
                  {currentUser.uid === 'u_client_1000' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logg ut */}
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition-colors border border-transparent hover:border-rose-900/50"
        >
          <LogOut className="w-4 h-4" />
          <span>Logg ut</span>
        </button>
      </div>
    );
  };

  return (
    <>
      {/* MOBIL & NETTBRETT TOPPLINJE (synlig på skjermer under lg) */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-white">
        <div 
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => handleNavClick('dashboard')}
        >
          <span className="text-xl font-black tracking-tight text-white">Tid1Din</span>
        </div>

        <div className="flex items-center gap-2">
          {getRoleBadge()}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Åpne meny"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* MOBIL & NETTBRETT MENYSKUFFE (drawer bakgrunn & panel) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 h-full flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div>
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-2xl font-black tracking-tight text-white block">Tid1Din</span>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    End-to-End Sikret
                  </p>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4">
                {renderNavLinks()}
              </div>
            </div>

            {renderUserSection()}
          </div>
        </div>
      )}

      {/* DESKTOP FAST VENSTRESTILT SVART SIDEFELT */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 bg-slate-950 border-r border-slate-800 flex-col justify-between z-40 text-white">
        <div>
          {/* Brand header */}
          <div 
            className="p-5 border-b border-slate-800/80 cursor-pointer"
            onClick={() => handleNavClick('dashboard')}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white">Tid1Din</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
              <Lock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Sikker kundeoppfølging</span>
            </p>
          </div>

          {/* Menyliste */}
          <div className="py-5">
            <div className="px-5 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hovedmeny</p>
            </div>
            {renderNavLinks()}
          </div>
        </div>

        {/* Bruker & innstillinger seksjon */}
        {renderUserSection()}
      </aside>
    </>
  );
};

export default Sidebar;
