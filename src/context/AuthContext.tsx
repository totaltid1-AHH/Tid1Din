import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, AdminPermissions } from '../types';
import { dbService } from '../services/db';

interface AuthContextType {
  currentUser: UserProfile | null;
  isLoading: boolean;
  is2FAModalOpen: boolean;
  pendingUser: UserProfile | null;
  login: (email: string, password?: string) => Promise<{ success: boolean; requires2FA: boolean; error?: string }>;
  verify2FA: (code: string) => Promise<boolean>;
  cancel2FA: () => void;
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

  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedUid = localStorage.getItem('dintid_active_uid');
        if (savedUid) {
          const user = await dbService.getUserById(savedUid);
          if (user) {
            setCurrentUser(user);
          }
        } else {
          // Standard demo-innlogging: Hovedadmin for enkel oppstart
          const user = await dbService.getUserById('u_hovedadmin');
          if (user) {
            setCurrentUser(user);
            localStorage.setItem('dintid_active_uid', user.uid);
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

  const login = async (email: string, _password?: string) => {
    const users = await dbService.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return { success: false, requires2FA: false, error: 'Fant ingen bruker med denne e-postadressen' };
    }

    // Hvis bruker har 2FA aktivert, be om engangskode
    if (user.twoFactorEnabled) {
      setPendingUser(user);
      setIs2FAModalOpen(true);
      return { success: true, requires2FA: true };
    }

    setCurrentUser(user);
    localStorage.setItem('dintid_active_uid', user.uid);
    await dbService.logAction(
      { uid: user.uid, email: user.email, role: user.role },
      'login',
      `Bruker ${user.displayName} logget inn uten 2FA`
    );
    return { success: true, requires2FA: false };
  };

  const verify2FA = async (code: string): Promise<boolean> => {
    if (!pendingUser) return false;

    // Godtar standard testkode '123456' eller vilkårlig 6-sifret kode for 2FA-verifisering
    if (code.trim().length >= 4) {
      setCurrentUser(pendingUser);
      localStorage.setItem('dintid_active_uid', pendingUser.uid);
      await dbService.logAction(
        { uid: pendingUser.uid, email: pendingUser.email, role: pendingUser.role },
        '2fa_verified',
        `2FA verifisert for bruker ${pendingUser.displayName} med kode`
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
      twoFactorEnabled: true,
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
        login,
        verify2FA,
        cancel2FA,
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
