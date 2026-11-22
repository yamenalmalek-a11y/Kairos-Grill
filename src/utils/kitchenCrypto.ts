export interface KitchenVaultPayload {
  publicKeyJwk: string;
  encryptedVaultBlob: string;
  salt: string;
  iv: string;
  adminSecretHash: string;
}

export interface UnlockedKitchenCredentials {
  privateKey: CryptoKey;
  privateKeyJwk: JsonWebKey;
  adminWriteSecret: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Base64(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(encoded));
  return bytesToBase64(new Uint8Array(digest)).replace(/\+/g, '-').replace(/\//g, '_');
}

async function derivePinAesKey(pin: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const pinMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(pin)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(saltBytes),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    pinMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function generateKitchenVaultForPin(pin: string): Promise<{
  vault: KitchenVaultPayload;
  credentials: UnlockedKitchenCredentials;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKeyJwk = JSON.stringify(
    await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  );
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const adminWriteSecret = `kwr_${randomHex(24)}`;
  const adminSecretHash = await sha256Base64(adminWriteSecret);

  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await derivePinAesKey(pin, saltBytes);

  const secretPayload = new TextEncoder().encode(
    JSON.stringify({ privateKeyJwk, adminWriteSecret })
  );
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(ivBytes) },
    aesKey,
    toArrayBuffer(secretPayload)
  );

  return {
    vault: {
      publicKeyJwk,
      encryptedVaultBlob: bytesToBase64(new Uint8Array(cipherBuffer)),
      salt: bytesToBase64(saltBytes),
      iv: bytesToBase64(ivBytes),
      adminSecretHash,
    },
    credentials: {
      privateKey: keyPair.privateKey,
      privateKeyJwk,
      adminWriteSecret,
    },
  };
}

export async function unlockKitchenVaultWithPin(
  vault: KitchenVaultPayload,
  pin: string
): Promise<UnlockedKitchenCredentials> {
  const saltBytes = base64ToBytes(vault.salt);
  const ivBytes = base64ToBytes(vault.iv);
  const cipherBytes = base64ToBytes(vault.encryptedVaultBlob);

  const aesKey = await derivePinAesKey(pin, saltBytes);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(ivBytes) },
    aesKey,
    toArrayBuffer(cipherBytes)
  );

  const parsed = JSON.parse(new TextDecoder().decode(plainBuffer)) as {
    privateKeyJwk: JsonWebKey;
    adminWriteSecret: string;
  };

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    parsed.privateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

  return {
    privateKey,
    privateKeyJwk: parsed.privateKeyJwk,
    adminWriteSecret: parsed.adminWriteSecret,
  };
}

export async function reencryptVaultForNewPin(
  privateKeyJwk: JsonWebKey,
  adminWriteSecret: string,
  newPin: string
): Promise<{ encryptedVaultBlob: string; salt: string; iv: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await derivePinAesKey(newPin, saltBytes);

  const secretPayload = new TextEncoder().encode(
    JSON.stringify({ privateKeyJwk, adminWriteSecret })
  );
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(ivBytes) },
    aesKey,
    toArrayBuffer(secretPayload)
  );

  return {
    encryptedVaultBlob: bytesToBase64(new Uint8Array(cipherBuffer)),
    salt: bytesToBase64(saltBytes),
    iv: bytesToBase64(ivBytes),
  };
}

export async function importCredentialsFromJwk(
  privateKeyJwk: JsonWebKey,
  adminWriteSecret: string
): Promise<UnlockedKitchenCredentials> {
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );
  return { privateKey, privateKeyJwk, adminWriteSecret };
}

export async function encryptPiiPayload(
  publicKeyJwkString: string,
  payloadObj: unknown
): Promise<string> {
  const publicJwk = JSON.parse(publicKeyJwkString) as JsonWebKey;
  const rsaPublicKey = await crypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );
  const rawAesKey = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey));
  const wrappedKeyBuffer = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaPublicKey,
    toArrayBuffer(rawAesKey)
  );

  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(ivBytes) },
    aesKey,
    toArrayBuffer(plainBytes)
  );

  return JSON.stringify({
    v: 1,
    k: bytesToBase64(new Uint8Array(wrappedKeyBuffer)),
    iv: bytesToBase64(ivBytes),
    c: bytesToBase64(new Uint8Array(cipherBuffer)),
  });
}

export async function decryptPiiPayload<T>(
  privateKey: CryptoKey,
  encryptedString: string
): Promise<T | null> {
  try {
    const parsed = JSON.parse(encryptedString) as {
      v: number;
      k: string;
      iv: string;
      c: string;
    };
    if (!parsed || parsed.v !== 1 || !parsed.k || !parsed.iv || !parsed.c) {
      return null;
    }

    const wrappedKeyBytes = base64ToBytes(parsed.k);
    const rawAesBuffer = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      toArrayBuffer(wrappedKeyBytes)
    );

    const aesKey = await crypto.subtle.importKey(
      'raw',
      rawAesBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(parsed.iv)) },
      aesKey,
      toArrayBuffer(base64ToBytes(parsed.c))
    );

    return JSON.parse(new TextDecoder().decode(plainBuffer)) as T;
  } catch {
    return null;
  }
}
