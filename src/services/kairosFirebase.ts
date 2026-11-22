import {
  Timestamp,
  Unsubscribe,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { CartEntry, CartTotals, getEntryUnitPrice } from '@/src/data/kairosData';
import { OperationType, db, handleFirestoreError } from '@/src/firebase';
import {
  KitchenVaultPayload,
  UnlockedKitchenCredentials,
  decryptPiiPayload,
  encryptPiiPayload,
  generateKitchenVaultForPin,
  reencryptVaultForNewPin,
  unlockKitchenVaultWithPin,
} from '@/src/utils/kitchenCrypto';

export const SHOP_ID = 'kairos_rostock' as const;
const VAULT_DOC_ID = 'rostock';

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'delivering'
  | 'completed'
  | 'cancelled';

export interface OrderItemPayload {
  dishId: string;
  itemNumber: string;
  nameAr: string;
  nameDe: string;
  variantLabel: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

export interface OrderRecord {
  id: string;
  shopId: string;
  orderNumber: string;
  piiEncrypted: boolean;
  encryptedPii: string;
  customerName: string;
  customerPhone: string;
  orderMode: 'delivery' | 'pickup';
  address: string;
  gpsText: string;
  paymentMethod: 'cash' | 'payment_link';
  notes: string;
  items: OrderItemPayload[];
  subtotal: number;
  foodTax: number;
  drinksTax: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  lastActionId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface OrderTrackingRecord {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusMessageAr: string;
  statusMessageDe: string;
  total: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface KitchenVaultDoc extends KitchenVaultPayload {
  lastActionId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

function generateSecureId(prefix: string): string {
  const bytes = new Uint8Array(14);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

export function getStatusMessages(status: OrderStatus): { ar: string; de: string } {
  switch (status) {
    case 'pending':
      return {
        ar: 'تم إرسال الطلب إلى المطعم — بانتظار التأكيد',
        de: 'Bestellung ans Restaurant gesendet — Warten auf Bestätigung',
      };
    case 'accepted':
      return {
        ar: 'تم استلام طلبك في مطعم Kairos Grill بنجاح!',
        de: 'Ihre Bestellung wurde von Kairos Grill angenommen!',
      };
    case 'preparing':
      return {
        ar: 'طلبك قيد التحضير الآن طازجاً في المطبخ',
        de: 'Ihre Bestellung wird gerade frisch zubereitet',
      };
    case 'delivering':
      return {
        ar: 'طلبك خرج للتوصيل وهو في الطريق إليك',
        de: 'Ihre Bestellung ist unterwegs zu Ihnen',
      };
    case 'completed':
      return {
        ar: 'تم تسليم الطلب بنجاح — صحتين وعافية!',
        de: 'Bestellung abgeschlossen — Guten Appetit!',
      };
    case 'cancelled':
      return {
        ar: 'تم إلغاء الطلب — يرجى التواصل مع المطعم للاستفسار',
        de: 'Bestellung storniert — Bitte kontaktieren Sie uns',
      };
  }
}

export async function fetchKitchenVault(): Promise<KitchenVaultDoc | null> {
  try {
    const snap = await getDoc(doc(db, 'kitchenVault', VAULT_DOC_ID));
    if (!snap.exists()) return null;
    return snap.data() as KitchenVaultDoc;
  } catch {
    return null;
  }
}

export async function initializeKitchenVault(
  pin: string
): Promise<UnlockedKitchenCredentials> {
  const { vault, credentials } = await generateKitchenVaultForPin(pin);
  try {
    await setDoc(doc(db, 'kitchenVault', VAULT_DOC_ID), {
      ...vault,
      lastActionId: 'init',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return credentials;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `kitchenVault/${VAULT_DOC_ID}`);
  }
}

export async function verifyAndUnlockKitchenVault(
  pin: string
): Promise<UnlockedKitchenCredentials> {
  const vault = await fetchKitchenVault();
  if (!vault) {
    throw new Error('VAULT_NOT_INITIALIZED');
  }
  return unlockKitchenVaultWithPin(vault, pin);
}

export async function rotateKitchenPin(
  credentials: UnlockedKitchenCredentials,
  newPin: string
): Promise<void> {
  const updated = await reencryptVaultForNewPin(
    credentials.privateKeyJwk,
    credentials.adminWriteSecret,
    newPin
  );
  const proofId = generateSecureId('prf');
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'adminProofs', proofId), {
      targetType: 'vault',
      targetId: VAULT_DOC_ID,
      targetStatus: 'pin_rotate',
      adminSecret: credentials.adminWriteSecret,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'kitchenVault', VAULT_DOC_ID), {
      encryptedVaultBlob: updated.encryptedVaultBlob,
      salt: updated.salt,
      iv: updated.iv,
      lastActionId: proofId,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `kitchenVault/${VAULT_DOC_ID}`);
  }
}

export async function createLiveOrder(params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  orderMode: 'delivery' | 'pickup';
  address: string;
  gpsCoords?: { lat: number; lng: number } | null;
  paymentMethod: 'cash' | 'payment_link';
  notes?: string;
  items: CartEntry[];
  totals: CartTotals;
}): Promise<string> {
  const orderId = generateSecureId('ord');

  const boundedItems: OrderItemPayload[] = params.items.slice(0, 50).map((entry) => ({
    dishId: entry.dish.id.slice(0, 64),
    itemNumber: (entry.dish.itemNumber || '').slice(0, 12),
    nameAr: entry.dish.nameAr.slice(0, 100),
    nameDe: entry.dish.nameDe.slice(0, 100),
    variantLabel: entry.variant
      ? `${entry.variant.labelAr} / ${entry.variant.labelDe}`.slice(0, 60)
      : '',
    qty: Math.max(1, entry.quantity),
    unitPrice: Number(getEntryUnitPrice(entry).toFixed(2)),
    taxRate: entry.dish.taxRate,
  }));

  const cleanName = params.customerName.trim().slice(0, 80);
  const cleanPhone = params.customerPhone.trim().slice(0, 32);
  const cleanAddress =
    params.orderMode === 'pickup'
      ? 'Abholung vor Ort'
      : params.address.trim().slice(0, 240);
  const gpsText = params.gpsCoords
    ? `${params.gpsCoords.lat.toFixed(6)},${params.gpsCoords.lng.toFixed(6)}`.slice(0, 64)
    : '';
  const cleanNotes = (params.notes || '').trim().slice(0, 300);

  const vault = await fetchKitchenVault();
  let piiEncrypted = false;
  let encryptedPii = '';

  if (vault?.publicKeyJwk) {
    try {
      encryptedPii = await encryptPiiPayload(vault.publicKeyJwk, {
        customerName: cleanName,
        customerPhone: cleanPhone,
        address: cleanAddress,
        gpsText,
        notes: cleanNotes,
      });
      piiEncrypted = true;
    } catch {
      piiEncrypted = false;
      encryptedPii = '';
    }
  }

  const initialMsg = getStatusMessages('pending');

  const orderDocPayload = {
    shopId: SHOP_ID,
    orderNumber: params.orderNumber.slice(0, 32),
    piiEncrypted,
    encryptedPii,
    customerName: piiEncrypted ? 'Geschützt' : cleanName,
    customerPhone: piiEncrypted ? '***' : cleanPhone,
    orderMode: params.orderMode,
    address: piiEncrypted
      ? params.orderMode === 'pickup'
        ? 'Abholung vor Ort'
        : 'Geschützt'
      : cleanAddress,
    gpsText: piiEncrypted ? '' : gpsText,
    paymentMethod: params.paymentMethod,
    notes: piiEncrypted ? '' : cleanNotes,
    items: boundedItems,
    subtotal: Number(params.totals.subtotal.toFixed(2)),
    foodTax: Number(params.totals.foodTax.toFixed(2)),
    drinksTax: Number(params.totals.drinksTax.toFixed(2)),
    deliveryFee: Number(params.totals.deliveryFee.toFixed(2)),
    total: Number(params.totals.total.toFixed(2)),
    status: 'pending' as OrderStatus,
    lastActionId: 'created',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const trackingDocPayload = {
    orderNumber: params.orderNumber.slice(0, 32),
    status: 'pending' as OrderStatus,
    statusMessageAr: initialMsg.ar.slice(0, 200),
    statusMessageDe: initialMsg.de.slice(0, 200),
    total: Number(params.totals.total.toFixed(2)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', orderId), orderDocPayload);
    batch.set(doc(db, 'orderTracking', orderId), trackingDocPayload);
    await batch.commit();
    return orderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${orderId}`);
  }
}

export async function decryptOrderRecord(
  order: OrderRecord,
  privateKey: CryptoKey
): Promise<OrderRecord> {
  if (!order.piiEncrypted || !order.encryptedPii) {
    return order;
  }
  const pii = await decryptPiiPayload<{
    customerName?: string;
    customerPhone?: string;
    address?: string;
    gpsText?: string;
    notes?: string;
  }>(privateKey, order.encryptedPii);

  if (!pii) return order;
  return {
    ...order,
    customerName: pii.customerName || order.customerName,
    customerPhone: pii.customerPhone || order.customerPhone,
    address: pii.address || order.address,
    gpsText: pii.gpsText ?? order.gpsText,
    notes: pii.notes ?? order.notes,
  };
}

export function subscribeOrderTracking(
  orderId: string,
  onData: (tracking: OrderTrackingRecord | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `orderTracking/${orderId}`;
  return onSnapshot(
    doc(db, 'orderTracking', orderId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData({
        id: snapshot.id,
        ...(snapshot.data() as Omit<OrderTrackingRecord, 'id'>),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export function subscribeAdminOrders(
  privateKey: CryptoKey,
  onData: (orders: OrderRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'orders'), where('shopId', '==', SHOP_ID), limit(150));
  return onSnapshot(
    q,
    (snapshot) => {
      const rawList: OrderRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<OrderRecord, 'id'>),
      }));

      void Promise.all(rawList.map((o) => decryptOrderRecord(o, privateKey))).then(
        (decrypted) => {
          decrypted.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
            return tb - ta;
          });
          onData(decrypted);
        }
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  adminWriteSecret: string
): Promise<void> {
  const messages = getStatusMessages(status);
  const proofId = generateSecureId('prf');
  const path = `orders/${orderId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'adminProofs', proofId), {
      targetType: 'order',
      targetId: orderId,
      targetStatus: status,
      adminSecret: adminWriteSecret,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'orders', orderId), {
      status,
      lastActionId: proofId,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'orderTracking', orderId), {
      status,
      statusMessageAr: messages.ar.slice(0, 200),
      statusMessageDe: messages.de.slice(0, 200),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export type ComplaintCategory =
  | 'delivery_delay'
  | 'food_quality'
  | 'missing_item'
  | 'service'
  | 'other';

export type ComplaintStatus = 'new' | 'reviewed' | 'resolved';

export interface ComplaintRecord {
  id: string;
  shopId: string;
  complaintNumber: string;
  piiEncrypted: boolean;
  encryptedPii: string;
  customerName: string;
  customerPhone: string;
  orderNumber: string;
  category: ComplaintCategory;
  message: string;
  status: ComplaintStatus;
  adminNote: string;
  lastActionId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export async function createComplaint(params: {
  customerName: string;
  customerPhone?: string;
  orderNumber?: string;
  category: ComplaintCategory;
  message: string;
}): Promise<{ complaintId: string; complaintNumber: string }> {
  const complaintId = generateSecureId('cmp');
  const complaintNumber = `CMP-${Math.floor(1000 + Math.random() * 9000)}`;

  const cleanName = params.customerName.trim().slice(0, 80);
  const cleanPhone = (params.customerPhone || '').trim().slice(0, 32);
  const cleanMessage = params.message.trim().slice(0, 600);

  const vault = await fetchKitchenVault();
  let piiEncrypted = false;
  let encryptedPii = '';

  if (vault?.publicKeyJwk) {
    try {
      encryptedPii = await encryptPiiPayload(vault.publicKeyJwk, {
        customerName: cleanName,
        customerPhone: cleanPhone,
        message: cleanMessage,
      });
      piiEncrypted = true;
    } catch {
      piiEncrypted = false;
      encryptedPii = '';
    }
  }

  const payload = {
    shopId: SHOP_ID,
    complaintNumber: complaintNumber.slice(0, 32),
    piiEncrypted,
    encryptedPii,
    customerName: piiEncrypted ? 'Geschützt' : cleanName,
    customerPhone: piiEncrypted ? '' : cleanPhone,
    orderNumber: (params.orderNumber || '').trim().slice(0, 32),
    category: params.category,
    message: piiEncrypted ? 'Geschützt' : cleanMessage,
    status: 'new' as ComplaintStatus,
    adminNote: '',
    lastActionId: 'created',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'complaints', complaintId), payload);
    await batch.commit();
    return { complaintId, complaintNumber };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `complaints/${complaintId}`);
  }
}

export function subscribeAdminComplaints(
  privateKey: CryptoKey,
  onData: (complaints: ComplaintRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'complaints'), where('shopId', '==', SHOP_ID), limit(150));
  return onSnapshot(
    q,
    (snapshot) => {
      const rawList: ComplaintRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ComplaintRecord, 'id'>),
      }));

      void Promise.all(
        rawList.map(async (c) => {
          if (!c.piiEncrypted || !c.encryptedPii) return c;
          const pii = await decryptPiiPayload<{
            customerName?: string;
            customerPhone?: string;
            message?: string;
          }>(privateKey, c.encryptedPii);
          if (!pii) return c;
          return {
            ...c,
            customerName: pii.customerName || c.customerName,
            customerPhone: pii.customerPhone ?? c.customerPhone,
            message: pii.message || c.message,
          };
        })
      ).then((decrypted) => {
        decrypted.sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
          return tb - ta;
        });
        onData(decrypted);
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'complaints');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function updateComplaintStatus(
  complaintId: string,
  status: ComplaintStatus,
  adminNote: string,
  adminWriteSecret: string
): Promise<void> {
  const proofId = generateSecureId('prf');
  const path = `complaints/${complaintId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'adminProofs', proofId), {
      targetType: 'complaint',
      targetId: complaintId,
      targetStatus: status,
      adminSecret: adminWriteSecret,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'complaints', complaintId), {
      status,
      adminNote: adminNote.trim().slice(0, 300),
      lastActionId: proofId,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
