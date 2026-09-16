# DinTid - Sikkert Kundeoppfølgings- og Bookingsystem

**DinTid** er en komplett webapplikasjon og Progressive Web App (PWA) bygget for behandlere, terapeuter, veiledere og klinikker som krever timebestilling, sensitiv journalføring med revisjonsspor, rollebasert tilgangsstyring (RBAC), 2-faktor autentisering (2FA), GDPR-etterlevelse og SMS-varslinger via GatewayAPI.

---

## 🚀 Teknologistakk

- **Frontend & PWA**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, `vite-plugin-pwa`.
- **Backend & Database**: Firebase Authentication, Cloud Firestore, Firebase Hosting, Firestore Security Rules (`firestore.rules`).
- **Sikkerhet & Kryptering**: Web Crypto API (AES-256-GCM) klientside-kryptering for sensitive journalnotater og personopplysninger.
- **SMS & Møtelenker**: GatewayAPI.com REST API for automatisk SMS ved booking, 24t og 1t påminnelser, samt automatisk generering av sikre videomøterom (Jitsi / Meet).
- **Rollebasert Tilgangskontroll (RBAC)**: Strenge regler for Hovedadmin, Administrator (med støtte for feltmaskering/anonymisering av klienter) og Klienter (kundenummer fra 1000).

---

## 👥 Brukerroller & Tilgangsstyring

### 1. Hovedadmin (Dr. Kari Nordmann - `hovedadmin@dintid.no`)
- Full tilgang til alle klienter, timer, innstillinger og systemlogger.
- Opprette og administrere andre administratorer.
- Skru av/på hvilke opplysninger administratorer kan se (navn, telefon, e-post, journalinnsyn).
- Konfigurere arbeidstid, 45 min intervaller, 15 min pauser, ferier og timepriser.
- Konfigurere GatewayAPI nøkler, avsendernavn, påminnelsestidspunkter og meldingsmaler.
- Se uforanderlige systemlogger / revisjonsspor.

### 2. Administrator (f.eks. Jonas Berg / Eva Lund)
- Administrere timer og skrive/redigere journalnotater (når tillatt).
- **Feltmaskering**: Hvis hovedadmin ikke har gitt tilgang til navn, telefon eller e-post, maskeres disse automatisk (vises kun som f.eks. "Klient #1000" og skjulte kontaktfelt).

### 3. Klient (f.eks. Ola Hansen - Kundenummer starter på 1000)
- Eget kundenummer tildelt automatisk ved registrering (starter på 1000).
- Sikker innlogging med 2FA (tofaktorautentisering).
- Full oversikt over neste time, kommende avtaler og timehistorikk.
- Bestille enkelt-, dobbelt- eller trippeltimer (fysisk oppmøte eller online videomøte).
- Avbestille egne timer.
- GDPR Dataeksport (laste ned alle egne data som JSON) og sletting («retten til å bli glemt»).
- Kan **aldri** se andre klienters informasjon.

---

## 📅 Kalender & Timebestilling

- **Månedsvisning og ukevisning** med ren, fargekodet status:
  - 🟢 **Grønn** = Ledig for bestilling
  - 🔴 **Rød** = Fullt opptatt
- Klikk på en dag viser liste over alle 45-minutters tidsluker og status.
- Automatisk pausehåndtering (standard 15 min pause mellom timer, lunsjpause).
- Støtte for:
  - Enkelttime (45 min)
  - Dobbelttime (90 min)
  - Trippeltime (135 min)
- Fysisk møte eller online møte (genererer videomøterom og inkluderer lenke i SMS).

---

## 📝 Journalføring med Ugjendrivelig Revisjonsspor

- Hvert journalnotat lagres med klientside AES-256-GCM kryptering.
- Automatisk registrering av:
  - Opprettet dato og klokkeslett
  - Forfatter og rolle
  - Sist endret dato og klokkeslett
  - Sist endret av
- **Revisjonsspor**: All historikk over endringer i notatene bevares slik at endringer kan spores bakover i tid.

---

## 📱 GatewayAPI SMS-integrasjon

- SMS sendes automatisk ved ny bestilling (med dato, klokkeslett, varighet, pris og avbestillingslenke).
- Påminnelse 1 (standard 24 timer før).
- Påminnelse 2 (standard 1 time før).
- Hovedadmin kan endre tidspunkter, slå av/på varsler og redigere meldingsmaler.
- Innebygd SMS-simulator og testverktøy for rask verifisering.

---

## 🛠️ Installasjon og Oppstart

1. Installer avhengigheter:
   ```bash
   npm install
   ```

2. Start lokal utviklingsserver:
   ```bash
   npm run dev
   ```

3. Bygg for produksjon:
   ```bash
   npm run build
   ```

4. Forbinde til ekte Firebase (valgfritt):
   Kopier `.env.example` til `.env` og fyll inn dine Firebase API-nøkler og GatewayAPI-token.
   Hvis nøkler ikke er oppgitt, kjører appen automatisk i fullverdig lokal demomodus med ferdige testbrukere og simulert SMS.
