import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// ============================================================
// مكون مؤشر التحليل الفني (TradingView - تاسي)
// ============================================================
const TechnicalAnalysisWidget = () => {
  const container = useRef();
  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.type = 'text/javascript';
    script.async = true;
    const isLight = document.body.classList.contains('light-theme');
    script.innerHTML = JSON.stringify({
      interval: '1D',
      width: '100%',
      isTransparent: true,
      height: 420,
      symbol: 'TADAWUL:TASI',
      showIntervalTabs: false,
      locale: 'ar_AE',
      colorTheme: isLight ? 'light' : 'dark',
    });
    container.current.appendChild(script);
  }, []);
  return <div className="tradingview-widget-container" ref={container} style={{ height: '420px', width: '100%' }} />;
};

// ============================================================
// مصادر RSS المجانية لأخبار الشركات السعودية
// ============================================================
const RSS_SOURCES = [
  'https://www.argaam.com/ar/article/articlelist/rss/4',  // إفصاحات الشركات
  'https://www.argaam.com/ar/article/articlelist/rss/2',  // أسهم
  'https://www.argaam.com/ar/rss',                         // عام
  'https://www.argaam.com/ar/article/articlelist/rss/6',  // بنوك
  'https://www.argaam.com/ar/article/articlelist/rss/7',  // طاقة
  'https://www.argaam.com/ar/article/articlelist/rss/5',  // اقتصاد
];

// ============================================================
// جلب الأخبار
// ============================================================
const loadNews = async () => {
  const all = [];
  for (const url of RSS_SOURCES) {
    try {
      const res = await fetch(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=50`,
        { signal: AbortSignal.timeout(6000) }
      );
      const data = await res.json();
      if (data.status === 'ok' && Array.isArray(data.items)) {
        data.items.forEach(item => {
          all.push({
            id: `${url}${item.pubDate}`,
            title: (item.title || '').trim(),
            body: (item.description || item.content || '').replace(/<[^>]+>/g, '').trim(),
            date: item.pubDate ? new Date(item.pubDate) : new Date(),
          });
        });
      }
    } catch (_) { }
  }
  const seen = new Set();
  return all
    .filter(n => { if (!n.title || seen.has(n.title)) return false; seen.add(n.title); return true; })
    .sort((a, b) => b.date - a.date);
};

const fmt = (d) => {
  try {
    return new Date(d).toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

const FALLBACK = [
  { id: 1, title: 'أرامكو السعودية (2222): توزيع أرباح نقدية 0.31 ريال للسهم', body: 'أعلنت شركة أرامكو السعودية عن توزيع أرباح نقدية بواقع 0.31 ريال للسهم عن الربع الثالث، وستودع في محافظ المساهمين خلال الأسبوعين القادمين.', date: new Date() },
  { id: 2, title: 'مصرف الراجحي (1120): نمو صافي الأرباح 8% في السنة المالية', body: 'سجل مصرف الراجحي نمواً في صافي الأرباح بنسبة 8% خلال السنة المالية الحالية مدعوماً بارتفاع محفظة التمويل والإيرادات التشغيلية.', date: new Date(Date.now() - 3600000) },
  { id: 3, title: 'البنك الأهلي (1180): إصدار صكوك دولية بقيمة 750 مليون دولار', body: 'أصدر البنك الأهلي صكوكاً دولارية بقيمة 750 مليون دولار بعائد تنافسي ضمن برنامج الإصدار متوسطة الأجل.', date: new Date(Date.now() - 7200000) },
  { id: 4, title: 'stc (7010): إطلاق خدمات 5G في 15 مدينة جديدة', body: 'أعلنت شركة الاتصالات السعودية عن توسعة شبكة 5G لتغطية 15 مدينة إضافية ضمن خطة الريادة في قطاع الاتصالات.', date: new Date(Date.now() - 86400000) },
  { id: 5, title: 'سابك (2010): اجتماع الجمعية العامة غير العادية', body: 'دعت شركة سابك مساهميها لحضور اجتماع الجمعية العامة غير العادية لمناقشة إعادة هيكلة الأصول وخطط التوسع.', date: new Date(Date.now() - 172800000) },
  { id: 6, title: 'مؤشر تاسي يرتفع 1.2% بدعم قطاع البنوك والطاقة', body: 'أنهى مؤشر تاسي تداولاته على ارتفاع 1.2% مدعوماً بقطاع البنوك والطاقة وسيولة تجاوزت ملياري ريال.', date: new Date(Date.now() - 259200000) },
];

export default function News() {
  const navigate = useNavigate();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  // Protected Route Logic
  useEffect(() => {
    const savedUser = localStorage.getItem('etegah_user');
    if (!savedUser) {
      alert('⚠️ يرجى تسجيل الدخول أو إنشاء حساب أولاً للوصول إلى أخبار السوق.');
      sessionStorage.setItem('open_register_modal', 'true');
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const items = await loadNews();
      setNews(items.length > 0 ? items : FALLBACK);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="news-page container mt-8 mb-8">
      {/* مؤشر تاسي */}
      <div className="card glass" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-blue)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ margin: 0 }}>مؤشر التحليل الفني الشامل (السوق السعودي - تاسي)</h3>
          <span style={{ fontSize: '0.72rem', padding: '3px 10px', background: 'rgba(38,166,154,0.15)', color: '#26a69a', borderRadius: '12px' }}>يومي</span>
        </div>
        <div style={{ padding: '10px' }}>
          <TechnicalAnalysisWidget />
        </div>
      </div>

      {/* رأس قسم الأخبار */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1.5rem' }}>
          أخبار الشركات المدرجة في السوق السعودي
        </h2>
      </div>

      {/* محتوى */}
      {loading ? (
        <div style={{ padding: '5rem 0', textAlign: 'center', color: 'var(--text-light)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          جاري جلب أخبار اليوم...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {news.map(item => (
            <div key={item.id} className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                style={{ padding: '15px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary-blue)', marginBottom: '5px', fontWeight: 'bold' }}>
                    🕐 {fmt(item.date)}
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.97rem', lineHeight: '1.5', color: 'var(--text-color)' }}>
                    {item.title}
                  </div>
                </div>
                <div style={{ color: 'var(--text-light)', fontSize: '0.9rem', flexShrink: 0, paddingTop: '4px' }}>
                  {expandedId === item.id ? '▲' : '▼'}
                </div>
              </div>
              {expandedId === item.id && item.body && (
                <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--border-blue)' }}>
                  <p style={{ margin: '14px 0 0', fontSize: '0.9rem', color: 'var(--text-color)', lineHeight: '1.85' }}>
                    {item.body.substring(0, 500)}{item.body.length > 500 ? '...' : ''}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
