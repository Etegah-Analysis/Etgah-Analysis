import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LineChart,
  ListTree,
  ShieldAlert,
  BrainCircuit,
  CheckCircle2,
  ArrowRightCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const ServiceCard = ({ service, isExpanded, onClick }) => (
  <div
    className={`card glass service-card-interactive ${isExpanded ? 'expanded' : ''}`}
    style={{
      padding: '0',
      cursor: 'pointer',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      border: isExpanded ? '1px solid var(--primary-blue)' : '1px solid rgba(255,255,255,0.1)',
      background: isExpanded ? 'rgba(0, 188, 212, 0.08)' : 'var(--card-bg)'
    }}
    onClick={onClick}
  >
    {/* Header / Visible Part */}
    <div style={{ padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="flex items-center gap-4">
        <div style={{
          background: 'var(--primary-blue-alpha)',
          padding: '10px',
          borderRadius: '10px',
          color: 'var(--primary-blue)'
        }}>
          <service.icon size={24} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{service.title}</h3>
          {!isExpanded && (
            <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '3px', maxWidth: '450px' }}>
              {service.description}
            </p>
          )}
        </div>
      </div>
      <div style={{ color: 'var(--primary-blue)' }}>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>
    </div>

    {/* Expanded Detail Part */}
    <div style={{
      maxHeight: isExpanded ? '1000px' : '0',
      opacity: isExpanded ? 1 : 0,
      transition: 'all 0.4s ease',
      padding: isExpanded ? '0 1.5rem 1.5rem' : '0 1.5rem',
      borderTop: isExpanded ? '1px solid rgba(255,255,255,0.05)' : 'none'
    }}>
      <div style={{ paddingTop: '1.2rem' }}>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-light)', lineHeight: '1.7', marginBottom: '1.5rem' }}>
          {service.fullDescription}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>

          <div>
            <h4 style={{ color: 'var(--primary-blue)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} /> المميزات والتحليلات
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {service.features.map((f, i) => (
                <li key={i} style={{ marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary-blue)' }}></div>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{ color: 'var(--primary-blue)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightCircle size={18} /> مخرجات الخدمة
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {service.outputs.map((o, i) => (
                <span key={i} style={{
                  fontSize: '0.8rem',
                  padding: '5px 12px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>{o}</span>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const [expandedId, setExpandedId] = useState(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const serviceId = searchParams.get('service');
    if (serviceId) {
      setExpandedId(serviceId);
      // Scroll to the element
      setTimeout(() => {
        const el = document.getElementById(serviceId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [searchParams]);


  const services = [
    {
      id: 'ai-portfolio',
      icon: BrainCircuit,
      title: "التحليل الذكي للمحفظة الاستثمارية",
      description: "تحليل شامل للمحفظة باستخدام تقنيات الذكاء الاصطناعي لتحديد مستوى المخاطرة.",
      fullDescription: "نستخدم أقوى خوارزميات الذكاء الاصطناعي لتحليل محفظتك الاستثمارية بشكل دقيق، مما يساعدك على اكتشاف نقاط الضعف والقوة وإعادة توازن أصولك بما يتوافق مع أهدافك المالية السلوكية.",
      features: ["تحديد مستوى المخاطرة", "تحليل توزيع القطاعات", "فرز الأسهم الضعيفة والقوية", "كشف فرص التحسين", "اقتراح إعادة التوازن", "تقييم الأداء المتوقع"],
      outputs: ["تقرير ذكي مفصل", "تقييم الـ Risk Score", "توصيات تحسين المحفظة", "تنبيهات فورية للمتغيرات"]
    },
    {
      id: 'smart-lists',
      icon: ListTree,
      title: "إنشاء قوائم ذكية حسب الاحتياج",
      description: "نظام تجميع تلقائي للأسهم بناءً على نوع التداول أو القطاع أو الشرعية.",
      fullDescription: "يقوم النظام بتجميع الأسهم تلقائيًا بناءً على نوع التداول أو القطاع لتوفير وقتك وجهدك في البحث اليدوي المجهد.",
      features: ["قائمة الأسهم النقية/الشرعية", "قائمة البنوك والطاقة", "قائمة البتروكيماويات", "الأسهم الاستثمارية", "المضاربة السريعة", "الأسهم ذات السيولة العالية"],
      outputs: ["تحديث تلقائي لحظي", "فلترة ذكية متقدمة", "بحث سريع", "تصنيف حسب الأداء"]
    },
    {
      id: 'support-resistance',
      icon: LineChart,
      title: "خدمة الدعم والمقاومة بكود السهم",
      description: "تحليل فني فوري وشامل لمناطق الارتداد والاتجاه بمجرد إدخال كود السهم.",
      fullDescription: "احصل على خارطة طريق لأي سهم. بمجرد إدخال الرمز، يقوم النظام برسم المستويات الفنية الحرجة وتحديد اتجاه السيولة بدقة متناهية.",
      features: ["تحديد مناطق الدعم والمقاومة", "نقاط الارتداد القوية", "اختراقات محتملة", "اتجاه السهم وقوة الترند", "رسم بياني تفاعلي", "إشارات دخول وخروج"],
      outputs: ["إشارات دقيقة", "تنبيهات الكسر", "تنبيهات الاختراق"]
    },
    {
      id: 'stuck-stocks',
      icon: ShieldAlert,
      title: "أفضل استراتيجية للأسهم المعلقة",
      description: "خطة خروج أو تعزيز ذكية للأسهم الخاسرة باستخدام نماذج AI السلوكية.",
      fullDescription: "تحليل الأسهم الخاسرة أو المعلقة باستخدام AI لتحديد أفضل سيناريو تعامل يحمي رأس مالك ويقلل من فترات الانتظار.",
      features: ["سيناريو التبريد (Averaging)", "الاحتفاظ أو التخفيف", "وقف الخسارة والتعزيز", "إعادة تدوير السيولة", "خطة خروج تدريجية", "سلوك السهم التاريخي"],
      outputs: ["سعر التعلق", "الكمية والوزن النسبي", "وضع السوق العام", "توصية AI النهائية"]
    }
  ];

  const handleToggle = (e, id) => {
    e.stopPropagation(); // Prevent the container's onClick (close) from firing
    setExpandedId(expandedId === id ? null : id);
  };


  return (
    <div className="dashboard-page container mt-8 mb-16 px-4" onClick={() => setExpandedId(null)}>


      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: '800' }}>جميع خدمات منصة اتجاه التحليل الذكي</h1>
        <p style={{ color: 'var(--text-light)', fontSize: '1.1rem' }}>
          اضغط على أي خدمة لاستكشاف تفاصيلها ومميزاتها
        </p>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2rem',
        maxWidth: '1000px',
        margin: '0 auto'
      }}>
        {services.map((service) => (
          <div key={service.id} id={service.id}>
            <ServiceCard
              service={service}
              isExpanded={expandedId === service.id}
              onClick={(e) => handleToggle(e, service.id)}
            />
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .service-card-interactive:hover {
          border-color: var(--primary-blue) !important;
          background: rgba(0, 188, 212, 0.04);
        }
        .service-card-interactive.expanded {
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }
      `}} />
    </div>
  );
}
