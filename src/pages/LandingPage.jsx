import React, { useState } from 'react';
import { db, collection, addDoc, getDocs, query, where, serverTimestamp } from '../firebase';
import { toast } from 'react-hot-toast';
import { MessageCircle } from 'lucide-react';

export default function LandingPage() {
  const [visitorName, setVisitorName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+966');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: form, 2: OTP, 3: Success
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    document.title = 'منصة اتجاه التحليل الذكي - الصفحة الرئيسية';
  }, []);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!visitorName || !phoneNumber) {
      toast.error('الرجاء إدخال جميع الحقول المطلوبة');
      return;
    }

    setLoading(true);
    const fullPhone = `${countryCode}${phoneNumber.replace(/^0+/, '')}`; // Remove leading zeros if any

    try {
      // Check if blocked
      const blockedRef = collection(db, 'blocked_numbers');
      const q = query(blockedRef, where('phone', '==', fullPhone));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        toast.error('عذراً، لا يمكن التسجيل بهذا الرقم حالياً.');
        setLoading(false);
        return;
      }

      // Check if already registered in CRM
      const visitorsRef = collection(db, 'visitor_customers');
      const qVisitor = query(visitorsRef, where('phone', '==', fullPhone));
      const snapVisitor = await getDocs(qVisitor);
      
      if (!snapVisitor.empty) {
        // User already exists, skip OTP
        const existingUser = snapVisitor.docs[0].data();
        localStorage.setItem('visitorName', existingUser.firstName || visitorName);
        toast.success('أهلاً بك مجدداً! جاري تحويلك للمنصة...');
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
        return; // Stop here, no OTP sent
      }

      // Send OTP via Twilio API
      const response = await fetch('https://whatsapp.etegah-analysis.com/api/sendOtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone })
      });
      const data = await response.json();

      if (data.success) {
        setStep(2);
        toast.success('تم إرسال كود التحقق في رسالة نصية SMS');
      } else {
        toast.error(data.message || 'فشل إرسال كود التحقق');
      }
    } catch (error) {
      console.error(error);
      toast.error(`حدث خطأ أثناء الاتصال بالخادم`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp) return;
    
    setLoading(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber.replace(/^0+/, '')}`;
      
      // Verify OTP via Twilio API
      const response = await fetch('https://whatsapp.etegah-analysis.com/api/verifyOtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, code: otp })
      });
      const data = await response.json();

      if (data.success) {
        // Save data to Firebase
        await addDoc(collection(db, 'visitor_customers'), {
          firstName: visitorName, // Saved as firstName for compatibility with your DB
          lastName: '',
          email: email || '',
          phone: fullPhone,
          status: 'new',
          createdAt: serverTimestamp()
        });

        localStorage.setItem('visitorName', visitorName);

        setStep(3);
        toast.success('تم التسجيل بنجاح!');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        toast.error(data.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
      }
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء التحقق');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-white flex flex-col font-sans relative overflow-hidden" dir="rtl">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div 
        className="absolute inset-0 opacity-5 bg-center bg-no-repeat pointer-events-none z-0"
        style={{ backgroundImage: "url('/logo.jpg')", backgroundSize: "800px", backgroundPosition: "center" }}
      ></div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="bg-[#131B2C]/90 backdrop-blur-xl border border-white/5 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex justify-center mb-6">
             <img src="/logo.jpg" alt="Logo" className="w-20 h-20 rounded-full object-cover border-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
          </div>
          <h2 className="text-3xl font-bold text-center mb-8 text-white">تسجيل الدخول للمنصة</h2>

          {step === 1 && (
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">اسم الزائر (مطلوب)</label>
                <input
                  type="text"
                  value={visitorName}
                  onChange={e => setVisitorName(e.target.value)}
                  required
                  placeholder="أدخل اسمك بالكامل"
                  className="w-full bg-[#1E293B] border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500 transition text-white"
                />
              </div>
              <p className="text-xs text-center text-gray-400">يمكنك كتابة الاسم بالعربية أو الإنجليزية</p>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="أدخل بريدك الإلكتروني"
                  className="w-full bg-[#1E293B] border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500 transition text-white placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">رقم الهاتف (مطلوب)</label>
                <div className="flex bg-[#1E293B] border border-white/10 rounded-lg focus-within:border-cyan-500 transition overflow-hidden" dir="ltr">
                  <select 
                    value={countryCode} 
                    onChange={e => setCountryCode(e.target.value)}
                    className="bg-[#1E293B] text-white px-3 py-3 border-r border-white/10 focus:outline-none outline-none appearance-none font-bold"
                  >
                    <option value="+966">SA +966</option>
                    <option value="+20">EG +20</option>
                    <option value="+971">AE +971</option>
                    <option value="+1">US +1</option>
                  </select>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    required
                    placeholder="5XXXXXXXX"
                    className="w-full bg-transparent px-4 py-3 focus:outline-none text-white placeholder-gray-500 text-left"
                  />
                </div>
              </div>


              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-400 hover:bg-cyan-500 text-[#0B1120] font-bold text-lg py-4 rounded-lg transition-colors mt-6 shadow-[0_0_15px_rgba(34,211,238,0.3)] disabled:opacity-50"
              >
                {loading ? 'جاري التحميل...' : 'تسجيل حساب'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-6 text-center">
              <div className="mb-4">
                <h3 className="text-xl font-bold mb-2">أدخل رمز التحقق</h3>
                <p className="text-gray-400 text-sm">تم إرسال كود من 6 أرقام إلى هاتفك في رسالة نصية (SMS)</p>
              </div>
              
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                required
                maxLength="6"
                placeholder="000000"
                dir="ltr"
                className="w-full text-center tracking-widest text-2xl font-bold bg-[#1E293B] border border-white/10 rounded-lg px-4 py-4 focus:outline-none focus:border-cyan-500 transition text-white"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-400 hover:bg-cyan-500 text-[#0B1120] font-bold text-lg py-4 rounded-lg transition-colors mt-6 shadow-[0_0_15px_rgba(34,211,238,0.3)] disabled:opacity-50"
              >
                {loading ? 'جاري التحقق...' : 'تأكيد التسجيل'}
              </button>
              
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="text-gray-400 text-sm hover:text-white transition mt-4"
              >
                تعديل رقم الهاتف
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center space-y-4 py-8">
              <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-green-400">تم التسجيل بنجاح!</h3>
              <p className="text-gray-300">شكراً لك، سيتم التواصل معك في أقرب وقت.</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating WhatsApp Button */}
      <a 
        href="https://wa.me/16813223358" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 bg-green-500 text-white p-4 rounded-full shadow-[0_4px_14px_rgba(34,197,94,0.5)] hover:bg-green-600 hover:scale-110 transition-transform z-50 flex items-center justify-center"
        title="تواصل معنا عبر واتساب"
      >
        <MessageCircle size={32} />
      </a>
    </div>
  );
}
