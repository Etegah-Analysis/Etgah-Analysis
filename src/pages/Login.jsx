import React, { useState, useEffect } from 'react';
import { auth, db, doc, updateDoc, getDoc, serverTimestamp, collection, getDocs } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [loginType, setLoginType] = useState('employee'); // 'employee' or 'admin'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'منصة اتجاه | خدمة العملاء والإدارة';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetMessage('');
    
    try {
      const rawInput = identifier.trim();
      const safeInput = rawInput.replace(/\s+/g, '').toLowerCase();

      const candidateEmails = [];

      if (loginType === 'admin') {
        if (rawInput.includes('@')) {
          candidateEmails.push(rawInput.toLowerCase());
        }
        candidateEmails.push('mohamed.gamal.work0@gmail.com');
        candidateEmails.push('etegahanalysis@gmail.com');
        candidateEmails.push('admin@etegah.com');
        candidateEmails.push(`${safeInput}@etegah.com`);
      } else {
        // Employee Login
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.forEach(docSnap => {
            const data = docSnap.data();
            const dbUsername = (data.username || '').trim().toLowerCase();
            const dbUsernameClean = dbUsername.replace(/\s+/g, '');
            const dbName = (data.name || '').trim().toLowerCase();
            const dbNameClean = dbName.replace(/\s+/g, '');
            const dbEmail = (data.email || '').trim().toLowerCase();

            if (
              dbUsername === rawInput.toLowerCase() ||
              dbUsernameClean === safeInput ||
              dbName === rawInput.toLowerCase() ||
              dbNameClean === safeInput ||
              dbEmail === rawInput.toLowerCase() ||
              dbEmail === `${safeInput}@etegah.com`
            ) {
              if (data.email && !candidateEmails.includes(data.email.toLowerCase())) {
                candidateEmails.push(data.email.toLowerCase());
              }
            }
          });
        } catch (dbErr) {
          console.warn('Firestore lookup skipped/fallback:', dbErr);
        }

        const defaultDomainEmail = `${safeInput}@etegah.com`;
        if (!candidateEmails.includes(defaultDomainEmail)) candidateEmails.push(defaultDomainEmail);
        if (rawInput.includes('@') && !candidateEmails.includes(rawInput.toLowerCase())) {
          candidateEmails.push(rawInput.toLowerCase());
        }
        
        if (safeInput.includes('saed')) {
          const fixedSayed = safeInput.replace('saed', 'sayed') + '@etegah.com';
          if (!candidateEmails.includes(fixedSayed)) candidateEmails.push(fixedSayed);
        }
      }

      let userCred = null;
      let lastAuthError = null;

      for (const emailToTry of candidateEmails) {
        try {
          userCred = await signInWithEmailAndPassword(auth, emailToTry, password);
          if (userCred) break;
        } catch (authErr) {
          lastAuthError = authErr;
        }
      }

      if (!userCred) {
        if (lastAuthError) throw lastAuthError;
        throw new Error('INVALID_CREDENTIALS');
      }

      // Check account active status & update lastLoginAt
      try {
        const userRef = doc(db, 'users', userCred.user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.isActive === false) {
             await signOut(auth);
             setError('عذراً، هذا الحساب موقوف من قبل الإدارة.');
             setLoading(false);
             return;
          }
          const updates = { lastLoginAt: serverTimestamp() };
          if (!data.firstLoginAt) updates.firstLoginAt = serverTimestamp();
          await updateDoc(userRef, updates).catch(e => console.warn('Could not update lastLoginAt:', e));
        }
      } catch (metaErr) {
        console.warn('User profile check warning:', metaErr);
      }

      // Navigate to destination
      if (loginType === 'admin') {
        navigate('/dashboard');
      } else {
        navigate('/inbox');
      }
    } catch (err) {
      console.error('Login error:', err);
      const code = err.code || '';
      if (err.message === 'ACCOUNT_DISABLED') {
         setError('عذراً، هذا الحساب موقوف من قبل الإدارة.');
      } else if (code === 'auth/wrong-password') {
         setError('كلمة المرور غير صحيحة. يرجى التأكد من كتابة كلمة المرور بالشكل الصحيح.');
      } else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
         setError('بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم وكلمة المرور.');
      } else if (code === 'auth/too-many-requests') {
         setError('تم حظر محاولات الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار دقيقة ثم المحاولة مجدداً.');
      } else {
         setError('بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم وكلمة المرور.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    let targetEmail = (identifier || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      targetEmail = 'mohamed.gamal.work0@gmail.com';
    }
    try {
      setLoading(true);
      setError('');
      await sendPasswordResetEmail(auth, targetEmail);
      setResetMessage(`تم إرسال رابط تغيير كلمة المرور إلى البريد الإلكتروني (${targetEmail}) بنجاح!`);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء إرسال رابط كلمة المرور. تأكد من صحة البريد الإلكتروني.');
      setResetMessage('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans relative overflow-hidden" dir="rtl">
      {/* 3D Modern Gradient Background */}
      <div className="absolute inset-0 bg-slate-900">
        <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-blue-600/30 blur-[120px] mix-blend-screen animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-500/20 blur-[100px] mix-blend-screen"></div>
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[100px] mix-blend-screen"></div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-8 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] w-full max-w-md z-10 relative">
        <div className="flex flex-col items-center mb-6">
          <div className="p-1 rounded-full bg-white/50 backdrop-blur-sm shadow-sm mb-4">
            <img src="/logo.jpg" alt="Etegah Logo" className="w-24 h-24 rounded-full object-cover" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">منصة اتجاه</h2>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6 shadow-inner">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center py-2 text-sm font-bold rounded-md transition ${loginType === 'employee' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setLoginType('employee'); setIdentifier(''); setError(''); setResetMessage(''); }}
          >
            <Users size={16} className="ml-2" /> الموظفين
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center py-2 text-sm font-bold rounded-md transition ${loginType === 'admin' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setLoginType('admin'); setIdentifier(''); setError(''); setResetMessage(''); }}
          >
            <Shield size={16} className="ml-2" /> الإدارة
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {loginType === 'admin' ? 'اسم المستخدم أو البريد (الإدارة)' : 'اسم المستخدم (الموظف)'}
            </label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-2 border border-gray-300 bg-white/70 focus:bg-white rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition text-left"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={loginType === 'admin' ? 'admin' : 'مثال: ahmed'}
              dir="ltr"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                required
                minLength={6}
                className="w-full pl-4 pr-10 py-2 border border-gray-300 bg-white/70 focus:bg-white rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition text-left"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full text-white font-bold py-2.5 px-4 rounded-lg transition duration-200 flex justify-center items-center shadow-md disabled:opacity-50 ${loginType === 'admin' ? 'bg-gray-800 hover:bg-gray-900' : 'bg-primary hover:bg-green-600'}`}
          >
            {loading ? 'جاري التنفيذ...' : 'تسجيل الدخول'}
          </button>
        </form>

        {resetMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg mt-4 text-sm text-center font-medium">
            {resetMessage}
          </div>
        )}

        {loginType === 'admin' && (
          <div className="mt-6 text-center">
            <button 
              type="button"
              onClick={handleResetPassword}
              className="text-sm text-gray-400 hover:text-gray-800 transition font-medium"
            >
              نسيت كلمة المرور الخاصة بالإدارة؟
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
