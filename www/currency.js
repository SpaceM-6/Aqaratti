/* ==================== نظام العملة الموحّد لموقع AqarX ====================
   يحفظ العملة المختارة من أي صفحة في localStorage، ويحوّل كل الأسعار المعروضة
   (المخزَّنة أصلاً بالدرهم الإماراتي AED) لنفس العملة تلقائياً عبر كل صفحات الموقع.
*/

const AQARX_CURRENCIES = {
  AED: { symbol: 'د.إ', rate: 1 },
  USD: { symbol: '$', rate: 0.27 },
  SAR: { symbol: 'ر.س', rate: 1.02 },
  EGP: { symbol: 'ج.م', rate: 13.1 },
  EUR: { symbol: '€', rate: 0.25 },
  GBP: { symbol: '£', rate: 0.21 },
  QAR: { symbol: 'ر.ق', rate: 0.99 },
  KWD: { symbol: 'د.ك', rate: 0.083 },
  BHD: { symbol: 'د.ب', rate: 0.10 },
  OMR: { symbol: 'ر.ع', rate: 0.10 },
  TRY: { symbol: '₺', rate: 8.85 },
  CAD: { symbol: 'CA$', rate: 0.37 },
  AUD: { symbol: 'A$', rate: 0.41 },
  CHF: { symbol: 'CHF', rate: 0.24 },
  JPY: { symbol: '¥', rate: 42.5 },
  CNY: { symbol: '¥', rate: 1.95 },
  INR: { symbol: '₹', rate: 22.8 },
  RUB: { symbol: '₽', rate: 24.5 },
  MAD: { symbol: 'د.م.', rate: 2.71 },
  JOD: { symbol: 'د.ا', rate: 0.19 }
};

const AQARX_CURRENCY_KEY = 'aqarx_currency_code';

function getSelectedCurrency() {
  const code = localStorage.getItem(AQARX_CURRENCY_KEY) || 'AED';
  const data = AQARX_CURRENCIES[code] || AQARX_CURRENCIES.AED;
  return { code, symbol: data.symbol, rate: data.rate };
}

function setSelectedCurrency(code) {
  if (!AQARX_CURRENCIES[code]) return;
  localStorage.setItem(AQARX_CURRENCY_KEY, code);
}

function convertFromAED(amountInAED) {
  const { rate } = getSelectedCurrency();
  return Math.round((amountInAED || 0) * rate);
}

// ينسّق مبلغاً محفوظاً بالدرهم إلى نص بالعملة المختارة حالياً، مع لاحقة عربية اختيارية (مثال: "/ شهر")
function formatPriceAED(amountInAED, suffix) {
  const { code } = getSelectedCurrency();
  const suffixText = suffix ? ` ${suffix}` : '';
  return `${code} ${convertFromAED(amountInAED).toLocaleString()}${suffixText}`;
}

// إعادة رسم كل عنصر يحمل data-price-aed="<مبلغ بالدرهم>" [و data-price-prefix / data-price-suffix] ليعرض السعر بالعملة المختارة
function applyCurrencyToPage() {
  document.querySelectorAll('[data-price-aed]').forEach(el => {
    const amount = parseFloat(el.getAttribute('data-price-aed'));
    if (isNaN(amount)) return;
    const prefix = el.getAttribute('data-price-prefix') || '';
    const suffix = el.getAttribute('data-price-suffix') || '';
    el.innerText = `${prefix}${formatPriceAED(amount, suffix)}`;
  });
}

document.addEventListener('DOMContentLoaded', applyCurrencyToPage);
