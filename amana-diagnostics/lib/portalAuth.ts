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
    if (!process.env.JWT_SECRET) {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not defined in production mode.');
    }
    cachedSecret = process.env.JWT_SECRET;
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
    // There used to be a literal secret here. Every hub that reached this path
    // shared one signing key, so a portal token minted on any of them was valid
    // on all of them. A hub that cannot reach its own secret must refuse to
    // sign rather than sign with a known one.
    console.error('Failed to retrieve or generate the portal signing secret:', err);
    if (process.env.JWT_SECRET) {
      cachedSecret = process.env.JWT_SECRET;
      return cachedSecret;
    }
    throw new Error('Portal signing secret unavailable; refusing to issue or accept portal sessions.');
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
