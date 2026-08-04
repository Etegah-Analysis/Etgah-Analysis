import React, { useState } from 'react';
import { db, collection, addDoc, query, where, getDocs, updateDoc, getCountFromServer } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Register({ lang }) {
  const [countryCode, setCountryCode] = useState('+966');
  const [phone, setPhone] = useState('');
  const [otpChannel, setOtpChannel] = useState('sms'); // 'sms' or 'whatsapp'
  const [successMsg, setSuccessMsg] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [pendingUser, setPendingUser] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false); // If true, we just update the user doc, otherwise create new
  const [docRefId, setDocRefId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // التعرف التلقائي الذكي على رمز الدولة لزوار المنصة الرئيسية
  const handlePhoneInputChange = (val) => {
    let cleanVal = val.trim();
    
    if (cleanVal.startsWith('+20') || cleanVal.startsWith('20')) {
      setCountryCode('+20');
      cleanVal = cleanVal.replace(/^\+?20/, '');
    } else if (cleanVal.startsWith('+966') || cleanVal.startsWith('966')) {
      setCountryCode('+966');
      cleanVal = cleanVal.replace(/^\+?966/, '');
    } else if (cleanVal.startsWith('+971') || cleanVal.startsWith('971')) {
      setCountryCode('+971');
      cleanVal = cleanVal.replace(/^\+?971/, '');
    } else if (cleanVal.startsWith('+1') && cleanVal.length > 5) {
      setCountryCode('+1');
      cleanVal = cleanVal.replace(/^\+?1/, '');
    } else if (/^0?1[0125]/.test(cleanVal)) {
      // مصر (010, 011, 012, 015)
      setCountryCode('+20');
      if (cleanVal.startsWith('0')) cleanVal = cleanVal.substring(1);
    } else if (/^0?5[0-9]/.test(cleanVal) && cleanVal.length <= 10) {
      // السعودية (05x)
      setCountryCode('+966');
      if (cleanVal.startsWith('0')) cleanVal = cleanVal.substring(1);
    } else if (/^0?5[024568]/.test(cleanVal) && cleanVal.length === 9) {
      // الإمارات (050, 052, 054, 055, 056, 058)
      setCountryCode('+971');
      if (cleanVal.startsWith('0')) cleanVal = cleanVal.substring(1);
    }

    setPhone(cleanVal);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('https://etegah-whatsapp-api.vercel.app/api/verifyOtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: pendingUser.country + pendingUser.phone,
          code: otp
        })
      });
      const data = await response.json();
      
      if (data.success) {
        // OTP Success! Now save to Firebase
        if (isUpdating && docRefId) {
          const { doc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', docRefId), {
            phone: pendingUser.phone,
            country: pendingUser.country,
            name: pendingUser.name
          });
        } else {
          await addDoc(collection(db, 'users'), pendingUser);
        }

        localStorage.setItem('etegah_user', JSON.stringify(pendingUser));
        setSuccessMsg('تم تأكيد رقمك بنجاح! جاري التوجيه 🔄');
        setTimeout(() => {
          setSuccessMsg('');
          window.location.href = '/';
        }, 1500);
      } else {
        alert(data.message || 'الكود غير صحيح، يرجى المحاولة مرة أخرى.');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء التحقق.');
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    const formData = new FormData(e.target);
    let cleanPhone = (phone || formData.get('phone') || '').trim();
    const email = formData.get('email');
    
    // Auto-cleanup: remove leading zero if they typed it
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }
    
    if (countryCode === '+966' && !/^5[0-9]{8}$/.test(cleanPhone)) {
      alert('فشل التسجيل: رقم الجوال السعودي يجب أن يبدأ برقم 5 ويتكون من 9 أرقام. يرجى التأكد من اختيار كود الدولة الصحيح.');
      setIsLoading(false);
      return;
    }
    if (countryCode === '+20' && !/^1[0-9]{9}$/.test(cleanPhone)) {
      alert('فشل التسجيل: رقم الهاتف المصري يجب أن يبدأ برقم 1 ويتكون من 10 أرقام (مثال: 1XXXXXXXX). يرجى التأكد من اختيار كود الدولة الصحيح.');
      setIsLoading(false);
      return;
    }
    if (countryCode === '+971' && !/^5[0-9]{8}$/.test(cleanPhone)) {
      alert('فشل التسجيل: رقم الهاتف الإماراتي يجب أن يبدأ برقم 5 ويتكون من 9 أرقام (مثال: 5XXXXXXXX).');
      setIsLoading(false);
      return;
    }
    if (countryCode === '+1' && !/^[2-9][0-9]{9}$/.test(cleanPhone)) {
      alert('فشل التسجيل: يرجى كتابة الرقم الأمريكي من 10 أرقام.');
      setIsLoading(false);
      return;
    }

    const newUser = {
      name: formData.get('name'),
      email: email,
      phone: cleanPhone,
      country: countryCode,
      date: new Date().toLocaleString('ar-EG'),
      timestamp: new Date()
    };

    try {
      // Get the total count of users to assign sequential number
      const coll = collection(db, 'users');
      const snapshotCount = await getCountFromServer(coll);
      const userCount = snapshotCount.data().count;
      newUser.sequenceNumber = userCount + 1;

      const emailQuery = query(collection(db, 'users'), where('email', '==', newUser.email));
      const phoneQuery = query(collection(db, 'users'), where('phone', '==', newUser.phone));
      
      const [emailSnapshot, phoneSnapshot] = await Promise.all([
        getDocs(emailQuery),
        getDocs(phoneQuery)
      ]);

      let loggedInUser = newUser;
      let willUpdate = false;
      let existingDocId = null;

      if (!emailSnapshot.empty) {
        const docSnap = emailSnapshot.docs[0];
        const existingUser = docSnap.data();
        const p1 = existingUser.phone.toString().trim();
        const p2 = newUser.phone.toString().trim();
        
        if (p1 === p2 || p1.includes(p2) || p2.includes(p1) || p1.slice(0, 8) === p2.slice(0, 8)) {
          existingUser.phone = newUser.phone;
          existingUser.country = newUser.country;
          existingUser.name = newUser.name;
          
          willUpdate = true;
          existingDocId = docSnap.id;
          loggedInUser = existingUser;
        } else {
          alert('هذا البريد الإلكتروني مسجل مسبقاً لدينا برقم هاتف آخر.');
          setIsLoading(false);
          return;
        }
      } else if (!phoneSnapshot.empty) {
        const docSnap = phoneSnapshot.docs[0];
        const existingUser = docSnap.data();
        if (existingUser.email.trim().toLowerCase() === newUser.email.trim().toLowerCase()) {
          loggedInUser = existingUser;
        } else {
          alert('رقم الهاتف هذا مسجل مسبقاً لدينا ببريد إلكتروني آخر.');
          setIsLoading(false);
          return;
        }
      }

      // Send OTP via Telnyx according to user choice
      const response = await fetch('https://etegah-whatsapp-api.vercel.app/api/sendOtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: newUser.country + newUser.phone,
          channel: otpChannel
        })
      });
      const data = await response.json();

      if (data.success) {
        setPendingUser(loggedInUser);
        setIsUpdating(willUpdate);
        setDocRefId(existingDocId);
        setVerificationStep(true);
        const channelName = otpChannel === 'sms' ? 'رسالة نصية SMS' : 'رسالة الواتساب WhatsApp';
        setSuccessMsg(`تم إرسال كود التحقق عبر (${channelName}) إلى رقمك بنجاح.`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert(data.message || 'حدث خطأ في إرسال كود التحقق.');
      }
      
    } catch (err) {
      console.error(err);
      alert('حدث خطأ، يرجى المحاولة لاحقاً.');
    }
    setIsLoading(false);
  };

  return (
    <div className="register-page container flex items-center justify-center" style={{ minHeight: '70vh' }}>
      <div className="card glass" style={{ width: '100%', maxWidth: '500px' }}>
        <h2 className="text-center" style={{ marginBottom: '2rem' }}>
          {verificationStep ? "تأكيد كود التحقق 🔒" : "تسجيل الدخول للمنصة"}
        </h2>
        
        {successMsg && (
          <div style={{
            padding: '15px',
            background: 'rgba(0, 200, 83, 0.1)',
            border: '1px solid rgba(0, 200, 83, 0.3)',
            borderRadius: '8px',
            color: '#00c853',
            textAlign: 'center',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
            fontSize: '0.95rem'
          }}>
            {successMsg}
          </div>
        )}

        {!verificationStep ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                اسم الزائر (مطلوب)
              </label>
              <input 
                name="name"
                type="text" 
                placeholder="أدخل اسمك بالكامل"
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-blue)', background: 'var(--dark-navy)', color: 'white' }}
                required 
                disabled={isLoading}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                البريد الإلكتروني (اختياري)
              </label>
              <input 
                name="email"
                type="email" 
                placeholder="أدخل بريدك الإلكتروني"
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-blue)', background: 'var(--dark-navy)', color: 'white' }}
                disabled={isLoading}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                رقم الهاتف (مطلوب)
              </label>
              <div style={{ display: 'flex', direction: 'ltr' }}>
                <select 
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={isLoading}
                  style={{
                    padding: '12px 8px', 
                    background: 'var(--border-blue)', 
                    border: '1px solid var(--border-blue)', 
                    borderRight: 'none',
                    borderRadius: '6px 0 0 6px',
                    color: 'white',
                    outline: 'none',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 'bold'
                  }}
                >
                  <option value="+966">SA +966 🇸🇦</option>
                  <option value="+20">EG +20 🇪🇬</option>
                  <option value="+971">AE +971 🇦🇪</option>
                  <option value="+1">US +1 🇺🇸</option>
                </select>
                <input 
                  name="phone"
                  type="tel" 
                  value={phone}
                  onChange={(e) => handlePhoneInputChange(e.target.value)}
                  placeholder={
                    countryCode === '+966' ? "5XXXXXXXX" : 
                    countryCode === '+20' ? "1XXXXXXXX" : 
                    countryCode === '+971' ? "5XXXXXXXX" : "XXXXXXXXXX"
                  }
                  disabled={isLoading}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    borderRadius: '0 6px 6px 0', 
                    border: '1px solid var(--border-blue)', 
                    background: 'var(--dark-navy)', 
                    color: 'white',
                    outline: 'none',
                    fontWeight: 'bold'
                  }}
                  required 
                />
              </div>
            </div>

            {/* OTP Delivery Method Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                طريقة استلام كود التفعيل:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setOtpChannel('sms')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: otpChannel === 'sms' ? '2px solid #00d2ff' : '1px solid var(--border-blue)',
                    background: otpChannel === 'sms' ? 'rgba(0, 210, 255, 0.2)' : 'var(--dark-navy)',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  📱 رسالة نصية (SMS)
                </button>
                <button
                  type="button"
                  onClick={() => setOtpChannel('whatsapp')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: otpChannel === 'whatsapp' ? '2px solid #25D366' : '1px solid var(--border-blue)',
                    background: otpChannel === 'whatsapp' ? 'rgba(37, 211, 102, 0.2)' : 'var(--dark-navy)',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  💬 واتساب (WhatsApp)
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="button primary" style={{ width: '100%', padding: '12px', fontSize: '1.1rem', marginTop: '0.5rem', opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? 'جاري التحقق...' : 'تسجيل حساب'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', textAlign: 'center' }}>
                أدخل الكود المكون من 6 أرقام المرسل إلى جوالك
              </label>
              <input 
                type="text" 
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="XXXXXX"
                maxLength="6"
                disabled={isLoading}
                style={{ 
                  width: '100%', 
                  padding: '15px', 
                  borderRadius: '8px', 
                  border: '2px solid var(--border-blue)', 
                  background: 'var(--dark-navy)', 
                  color: 'white',
                  fontSize: '1.5rem',
                  letterSpacing: '10px',
                  textAlign: 'center',
                  outline: 'none'
                }}
                required 
              />
            </div>
            
            <button type="submit" disabled={isLoading || otp.length !== 6} className="button primary" style={{ width: '100%', padding: '12px', fontSize: '1.1rem', marginTop: '1rem', opacity: (isLoading || otp.length !== 6) ? 0.7 : 1 }}>
              {isLoading ? 'جاري التأكيد...' : 'تأكيد الحساب'}
            </button>
            
            <button 
              type="button" 
              onClick={() => { setVerificationStep(false); setOtp(''); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-light)', textDecoration: 'underline', cursor: 'pointer', marginTop: '10px' }}
            >
              تعديل رقم الهاتف
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
