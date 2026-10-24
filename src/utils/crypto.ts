/**
 * Sikker klientside-kryptering og hashing med Web Crypto API (AES-256-GCM og PBKDF2)
 * Brukes for kryptert lagring av sensitive pasient- og journalopplysninger (GDPR / Helsepersonelloven)
 * samt sikker hashing av passord.
 */

const DEFAULT_SALT = new TextEncoder().encode('DinTid_Secure_Salt_2026_GDPR');

const getCrypto = (): Crypto => (typeof window !== 'undefined' && window.crypto ? window.crypto : (globalThis as any).crypto);

// Hjelpefunksjon: Konverter Uint8Array til Hex-streng
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Hjelpefunksjon: Konverter Hex-streng til Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Hent en deterministisk klinikk-krypteringsnøkkel basert på bedrift/klinikk.
 * Dette sikrer at autoriserte behandlere i samme klinikk kan dekryptere journalnotater
 * på tvers av enheter (PC, iPad, mobil), samtidig som sletting av nettleser-cache
 * IKKE fører til permanent tap av pasientjournaler.
 */
export function getClinicEncryptionKey(companyId?: string): string {
  let targetCompany = companyId;
  if (!targetCompany && typeof window !== 'undefined') {
    try {
      targetCompany = localStorage.getItem('dintid_active_company_id') || undefined;
    } catch {
      // Ignorer feil
    }
  }
  const cleanComp = targetCompany || 'comp_hovden';
  return `DinTid-Clinic-Vault-v2-${cleanComp}`;
}

async function getKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await getCrypto().subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await getCrypto().subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: DEFAULT_SALT,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Krypterer en streng ved hjelp av AES-256-GCM.
 * Feiler strengt hvis kryptering ikke lykkes for å forhindre datalekkasje av råtekst til databasen.
 */
export async function encryptData(plainText: string, customKey?: string): Promise<string> {
  if (!plainText) return '';
  try {
    const key = await getKey(customKey || getClinicEncryptionKey());
    const iv = getCrypto().getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);

    const ciphertext = await getCrypto().subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encoded
    );

    // Pakk IV og chiffertekst sammen i Base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    let binary = '';
    const bytes = new Uint8Array(combined);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `ENC:${btoa(binary)}`;
  } catch (error) {
    console.error('Krypteringsfeil:', error);
    throw new Error('Kryptering feilet: Sensitive pasientopplysninger kan ikke lagres ukryptert.');
  }
}

/**
 * Dekrypterer en AES-256-GCM kryptert streng
 */
export async function decryptData(cipherText: string, customKey?: string): Promise<string> {
  if (!cipherText || !cipherText.startsWith('ENC:')) {
    return cipherText; // Teksten var ikke kryptert eller tom
  }
  try {
    const base64Data = cipherText.replace('ENC:', '');
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);

    const key = await getKey(customKey || getClinicEncryptionKey());
    const decrypted = await getCrypto().subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.warn('Dekrypteringsfeil (kan skyldes annen nøkkel eller endret klinikk):', error);
    return '[Kryptert innhold - Nøkkel kreves]';
  }
}

/**
 * Sikker hashing av passord med PBKDF2 (SHA-256) og unik kryptografisk salt per bruker.
 */
export async function hashPassword(plainPassword: string, existingSaltHex?: string): Promise<string> {
  if (!plainPassword) return '';
  const salt = existingSaltHex
    ? hexToUint8Array(existingSaltHex)
    : getCrypto().getRandomValues(new Uint8Array(16));

  const enc = new TextEncoder();
  const keyMaterial = await getCrypto().subtle.importKey(
    'raw',
    enc.encode(plainPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await getCrypto().subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const saltHex = uint8ArrayToHex(salt);
  const hashHex = uint8ArrayToHex(new Uint8Array(derivedBits));
  return `PBKDF2:${saltHex}:${hashHex}`;
}

/**
 * Verifiserer et oppgitt passord mot en lagret hash (eller eksisterende demo-klartekst).
 */
export async function verifyPassword(plainPassword: string, storedHashOrPlain: string): Promise<boolean> {
  if (!plainPassword || !storedHashOrPlain) return false;

  // Støtt eldre demo-passord (f.eks. 'demo1234') for sømløs overgang til hash
  if (!storedHashOrPlain.startsWith('PBKDF2:')) {
    return plainPassword === storedHashOrPlain;
  }

  const parts = storedHashOrPlain.split(':');
  if (parts.length !== 3) return false;

  const saltHex = parts[1];
  const computedHash = await hashPassword(plainPassword, saltHex);
  return computedHash === storedHashOrPlain;
}

/**
 * Hjelpefunksjon for å maskere personopplysninger for uautoriserte administratorer
 */
export function maskPersonalInfo(value: string | undefined, type: 'name' | 'phone' | 'email'): string {
  if (!value) return 'Ikke oppgitt';
  
  if (type === 'name') {
    return 'Klient';
  }
  
  if (type === 'phone') {
    const clean = value.replace(/\s+/g, '');
    if (clean.length < 4) return '***';
    return `${clean.slice(0, 2)} ** ***`;
  }
  
  if (type === 'email') {
    const parts = value.split('@');
    if (parts.length === 2) {
      return `***@${parts[1]}`;
    }
    return '***@skjult.no';
  }
  
  return '***';
}
