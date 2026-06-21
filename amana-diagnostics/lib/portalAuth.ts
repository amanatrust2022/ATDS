import crypto from 'crypto';
import { getDb } from './localDb';

let cachedSecret: string | null = null;

/**
 * Gets the secret key used for signing JWTs and OTP signatures.
 * In cloud mode, reads from process.env.JWT_SECRET.
 * In local mode, retrieves from the sync_metadata table (or auto-generates and persists it if missing).
 */
export function getJwtSecret(): string {
  if (cachedSecret) return cachedSecret;

  const isLocalMode =
    process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true' ||
    process.env.IS_LOCAL_HUB === 'true';

  if (!isLocalMode) {
    cachedSecret = process.env.JWT_SECRET || 'amana-cloud-portal-default-secret-key-32chars';
    return cachedSecret;
  }

  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM sync_metadata WHERE key = 'jwt_secret'").get() as { value: string } | undefined;
    if (row && row.value) {
      cachedSecret = row.value;
      return cachedSecret;
    }

    // Secret doesn't exist, generate a secure random 256-bit one (64 hex chars)
    const newSecret = crypto.randomBytes(32).toString('hex');
    db.prepare(`
      INSERT INTO sync_metadata (key, value) 
      VALUES ('jwt_secret', ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(newSecret);

    cachedSecret = newSecret;
    return cachedSecret;
  } catch (err) {
    console.error('Failed to retrieve or generate JWT secret in SQLite, falling back:', err);
    return process.env.JWT_SECRET || 'amana-diagnostics-local-fallback-secret-2026';
  }
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Signs a payload to generate a standard HMAC SHA-256 JWT.
 */
export function signToken(payload: Record<string, any>): string {
  const secret = getJwtSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64url');
    
  return `${signatureInput}.${signature}`;
}

/**
 * Verifies a JWT signature and checks expiration.
 */
export function verifyToken(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, signature] = parts;
    const secret = getJwtSecret();
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signatureInput)
      .digest('base64url');
      
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    
    // Check expiration (exp is in milliseconds, matching Date.now())
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates a stateless, cryptographically signed token representing an OTP challenge.
 * Returns the base64-encoded string containing email, expiration timestamp, and signature hash.
 */
export function signOtp(email: string, otp: string, expires: number): string {
  const secret = getJwtSecret();
  const normalizedEmail = email.trim().toLowerCase();
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(`${normalizedEmail}|${otp}|${expires}`)
    .digest('hex');
    
  return Buffer.from(`${normalizedEmail}|${expires}|${hash}`).toString('base64');
}

/**
 * Verifies a stateless OTP challenge against the provided OTP and state token.
 */
export function verifyOtp(email: string, otp: string, stateToken: string): boolean {
  try {
    const decoded = Buffer.from(stateToken, 'base64').toString('utf8');
    const [tokenEmail, tokenExpiresStr, tokenHash] = decoded.split('|');
    if (!tokenEmail || !tokenExpiresStr || !tokenHash) return false;
    
    const expires = parseInt(tokenExpiresStr, 10);
    const normalizedEmail = email.trim().toLowerCase();
    
    // 1. Check email match
    if (tokenEmail !== normalizedEmail) return false;
    
    // 2. Check expiration
    if (Date.now() > expires) return false;
    
    // 3. Verify signature hash with timing-safe comparison
    const secret = getJwtSecret();
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(`${normalizedEmail}|${otp.trim()}|${expires}`)
      .digest('hex');
      
    return crypto.timingSafeEqual(
      Buffer.from(tokenHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch {
    return false;
  }
}
