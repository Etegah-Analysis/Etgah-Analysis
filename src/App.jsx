import { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import News from './pages/News';
import Admin from './pages/Admin';
import USOptions from './pages/USOptions';
import { X, Menu } from 'lucide-react';


import { db, collection, addDoc, query, where, getDocs, updateDoc } from './firebase';


import logoImg from './assets/logo.jpg';
import './index.css';

// Reusable Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        animation: 'fadeIn 0.3s ease'
      }}
    >
      <div 
        className="modal-content card glass" 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: '500px',
          padding: '2rem',
          position: 'relative',
          animation: 'slideUp 0.3s ease'
        }}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--primary-blue)',
            cursor: 'pointer'
          }}
        >
          <X size={24} />
        </button>
        
        {title && <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
};

function App() {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [countryCode, setCountryCode] = useState('+966');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();



  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('etegah_user');
    navigate('/');
  };

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('etegah_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    
    // Check if redirect flag exists to open register modal
    const shouldOpen = sessionStorage.getItem('open_register_modal');
    if (shouldOpen === 'true') {
      sessionStorage.removeItem('open_register_modal');
      setIsRegisterOpen(true);
    }
  }, []);

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
      // Check if email or phone already exists
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
        
        // Flexible match: equal, includes, or first 8 digits match
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

      setCurrentUser(loggedInUser);
      localStorage.setItem('etegah_user', JSON.stringify(loggedInUser));
      setSuccessMsg('تم التسجيل ودخول المنصة بنجاح! جاري التوجيه تلقائياً 🔄');
      
      setTimeout(() => {
        setIsRegisterOpen(false);
        setSuccessMsg('');
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ، يرجى المحاولة لاحقاً.');
    }
  };

  return (
    <>
      <div className="app-container">


        {/* Watermark Background */}
        <div className="watermark" style={{ backgroundImage: `url(${logoImg})` }}></div>

        {/* Navbar */}
        <nav className="navbar glass" style={{ position: 'relative', zIndex: 1000 }}>
          <div className="container flex items-center justify-between">
            <Link to="/" className="logo flex items-center gap-4">
              <img src={logoImg} alt="Etegah Logo" style={{ height: '60px', objectFit: 'contain', borderRadius: '8px' }} />
            </Link>
            
            {/* Mobile Menu Button */}
            <button className="mobile-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>

            {/* Overlay to close menu when clicking outside */}
            {isMenuOpen && (
              <div 
                className="mobile-menu-overlay" 
                onClick={() => setIsMenuOpen(false)}
                style={{
                  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.5)', zIndex: 999
                }}
              ></div>
            )}

            <div className={`nav-links flex items-center gap-8 ${isMenuOpen ? 'mobile-open' : ''}`}>
              <Link to="/" onClick={() => setIsMenuOpen(false)}>الرئيسية</Link>
              <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>خدمات المنصة</Link>
              <Link 
                to={currentUser ? "/options" : "/"} 
                onClick={(e) => {
                  setIsMenuOpen(false);
                  if (!currentUser) {
                    e.preventDefault();
                    setIsRegisterOpen(true);
                  }
                }}
              >
                رادار الأوبشن
              </Link>
              
              <Link 
                to={currentUser ? "/news" : "/"} 
                onClick={(e) => {
                  setIsMenuOpen(false);
                  if (!currentUser) {
                    e.preventDefault();
                    setIsRegisterOpen(true);
                  }
                }}
              >
                أخبار السوق
              </Link>
              
              <div className="nav-actions-mobile flex items-center gap-4">
                {currentUser ? (
                  <div className="flex flex-col items-center gap-2">
                    <span style={{ fontSize: '0.8rem', color: 'var(--primary-blue)' }}>{currentUser.email}</span>
                    <button onClick={logout} className="button secondary small">خروج</button>
                  </div>
                ) : (
                  <button onClick={() => { setIsRegisterOpen(true); setIsMenuOpen(false); }} className="button primary">ابدأ الآن</button>
                )}
              </div>
            </div>

            <div className="nav-actions-desktop flex items-center gap-4">
              {currentUser ? (
                <div className="flex items-center gap-4">
                  <div className="user-badge flex items-center gap-2 glass" style={{ padding: '5px 12px', borderRadius: '20px', border: '1px solid var(--primary-blue)' }}>
                    <div style={{ width: '8px', height: '8px', background: '#4CAF50', borderRadius: '50%' }}></div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{currentUser.email}</span>
                  </div>
                  <button onClick={logout} className="button secondary small" style={{ padding: '5px 12px', fontSize: '0.8rem' }}>خروج</button>
                </div>
              ) : (
                <button onClick={() => setIsRegisterOpen(true)} className="button primary">ابدأ الآن</button>
              )}
            </div>
          </div>
        </nav>

        {/* Register Modal */}
        <Modal 
          isOpen={isRegisterOpen} 
          onClose={() => {
            setIsRegisterOpen(false);
          }} 
          title="إنشاء حساب جديد"
        >
            {successMsg && (
              <div style={{
                padding: '15px',
                background: 'rgba(0, 200, 83, 0.1)',
                border: '1px solid rgba(0, 200, 83, 0.3)',
                borderRadius: '8px',
                color: '#00c853',
                textAlign: 'center',
                fontWeight: 'bold',
                marginBottom: '1rem',
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
                  className="input-field"
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
                    className="select-field"
                  >
                    <option value="+966">🇸🇦 +966</option>
                    <option value="+20">🇪🇬 +20</option>
                  </select>
                  <input 
                    name="phone"
                    type="tel" 
                    placeholder={countryCode === '+966' ? "5XXXXXXXX" : "1XXXXXXXX"}
                    className="input-field-tel"
                    required 
                  />
                </div>
              </div>

              <button type="submit" className="button primary" style={{ width: '100%', padding: '12px' }}>
                تسجيل حساب
              </button>
            </form>
        </Modal>

        {/* Main Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home onOpenRegister={() => setIsRegisterOpen(true)} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/news" element={<News />} />
            <Route path="/options" element={<USOptions />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="footer glass mt-8">
          <div className="container">
            <div className="flex justify-between items-center" style={{ padding: '2rem 0' }}>
              <div className="logo-text flex items-center gap-4">
                <img src={logoImg} alt="Etegah Logo Footer" style={{ height: '60px', objectFit: 'contain', borderRadius: '8px' }} />
                <div>
                  <p style={{ margin: 0 }}>نحو قرارات أدق... برؤية أعمق</p>
                </div>
              </div>
              <div className="footer-links flex gap-4">
                <Link to="/">الرئيسية</Link>
                <button 
                  onClick={() => setIsRegisterOpen(true)}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit' }}
                >
                  التسجيل
                </button>
              </div>
            </div>
            {/* Invisible overlay to close disclaimer when clicking outside */}
            {isDisclaimerOpen && (
              <div 
                onClick={() => setIsDisclaimerOpen(false)}
                style={{
                  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998
                }}
              />
            )}
            <div className="disclaimer" onClick={() => setIsDisclaimerOpen(!isDisclaimerOpen)} style={{ cursor: 'pointer', userSelect: 'none', position: 'relative', zIndex: 999 }}>
              <p>
                <strong>إخلاء مسؤولية قانوني {isDisclaimerOpen ? '▼' : '◀'}</strong>
                {isDisclaimerOpen && (
                  <span style={{ paddingRight: '5px' }}>
                    هذه المنصة توفر أدوات تعليمية وتحليل فني فقط، ولا تشكل توصيات استثمارية، أو إشارات بيع وشراء، أو خدمات استشارية مالية.
                  </span>
                )}
              </p>
            </div>
          </div>
        </footer>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .input-field, .input-field-tel {
          width: 100%; padding: 12px; border-radius: 6px; border: 1px solid var(--border-blue); 
          background: rgba(255,255,255,0.05); color: var(--text-color); outline: none;
        }
        .input-field-tel { border-radius: 0 6px 6px 0; }
        .select-field {
          padding: 12px 8px; background: var(--border-blue); border: 1px solid var(--border-blue); 
          border-right: none; border-radius: 6px 0 0 6px; color: white; outline: none; cursor: pointer;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}} />
    </>
  );
}


export default App;
