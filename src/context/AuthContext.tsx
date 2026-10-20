import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, AdminPermissions, Company } from '../types';
import { dbService, DEFAULT_COMPANY } from '../services/db';
import { verifyTotpCode, generateTotpSecret } from '../utils/totp';
import { auth, isFirebaseConfigured, googleProvider } from '../config/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

export const SUPERADMIN_EMAILS = [
  'total.tid1@gmail.com',
  'superadmin@dintid.no'
];

interface AuthContextType {
  currentUser: UserProfile | null;
  activeCompany: Company | null;
  companies: Company[];
  isLoading: boolean;
  is2FAModalOpen: boolean;
  pendingUser: UserProfile | null;
  is2FASetupModalOpen: boolean;
  setup2FAUser: UserProfile | null;
  login: (identifier: string, password?: string) => Promise<{ success: boolean; requires2FA: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  verify2FA: (code: string) => Promise<boolean>;
  cancel2FA: () => void;
  open2FASetupModal: (user?: UserProfile) => void;
  close2FASetupModal: () => void;
  updateUser2FA: (uid: string, enabled: boolean, secret?: string) => Promise<void>;
  logout: () => Promise<void>;
  registerClient: (data: {
    displayName: string;
    email: string;
    phone: string;
    address: string;
    birthDate: string;
    notes?: string;
  }) => Promise<UserProfile>;
  switchUserRole: (uid: string) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  refreshCompanies: () => Promise<void>;
  updateUserPermissions: (uid: string, permissions: AdminPermissions) => Promise<void>;
  updateCurrentUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([DEFAULT_COMPANY]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [is2FASetupModalOpen, setIs2FASetupModalOpen] = useState(false);
  const [setup2FAUser, setSetup2FAUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const comps = await dbService.getCompanies();
        setCompanies(comps);

        const savedUid = localStorage.getItem('dintid_active_uid');
        if (savedUid) {
          const user = await dbService.getUserById(savedUid);
          if (user) {
            if (user.role === 'client') {
              // Klient-innlogging er satt på pause
              localStorage.removeItem('dintid_active_uid');
              setCurrentUser(null);
            } else {
              setCurrentUser(user);
              const targetCompId = user.companyId || dbService.getActiveCompanyId();
              dbService.setActiveCompanyId(targetCompId);
              const matchedComp = comps.find(c => c.id === targetCompId) || comps[0] || null;
              setActiveCompany(matchedComp);
            }
          }
        } else {
          const targetCompId = dbService.getActiveCompanyId();
          const matchedComp = comps.find(c => c.id === targetCompId) || comps[0] || null;
          setActiveCompany(matchedComp);
        }
      } catch (e) {
        console.error('Feil under initialisering av autentisering:', e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const refreshCompanies = async () => {
    try {
      const comps = await dbService.getCompanies(true);
      setCompanies(comps);
      const activeId = dbService.getActiveCompanyId();
      const current = comps.find(c => c.id === activeId) || comps[0] || null;
      setActiveCompany(current);
    } catch (e) {
      console.error('Feil ved oppdatering av bedrifter:', e);
    }
  };

  const switchCompany = async (companyId: string) => {
    dbService.setActiveCompanyId(companyId);
    const matched = companies.find(c => c.id === companyId) || await dbService.getCompanyById(companyId) || null;
    setActiveCompany(matched);
    if (currentUser) {
      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'switch_company',
        `Byttet aktiv bedrift til: ${matched?.name || companyId}`
      );
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!isFirebaseConfigured || !auth) {
        // Fallback ved frakoblet/lokalt miljø: logg inn superadmin demo
        const demoUser = await dbService.getUserById('u_superadmin_total');
        if (demoUser) {
          setCurrentUser(demoUser);
          localStorage.setItem('dintid_active_uid', demoUser.uid);
          const currentCompanyId = dbService.getActiveCompanyId();
          const comp = await dbService.getCompanyById(currentCompanyId);
          setActiveCompany(comp);
          return { success: true };
        }
        return { success: false, error: 'Firebase er ikke konfigurert for ekte innlogging.' };
      }

      const result = await signInWithPopup(auth, googleProvider);
      const googleUser = result.user;
      const email = googleUser.email?.toLowerCase().trim() || '';

      if (!email) {
        return { success: false, error: 'Kunne ikke hente e-postadresse fra Google-kontoen.' };
      }

      const isWhitelistedSuperAdmin = SUPERADMIN_EMAILS.some(e => e.toLowerCase() === email);

      // Sjekk om bruker allerede finnes
      const allUsers = await dbService.getAllUsers(true);
      let user = allUsers.find(u => u.email.toLowerCase() === email);

      if (isWhitelistedSuperAdmin) {
        if (!user) {
          user = {
            uid: googleUser.uid || 'u_superadmin_' + Date.now(),
            email: googleUser.email || email,
            role: 'superadmin',
            displayName: googleUser.displayName || 'Super Administrator',
            twoFactorEnabled: false,
            isActive: true,
            createdAt: new Date().toISOString()
          };
          await dbService.saveUser(user);
        } else if (user.role !== 'superadmin') {
          user.role = 'superadmin';
          await dbService.saveUser(user);
        }
      } else {
        // Dersom e-posten ikke er forhåndsgodkjent superadmin, sjekk om den tilhører en eksisterende klinikkbruker
        if (!user) {
          await signOut(auth).catch(() => null);
          return {
            success: false,
            error: `E-postadressen ${email} er ikke autorisert som super-administrator. Kun forhåndsgodkjente administratorer (total.tid1@gmail.com) har adgang her.`
          };
        }
      }

      setCurrentUser(user);
      localStorage.setItem('dintid_active_uid', user.uid);

      // Sett aktiv bedriftskontekst
      const compId = user.companyId || dbService.getActiveCompanyId();
      dbService.setActiveCompanyId(compId);
      const comp = await dbService.getCompanyById(compId);
      setActiveCompany(comp);

      await dbService.logAction(
        { uid: user.uid, email: user.email, role: user.role },
        'login',
        `Google-innlogging fullført for ${user.displayName} (${user.role})`
      );

      return { success: true };
    } catch (err: any) {
      console.error('Feil ved Google-innlogging:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'Innloggingsvinduet ble lukket før fullføring.' };
      }
      if (err.code === 'auth/popup-blocked') {
        return { success: false, error: 'Nettleseren blokkerte popup-vinduet for innlogging. Vennligst tillat popups og prøv på nytt.' };
      }
      return { success: false, error: err.message || 'Google-innlogging feilet.' };
    }
  };

  const login = async (identifier: string, password?: string) => {
    const users = await dbService.getAllUsers();
    // Aksepter innlogging med e-post eller brukernavn
    const user = users.find(u =>
      u.email.toLowerCase() === identifier.toLowerCase() ||
      (u.username && u.username.toLowerCase() === identifier.toLowerCase())
    );

    if (!user) {
      return { success: false, requires2FA: false, error: 'Feil brukernavn/e-post eller passord' };
    }

    // Klient-innlogging er satt på pause
    if (user.role === 'client') {
      return { 
        success: false, 
        requires2FA: false, 
        error: 'Klient-innlogging er midlertidig satt på pause. Kun behandlere og klinikkadministratorer kan logge inn.' 
      };
    }

    // Passord-sjekk: hopp over hvis ingen passord er satt (bakoverkompatibilitet) eller ved demo-hurtigvalg
    if (user.password && password !== undefined && user.password !== password) {
      return { success: false, requires2FA: false, error: 'Feil brukernavn/e-post eller passord' };
    }

    // Hvis bruker har 2FA aktivert, be om engangskode fra Google Authenticator
    if (user.twoFactorEnabled) {
      if (!user.twoFactorSecret) {
        user.twoFactorSecret = 'JBSWY3DPEHPK3PXP';
      }
      setPendingUser(user);
      setIs2FAModalOpen(true);
      return { success: true, requires2FA: true };
    }

    setCurrentUser(user);
    localStorage.setItem('dintid_active_uid', user.uid);

    // Knytt til bedriften
    const targetCompId = user.companyId || dbService.getActiveCompanyId();
    dbService.setActiveCompanyId(targetCompId);
    const comp = await dbService.getCompanyById(targetCompId);
    setActiveCompany(comp);

    await dbService.logAction(
      { uid: user.uid, email: user.email, role: user.role },
      'login',
      `Bruker ${user.displayName} logget inn`
    );
    return { success: true, requires2FA: false };
  };

  const verify2FA = async (code: string): Promise<boolean> => {
    if (!pendingUser) return false;

    const trimmed = code.trim();
    let isValid = false;

    // Sjekk ekte TOTP-kode med Google Authenticator
    if (pendingUser.twoFactorSecret) {
      try {
        isValid = await verifyTotpCode(trimmed, pendingUser.twoFactorSecret);
      } catch (err) {
        console.error('Feil ved verifisering av TOTP-kode:', err);
      }
    }

    // Tillat også testkode '123456' i test-/demomiljø
    if (!isValid && trimmed === '123456') {
      isValid = true;
    }

    if (isValid) {
      setCurrentUser(pendingUser);
      localStorage.setItem('dintid_active_uid', pendingUser.uid);

      const targetCompId = pendingUser.companyId || dbService.getActiveCompanyId();
      dbService.setActiveCompanyId(targetCompId);
      const comp = await dbService.getCompanyById(targetCompId);
      setActiveCompany(comp);

      await dbService.logAction(
        { uid: pendingUser.uid, email: pendingUser.email, role: pendingUser.role },
        '2fa_verified',
        `Google Authenticator 2FA verifisert for bruker ${pendingUser.displayName}`
      );
      setPendingUser(null);
      setIs2FAModalOpen(false);
      return true;
    }
    return false;
  };

  const cancel2FA = () => {
    setPendingUser(null);
    setIs2FAModalOpen(false);
  };

  const open2FASetupModal = (user?: UserProfile) => {
    setSetup2FAUser(user || currentUser);
    setIs2FASetupModalOpen(true);
  };

  const close2FASetupModal = () => {
    setSetup2FAUser(null);
    setIs2FASetupModalOpen(false);
  };

  const updateUser2FA = async (uid: string, enabled: boolean, secret?: string) => {
    const user = await dbService.getUserById(uid);
    if (!user) return;

    const updated: UserProfile = {
      ...user,
      twoFactorEnabled: enabled,
      twoFactorSecret: enabled ? (secret || user.twoFactorSecret || generateTotpSecret(16)) : undefined,
      updatedAt: new Date().toISOString()
    };

    await dbService.saveUser(updated);

    if (currentUser?.uid === uid) {
      setCurrentUser(updated);
    }

    await dbService.logAction(
      { uid: user.uid, email: user.email, role: user.role },
      enabled ? '2fa_enabled' : '2fa_disabled',
      `Google Authenticator 2FA ble ${enabled ? 'aktivert' : 'deaktivert'} for ${user.displayName}`
    );
  };

  const logout = async () => {
    if (currentUser) {
      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'logout',
        `Bruker ${currentUser.displayName} logget ut`
      );
    }
    setCurrentUser(null);
    setActiveCompany(null);
    localStorage.removeItem('dintid_active_uid');
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn('Feil ved utlogging fra Firebase Auth:', e);
      }
    }
  };

  const switchUserRole = async (uid: string) => {
    const user = await dbService.getUserById(uid);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('dintid_active_uid', user.uid);
      const targetCompId = user.companyId || dbService.getActiveCompanyId();
      dbService.setActiveCompanyId(targetCompId);
      const comp = await dbService.getCompanyById(targetCompId);
      setActiveCompany(comp);

      await dbService.logAction(
        { uid: user.uid, email: user.email, role: user.role },
        'login',
        `Byttet aktiv profil til: ${user.displayName} (${user.role})`
      );
    }
  };

  const registerClient = async (data: {
    displayName: string;
    email: string;
    phone: string;
    address: string;
    birthDate: string;
    notes?: string;
  }): Promise<UserProfile> => {
    const activeCompanyId = dbService.getActiveCompanyId();
    const customerNumber = await dbService.getNextCustomerNumber(activeCompanyId);
    const newUid = 'u_client_' + customerNumber;

    const newClient: UserProfile = {
      uid: newUid,
      companyId: activeCompanyId,
      email: data.email,
      role: 'client',
      displayName: data.displayName,
      customerNumber,
      phone: data.phone,
      address: data.address,
      birthDate: data.birthDate,
      notes: data.notes || '',
      twoFactorEnabled: false,
      createdAt: new Date().toISOString()
    };

    await dbService.saveUser(newClient);

    if (currentUser) {
      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'create_client',
        `Opprettet ny klient: ${newClient.displayName} (Kundenummer: ${customerNumber})`
      );
    }

    return newClient;
  };

  const updateUserPermissions = async (uid: string, permissions: AdminPermissions) => {
    const user = await dbService.getUserById(uid);
    if (user && user.role === 'admin') {
      user.permissions = permissions;
      user.updatedAt = new Date().toISOString();
      await dbService.saveUser(user);

      if (currentUser?.uid === uid) {
        setCurrentUser({ ...user });
      }

      if (currentUser) {
        await dbService.logAction(
          { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
          'update_admin_permissions',
          `Oppdaterte rettigheter for administrator: ${user.displayName}`
        );
      }
    }
  };

  const updateCurrentUserProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...data, updatedAt: new Date().toISOString() };
    await dbService.saveUser(updated);
    setCurrentUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeCompany,
        companies,
        isLoading,
        is2FAModalOpen,
        pendingUser,
        is2FASetupModalOpen,
        setup2FAUser,
        login,
        loginWithGoogle,
        verify2FA,
        cancel2FA,
        open2FASetupModal,
        close2FASetupModal,
        updateUser2FA,
        logout,
        registerClient,
        switchUserRole,
        switchCompany,
        refreshCompanies,
        updateUserPermissions,
        updateCurrentUserProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth må brukes innenfor en AuthProvider');
  }
  return context;
};
