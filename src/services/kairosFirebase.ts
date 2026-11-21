import {
  Timestamp,
  Unsubscribe,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { CartEntry, CartTotals, getEntryUnitPrice } from '@/src/data/kairosData';
import { OperationType, db, handleFirestoreError } from '@/src/firebase';

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
  orderNumber: string;
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

export function generateSecureOrderId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `ord_${hex}`;
}

export function getStatusMessages(status: OrderStatus): { ar: string; de: string } {
  switch (status) {
    case 'pending':
      return {
        ar: 'تم إرسال الطلب — بانتظار تأكيد المطعم',
        de: 'Bestellung gesendet — Warten auf Bestätigung',
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
  const orderId = generateSecureOrderId();

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

  const gpsText = params.gpsCoords
    ? `${params.gpsCoords.lat.toFixed(6)},${params.gpsCoords.lng.toFixed(6)}`.slice(0, 64)
    : '';

  const initialMsg = getStatusMessages('pending');

  const orderDocPayload = {
    orderNumber: params.orderNumber.slice(0, 32),
    customerName: params.customerName.trim().slice(0, 80),
    customerPhone: params.customerPhone.trim().slice(0, 32),
    orderMode: params.orderMode,
    address:
      params.orderMode === 'pickup'
        ? 'Abholung vor Ort'
        : params.address.trim().slice(0, 240),
    gpsText,
    paymentMethod: params.paymentMethod,
    notes: (params.notes || '').trim().slice(0, 300),
    items: boundedItems,
    subtotal: Number(params.totals.subtotal.toFixed(2)),
    foodTax: Number(params.totals.foodTax.toFixed(2)),
    drinksTax: Number(params.totals.drinksTax.toFixed(2)),
    deliveryFee: Number(params.totals.deliveryFee.toFixed(2)),
    total: Number(params.totals.total.toFixed(2)),
    status: 'pending' as OrderStatus,
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
  onData: (orders: OrderRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: OrderRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<OrderRecord, 'id'>),
      }));
      onData(list);
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

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const messages = getStatusMessages(status);
  const path = `orders/${orderId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'orders', orderId), {
      status,
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
  complaintNumber: string;
  customerName: string;
  customerPhone: string;
  orderNumber: string;
  category: ComplaintCategory;
  message: string;
  status: ComplaintStatus;
  adminNote: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export function generateSecureComplaintId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `cmp_${hex}`;
}

export async function createComplaint(params: {
  customerName: string;
  customerPhone?: string;
  orderNumber?: string;
  category: ComplaintCategory;
  message: string;
}): Promise<{ complaintId: string; complaintNumber: string }> {
  const complaintId = generateSecureComplaintId();
  const complaintNumber = `CMP-${Math.floor(1000 + Math.random() * 9000)}`;

  const payload = {
    complaintNumber: complaintNumber.slice(0, 32),
    customerName: params.customerName.trim().slice(0, 80),
    customerPhone: (params.customerPhone || '').trim().slice(0, 32),
    orderNumber: (params.orderNumber || '').trim().slice(0, 32),
    category: params.category,
    message: params.message.trim().slice(0, 600),
    status: 'new' as ComplaintStatus,
    adminNote: '',
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
  onData: (complaints: ComplaintRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: ComplaintRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ComplaintRecord, 'id'>),
      }));
      onData(list);
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
  adminNote: string
): Promise<void> {
  const path = `complaints/${complaintId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'complaints', complaintId), {
      status,
      adminNote: adminNote.trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

