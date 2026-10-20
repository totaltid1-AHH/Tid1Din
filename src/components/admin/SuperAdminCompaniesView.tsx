import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { Company, UserProfile } from '../../types';
import { 
  Building2, 
  Plus, 
  Search, 
  Shield, 
  User, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin, 
  Sparkles, 
  AlertCircle,
  X,
  Check,
  Lock,
  KeyRound
} from 'lucide-react';

export const SuperAdminCompaniesView: React.FC = () => {
  const { currentUser, refreshCompanies } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal: Ny / Rediger bedrift
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Bedriftsopplysninger
  const [name, setName] = useState('');
  const [treatmentPlace, setTreatmentPlace] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Kontaktperson
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Hovedadmin
  const [hovedadminName, setHovedadminName] = useState('');
  const [hovedadminEmail, setHovedadminEmail] = useState('');
  const [hovedadminPhone, setHovedadminPhone] = useState('');
  const [hovedadminUsername, setHovedadminUsername] = useState('');
  const [hovedadminPassword, setHovedadminPassword] = useState('');

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modal: Endre passord for hovedadmin
  const [passwordModalCompany, setPasswordModalCompany] = useState<Company | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordModalError, setPasswordModalError] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const comps = await dbService.getCompanies(true);
      const users = await dbService.getAllUsers(true);
      setCompanies(comps);
      setAllUsers(users);
    } catch (e) {
      console.error('Feil ved lasting av bedrifter:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleOpenCreateModal = () => {
    setEditingCompany(null);
    setName('');
    setTreatmentPlace('');
    setOrgNumber('');
    setEmail('');
    setPhone('');
    setAddress('');
    setContactPerson('');
    setContactPhone('');
    setContactEmail('');
    setHovedadminName('');
    setHovedadminEmail('');
    setHovedadminPhone('');
    setHovedadminUsername('');
    setHovedadminPassword('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (comp: Company) => {
    setEditingCompany(comp);
    setName(comp.name);
    setTreatmentPlace(comp.treatmentPlace || comp.name);
    setOrgNumber(comp.orgNumber || '');
    setEmail(comp.email || '');
    setPhone(comp.phone || '');
    setAddress(comp.address || '');
    setContactPerson(comp.contactPerson || '');
    setContactPhone(comp.contactPhone || '');
    setContactEmail(comp.contactEmail || '');

    // Hent hovedadmin detaljer
    const adminUser = allUsers.find(u => u.uid === comp.hovedadminUid);
    setHovedadminName(comp.hovedadminName || adminUser?.displayName || '');
    setHovedadminEmail(comp.hovedadminEmail || adminUser?.email || '');
    setHovedadminPhone(adminUser?.phone || '');
    setHovedadminUsername(comp.hovedadminUsername || adminUser?.username || '');
    setHovedadminPassword(''); // Blank ved redigering med mindre man vil sette nytt
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Bedriftsnavn er påkrevd.');
      return;
    }
    const cleanTreatmentPlace = (treatmentPlace.trim() || name.trim()).substring(0, 11);

    setIsSaving(true);
    setFormError('');

    try {
      const companyId = editingCompany ? editingCompany.id : 'comp_' + Date.now();
      let adminUid = editingCompany?.hovedadminUid;
      let adminName = hovedadminName.trim() || editingCompany?.hovedadminName || 'Hovedadministrator';
      let adminEmail = hovedadminEmail.trim() || editingCompany?.hovedadminEmail || '';
      let adminUsername = hovedadminUsername.trim() || editingCompany?.hovedadminUsername || (adminEmail ? adminEmail.split('@')[0] : 'admin');

      if (!editingCompany) {
        // Ny bedrift: Må ha hovedadmin
        if (!hovedadminName.trim() || !hovedadminEmail.trim()) {
          setFormError('Hovedadministrator sitt navn og e-post er påkrevd.');
          setIsSaving(false);
          return;
        }

        const newAdminUid = 'u_hovedadmin_' + Date.now();
        const newAdminUser: UserProfile = {
          uid: newAdminUid,
          companyId,
          role: 'hovedadmin',
          displayName: adminName,
          email: adminEmail,
          username: adminUsername,
          password: hovedadminPassword.trim() || 'demo1234',
          phone: hovedadminPhone.trim() || undefined,
          twoFactorEnabled: false,
          isActive: true,
          createdAt: new Date().toISOString()
        };

        await dbService.saveUser(newAdminUser);
        adminUid = newAdminUid;
      } else if (editingCompany.hovedadminUid) {
        // Oppdater eksisterende hovedadmin-profil
        const existingAdmin = allUsers.find(u => u.uid === editingCompany.hovedadminUid);
        if (existingAdmin) {
          const updatedAdmin: UserProfile = {
            ...existingAdmin,
            displayName: adminName,
            email: adminEmail || existingAdmin.email,
            username: adminUsername || existingAdmin.username,
            phone: hovedadminPhone.trim() || existingAdmin.phone,
            ...(hovedadminPassword.trim() ? { password: hovedadminPassword.trim() } : {}),
            updatedAt: new Date().toISOString()
          };
          await dbService.saveUser(updatedAdmin);
        }
      }

      const companyData: Company = {
        id: companyId,
        name: name.trim(),
        treatmentPlace: cleanTreatmentPlace,
        orgNumber: orgNumber.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        hovedadminUid: adminUid,
        hovedadminName: adminName,
        hovedadminEmail: adminEmail,
        hovedadminUsername: adminUsername,
        isActive: editingCompany ? editingCompany.isActive : true,
        createdAt: editingCompany ? editingCompany.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await dbService.saveCompany(companyData);

      if (currentUser) {
        await dbService.logAction(
          { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
          editingCompany ? 'update_company' : 'create_company',
          `${editingCompany ? 'Oppdaterte' : 'Opprettet'} bedrift: ${companyData.name}`
        );
      }

      await refreshCompanies();
      await loadData();
      setIsModalOpen(false);
      showToast(editingCompany ? 'Bedriften ble oppdatert!' : 'Ny bedrift ble opprettet!');
    } catch (err: any) {
      setFormError(err.message || 'Kunne ikke lagre bedrift.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (comp: Company) => {
    const updated: Company = {
      ...comp,
      isActive: !comp.isActive,
      updatedAt: new Date().toISOString()
    };
    await dbService.saveCompany(updated);
    await refreshCompanies();
    await loadData();
    showToast(`Bedriften er nå ${updated.isActive ? 'aktiv' : 'inaktiv'}.`);
  };

  const handleDeleteCompany = async (comp: Company) => {
    if (companies.length <= 1) {
      alert('Du kan ikke slette den eneste bedriften i systemet.');
      return;
    }
    const confirmDelete = window.confirm(
      `Er du sikker på at du vil slette bedriften "${comp.name}"?`
    );
    if (!confirmDelete) return;

    await dbService.deleteCompany(comp.id);
    await refreshCompanies();
    await loadData();
    showToast('Bedriften ble slettet.');
  };

  const handleOpenPasswordModal = (comp: Company) => {
    setPasswordModalCompany(comp);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordModalError('');
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalCompany) return;
    if (!newPassword.trim()) {
      setPasswordModalError('Vennligst oppgi et nytt passord.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordModalError('Passordene matcher ikke.');
      return;
    }

    setIsSavingPassword(true);
    setPasswordModalError('');

    try {
      if (passwordModalCompany.hovedadminUid) {
        const adminUser = await dbService.getUserById(passwordModalCompany.hovedadminUid);
        if (adminUser) {
          adminUser.password = newPassword.trim();
          adminUser.updatedAt = new Date().toISOString();
          await dbService.saveUser(adminUser);
        }
      }

      if (currentUser) {
        await dbService.logAction(
          { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
          'update_company',
          `Endret passord for hovedadmin i ${passwordModalCompany.name}`
        );
      }

      await loadData();
      setPasswordModalCompany(null);
      showToast(`Nytt passord lagret for ${passwordModalCompany.name}!`);
    } catch (err: any) {
      setPasswordModalError(err.message || 'Kunne ikke oppdatere passord.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const filteredCompanies = companies.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.treatmentPlace && c.treatmentPlace.toLowerCase().includes(q)) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
      (c.hovedadminName && c.hovedadminName.toLowerCase().includes(q)) ||
      (c.hovedadminUsername && c.hovedadminUsername.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      
      {/* Toast bekreftelse */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <Check className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Toppseksjon med tittel og opprett-knapp */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Super-admin portal
              </span>
              <span className="text-xs text-slate-400 font-mono">Kun bedriftsadministrasjon</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-600" />
              Bedriftsoversikt
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Administrasjon av bedriftsinformasjon, kontaktperson, adresse og hovedadmin med brukernavn og passord.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-center"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Registrer ny bedrift</span>
          </button>
        </div>

        {/* Søkefelt */}
        <div className="pt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk etter bedrift, kontaktperson, adresse, hovedadmin eller brukernavn..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>
      </div>

      {/* Bedriftsliste: strukturert tabell / kortvisning */}
      <div className="space-y-3">
        {filteredCompanies.map((comp) => {
          const adminUser = allUsers.find(u => u.uid === comp.hovedadminUid);
          const username = comp.hovedadminUsername || adminUser?.username || 'Ikke satt';

          return (
            <div
              key={comp.id}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                
                {/* 1. Bedriftsinformasjon (kolonne 1-4) */}
                <div className="md:col-span-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0 border border-indigo-100">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-base text-slate-900 leading-tight">{comp.name}</h2>
                      <p className="text-xs text-slate-500">
                        Sted: <strong className="text-slate-700 font-semibold">{comp.treatmentPlace || comp.name}</strong>
                        {comp.orgNumber ? ` · Org: ${comp.orgNumber}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 pl-11">
                    {comp.email && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{comp.email}</span>
                      </p>
                    )}
                    {comp.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{comp.phone}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Kontaktperson & Adresse (kolonne 5-7) */}
                <div className="md:col-span-3 space-y-2 text-xs border-t md:border-t-0 md:border-l border-slate-100 md:pl-4 pt-2 md:pt-0">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Kontaktperson
                    </span>
                    <p className="font-semibold text-slate-800">
                      {comp.contactPerson || comp.hovedadminName || 'Ikke oppgitt'}
                    </p>
                    {comp.contactPhone && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{comp.contactPhone}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Adresse
                    </span>
                    <p className="text-[11px] text-slate-700 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span>{comp.address || 'Ingen adresse registrert'}</span>
                    </p>
                  </div>
                </div>

                {/* 3. Hovedadmin & Brukernavn/Passordfelt (kolonne 8-10) */}
                <div className="md:col-span-3 space-y-2 text-xs border-t md:border-t-0 md:border-l border-slate-100 md:pl-4 pt-2 md:pt-0">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-indigo-500" />
                      Hovedadministrator
                    </span>
                    <p className="font-semibold text-slate-800">{comp.hovedadminName || 'Ikke tildelt'}</p>
                    {comp.hovedadminEmail && (
                      <p className="text-[11px] text-slate-500 truncate">{comp.hovedadminEmail}</p>
                    )}
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Brukernavn:</span>
                      <code className="font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {username}
                      </code>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        Passord:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {/* Maskert passordfelt – passordet vises aldri i klartekst */}
                        <input
                          type="password"
                          readOnly
                          value="••••••••"
                          className="w-16 text-center text-xs py-0.5 rounded bg-white border border-slate-300 text-slate-600 font-mono tracking-widest select-none cursor-default"
                          title="Passordet er skjult"
                        />
                        <button
                          type="button"
                          onClick={() => handleOpenPasswordModal(comp)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline px-1 py-0.5"
                          title="Sett nytt passord for hovedadmin"
                        >
                          Endre
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Status & Handlinger (kolonne 11-12) */}
                <div className="md:col-span-2 flex flex-row md:flex-col items-center md:items-end justify-between gap-2 border-t md:border-t-0 md:border-l border-slate-100 md:pl-4 pt-2 md:pt-0">
                  <button
                    onClick={() => handleToggleActive(comp)}
                    title={comp.isActive ? 'Sett inaktiv' : 'Aktiver bedrift'}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                      comp.isActive 
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {comp.isActive ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Aktiv</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>Inaktiv</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(comp)}
                      className="p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Rediger bedriftsopplysninger"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteCompany(comp)}
                      className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                      title="Slett bedrift"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {filteredCompanies.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">Ingen bedrifter funnet</p>
          <p className="text-xs text-slate-400">Prøv et annet søkeord eller opprett en ny bedrift.</p>
        </div>
      )}

      {/* MODAL: REGISTRER NY / REDIGER BEDRIFT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-5 sm:p-7 max-w-xl w-full border border-slate-200 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {editingCompany ? 'Rediger bedriftsinformasjon' : 'Registrer ny bedrift'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bedriftsdetaljer, kontaktperson, adresse og hovedadministrator
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCompany} className="space-y-4">
              
              {/* Seksjon 1: Bedriftsinformasjon */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                  1. Bedriftsinformasjon
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bedriftsnavn *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (!treatmentPlace) {
                          setTreatmentPlace(e.target.value.substring(0, 11));
                        }
                      }}
                      placeholder="f.eks. Hovden Terapi"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Behandlingssted (SMS-avsender) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={11}
                      value={treatmentPlace}
                      onChange={(e) => setTreatmentPlace(e.target.value)}
                      placeholder="Maks 11 tegn (f.eks. Hovden)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Org.nummer</label>
                    <input
                      type="text"
                      value={orgNumber}
                      onChange={(e) => setOrgNumber(e.target.value)}
                      placeholder="9 siffer"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">E-postadresse</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="post@bedrift.no"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="8 siffer"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Adresse</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Gateadresse, postnummer og sted"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Seksjon 2: Kontaktperson */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                  2. Kontaktperson for bedriften
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Navn</label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="f.eks. Kari Nordmann"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="Mobilnummer"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">E-post</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="kari@bedrift.no"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Seksjon 3: Hovedadministrator */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                  3. Hovedadministrator (Innlogging)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fullt navn *</label>
                    <input
                      type="text"
                      required
                      value={hovedadminName}
                      onChange={(e) => setHovedadminName(e.target.value)}
                      placeholder="f.eks. Dr. Kari Nordmann"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">E-postadresse *</label>
                    <input
                      type="email"
                      required
                      value={hovedadminEmail}
                      onChange={(e) => {
                        setHovedadminEmail(e.target.value);
                        if (!hovedadminUsername) {
                          setHovedadminUsername(e.target.value.split('@')[0]);
                        }
                      }}
                      placeholder="hovedadmin@bedrift.no"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Brukernavn *</label>
                    <input
                      type="text"
                      required
                      value={hovedadminUsername}
                      onChange={(e) => setHovedadminUsername(e.target.value)}
                      placeholder="f.eks. hovedadmin"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {editingCompany ? 'Nytt passord (la stå tomt for å beholde)' : 'Passord *'}
                    </label>
                    {/* Passordfelt er type="password" slik at passord ikke er synlig */}
                    <input
                      type="password"
                      required={!editingCompany}
                      value={hovedadminPassword}
                      onChange={(e) => setHovedadminPassword(e.target.value)}
                      placeholder={editingCompany ? '••••••••' : 'Passord'}
                      autoComplete="new-password"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Handlingsknapper */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving ? 'Lagrer...' : (editingCompany ? 'Lagre endringer' : 'Opprett bedrift')}
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: ENDRE PASSORD FOR HOVEDADMIN (MASKERT FELT) */}
      {passwordModalCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Endre passord for hovedadmin</h3>
                  <p className="text-[11px] text-slate-500">{passwordModalCompany.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalCompany(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {passwordModalError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passwordModalError}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Brukernavn
                </label>
                <input
                  type="text"
                  readOnly
                  value={passwordModalCompany.hovedadminUsername || 'hovedadmin'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 font-mono text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nytt passord *
                </label>
                {/* Ikke synlig passord: type="password" */}
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gjenta nytt passord *
                </label>
                {/* Ikke synlig passord: type="password" */}
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalCompany(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isSavingPassword ? 'Lagrer...' : 'Oppdater passord'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
