import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import logoImg from '../assets/logo.jpg';

export default function Navbar() {
  const navigate = useNavigate();
  const [visitorName, setVisitorName] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const name = localStorage.getItem('visitorName');
    if (name) {
      setVisitorName(name);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('visitorName');
    window.location.href = '/';
  };

  return (
    <nav style={{ background: 'rgba(10,25,47,0.85)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '1rem 0', position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src={logoImg} alt="Etegah Logo" style={{ width: '40px', borderRadius: '8px' }} />
          <span style={{ fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '1px', color: '#fff' }} className="mobile-logo-text">اتجاه للتحليل الذكي</span>
        </div>
        
        <button 
          className="mobile-toggle" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 1001 }}
        >
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>

        <div className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`} style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
          <Link to="/" className="nav-link" style={{ color: '#fff', textDecoration: 'none' }} onClick={() => setIsMobileMenuOpen(false)}>الرئيسية</Link>
          <Link to="/news" className="nav-link" style={{ color: '#fff', textDecoration: 'none' }} onClick={() => setIsMobileMenuOpen(false)}>أخبار السوق السعودي</Link>
          <Link to="/us-options" className="nav-link" style={{ color: '#fff', textDecoration: 'none' }} onClick={() => setIsMobileMenuOpen(false)}>رادار الأوبشن</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderRight: '1px solid rgba(255,255,255,0.2)', paddingRight: '15px' }} className="user-info-mobile mt-4 md:mt-0">
            {visitorName ? (
              <>
                <span style={{ color: '#00d2ff', fontWeight: 'bold', fontSize: '0.95rem' }}>{visitorName}</span>
                <button onClick={handleLogout} className="button secondary small" style={{ padding: '5px 12px', fontSize: '0.8rem', background: 'transparent', border: '1px solid #ff5252', color: '#ff5252', borderRadius: '4px', cursor: 'pointer' }}>خروج</button>
              </>
            ) : (
              <Link to="/visitor-login" className="button primary small" style={{ padding: '5px 15px', fontSize: '0.9rem', borderRadius: '4px', background: '#00d2ff', color: '#07111f', fontWeight: 'bold', textDecoration: 'none' }}>تسجيل الدخول</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
