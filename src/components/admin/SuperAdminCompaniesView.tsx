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
  Trash2, 
  Mail, 
  Phone, 
  MapPin, 
  Sparkles, 
  AlertCircle,
  ArrowLeft,
  Check,
  Lock,
  ChevronRight,
  Save
} from 'lucide-react';

export const SuperAdminCompaniesView: React.FC = () => {
  const { currentUser, refreshCompanies } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Visningsmodus: 'list' (enkle linjer) eller 'details' (side med all informasjon)
  const [viewMode, setViewMode] = useState<'list' | 'details'>('list');
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Skjemafelter for bedrift
  const [name, setName] = useState('');
  const [treatmentPlace, setTreatmentPlace] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);

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

  // Åpne helside for opprettelse av ny bedrift
  const handleOpenCreate = () => {
    setEditingCompany(null);
    setIsCreatingNew(true);
    setName('');
    setTreatmentPlace('');
    setOrgNumber('');
    setEmail('');
    setPhone('');
    setAddress('');
    setIsActive(true);
    setContactPerson('');
    setContactPhone('');
    setContactEmail('');
    setHovedadminName('');
    setHovedadminEmail('');
    setHovedadminPhone('');
    setHovedadminUsername('');
    setHovedadminPassword('');
    setFormError('');
    setViewMode('details');
  };

  // Åpne helside for eksisterende bedrift
  const handleOpenDetails = (comp: Company) => {
    setEditingCompany(comp);
    setIsCreatingNew(false);
    setName(comp.name);
    setTreatmentPlace(comp.treatmentPlace || comp.name);
    setOrgNumber(comp.orgNumber || '');
    setEmail(comp.email || '');
    setPhone(comp.phone || '');
    setAddress(comp.address || '');
    setIsActive(comp.isActive);

    setContactPerson(comp.contactPerson || '');
    setContactPhone(comp.contactPhone || '');
    setContactEmail(comp.contactEmail || '');

    const adminUser = allUsers.find(u => u.uid === comp.hovedadminUid);
    setHovedadminName(comp.hovedadminName || adminUser?.displayName || '');
    setHovedadminEmail(comp.hovedadminEmail || adminUser?.email || '');
    setHovedadminPhone(adminUser?.phone || '');
    setHovedadminUsername(comp.hovedadminUsername || adminUser?.username || '');
    setHovedadminPassword(''); // Skjult passord: kun utfylt dersom man ønsker å endre det
    setFormError('');
    setViewMode('details');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setEditingCompany(null);
    setIsCreatingNew(false);
    setFormError('');
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

      if (!adminUid) {
        adminUid = 'u_admin_' + companyId.replace('comp_', '');
      }

      // Opprett eller oppdater hovedadmin-brukeren
      const existingUser = allUsers.find(u => u.uid === adminUid);
      const userProfile: UserProfile = {
        uid: adminUid,
        email: adminEmail || `${adminUsername}@${companyId}.tid1din.no`,
        username: adminUsername,
        displayName: adminName,
        role: 'hovedadmin',
        companyId: companyId,
        phone: hovedadminPhone.trim() || phone.trim(),
        twoFactorEnabled: existingUser?.twoFactorEnabled || false,
        isActive: isActive,
        createdAt: existingUser?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissions: {
          canViewClientName: true,
          canViewClientPhone: true,
          canViewClientEmail: true,
          canEditJournals: true,
          canManageAppointments: true
        }
      };

      // Kun oppdater passord hvis det er oppgitt
      if (hovedadminPassword.trim()) {
        userProfile.password = hovedadminPassword.trim();
      } else if (existingUser?.password) {
        userProfile.password = existingUser.password;
      } else {
        userProfile.password = 'passord123';
      }

      await dbService.saveUser(userProfile);

      // Opprett / oppdater Company
      const companyData: Company = {
        id: companyId,
        name: name.trim(),
        treatmentPlace: cleanTreatmentPlace,
        orgNumber: orgNumber.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        hovedadminUid: adminUid,
        hovedadminName: adminName,
        hovedadminEmail: adminEmail || userProfile.email,
        hovedadminUsername: adminUsername,
        isActive: isActive,
        createdAt: editingCompany?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await dbService.saveCompany(companyData);

      // Synkroniser bedriftens SMS-avsendernavn og behandlingssted til bedriftens SMS-innstillinger
      const compSms = await dbService.getSmsSettings(companyId);
      compSms.sender = cleanTreatmentPlace;
      compSms.treatmentPlace = cleanTreatmentPlace;
      await dbService.saveSmsSettings(compSms, companyId);

      if (currentUser) {
        await dbService.logAction(
          { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
          editingCompany ? 'update_company' : 'create_company',
          `${editingCompany ? 'Oppdaterte' : 'Opprettet'} bedriften ${companyData.name}`
        );
      }

      await refreshCompanies();
      await loadData();
      showToast(`Bedriftsinformasjon for ${companyData.name} er lagret!`);
      setViewMode('list');
    } catch (err: any) {
      setFormError(err.message || 'Kunne ikke lagre bedrift.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!editingCompany) return;
    if (editingCompany.id === 'comp_hovden') {
      alert('Standardbedriften (Hovden) kan ikke slettes.');
      return;
    }

    if (!window.confirm(`Er du sikker på at du vil slette ${editingCompany.name}?\n\nDette kan ikke angres.`)) {
      return;
    }

    try {
      await dbService.deleteCompany(editingCompany.id);

      if (currentUser) {
        await dbService.logAction(
          { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
          'delete_company',
          `Slettet bedriften ${editingCompany.name}`
        );
      }

      await refreshCompanies();
      await loadData();
      showToast(`Bedriften ${editingCompany.name} ble slettet.`);
      setViewMode('list');
    } catch (err: any) {
      alert('Kunne ikke slette bedrift: ' + err.message);
    }
  };

  const filteredCompanies = companies.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.contactPhone && c.contactPhone.toLowerCase().includes(q)) ||
      (c.treatmentPlace && c.treatmentPlace.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      
      {/* Toast bekreftelse */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <Check className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VISNING 1: ENKEL LISTEOVERSIKT OVER BEDRIFTENE (NAVN & TLF NR) */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          
          {/* Toppseksjon med tittel, registrering og søkefelt */}
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-sky-600" />
                  <span>Bedrifter</span>
                  <span className="text-xs font-normal text-slate-400">({companies.length})</span>
                </h1>
              </div>

              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-center"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ny bedrift</span>
              </button>
            </div>

            {/* Søkefelt */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Søk etter bedrift eller telefon..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200/80 text-xs sm:text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none bg-slate-50/50"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* Enkel linjeliste: kun Navn og Tlf nr for hver bedrift */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {filteredCompanies.length === 0 ? (
              <div className="text-center py-12 p-6 space-y-2">
                <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Ingen bedrifter funnet</p>
                <p className="text-xs text-slate-400">Prøv et annet søk eller registrer en ny bedrift.</p>
              </div>
            ) : (
              filteredCompanies.map((comp) => {
                const displayPhone = comp.phone || comp.contactPhone || 'Ikke oppgitt tlf';

                return (
                  <div
                    key={comp.id}
                    onClick={() => handleOpenDetails(comp)}
                    className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    {/* Bedriftsnavn */}
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            {comp.name}
                          </span>
                          {comp.treatmentPlace && comp.treatmentPlace !== comp.name && (
                            <span className="text-[11px] text-slate-400 hidden sm:inline truncate">
                              ({comp.treatmentPlace})
                            </span>
                          )}
                          {!comp.isActive && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-500">
                              Inaktiv
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Telefonnummer og pil */}
                    <div className="flex items-center gap-3 text-xs flex-shrink-0">
                      <span className="text-slate-600 font-mono flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{displayPhone}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VISNING 2: DEDIKERT SIDE MED ALL INFORMASJON SOM SKAL LEGGES   */}
      {/* INN ELLER ENDRES FOR BEDRIFTEN                                 */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'details' && (
        <div className="space-y-4">
          
          {/* Topplinje med tilbakeknapp og tittel */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBackToList}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
                title="Tilbake til bedriftsoversikt"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    {isCreatingNew ? 'Ny registrering' : 'Redigerer bedrift'}
                  </span>
                  {editingCompany && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {isCreatingNew ? 'Registrer ny bedrift' : name || 'Bedriftsinformasjon'}
                </h1>
              </div>
            </div>

            {/* Handlinger i topplinjen */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              {editingCompany && (
                <button
                  type="button"
                  onClick={handleDeleteCompany}
                  className="p-2.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                  title="Slett bedrift"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleBackToList}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Avbryt
              </button>

              <button
                type="button"
                onClick={handleSaveCompany}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Lagrer...' : 'Lagre endringer'}</span>
              </button>
            </div>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSaveCompany} className="space-y-4">
            
            {/* SEKSJON 1: BEDRIFTSINFORMASJON */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    1. Bedriftsinformasjon
                  </h2>
                </div>

                {/* Aktiv / Inaktiv bryter */}
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Aktiv bedrift</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Bedriftsnavn *
                  </label>
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
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Behandlingssted (SMS-avsender) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={treatmentPlace}
                    onChange={(e) => setTreatmentPlace(e.target.value)}
                    placeholder="Maks 11 tegn (f.eks. Hovden)"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Maks 11 tegn. Vises som avsender i SMS til bedriftens klienter.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Organisasjonsnummer
                  </label>
                  <input
                    type="text"
                    value={orgNumber}
                    onChange={(e) => setOrgNumber(e.target.value)}
                    placeholder="9 siffer"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Bedriftens E-post
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="post@bedrift.no"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Bedriftens Telefonnummer
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="f.eks. 91234567"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* SEKSJON 2: ADRESSE */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <MapPin className="w-4 h-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  2. Besøks- og postadresse
                </h2>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Adresse (gateadresse, postnummer og sted)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="f.eks. Storgata 1, 0182 Oslo"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* SEKSJON 3: KONTAKTPERSON */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  3. Kontaktperson for bedriften
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Navn på kontaktperson
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="f.eks. Kari Nordmann"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Telefonnummer
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Mobilnummer"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    E-postadresse
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="kontakt@bedrift.no"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* SEKSJON 4: HOVEDADMINISTRATOR & BRUKERNAVN / PASSORD */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    4. Hovedadministrator (Innlogging for bedriften)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Hovedadmin styrer klinikkens terapeuter, kalendere og klienter.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Fullt navn *
                  </label>
                  <input
                    type="text"
                    required
                    value={hovedadminName}
                    onChange={(e) => setHovedadminName(e.target.value)}
                    placeholder="f.eks. Dr. Kari Nordmann"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Innloggings-epost *
                  </label>
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Brukernavn *
                  </label>
                  <input
                    type="text"
                    required
                    value={hovedadminUsername}
                    onChange={(e) => setHovedadminUsername(e.target.value)}
                    placeholder="f.eks. hovedadmin"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      {isCreatingNew ? 'Passord *' : 'Endre passord'}
                    </span>
                    {!isCreatingNew && (
                      <span className="text-[10px] text-slate-400 font-normal lowercase">
                        (la stå tomt for å beholde)
                      </span>
                    )}
                  </label>
                  {/* Passordfelt er maskert (type="password") slik at det aldri er synlig */}
                  <input
                    type="password"
                    required={isCreatingNew}
                    value={hovedadminPassword}
                    onChange={(e) => setHovedadminPassword(e.target.value)}
                    placeholder={isCreatingNew ? 'Skriv inn passord' : '••••••••'}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Handlingsknapper i bunn av siden */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={handleBackToList}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Avbryt
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Lagrer...' : 'Lagre endringer'}</span>
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
};

export default SuperAdminCompaniesView;
