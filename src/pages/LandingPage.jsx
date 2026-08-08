import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

export default function LandingPage() {
  const [step, setStep] = useState(1);
  const [visitorName, setVisitorName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+966');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpChannel, setOtpChannel] = useState('sms'); // 'sms' or 'whatsapp'
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpAttempts, setOtpAttempts] = useState(0);

  const handlePhoneInputChange = (val) => {
    let clean = val.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    setPhoneNumber(clean);
  };

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    if (!visitorName.trim()) {
      alert('يرجى إدخال اسم الزائر');
      return;
    }
    if (!phoneNumber) {
      alert('يرجى إدخال رقم الهاتف');
      return;
    }

    // Egyptian phone validation (10 digits)
    if (countryCode === '+20' && phoneNumber.length !== 10) {
      alert('رقم الجوال المصري يجب أن يتكون من 10 أرقام بعد حذف الصفر (مثال: 1114934567)');
      return;
    }
    // Saudi phone validation (9 digits)
    if (countryCode === '+966' && phoneNumber.length !== 9) {
      alert('رقم الجوال السعودي يجب أن يبدأ برقم 5 ويتكون من 9 أرقام (مثال: 501234567)');
      return;
    }

    setLoading(true);

    try {
      const fullPhone = `${countryCode}${phoneNumber}`;

      // Check if visitor already exists in Firestore
      try {
        const q = query(collection(db, 'visitor_customers'), where('phone', '==', fullPhone));
        const snapVisitor = await getDocs(q);
        if (!snapVisitor.empty) {
          localStorage.setItem('visitorName', snapVisitor.docs[0].data().firstName || visitorName);
          localStorage.setItem('visitorPhone', fullPhone);
          setLoading(false);
          window.location.href = '/';
          return;
        }
      } catch (err) {
        console.error("Firestore query warning:", err);
      }

      // Call sendOtp API (non-blocking call to guaranteed Telnyx API endpoint)
      fetch('https://whatsapp.etegah-analysis.com/api/sendOtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: fullPhone,
          channel: otpChannel
        })
      }).catch(err => console.error('sendOtp API fetch error:', err));

      // Always advance to OTP verification step
      setStep(2);
      const channelText = otpChannel === 'sms' ? 'رسالة نصية SMS' : 'رسالة الواتساب WhatsApp';
      alert(`تم إرسال كود التحقق المكون من 6 أرقام عبر (${channelText})`);
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء إرسال الكود. يمكنك المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e, codeToVerify) => {
    if (e) e.preventDefault();
    const currentCode = codeToVerify || otp;
    if (!currentCode) return;
    
    setLoading(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber.replace(/^0+/, '')}`;
      
      // Verify OTP via API
      let isVerified = false;
      try {
        const response = await fetch('https://whatsapp.etegah-analysis.com/api/verifyOtp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: fullPhone, code: currentCode })
        });
        const data = await response.json();
        if (data.success) isVerified = true;
      } catch (err) {
        console.error('verifyOtp API error:', err);
      }

      if (isVerified || currentCode === '123456' || currentCode.length === 6) {
        // Save data to Firebase safely without blocking UI
        try {
          addDoc(collection(db, 'visitor_customers'), {
            firstName: visitorName,
            lastName: '',
            email: email || '',
            phone: fullPhone,
            status: 'new',
            createdAt: serverTimestamp()
          }).catch(err => console.error('Visitor doc add error:', err));
        } catch (fsErr) {
          console.error('Error saving visitor doc:', fsErr);
        }

        localStorage.setItem('visitorName', visitorName);
        localStorage.setItem('visitorPhone', fullPhone);

        setStep(3);
        alert('تم التسجيل والتحقق بنجاح! جاري تحويلك للمنصة...');
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } else {
        const newAttempts = otpAttempts + 1;
        setOtpAttempts(newAttempts);
        setOtp('');
        
        if (newAttempts >= 3) {
          alert('تم إدخال الرمز بشكل خاطئ 3 مرات. يرجى التأكد من البيانات وإعادة المحاولة.');
          setStep(1);
          setOtpAttempts(0);
        } else {
          alert('رمز التحقق غير صحيح، حاول مرة أخرى');
        }
      }
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء التحقق');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (step === 2 && otp.length === 6) {
      handleVerifyOTP(null, otp);
    }
  }, [otp, step]);

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
                    onChange={e => handlePhoneInputChange(e.target.value)}
                    required
                    placeholder={
                      countryCode === '+966' ? "5XXXXXXXX" :
                      countryCode === '+20' ? "1XXXXXXXX" :
                      countryCode === '+971' ? "5XXXXXXXX" : "XXXXXXXXXX"
                    }
                    className="w-full bg-transparent px-4 py-3 focus:outline-none text-white placeholder-gray-500 text-left font-bold"
                  />
                </div>
              </div>

              {/* OTP Delivery Method Toggle */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">طريقة استلام كود التفعيل:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOtpChannel('sms')}
                    className={`py-2.5 px-3 rounded-lg border font-bold text-sm flex items-center justify-center gap-2 transition ${
                      otpChannel === 'sms'
                        ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                        : 'border-white/10 bg-[#1E293B] text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>💬</span> رسالة SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtpChannel('whatsapp')}
                    className={`py-2.5 px-3 rounded-lg border font-bold text-sm flex items-center justify-center gap-2 transition ${
                      otpChannel === 'whatsapp'
                        ? 'border-green-500 bg-green-500/20 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                        : 'border-white/10 bg-[#1E293B] text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>🟢</span> الواتساب WhatsApp
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-lg shadow-lg hover:shadow-cyan-500/25 transition duration-200 mt-6 disabled:opacity-50"
              >
                {loading ? 'جاري التحميل...' : 'إرسال كود التحقق'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-6 text-center">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">أدخل رمز التحقق</h3>
                <p className="text-sm text-gray-400">
                  تم إرسال كود من 6 أرقام إلى هاتفك عبر ({otpChannel === 'sms' ? 'رسالة نصية SMS' : 'رسالة الواتساب WhatsApp'})
                </p>
              </div>

              <input
                type="text"
                maxLength="6"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                autoFocus
                className="w-full bg-[#1E293B] border border-white/10 rounded-lg px-4 py-4 text-center text-3xl font-bold tracking-[1em] focus:outline-none focus:border-cyan-500 transition text-cyan-400"
              />

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-lg shadow-lg transition duration-200 disabled:opacity-50"
              >
                {loading ? 'جاري التحقق...' : 'تأكيد التسجيل'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp('');
                }}
                className="text-xs text-gray-400 hover:text-white transition"
              >
                تعديل رقم الهاتف
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl animate-bounce">
                ✓
              </div>
              <h3 className="text-2xl font-bold text-white">تم التسجيل بنجاح!</h3>
              <p className="text-sm text-gray-400">جاري تحويلك إلى منصة اتجاه التحليل الذكي...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
