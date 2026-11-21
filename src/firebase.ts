import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAIL = 'YamenAlmalek@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export function isNativeAuthHost(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.run.app') ||
    host.endsWith('.firebaseapp.com') ||
    host.endsWith('.web.app')
  );
}

export function isUnauthorizedDomainError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const msg = error instanceof Error ? error.message : String(error || '');
  return code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain');
}

export function formatFirebaseAuthError(error: unknown, lang: 'ar' | 'de'): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const msg = error instanceof Error ? error.message : String(error || '');

  if (isUnauthorizedDomainError(error)) {
    return lang === 'ar'
      ? 'تسجيل دخول Google محصور بالنطاق المنشور من المنصة (زر «انشر») ولا يدعم النطاقات الخارجية.'
      : 'Die Google-Anmeldung funktioniert nur über die veröffentlichte Plattform-Domain, nicht über externe Domains.';
  }

  if (code === 'auth/popup-blocked' || msg.includes('auth/popup-blocked')) {
    return lang === 'ar'
      ? 'تم حظر نافذة تسجيل الدخول المنبثقة من المتصفح، يرجى السماح بالنوافذ المنبثقة أو فتح الرابط في متصفح Chrome.'
      : 'Das Anmeldefenster wurde vom Browser blockiert. Bitte Pop-ups erlauben oder in Chrome öffnen.';
  }

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    msg.includes('popup-closed-by-user')
  ) {
    return lang === 'ar'
      ? 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.'
      : 'Das Anmeldefenster wurde vorzeitig geschlossen.';
  }

  return lang === 'ar'
    ? 'تعذّر تسجيل الدخول بحساب Google، يرجى المحاولة مرة أخرى.'
    : 'Google-Anmeldung fehlgeschlagen. Bitte erneut versuchen.';
}


