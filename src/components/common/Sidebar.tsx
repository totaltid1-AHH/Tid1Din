import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  LogOut, 
  Users, 
  Settings, 
  Calendar as CalendarIcon, 
  LayoutDashboard,
  Menu, 
  X, 
  BookOpen, 
  Building2, 
  MessageSquare,
  Clock
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { 
    currentUser, 
    activeCompany, 
    logout
  } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!currentUser) return null;

  const handleNavClick = (tab: string) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
  };

  const isSuperAdmin = currentUser.role === 'superadmin';
  const isStaffOrAdmin = currentUser.role === 'hovedadmin' || currentUser.role === 'admin';

  // Menyvalg tilpasset brukerens rolle
  const navItems = isSuperAdmin
    ? [
        { id: 'companies', label: 'Bedrifter', icon: Building2 },
        { id: 'sms_admin', label: 'SMS & API', icon: MessageSquare }
      ]
    : currentUser.role === 'client'
    ? [
        { id: 'dashboard', label: 'Oversikt', icon: LayoutDashboard },
        { id: 'calendar', label: 'Kalender', icon: CalendarIcon },
        { id: 'booking', label: 'Bestill time', icon: Clock }
      ]
    : [
        { id: 'dashboard', label: 'Oversikt', icon: LayoutDashboard },
        ...(isStaffOrAdmin ? [{ id: 'journal', label: 'Journal', icon: BookOpen }] : []),
        { id: 'calendar', label: 'Kalender', icon: CalendarIcon },
        ...(isStaffOrAdmin ? [{ id: 'clients', label: 'Klienter', icon: Users }] : []),
        ...(isStaffOrAdmin ? [{ id: 'admin_settings', label: 'Klinikk', icon: Settings }] : [])
      ];

  const getRoleLabel = () => {
    switch (currentUser.role) {
      case 'superadmin': return 'Superadmin';
      case 'hovedadmin': return 'Hovedadmin';
      case 'admin': return 'Behandler';
      case 'client': return `Klient #${currentUser.customerNumber || 1000}`;
      default: return '';
    }
  };

  const getSubTitle = () => {
    if (isSuperAdmin) return 'Systemadministrasjon';
    return activeCompany?.treatmentPlace || activeCompany?.name || 'Klinikk';
  };

  return (
    <>
      {/* MOBIL TOPPLINJE */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#0f172a] border-b border-slate-800/80 px-4 py-3 flex items-center justify-between text-white flex-shrink-0">
        <div 
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => handleNavClick(isSuperAdmin ? 'companies' : 'dashboard')}
        >
          <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-xs text-white">
            T1
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white leading-tight block">Tid1Din</span>
            <span className="text-[10px] text-slate-400 block -mt-0.5">{getSubTitle()}</span>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Meny"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* MOBIL MENYSKUFFE */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-[#0f172a] border-r border-slate-800 h-full flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div>
              <div className="p-4 border-b border-slate-800/70 flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold tracking-tight text-white block">Tid1Din</span>
                  <span className="text-[11px] text-slate-400">{getSubTitle()}</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="p-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-3 border-t border-slate-800/70 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-semibold text-white truncate">{currentUser.displayName}</p>
                <p className="text-[10px] text-slate-400">{getRoleLabel()}</p>
              </div>
              <button
                onClick={() => logout()}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Logg ut"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 bg-[#0f172a] border-r border-slate-800/70 flex-col justify-between z-40 text-white">
        <div>
          {/* Logo / Header */}
          <div 
            className="p-5 border-b border-slate-800/70 cursor-pointer flex items-center gap-3"
            onClick={() => handleNavClick(isSuperAdmin ? 'companies' : 'dashboard')}
          >
            <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-sm shadow-xs flex-shrink-0">
              T1
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold tracking-tight text-white leading-tight block truncate">Tid1Din</span>
              <span className="text-[11px] text-slate-400 leading-tight block truncate">{getSubTitle()}</span>
            </div>
          </div>

          {/* Menyliste */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-sky-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bruker & logg ut */}
        <div className="p-3.5 border-t border-slate-800/70 flex items-center justify-between bg-slate-950/30">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-white truncate">{currentUser.displayName}</p>
            <p className="text-[10px] text-slate-400 truncate">{getRoleLabel()}</p>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition-colors flex-shrink-0"
            title="Logg ut"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
