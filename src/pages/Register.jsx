import React, { useState } from 'react';
import { db, collection, addDoc, query, where, getDocs, updateDoc, getCountFromServer } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Register({ lang }) {
  const [countryCode, setCountryCode] = useState('+966');
  const [successMsg, setSuccessMsg] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [pendingUser, setPendingUser] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false); // If true, we just update the user doc, otherwise create new
  const [docRefId, setDocRefId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // For localhost/Vercel URL, use relative if possible or rely on proxy
      // In production (Vercel), API is on same domain if hosted together, 
      // but if api is separate, we need the full URL. Let's use relative and assume Vite proxy or Vercel rewrites.
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
    let phone = formData.get('phone').trim();
    const email = formData.get('email');
    
    // Auto-cleanup: remove leading zero if they typed it
    if (countryCode === '+966' && phone.startsWith('0')) {
      phone = phone.substring(1);
    } else if (countryCode === '+20' && phone.startsWith('0')) {
      phone = phone.substring(1);
    }
    
    if (countryCode === '+966' && !/^5[0-9]{8}$/.test(phone)) {
      alert('فشل التسجيل: رقم الجوال السعودي يجب أن يبدأ برقم 5 ويتكون من 9 أرقام. يرجى التأكد من اختيار كود الدولة الصحيح.');
      return;
    }
    if (countryCode === '+20' && !/^1[0-9]{9}$/.test(phone)) {
      alert('فشل التسجيل: رقم الهاتف المصري يجب أن يبدأ برقم 1 ويتكون من 10 أرقام (مثال: 1XXXXXXXX). يرجى التأكد من اختيار كود الدولة الصحيح.');
      return;
    }

    const newUser = {
      name: formData.get('name'),
      email: email,
      phone: phone,
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

      // Instead of writing to Firebase immediately, we send OTP
      const response = await fetch('https://etegah-whatsapp-api.vercel.app/api/sendOtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: newUser.country + newUser.phone
        })
      });
      const data = await response.json();

      if (data.success) {
        setPendingUser(loggedInUser);
        setIsUpdating(willUpdate);
        setDocRefId(existingDocId);
        setVerificationStep(true);
        setSuccessMsg('تم إرسال كود التحقق في رسالة نصية SMS إلى رقمك.');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert(data.message || 'حدث خطأ في إرسال الرسالة.');
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
          {verificationStep ? "تأكيد كود التحقق 🔒" : "إنشاء حساب جديد"}
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
                البريد الإلكتروني (مطلوب)
              </label>
              <input 
                name="email"
                type="email" 
                placeholder="أدخل بريدك الإلكتروني"
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-blue)', background: 'var(--dark-navy)', color: 'white' }}
                required 
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
                    cursor: 'pointer'
                  }}
                >
                  <option value="+966">🇸🇦 +966</option>
                  <option value="+20">🇪🇬 +20</option>
                </select>
                <input 
                  name="phone"
                  type="tel" 
                  placeholder={countryCode === '+966' ? "5XXXXXXXX" : "1XXXXXXXX"}
                  disabled={isLoading}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    borderRadius: '0 6px 6px 0', 
                    border: '1px solid var(--border-blue)', 
                    background: 'var(--dark-navy)', 
                    color: 'white',
                    outline: 'none'
                  }}
                  required 
                />
              </div>
              {countryCode === '+20' && (
                <small style={{ display: 'block', marginTop: '5px', color: 'var(--text-light)', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
                  أدخل رقم الهاتف بدون الصفر بالبداية (مثال: 10XXXXX)
                </small>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="button primary" style={{ width: '100%', padding: '12px', fontSize: '1.1rem', marginTop: '1rem', opacity: isLoading ? 0.7 : 1 }}>
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
