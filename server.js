const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// مسار ملف قاعدة البيانات المحلية
const DATA_FILE = path.join(__dirname, 'properties.json');

// 🛡️ حماية السيرفر من التوقف المفاجئ عند حدوث أي خطأ
process.on('uncaughtException', (err) => {
  console.error('❌ حدث خطأ غير متوقع وتم التجاوز عن إغلاق السيرفر:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ خطأ في Promise وتم التعامل معه:', reason);
});

// تفعيل CORS ورفع حد استقبال البيانات لـ 50MB لدعم صور الاستوديو والكمبيوتر
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 📁 دالة قراءة وتمرير العقارات من ملف التخزين المحلي
function loadProperties() {
  if (!fs.existsSync(DATA_FILE)) {
    // بيانات افتراضية أولية عند تشغيل السيرفر لأول مرة
    const initialData = [
      {
        id: "101",
        title: "شقة بنتهاوس فاخرة بإطلالة على برج خليفة",
        price: 3850000,
        currency: "AED",
        bedrooms: 3,
        bathrooms: 4,
        area_m2: 210,
        city: "uae",
        image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=800",
        commission: "1.5%",
        verified: true
      },
      {
        id: "102",
        title: "فيلا شاطئية مستقلة في نخلة جميرا",
        price: 18500000,
        currency: "AED",
        bedrooms: 6,
        bathrooms: 7,
        area_m2: 650,
        city: "uae",
        image: "https://images.unsplash.com/photo-1613977257363-707ba9348227?q=80&w=800",
        commission: "2.0%",
        verified: true
      }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// 💾 دالة حفظ البيانات المحدثة في ملف التخزين المحلي
function saveProperties(properties) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(properties, null, 2), 'utf8');
}

// 📡 1. Endpoint: جلب العقارات المتاحة مع الفلترة والبحث المباشر
app.get('/api/properties', (req, res) => {
  let properties = loadProperties();
  const { city, maxPrice, search } = req.query;

  // فلترة حسب الدولة/المدينة
  if (city && city !== 'all') {
    properties = properties.filter(p => p.city === city);
  }
  // فلترة حسب الحد الأقصى للسعر
  if (maxPrice) {
    properties = properties.filter(p => Number(p.price) <= Number(maxPrice));
  }
  // فلترة حسب كلمة البحث في العنوان
  if (search) {
    const term = search.toLowerCase();
    properties = properties.filter(p => p.title.toLowerCase().includes(term));
  }

  res.json({
    status: 'success',
    total: properties.length,
    data: properties
  });
});

// 🔍 2. Endpoint: جلب عقار محدد + تتبع عمولات التسويق بالعمولة (Affiliate Track)
app.get('/api/properties/:id', (req, res) => {
  const properties = loadProperties();
  const property = properties.find(p => p.id === req.params.id);
  const ref = req.query.ref; // معرف المسوق

  if (property) {
    if (ref) {
      console.log(`📈 [Affiliate Click] زائر جديد وصل للعقار "${property.title}" عبر رابط المسوق: (${ref})`);
    }
    res.json({
      status: 'success',
      data: property,
      referrer: ref || null
    });
  } else {
    res.status(404).json({ status: 'error', message: 'العقار غير موجود' });
  }
});

// ➕ 3. Endpoint: إضافة عقار جديد ونشره فوراً
app.post('/api/properties', (req, res) => {
  try {
    const properties = loadProperties();
    const newProperty = {
      id: Date.now().toString(),
      currency: 'AED',
      verified: true,
      city: 'uae',
      commission: '1.5%',
      ...req.body
    };
    
    properties.unshift(newProperty); // وضع العقار في بداية القائمة
    saveProperties(properties); // الحفظ الفوري في قاعدة البيانات المحلية

    console.log("✅ تم حفظ ونشر عقار جديد بنجاح:", newProperty.title);
    
    res.status(201).json({
      status: 'success',
      message: 'تم حفظ ونشر العقار بنجاح!',
      data: newProperty
    });
  } catch (err) {
    console.error("❌ خطأ أثناء إضافة العقار:", err);
    res.status(500).json({ status: 'error', message: 'فشل حفظ العقار' });
  }
});

// 🗑️ 4. Endpoint: حذف عقار محدد
app.delete('/api/properties/:id', (req, res) => {
  try {
    let properties = loadProperties();
    const initialLength = properties.length;
    properties = properties.filter(p => p.id !== req.params.id);

    if (properties.length < initialLength) {
      saveProperties(properties);
      console.log(`🗑️ تم حذف العقار ذو المعرف ID: ${req.params.id}`);
      res.json({ status: 'success', message: 'تم حذف العقار بنجاح' });
    } else {
      res.status(404).json({ status: 'error', message: 'العقار غير موجود' });
    }
  } catch (err) {
    console.error("❌ خطأ أثناء حذف العقار:", err);
    res.status(500).json({ status: 'error', message: 'فشل حذف العقار' });
  }
});

// 🚀 تشغيل السيرفر والاستماع على البورت 3001
const server = app.listen(PORT, () => {
  console.log(`🚀 سيرفر عقاراتي الخارق يعمل بنجاح على: http://localhost:${PORT}`);
});

server.on('error', (e) => {
  console.error('❌ خطأ في تشغيل محرك السيرفر:', e.message);
});