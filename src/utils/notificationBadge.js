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


/**
 * طلب إذن إشعارات النظام (Windows / Mac / Android / iOS) تلقائياً
 */
export async function requestSystemNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission;
    }
    return Notification.permission;
  } catch (err) {
    console.warn('Notification permission error:', err);
    return 'error';
  }
}

/**
 * تشغيل صوت تنبيه رقيق واحترافي باستخدام Web Audio API دون الحاجة لتحميل ملفات خارجية
 */
export function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // نغمة تنبيه ثنائية أنيقة (E6 -> A6)
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, now); // E6
    osc1.frequency.setValueAtTime(1760.00, now + 0.12); // A6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(659.25, now);
    osc2.frequency.setValueAtTime(880.00, now + 0.12);

    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  } catch (e) {
    // Audio autoplay might be blocked before first user interaction
  }
}

/**
 * إطلاق إشعار نظام حقيقي على شاشة اللابتوب أو الكمبيوتر أو الموبايل
 * @param {Object} options خيارات الإشعار
 * @param {string} options.title عنوان الإشعار
 * @param {string} options.body نص وتفاصيل الإشعار
 * @param {string} [options.icon] مسار الشعار
 * @param {string} [options.url] الرابط للتركيز عند النقر
 */
export async function triggerNativeNotification({ title = '🔔 منصة اتجاه', body = 'وصلك تنبيه جديد', icon = '/logo.jpg', url = '/dashboard' } = {}) {
  if (typeof window === 'undefined') return;

  // 1. تشغيل صوت التنبيه
  playNotificationChime();

  // 2. التحقق من إذن الإشعارات
  if (!('Notification' in window)) return;
  
  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await requestSystemNotificationPermission();
  }

  if (perm !== 'granted') return;

  try {
    // محاولة الإرسال عبر Service Worker لدعم الهواتف والخلفية
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon,
          badge: icon,
          vibrate: [200, 100, 200],
          tag: 'etegah-system-alert-' + Date.now(),
          renotify: true,
          data: { url }
        });
        return;
      }
    }

    // إرسال الإشعار المباشر لسطح المكتب
    const notif = new Notification(title, {
      body,
      icon,
      badge: icon,
      silent: false,
      tag: 'etegah-system-alert-' + Date.now()
    });

    notif.onclick = () => {
      window.focus();
      if (window.location.pathname !== url && url) {
        window.location.href = url;
      }
      notif.close();
    };
  } catch (err) {
    console.warn('Native notification error:', err);
  }
}
