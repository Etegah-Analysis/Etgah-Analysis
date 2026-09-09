/**
 * ==============================================================================
 *  منصة اتجاه للتحليل الذكي - نظام شارة التنبيهات الديناميكية للمتصفح والتبويب
 *  Dynamic Favicon Badge & Flashing Browser Tab Title Notifier
 * ==============================================================================
 * يقوم هذا الموديول بـ:
 *  1. رسم شارة تنبيه رقمية حمراء ساطعة على أيقونة التبويب (Favicon) عند وجود تنبيهات
 *  2. تغيير وتومض عنوان التبويب بالمتصفح (مثال: (1) 🔔 تنبيه جديد!) لجذب انتباه الموظف
 *  3. التفاعل الفوري مع مغادرة الموظف للتبويب وبدء الوميض تلقائياً (visibilitychange)
 *  4. العمل تلقائياً مع كافة الموظفين وإزالة التنبيه عند قراءة الإشعارات وتصفيرها
 */

let titleInterval = null;
let cachedLogoImg = null;
let currentAlertCount = 0;
let currentBaseTitle = 'WhatsApp Etegah';

// تحميل مسبق لصورة اللوجو لسرعة الاستجابة
if (typeof window !== 'undefined') {
  cachedLogoImg = new Image();
  cachedLogoImg.crossOrigin = 'anonymous';
  cachedLogoImg.src = '/logo.jpg';

  // مراقبة تبديل التبويب (Visibility Change) لبدء الوميض فور خروج الموظف من الصفحة
  document.addEventListener('visibilitychange', () => {
    if (currentAlertCount > 0) {
      updateTabTitle(currentAlertCount, currentBaseTitle);
    }
  });
}

/**
 * تحديث شارة الـ Favicon برقم الإشعارات
 * @param {number} count عدد التنبيهات غير المقروءة
 */
export function updateFaviconBadge(count) {
  if (typeof document === 'undefined') return;

  const links = document.querySelectorAll("link[rel*='icon']");
  if (!links || links.length === 0) return;

  if (count <= 0) {
    links.forEach(link => {
      link.type = 'image/jpeg';
      link.href = '/logo.jpg';
    });
    return;
  }

  const renderBadge = (img) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // رسم صورة اللوجو الأساسية
      ctx.drawImage(img, 0, 0, 64, 64);

      // تحديد أبعاد وموضع الشارة الحمراء في الزاوية العلوية
      const badgeRadius = count > 9 ? 17 : 15;
      const badgeX = 64 - badgeRadius - 1;
      const badgeY = badgeRadius + 1;

      // ظل خارجي مضيء للشارة
      ctx.save();
      ctx.shadowColor = 'rgba(225, 29, 72, 0.9)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;

      // حد أبيض دائري عريض
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeRadius + 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // الدائرة الحمراء للتنبيه (تدرج لوني ناصع)
      const grad = ctx.createLinearGradient(badgeX - badgeRadius, badgeY - badgeRadius, badgeX + badgeRadius, badgeY + badgeRadius);
      grad.addColorStop(0, '#f43f5e'); // Rose 500
      grad.addColorStop(1, '#be123c'); // Rose 700
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = grad;
      ctx.fill();

      // كتابة رقم التنبيه داخل الشارة
      ctx.fillStyle = '#ffffff';
      ctx.font = count > 99 ? '900 14px "Segoe UI", Arial, sans-serif' : (count > 9 ? '900 18px "Segoe UI", Arial, sans-serif' : '900 21px "Segoe UI", Arial, sans-serif');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = count > 99 ? '99+' : String(count);
      ctx.fillText(text, badgeX, badgeY + 1);

      const dataUrl = canvas.toDataURL('image/png');

      // استبدال روابط الأيقونات مع إعادة الربط لضمان قراءة كروم وإيدج للأيقونة الجديدة فوراً
      links.forEach(link => {
        link.type = 'image/png';
        link.href = dataUrl;
      });

      const primaryIcon = document.querySelector("link[rel='icon']");
      if (primaryIcon && primaryIcon.parentNode) {
        const freshLink = primaryIcon.cloneNode(true);
        freshLink.type = 'image/png';
        freshLink.href = dataUrl;
        primaryIcon.parentNode.replaceChild(freshLink, primaryIcon);
      }
    } catch (err) {
      console.warn('Favicon badge render error:', err);
    }
  };

  if (cachedLogoImg && cachedLogoImg.complete && cachedLogoImg.naturalWidth > 0) {
    renderBadge(cachedLogoImg);
  } else {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/logo.jpg';
    img.onload = () => {
      cachedLogoImg = img;
      renderBadge(img);
    };
  }
}

/**
 * وميض وتحديث عنوان التبويب في المتصفح
 * @param {number} count عدد التنبيهات
 * @param {string} baseTitle عنوان الصفحة الأصلي
 */
export function updateTabTitle(count, baseTitle = 'WhatsApp Etegah') {
  if (typeof document === 'undefined') return;
  currentAlertCount = count;
  currentBaseTitle = baseTitle;

  if (titleInterval) {
    clearInterval(titleInterval);
    titleInterval = null;
  }

  if (count <= 0) {
    document.title = baseTitle;
    return;
  }

  const alertTitle = `(${count}) 🔔 تنبيه جديد!`;
  const countedTitle = `(${count}) 🔔 ${baseTitle}`;

  // إذا كانت الصفحة في الخلفية والمستخدم في تبويب آخر، نبدأ وميض العنوان
  if (document.hidden) {
    let toggle = false;
    document.title = alertTitle;
    titleInterval = setInterval(() => {
      if (document.hidden) {
        document.title = toggle ? alertTitle : countedTitle;
        toggle = !toggle;
      } else {
        document.title = countedTitle;
        if (titleInterval) {
          clearInterval(titleInterval);
          titleInterval = null;
        }
      }
    }, 1200);
  } else {
    document.title = countedTitle;
  }
}

/**
 * التحديث الشامل للشارة وعنوان التبويب معاً
 * @param {number} count عدد التنبيهات
 * @param {string} baseTitle عنوان الصفحة الافتراضي
 */
export function setGlobalNotificationAlert(count, baseTitle = 'WhatsApp Etegah') {
  updateFaviconBadge(count);
  updateTabTitle(count, baseTitle);
}
