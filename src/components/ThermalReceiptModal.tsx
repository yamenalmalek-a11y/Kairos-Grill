import { useEffect, useState } from 'react';
import { Check, Copy, Printer, Share2, X, Zap } from 'lucide-react';
import QRCode from 'qrcode';
import { KAIROS_ASSETS, KAIROS_INFO, formatEuro } from '@/src/data/kairosData';
import { OrderRecord } from '@/src/services/kairosFirebase';
import {
  ReceiptPaperWidth,
  buildRawBtEscPosUri,
  buildThermalReceiptText,
  getReceiptOrderDate,
  getReceiptQrTarget,
} from '@/src/utils/thermalPrinter';

interface ThermalReceiptProps {
  order: OrderRecord;
  paperWidth: ReceiptPaperWidth;
}

export function ThermalReceiptSlip({ order, paperWidth }: ThermalReceiptProps) {
  const [qrSvg, setQrSvg] = useState<string>('');
  const qrTarget = getReceiptQrTarget(order);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(qrTarget, {
      type: 'svg',
      margin: 1,
      width: paperWidth === '58mm' ? 120 : 140,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setQrSvg('');
      });

    return () => {
      cancelled = true;
    };
  }, [qrTarget, paperWidth]);

  const isPaid = order.paymentMethod === 'payment_link';
  const widthStyle = paperWidth === '58mm' ? '54mm' : '74mm';
  const dateStr = getReceiptOrderDate(order);

  return (
    <div
      dir="ltr"
      style={{ width: widthStyle }}
      className="kairos-thermal-sheet bg-white text-black mx-auto px-2 py-3 font-sans leading-snug select-text"
    >
      {/* Restaurant Name Header */}
      <div className="text-center pb-2 border-b-2 border-black">
        <img
          src={KAIROS_ASSETS.logoBanner}
          alt={KAIROS_INFO.brandName}
          className="h-9 w-auto mx-auto mb-1 object-contain grayscale contrast-200"
        />
        <p className="text-[19px] font-black tracking-tight uppercase leading-none">
          {KAIROS_INFO.brandName}
        </p>
        <p className="text-[10px] font-bold mt-1">
          {KAIROS_INFO.address}
        </p>
        <p className="text-[10px] font-bold">
          Tel: {KAIROS_INFO.phoneDisplay}
        </p>
      </div>

      {/* Order Number & Payment Status Highlight Bar (Sunmi POS Style) */}
      <div className="text-center py-2 border-b border-dashed border-black">
        <p className="text-[10px] font-bold uppercase tracking-wider">
          {order.orderMode === 'pickup' ? 'ABHOLUNG' : 'LIEFERUNG'} · {dateStr}
        </p>
        <p className="text-[22px] font-black tracking-tight my-1 tabular-nums">
          #{order.orderNumber}
        </p>
        <div className="bg-black text-white py-1 px-2 text-[12px] font-black uppercase tracking-wider">
          {isPaid ? 'BEZAHLT (ONLINE)' : 'BARZAHLUNG'}
        </div>
      </div>

      {/* Customer & Delivery Details */}
      <div className="py-2 border-b border-dashed border-black text-[11px] space-y-0.5">
        <p className="font-black text-[12px]">{order.customerName}</p>
        <p className="font-bold tabular-nums">Tel: {order.customerPhone}</p>
        <p className="font-semibold break-words">{order.address}</p>
      </div>

      {/* Ordered Dishes */}
      <div className="py-2 border-b border-dashed border-black space-y-1.5 text-[11px]">
        {order.items.map((item, idx) => (
          <div key={idx}>
            <div className="flex items-start justify-between gap-1.5 font-bold">
              <span className="break-words">
                {item.qty}x {item.itemNumber ? `#${item.itemNumber} ` : ''}
                {item.nameDe}
              </span>
              <span className="tabular-nums shrink-0">
                {formatEuro(item.unitPrice * item.qty)}
              </span>
            </div>
            {item.variantLabel && (
              <p className="pl-3 text-[10px] font-semibold">
                + {item.variantLabel}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Customer Notes Box */}
      {order.notes && order.notes.trim().length > 0 && (
        <div className="my-2 border-2 border-black p-1.5 text-[11px]">
          <p className="font-black uppercase text-[10px]">HINWEIS / NOTIZ:</p>
          <p className="font-bold break-words">{order.notes}</p>
        </div>
      )}

      {/* Subtotal, Tax & Total */}
      <div className="py-2 border-b-2 border-black text-[11px] space-y-0.5 tabular-nums">
        <div className="flex justify-between">
          <span>Netto:</span>
          <span>{formatEuro(order.subtotal)}</span>
        </div>
        {order.foodTax > 0 && (
          <div className="flex justify-between">
            <span>MwSt 7%:</span>
            <span>+{formatEuro(order.foodTax)}</span>
          </div>
        )}
        {order.drinksTax > 0 && (
          <div className="flex justify-between">
            <span>MwSt 19%:</span>
            <span>+{formatEuro(order.drinksTax)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Lieferung:</span>
          <span>{formatEuro(order.deliveryFee)}</span>
        </div>
        <div className="flex justify-between items-baseline pt-1.5 mt-1 border-t border-black text-[15px] font-black">
          <span>GESAMT</span>
          <span>{formatEuro(order.total)}</span>
        </div>
      </div>

      {/* Scannable Driver / Verification QR Code */}
      {qrSvg && (
        <div className="pt-2.5 flex flex-col items-center text-center">
          <div
            className="w-[26mm] h-[26mm] [&>svg]:w-full [&>svg]:h-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="text-[9px] font-bold uppercase mt-1">
            {order.orderMode === 'delivery'
              ? 'QR: Navi / Adresse scannen'
              : 'QR: Kontakt / Bestellung'}
          </p>
        </div>
      )}

      <div className="pt-2 mt-1.5 border-t border-dashed border-black text-center text-[10px] font-bold">
        <p>Vielen Dank für Ihre Bestellung!</p>
        <p>{KAIROS_INFO.brandName} · Rostock</p>
      </div>
    </div>
  );
}

interface ThermalReceiptModalProps {
  order: OrderRecord;
  lang: 'ar' | 'de';
  paperWidth: ReceiptPaperWidth;
  onChangePaperWidth: (width: ReceiptPaperWidth) => void;
  onClose: () => void;
}

export function ThermalReceiptModal({
  order,
  lang,
  paperWidth,
  onChangePaperWidth,
  onClose,
}: ThermalReceiptModalProps) {
  const [copied, setCopied] = useState(false);

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleRawBtPrint = () => {
    const uri = buildRawBtEscPosUri(order, paperWidth);
    window.location.href = uri;
  };

  const handleShareReceipt = async () => {
    const text = buildThermalReceiptText(order, paperWidth);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Kairos Grill #${order.orderNumber}`,
          text,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopyReceipt();
  };

  const handleCopyReceipt = async () => {
    const text = buildThermalReceiptText(order, paperWidth);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures on restricted WebViews
    }
  };

  return (
    <>
      {/* Dynamic @page paper width synced to 58mm or 80mm */}
      <style>{`@media print { @page { size: ${paperWidth} auto; margin: 0mm; } }`}</style>

      <div
        className="fixed inset-0 z-50 bg-[#0B0D0F]/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 print:hidden"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[440px] max-h-[92vh] bg-[#14171A] border border-[#262B31] rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-[#262B31] flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-[15px] font-extrabold text-[#F4F5F6]">
              {lang === 'ar'
                ? `فاتورة الطباعة #${order.orderNumber}`
                : `Kassenbon #${order.orderNumber}`}
            </h2>
            <p className="text-[11px] text-[#A3ACB3]">
              {lang === 'ar'
                ? 'مقاس حراري جاهز لأجهزة Sunmi (58mm)'
                : 'Thermodruck-Format für Sunmi POS'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-[10px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[#F4F5F6] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Paper Size Toggle */}
        <div className="px-4 py-2.5 bg-[#0B0D0F] border-b border-[#262B31] flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[#A3ACB3]">
            {lang === 'ar' ? 'عرض ورق الطابعة:' : 'Papierbreite:'}
          </span>
          <div className="inline-flex rounded-[10px] bg-[#14171A] p-0.5 border border-[#262B31]">
            <button
              type="button"
              onClick={() => onChangePaperWidth('58mm')}
              className={`px-3 py-1 rounded-[8px] text-[11px] font-bold transition-colors ${
                paperWidth === '58mm'
                  ? 'bg-[#FF8000] text-white'
                  : 'text-[#A3ACB3] hover:text-[#F4F5F6]'
              }`}
            >
              58 mm (Sunmi)
            </button>
            <button
              type="button"
              onClick={() => onChangePaperWidth('80mm')}
              className={`px-3 py-1 rounded-[8px] text-[11px] font-bold transition-colors ${
                paperWidth === '80mm'
                  ? 'bg-[#FF8000] text-white'
                  : 'text-[#A3ACB3] hover:text-[#F4F5F6]'
              }`}
            >
              80 mm
            </button>
          </div>
        </div>

        {/* Authentic White Thermal Roll Preview */}
        <div className="flex-1 overflow-y-auto bg-[#0B0D0F] p-4 flex justify-center">
          <div className="bg-white rounded-[4px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] self-start">
            <ThermalReceiptSlip order={order} paperWidth={paperWidth} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-[#262B31] bg-[#14171A] space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="h-11 px-4 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white font-display font-bold text-[13px] inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>
                {lang === 'ar' ? 'طباعة الآن (طابعة الجهاز)' : 'Jetzt drucken (58mm)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleRawBtPrint}
              className="h-11 px-4 rounded-[12px] bg-[#16A34A] hover:bg-[#15803D] text-white font-display font-bold text-[13px] inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Zap className="w-4 h-4" />
              <span>
                {lang === 'ar' ? 'طباعة Sunmi / RawBT' : 'Sunmi / RawBT Druck'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleShareReceipt}
              className="h-9 px-3 rounded-[10px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[#F4F5F6] text-[12px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-[#FF8000]" />
              <span>{lang === 'ar' ? 'مشاركة لتطبيق الطباعة' : 'An Druck-App teilen'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReceipt}
              className="h-9 px-3 rounded-[10px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[#F4F5F6] text-[12px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#A3ACB3]" />
              )}
              <span>
                {copied
                  ? lang === 'ar'
                    ? 'تم النسخ!'
                    : 'Kopiert!'
                  : lang === 'ar'
                    ? 'نسخ نص الفاتورة'
                    : 'Bon-Text kopieren'}
              </span>
            </button>
          </div>

          <p className="text-[11px] text-[#A3ACB3] text-center leading-relaxed">
            {lang === 'ar'
              ? 'للطابعة الداخلية في أجهزة Uber Eats Sunmi: اضغط «طباعة الآن»، وإذا لم تظهر طابعة الجهاز في نافذة أندرويد ثبّت تطبيق RawBT واضغط الزر الأخضر.'
              : 'Für den integrierten 58mm-Drucker: „Jetzt drucken“ wählen oder für direkten ESC/POS-Druck die kostenlose App RawBT nutzen.'}
          </p>
        </div>
      </div>
      </div>
    </>
  );
}
