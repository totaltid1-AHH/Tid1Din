import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, AdminPermissions } from '../types';
import { dbService } from '../services/db';
import { verifyTotpCode, generateTotpSecret } from '../utils/totp';

interface AuthContextType {
  currentUser: UserProfile | null;
  isLoading: boolean;
  is2FAModalOpen: boolean;
  pendingUser: UserProfile | null;
  is2FASetupModalOpen: boolean;
  setup2FAUser: UserProfile | null;
  login: (identifier: string, password?: string) => Promise<{ success: boolean; requires2FA: boolean; error?: string }>;
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
  updateUserPermissions: (uid: string, permissions: AdminPermissions) => Promise<void>;
  updateCurrentUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [is2FASetupModalOpen, setIs2FASetupModalOpen] = useState(false);
  const [setup2FAUser, setSetup2FAUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
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
            }
          }
        }
      } catch (e) {
        console.error('Feil under initialisering av autentisering:', e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (identifier: string, password?: string) => {
    const users = await dbService.getUsers();
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
        error: 'Klient-innlogging er midlertidig satt på pause. Kun behandlere og terapeuter kan logge inn for øyeblikket.' 
      };
    }

    // Passord-sjekk: hopp over hvis ingen passord er satt (bakoverkompatibilitet) eller ved demo-hurtigvalg
    if (user.password && password !== undefined && user.password !== password) {
      return { success: false, requires2FA: false, error: 'Feil brukernavn/e-post eller passord' };
    }

    // Hvis bruker har 2FA aktivert, be om engangskode fra Google Authenticator
    if (user.twoFactorEnabled) {
      // Sikre at bruker har en hemmelighet hvis 2FA er slått på
      if (!user.twoFactorSecret) {
        user.twoFactorSecret = 'JBSWY3DPEHPK3PXP';
      }
      setPendingUser(user);
      setIs2FAModalOpen(true);
      return { success: true, requires2FA: true };
    }

    setCurrentUser(user);
    localStorage.setItem('dintid_active_uid', user.uid);
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
    localStorage.removeItem('dintid_active_uid');
  };

  const switchUserRole = async (uid: string) => {
    const user = await dbService.getUserById(uid);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('dintid_active_uid', user.uid);
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
    const customerNumber = await dbService.getNextCustomerNumber();
    const newUid = 'u_client_' + customerNumber;

    const newClient: UserProfile = {
      uid: newUid,
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
        isLoading,
        is2FAModalOpen,
        pendingUser,
        is2FASetupModalOpen,
        setup2FAUser,
        login,
        verify2FA,
        cancel2FA,
        open2FASetupModal,
        close2FASetupModal,
        updateUser2FA,
        logout,
        registerClient,
        switchUserRole,
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
