/**
 * Sikker klientside-kryptering med Web Crypto API (AES-256-GCM)
 * Brukes for kryptert lagring av sensitive pasient- og journalopplysninger.
 */

const DEFAULT_SALT = new TextEncoder().encode('DinTid_Secure_Salt_2026_GDPR');
const SYSTEM_STORAGE_KEY = 'dintid_secure_master_key_v1';

// Hent eller generer en unik klinikk-krypteringsnøkkel
export function getClinicEncryptionKey(): string {
  let key = localStorage.getItem(SYSTEM_STORAGE_KEY);
  if (!key) {
    key = 'DinTid-Clinic-Encrypted-Key-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(SYSTEM_STORAGE_KEY, key);
  }
  return key;
}

async function getKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
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
 * Krypterer en streng ved hjelp av AES-256-GCM
 */
export async function encryptData(plainText: string, customKey?: string): Promise<string> {
  if (!plainText) return '';
  try {
    const key = await getKey(customKey || getClinicEncryptionKey());
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);

    const ciphertext = await window.crypto.subtle.encrypt(
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
    return plainText; // Fallback i tilfelle feil
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
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.warn('Dekrypteringsfeil (kan skyldes annen nøkkel):', error);
    return '[Kryptert innhold - Nøkkel kreves]';
  }
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
    if (value.length < 4) return '***';
    return `${value.slice(0, 2)} ** ***`;
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
