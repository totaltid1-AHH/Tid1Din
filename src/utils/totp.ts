/**
 * TOTP (Time-based One-Time Password) implementasjon basert på RFC 6238 og RFC 4226.
 * Kompatibel med Google Authenticator, Microsoft Authenticator, Authy, etc.
 * Benytter Web Crypto API (SubtleCrypto) for HMAC-SHA1.
 */

// Base32 alfabet (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Konverterer en Base32-streng til en Uint8Array
 */
export function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
  const bits: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) {
      throw new Error(`Ugyldig Base32-tegn: "${clean[i]}"`);
    }
    for (let b = 4; b >= 0; b--) {
      bits.push((val >> b) & 1);
    }
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i + b];
    }
    bytes.push(byte);
  }

  return new Uint8Array(bytes);
}

/**
 * Konverterer en Uint8Array til en Base32-streng
 */
export function bytesToBase32(bytes: Uint8Array): string {
  let bits = '';
  for (let i = 0; i < bytes.length; i++) {
    bits += bytes[i].toString(2).padStart(8, '0');
  }

  let base32 = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5).padEnd(5, '0');
    base32 += BASE32_ALPHABET[parseInt(chunk, 2)];
  }

  return base32;
}

/**
 * Genererer en tilfeldig 16-tegns (80-bit) eller 32-tegns Base32 hemmelig nøkkel for TOTP
 */
export function generateTotpSecret(length: number = 16): string {
  const byteCount = Math.ceil((length * 5) / 8);
  const randomBytes = new Uint8Array(byteCount);
  window.crypto.getRandomValues(randomBytes);
  return bytesToBase32(randomBytes).substring(0, length);
}

/**
 * Lager en otpauth:// URI for Google Authenticator QR-kode
 */
export function generateTotpUri(issuer: string, accountName: string, secret: string): string {
  const cleanIssuer = encodeURIComponent(issuer.trim());
  const cleanAccount = encodeURIComponent(accountName.trim());
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  return `otpauth://totp/${cleanIssuer}:${cleanAccount}?secret=${cleanSecret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Beregner en 6-sifret TOTP-kode for en gitt nøkkel og et tidsstempel (RFC 6238)
 */
export async function generateTotpCode(secret: string, timestampMs: number = Date.now()): Promise<string> {
  const keyBytes = base32ToBytes(secret);
  const keyBuffer = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;
  const timeStep = Math.floor(timestampMs / 1000 / 30);

  // 8-byte big-endian tids-teller
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(0, Math.floor(timeStep / 0x100000000));
  counterView.setUint32(4, timeStep >>> 0);

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(signature);

  // Dynamisk trunkering (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifiserer om en oppgitt 6-sifret kode stemmer overens med hemmelig nøkkel.
 * windowSteps = antall 30-sekunders intervaller bakover/forover for å tolerere litt tidsavvik (default 1 = +/- 30 sek).
 */
export async function verifyTotpCode(
  inputCode: string,
  secret: string,
  windowSteps: number = 1
): Promise<boolean> {
  const cleanCode = inputCode.trim();
  if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
    return false;
  }

  if (!secret) return false;

  const now = Date.now();
  const stepMs = 30 * 1000;

  for (let i = -windowSteps; i <= windowSteps; i++) {
    try {
      const expectedCode = await generateTotpCode(secret, now + i * stepMs);
      if (cleanCode === expectedCode) {
        return true;
      }
    } catch (e) {
      console.error('Feil ved generering av TOTP-kode:', e);
      return false;
    }
  }

  return false;
}
