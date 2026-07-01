import React from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  Cpu, 
  ShieldCheck, 
  Zap, 
  Target, 
  Globe, 
  BarChart3,
  ArrowRight
} from 'lucide-react';
import logoImg from '../assets/logo.jpg';


export default function Home({ onOpenRegister }) {

  return (
    <div className="home-page animate-fade-in">
      
      {/* Hero Section */}
      <section className="hero" style={{ 
        minHeight: '90vh', 
        display: 'flex', 
        alignItems: 'center', 
        position: 'relative', 
        overflow: 'hidden',
        background: 'var(--dark-navy)'
      }}>
        <div className="container flex flex-col md:flex-row items-center gap-12" style={{ position: 'relative', zIndex: 2 }}>
          <div className="hero-content" style={{ flex: 1, textAlign: 'right' }}>
            <div className="badge-modern">
              مستقبل التداول الذكي في السوق السعودي
            </div>
            <h1 className="hero-title">
              نحو قرارات أدق... <br/>
              <span style={{ color: 'var(--primary-blue)' }}>برؤية أعمق</span>
            </h1>
            <p className="hero-subtitle">
              منصة "اتجاه" تدمج خبرة أسواق المال مع قوة الذكاء الاصطناعي لتوفر لك تحليلاً احترافياً لحظياً يساعدك على اقتناص الفرص وتجنب المخاطر.
            </p>
            <div className="flex gap-4">
              <button onClick={onOpenRegister} className="button primary hero-btn">
                ابدأ رحلتك الآن
              </button>
              <Link to="/dashboard" className="button hero-btn-outline">
                استعرض الخدمات
              </Link>
            </div>
          </div>
          
          <div className="hero-visual" style={{ flex: 1, position: 'relative' }}>
            <div className="hero-logo-wrapper" style={{ 
              borderRadius: '30px', 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <img src={logoImg} alt="Etegah Logo" style={{ width: '100%', maxWidth: '400px', display: 'block' }} />
            </div>
            {/* Floating logo removed as requested */}

          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="hero-glow"></div>
      </section>

      {/* About Section - "What is Etegah?" */}
      <section style={{ padding: '8rem 0', background: 'rgba(255,255,255,0.02)' }}>
        <div className="container">
          <div className="flex flex-col md:flex-row gap-24 items-center">
            <div style={{ flex: 1, order: 2 }}>
              <div className="about-grid">
                <div className="card glass about-card">
                  <ShieldCheck size={40} color="var(--primary-blue)" />
                  <h4>أمان تام</h4>
                </div>
                <div className="card glass about-card offset">
                  <Cpu size={40} color="var(--primary-blue)" />
                  <h4>ذكاء اصطناعي</h4>
                </div>
                <div className="card glass about-card">
                  <Zap size={40} color="var(--primary-blue)" />
                  <h4>سرعة لحظية</h4>
                </div>
                <div className="card glass about-card offset">
                  <Globe size={40} color="var(--primary-blue)" />
                  <h4>تغطية شاملة</h4>
                </div>
              </div>
            </div>
            
            <div style={{ flex: 1.2 }}>
              <h2 style={{ fontSize: '2.8rem', marginBottom: '1.5rem' }}>ما هي منصة اتجاه؟</h2>
              <p className="about-text">
                منصة "اتجاه" هي شريكك الرقمي في عالم التداول، نجمع بين عراقة التحليل المالي وأحدث ابتكارات الذكاء الاصطناعي (AI) لتمكين المتداول في السوق السعودي من قراءة السوق برؤية أعمق، بعيداً عن العشوائية.
              </p>
              <p className="about-text">
                نحن نقدم أدوات تحليل لحظية، رصد للسيولة، وتحديد دقيق لمناطق العرض والطلب لتجعل قرارك الاستثماري مبنياً على البيانات لا العاطفة. مهمتنا هي تحويل البيانات المعقدة إلى فرص استثمارية واضحة.
              </p>
              <ul className="about-list">
                <li><ArrowRight size={18} color="var(--primary-blue)" /> دعم فني متواصل</li>
                <li><ArrowRight size={18} color="var(--primary-blue)" /> تقارير يومية ذكية</li>
                <li><ArrowRight size={18} color="var(--primary-blue)" /> تحليل 200+ شركة</li>
                <li><ArrowRight size={18} color="var(--primary-blue)" /> تحديثات لحظية</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="container" style={{ padding: '6rem 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>لماذا يختار المتداولون "اتجاه"؟</h2>
          <p style={{ color: 'var(--text-light)', maxWidth: '700px', margin: '0 auto' }}>قوة التكنولوجيا بين يديك لتحقيق أهدافك المالية.</p>
        </div>
        
        <div className="value-grid">
          <div className="card glass value-card">
            <div className="value-icon-box">
              <BarChart3 size={24} color="var(--primary-blue)" />
            </div>
            <h3 style={{ fontSize: '1.1rem' }}>تحليل اتجاه فوري</h3>
            <p style={{ fontSize: '0.85rem' }}>رصد دقيق لاتجاهات السوق وتغيراتها قبل الجميع باستخدام خوارزميات تعلم الآلة.</p>
          </div>
          
          <div className="card glass value-card">
            <div className="value-icon-box">
              <Target size={24} color="var(--primary-blue)" />
            </div>
            <h3 style={{ fontSize: '1.1rem' }}>نقاط دخول وخروج</h3>
            <p style={{ fontSize: '0.85rem' }}>تحديد مستويات الدعم والمقاومة الحرجة ونقاط الانعكاس المحتملة بدقة متناهية.</p>
          </div>
          
          <div className="card glass value-card">
            <div className="value-icon-box">
              <ShieldCheck size={24} color="var(--primary-blue)" />
            </div>
            <h3 style={{ fontSize: '1.1rem' }}>إدارة المخاطر</h3>
            <p style={{ fontSize: '0.85rem' }}>أدوات متطورة لتقييم مخاطر المحفظة وتقديم توصيات ذكية للحفاظ على رأس المال.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mt-8 mb-16">
        <div className="cta-box card glass">
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>ابدأ استثمارك بذكاء اليوم</h2>
          <p className="cta-text">
            انضم إلى مئات المتداولين الذين يستخدمون منصة اتجاه يومياً لتحسين أدائهم في السوق السعودي.
          </p>
          <button onClick={onOpenRegister} className="button primary cta-btn">
            إنشاء حساب مجاني
          </button>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        .home-page { animation: fadeIn 0.8s ease-out; }
        .badge-modern {
          display: inline-block; padding: 6px 14px; background: rgba(0, 188, 212, 0.1); 
          borderRadius: 20px; border: 1px solid var(--primary-blue); color: var(--primary-blue);
          font-size: 0.85rem; font-weight: bold; margin-bottom: 1.2rem;
        }
        .hero-title { font-size: 3.2rem; line-height: 1.2; margin-bottom: 1.2rem; font-weight: 800; }
        .hero-subtitle { font-size: 1.15rem; color: var(--text-light); margin-bottom: 2rem; max-width: 600px; line-height: 1.7; }
        .hero-btn { font-size: 1rem; padding: 12px 36px; border-radius: 12px; }
        .hero-btn-outline { font-size: 1rem; padding: 12px 36px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }
        .hero-image-wrapper { 
          border-radius: 30px; overflow: hidden; box-shadow: 0 20px 50px rgba(0, 188, 212, 0.2);
          border: 1px solid rgba(255,255,255,0.1); transform: perspective(1000px) rotateY(-5deg);
        }
        .floating-card { position: absolute; padding: 15px 25px; border-radius: 15px; z-index: 10; }
        .hero-glow { 
          position: absolute; top: -10%; right: -5%; width: 500px; height: 500px; 
          background: radial-gradient(circle, rgba(0, 188, 212, 0.1) 0%, transparent 70%); z-index: 1; 
        }
        .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .about-card { padding: 1.2rem; text-align: center; }
        .about-card h4 { font-size: 0.85rem; margin-top: 8px; }
        .about-card.offset { margin-top: 1.5rem; }
        .about-text { font-size: 1rem; line-height: 1.7; color: var(--text-light); margin-bottom: 1.5rem; }
        .about-list { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; font-size: 0.85rem; }
        .about-list li { display: flex; align-items: center; gap: 8px; }
        .value-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
        .value-card { padding: 1.5rem; text-align: center; }
        .value-icon-box { background: var(--primary-blue-alpha); padding: 15px; border-radius: 50%; width: fit-content; margin: 0 auto 1.2rem; }
        .cta-box { 
          padding: 3rem; text-align: center; 
          background: linear-gradient(135deg, var(--secondary-navy) 0%, var(--dark-navy) 100%) !important;
          border: 1px solid var(--primary-blue) !important;
        }
        .cta-text { font-size: 1rem; color: var(--text-light); margin-bottom: 2rem; max-width: 600px; margin: 0 auto 2rem; }
        .cta-btn { padding: 12px 40px; font-size: 1rem; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        @media (max-width: 768px) {
          .hero-title { font-size: 2.5rem !important; }
          .hero-visual { display: none; }
          .about-list { grid-template-columns: 1fr; }
          .about-card.offset { margin-top: 0; }
        }
      `}} />
    </div>
  );
}
