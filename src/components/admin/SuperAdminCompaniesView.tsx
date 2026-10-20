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
  ExternalLink, 
  Edit3, 
  Trash2, 
  Users, 
  Calendar, 
  ArrowRight, 
  Mail, 
  Phone, 
  MapPin, 
  Sparkles, 
  AlertCircle,
  X,
  Check
} from 'lucide-react';

interface SuperAdminCompaniesViewProps {
  onSelectCompanyAndNavigate?: (companyId: string, targetTab: string) => void;
}

export const SuperAdminCompaniesView: React.FC<SuperAdminCompaniesViewProps> = ({ 
  onSelectCompanyAndNavigate 
}) => {
  const { currentUser, activeCompany, switchCompany, refreshCompanies } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal for ny / rediger bedrift
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [treatmentPlace, setTreatmentPlace] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  // Hovedadmin form
  const [hovedadminMode, setHovedadminMode] = useState<'new' | 'existing'>('new');
  const [hovedadminName, setHovedadminName] = useState('');
  const [hovedadminEmail, setHovedadminEmail] = useState('');
  const [hovedadminPhone, setHovedadminPhone] = useState('');
  const [hovedadminUsername, setHovedadminUsername] = useState('');
  const [hovedadminPassword, setHovedadminPassword] = useState('demo1234');
  const [selectedExistingAdminUid, setSelectedExistingAdminUid] = useState('');

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
      console.error('Feil ved lasting av bedriftsdata:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingCompany(null);
    setName('');
    setTreatmentPlace('');
    setOrgNumber('');
    setEmail('');
    setPhone('');
    setAddress('');
    setHovedadminMode('new');
    setHovedadminName('');
    setHovedadminEmail('');
    setHovedadminPhone('');
    setHovedadminUsername('');
    setHovedadminPassword('demo1234');
    setSelectedExistingAdminUid('');
    setFormError('');
    setFormSuccess('');
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
    setHovedadminMode('existing');
    setSelectedExistingAdminUid(comp.hovedadminUid || '');
    setHovedadminName(comp.hovedadminName || '');
    setHovedadminEmail(comp.hovedadminEmail || '');
    setFormError('');
    setFormSuccess('');
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
      let adminName = editingCompany?.hovedadminName;
      let adminEmail = editingCompany?.hovedadminEmail;

      if (!editingCompany && hovedadminMode === 'new') {
        if (!hovedadminName.trim() || !hovedadminEmail.trim()) {
          setFormError('Hovedadmin sitt navn og e-post er påkrevd.');
          setIsSaving(false);
          return;
        }

        const newAdminUid = 'u_admin_' + Date.now();
        const newAdmin: UserProfile = {
          uid: newAdminUid,
          companyId,
          role: 'hovedadmin',
          displayName: hovedadminName.trim(),
          email: hovedadminEmail.trim(),
          username: hovedadminUsername.trim() || hovedadminEmail.trim().split('@')[0],
          password: hovedadminPassword.trim() || 'demo1234',
          phone: hovedadminPhone.trim(),
          twoFactorEnabled: false,
          isActive: true,
          createdAt: new Date().toISOString()
        };

        await dbService.saveUser(newAdmin);
        adminUid = newAdminUid;
        adminName = newAdmin.displayName;
        adminEmail = newAdmin.email;
      } else if (selectedExistingAdminUid) {
        const foundAdmin = allUsers.find(u => u.uid === selectedExistingAdminUid);
        if (foundAdmin) {
          foundAdmin.companyId = companyId;
          foundAdmin.role = 'hovedadmin';
          await dbService.saveUser(foundAdmin);
          adminUid = foundAdmin.uid;
          adminName = foundAdmin.displayName;
          adminEmail = foundAdmin.email;
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
        hovedadminUid: adminUid,
        hovedadminName: adminName,
        hovedadminEmail: adminEmail,
        isActive: editingCompany ? editingCompany.isActive : true,
        createdAt: editingCompany ? editingCompany.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await dbService.saveCompany(companyData);

      if (currentUser) {
        await dbService.logAction(
          { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
          editingCompany ? 'update_company' : 'create_company',
          `${editingCompany ? 'Oppdaterte' : 'Opprettet'} bedrift: ${companyData.name} (${companyData.treatmentPlace})`
        );
      }

      await refreshCompanies();
      await loadData();
      setIsModalOpen(false);
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
  };

  const handleDeleteCompany = async (comp: Company) => {
    if (companies.length <= 1) {
      alert('Du kan ikke slette den eneste bedriften i systemet.');
      return;
    }
    const confirmDelete = window.confirm(
      `Er du sikker på at du vil slette bedriften "${comp.name}"?\nAlle tilknyttede kalenderoppføringer og data vil ikke lenger være tilgjengelige.`
    );
    if (!confirmDelete) return;

    await dbService.deleteCompany(comp.id);
    if (activeCompany?.id === comp.id) {
      const remaining = companies.filter(c => c.id !== comp.id);
      if (remaining.length > 0) {
        await switchCompany(remaining[0].id);
      }
    }
    await refreshCompanies();
    await loadData();
  };

  const handleEnterCompany = async (comp: Company) => {
    await switchCompany(comp.id);
    if (onSelectCompanyAndNavigate) {
      onSelectCompanyAndNavigate(comp.id, 'dashboard');
    }
  };

  const filteredCompanies = companies.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.treatmentPlace && c.treatmentPlace.toLowerCase().includes(q)) ||
      (c.hovedadminName && c.hovedadminName.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const totalTherapists = allUsers.filter(u => u.role === 'admin' || u.role === 'hovedadmin').length;
  const totalClients = allUsers.filter(u => u.role === 'client').length;
  const activeCount = companies.filter(c => c.isActive).length;

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      
      {/* Toppseksjon med statistikk */}
      <div className="bg-white rounded-none sm:rounded-2xl p-4 sm:p-6 border-y sm:border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Super-admin plattform
              </span>
              <span className="text-xs text-slate-400 font-mono">Flerbedriftsstyring</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-600" />
              Bedrifter & Behandlingssteder
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Administrer alle klinikker og bedrifter på plattformen. Opprett nye firmaer, tildel hovedadministratorer og gå inn i klinikker.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-center"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Ny bedrift</span>
          </button>
        </div>

        {/* Nøkkeltall kort */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bedrifter totalt</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{companies.length}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Aktive klinikker</p>
            <p className="text-2xl font-black text-emerald-800 mt-1">{activeCount}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200">
            <p className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">Terapeuter totalt</p>
            <p className="text-2xl font-black text-sky-800 mt-1">{totalTherapists}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200">
            <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Klienter totalt</p>
            <p className="text-2xl font-black text-purple-800 mt-1">{totalClients}</p>
          </div>
        </div>

        {/* Søk og filter */}
        <div className="pt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk i bedrifter etter navn, behandlingssted, e-post eller hovedadmin..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {/* Bedriftsliste */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 px-2 sm:px-0">
        {filteredCompanies.map((comp) => {
          const isActiveComp = activeCompany?.id === comp.id;
          const compTherapists = allUsers.filter(u => u.companyId === comp.id && (u.role === 'admin' || u.role === 'hovedadmin'));
          const compClients = allUsers.filter(u => u.companyId === comp.id && u.role === 'client');

          return (
            <div 
              key={comp.id}
              className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-xs flex flex-col justify-between ${
                isActiveComp 
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                
                {/* Topplinje for kort */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base border border-indigo-100 flex-shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-base text-slate-900">{comp.name}</h2>
                        {isActiveComp && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Aktiv i appen nå
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <span>Behandlingssted (SMS):</span>
                        <strong className="text-slate-700 font-semibold">{comp.treatmentPlace || comp.name}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <button
                    onClick={() => handleToggleActive(comp)}
                    title={comp.isActive ? 'Klikk for å sette inaktiv' : 'Klikk for å aktivere'}
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
                </div>

                {/* Hovedadmin informasjon */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3 h-3 text-indigo-500" />
                      Hovedadministrator
                    </span>
                    <span className="font-bold text-slate-800">{comp.hovedadminName || 'Ikke tildelt'}</span>
                  </div>
                  {comp.hovedadminEmail && (
                    <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>{comp.hovedadminEmail}</span>
                    </div>
                  )}
                </div>

                {/* Terapeuter & Klienter info */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50/80 border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Terapeuter:</span>
                    <strong className="font-bold text-slate-800">{compTherapists.length}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50/80 border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Klienter:</span>
                    <strong className="font-bold text-slate-800">{compClients.length}</strong>
                  </div>
                </div>

                {/* Kontakt- og adresseinfo */}
                {(comp.address || comp.phone || comp.email) && (
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                    {comp.address && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{comp.address}</span>
                      </p>
                    )}
                    {comp.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{comp.phone}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Handlingsknapper nederst på kortet */}
              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEditModal(comp)}
                    className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="Rediger bedrift"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteCompany(comp)}
                    className="p-2 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                    title="Slett bedrift"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => handleEnterCompany(comp)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActiveComp
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200'
                  }`}
                >
                  <span>{isActiveComp ? 'Gå til klinikk' : 'Gå inn i bedrift'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
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

      {/* MODAL: OPPRETT / REDIGER BEDRIFT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-5 sm:p-7 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {editingCompany ? 'Rediger bedrift' : 'Opprett ny bedrift & Hovedadmin'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingCompany ? 'Oppdater klinikkens opplysninger' : 'Oppretter bedrift og oppretter tilhørende hovedadministrator'}
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
              
              {/* Bedriftsopplysninger */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  1. Bedriftsinformasjon
                </span>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bedriftsnavn / Klinikk *</label>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Vises som klinikknavn i SMS-varsler</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Org.nummer</label>
                    <input
                      type="text"
                      value={orgNumber}
                      onChange={(e) => setOrgNumber(e.target.value)}
                      placeholder="9 siffer"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">E-postadresse</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="kontakt@klinikk.no"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="8 siffer"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Adresse</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Gateadresse, Postnr og Sted"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Hovedadmin opplysninger */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  2. Hovedadministrator for bedriften
                </span>

                {!editingCompany && (
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <button
                      type="button"
                      onClick={() => setHovedadminMode('new')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                        hovedadminMode === 'new' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      + Opprett ny hovedadmin
                    </button>
                    <button
                      type="button"
                      onClick={() => setHovedadminMode('existing')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                        hovedadminMode === 'existing' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Velg eksisterende bruker
                    </button>
                  </div>
                )}

                {hovedadminMode === 'new' && !editingCompany ? (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Fullt navn *</label>
                        <input
                          type="text"
                          required
                          value={hovedadminName}
                          onChange={(e) => setHovedadminName(e.target.value)}
                          placeholder="f.eks. Ola Nordmann"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">E-post / Brukernavn *</label>
                        <input
                          type="email"
                          required
                          value={hovedadminEmail}
                          onChange={(e) => setHovedadminEmail(e.target.value)}
                          placeholder="ola@klinikk.no"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Telefon</label>
                        <input
                          type="tel"
                          value={hovedadminPhone}
                          onChange={(e) => setHovedadminPhone(e.target.value)}
                          placeholder="91234567"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Startpassord</label>
                        <input
                          type="text"
                          value={hovedadminPassword}
                          onChange={(e) => setHovedadminPassword(e.target.value)}
                          placeholder="demo1234"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Velg bruker som tildeles hovedadmin:</label>
                    <select
                      value={selectedExistingAdminUid}
                      onChange={(e) => setSelectedExistingAdminUid(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
                    >
                      <option value="">-- Ingen valgt --</option>
                      {allUsers
                        .filter(u => u.role !== 'superadmin')
                        .map(u => (
                          <option key={u.uid} value={u.uid}>
                            {u.displayName} ({u.email}) – Rolle: {u.role}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
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

    </div>
  );
};
