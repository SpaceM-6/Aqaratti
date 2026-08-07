const fs = require('fs');

function generateUAEPropertiesWithBrokers() {
  console.log('🚀 جاري بناء وتوليد العقارات وربطها بالوسطاء والشركات العقارية...');

  // 1. مصفوفة بيانات الوسطاء والشركات العقارية
  const brokersList = [
    {
      brokerId: "agent-101",
      name: "أحمد المنصوري",
      agency: "إعمار العقارية (Emaar Properties)",
      phone: "971501234567",
      whatsapp: "201030110959", // الرقم المخصص لاستقبال الاستفسارات والعمولات
      avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200",
      badge: "وسيط موثوق 🌟"
    },
    {
      brokerId: "agent-102",
      name: "سارة الفلاسي",
      agency: "داماك العقارية (DAMAC)",
      phone: "971509876543",
      whatsapp: "201030110959",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200",
      badge: "وسيط مميز 💎"
    },
    {
      brokerId: "agent-103",
      name: "محمد كمال",
      agency: "بيتر هومز (Betterhomes)",
      phone: "971504567890",
      whatsapp: "201030110959",
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=200",
      badge: "وكيل معتمد Check"
    },
    {
      brokerId: "agent-104",
      name: "مريم الشامسي",
      agency: "إف إيه إم العقارية (fām Properties)",
      phone: "971503332211",
      whatsapp: "201030110959",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200",
      badge: "وسيط ذهبي 🥇"
    }
  ];

  const cities = ['دبي', 'أبوظبي', 'الشارقة', 'عجمان', 'رأس الخيمة'];
  const titles = [
    'فيلا شاطئية فاخرة مع مسبح خاص وإطلالة بانورامية',
    'شقة بنتهاوس راقية في برج سكني حديث',
    'تاون هاوس مودرن عائلي بتشطيبات سوبر لوكس',
    'شقة فندقية فاخرة للإيجار السنوي والشهري',
    'استوديو فاخر مفروش بالكامل قرب محطة المترو'
  ];

  const baseGallery = [
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=800',
    'https://images.unsplash.com/photo-1613977257363-707ba9348227?q=80&w=800',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=800',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=800',
    'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?q=80&w=800',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=800',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800',
    'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?q=80&w=800',
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800',
    'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?q=80&w=800',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=800',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=800',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=800',
    'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?q=80&w=800',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?q=80&w=800',
    'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?q=80&w=800',
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?q=80&w=800'
  ];

  const properties = [];

  for (let i = 1; i <= 30; i++) {
    const randomCity = cities[i % cities.length];
    const randomTitle = titles[i % titles.length];
    const price = Math.floor(Math.random() * (4500000 - 900000 + 1)) + 900000;
    
    // ربط العقار بوسيط محدد من القائمة بالتناوب
    const assignedBroker = brokersList[i % brokersList.length];

    const propImages = [];
    for (let j = 0; j < 20; j++) {
      propImages.push(baseGallery[(i + j) % baseGallery.length]);
    }

    properties.push({
      id: `uae-rich-${100 + i}`,
      title: `${randomTitle} - ${randomCity}`,
      priceAED: price,
      bedrooms: (i % 4) + 2,
      bathrooms: (i % 3) + 2,
      area_m2: Math.floor(Math.random() * (500 - 120 + 1)) + 120,
      image: propImages[0],
      imagesList: propImages,
      totalImagesCount: propImages.length,
      commission: "1.5%",
      broker: assignedBroker, // 👈 تم ربط الوسيط الكامل بالعقار!
      description: `عقار راقي ومتميز يقع في موقع حيوي في ${randomCity}. يعرض بواسطة ${assignedBroker.name} من شركة ${assignedBroker.agency}.`
    });
  }

  fs.writeFileSync('properties.json', JSON.stringify(properties, null, 2), 'utf-8');
  console.log(`🎉 تم ربط 30 عقاراً بالوسطاء والشركات وحفظ الملف بنجاح! ✨`);
}

generateUAEPropertiesWithBrokers();