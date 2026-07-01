import React, { useState } from 'react';
import { db, collection, addDoc, query, where, getDocs, updateDoc } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Register({ lang }) {
  const [countryCode, setCountryCode] = useState('+966');
  const [successMsg, setSuccessMsg] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const navigate = useNavigate();



  const handleSubmit = async (e) => {
    e.preventDefault();
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
      email: email,
      phone: phone,
      country: countryCode,
      date: new Date().toLocaleString('ar-EG'),
      timestamp: new Date()
    };

    try {
      const emailQuery = query(collection(db, 'users'), where('email', '==', newUser.email));
      const phoneQuery = query(collection(db, 'users'), where('phone', '==', newUser.phone));
      
      const [emailSnapshot, phoneSnapshot] = await Promise.all([
        getDocs(emailQuery),
        getDocs(phoneQuery)
      ]);

      let loggedInUser = newUser;

      if (!emailSnapshot.empty) {
        const docSnap = emailSnapshot.docs[0];
        const existingUser = docSnap.data();
        const p1 = existingUser.phone.toString().trim();
        const p2 = newUser.phone.toString().trim();
        
        if (p1 === p2 || p1.includes(p2) || p2.includes(p1) || p1.slice(0, 8) === p2.slice(0, 8)) {
          existingUser.phone = newUser.phone;
          existingUser.country = newUser.country;
          
          try {
            await updateDoc(docSnap.ref, {
              phone: newUser.phone,
              country: newUser.country
            });
          } catch (err) {
            console.error("Failed to update user phone in DB:", err);
          }
          loggedInUser = existingUser;
        } else {
          alert('هذا البريد الإلكتروني مسجل مسبقاً لدينا برقم هاتف آخر.');
          return;
        }
      } else if (!phoneSnapshot.empty) {
        const docSnap = phoneSnapshot.docs[0];
        const existingUser = docSnap.data();
        if (existingUser.email.trim().toLowerCase() === newUser.email.trim().toLowerCase()) {
          loggedInUser = existingUser;
        } else {
          alert('رقم الهاتف هذا مسجل مسبقاً لدينا ببريد إلكتروني آخر.');
          return;
        }
      } else {
        await addDoc(collection(db, 'users'), newUser);
        loggedInUser = newUser;
      }

      localStorage.setItem('etegah_user', JSON.stringify(loggedInUser));
      setSuccessMsg('تم التسجيل ودخول المنصة بنجاح! جاري التوجيه تلقائياً 🔄');
      
      setTimeout(() => {
        setSuccessMsg('');
        window.location.href = '/';
      }, 1500);
      
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ، يرجى المحاولة لاحقاً.');
    }
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

          <button type="submit" className="button primary" style={{ width: '100%', padding: '12px', fontSize: '1.1rem', marginTop: '1rem' }}>
            تسجيل حساب
          </button>
        </form>
      </div>
    </div>
  );
}
