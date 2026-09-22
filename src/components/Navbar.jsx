import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, Bell, ShieldCheck, Trash2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDocs, getDoc, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import logoImg from '../assets/logo.jpg';
import { playNotificationChime } from '../utils/notificationBadge';

export default function Navbar() {
  const navigate = useNavigate();
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [isEmp, setIsEmp] = useState(false);
  const [empTitle, setEmpTitle] = useState('');
  const [empAliasName, setEmpAliasName] = useState('');

  const [notifications, setNotifications] = useState([]);
  const [chatNotifications, setChatNotifications] = useState([]);
  const [platformNotifications, setPlatformNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const notifRef = useRef(null);
  const isInitialNotifMount = useRef(true);
  const prevUnreadNotifCountRef = useRef(0);

  const [isAdmin, setIsAdmin] = useState(false);

  // Check login state (Customer vs Employee)
  useEffect(() => {
    const name = localStorage.getItem('visitorName') || '';
    const phone = localStorage.getItem('visitorPhone') || '';
    const isEmpLogged = localStorage.getItem('isEmpLoggedIn') === 'true';
    const alias = localStorage.getItem('empAliasName') || '';
    const title = localStorage.getItem('empTitle') || '';
    const empCode = localStorage.getItem('empCode') || '';

    setIsEmp(isEmpLogged);
    if (alias) setEmpAliasName(alias);
    if (title) setEmpTitle(title);
    if (name) setVisitorName(name);

    const normTitle = (title || '').toLowerCase();
    const normCode = (empCode || '').toLowerCase();
    const normAlias = (alias || '').toLowerCase();
    const normName = (name || '').toLowerCase();

    const adminCheck = isEmpLogged && (
      normTitle.includes('admin') || 
      normTitle.includes('أدمن') || 
      normTitle.includes('ادمن') || 
      normTitle.includes('مدير') || 
      normTitle.includes('إدارة') || 
      normTitle.includes('اداره') || 
      normCode.includes('admin') ||
      normAlias.includes('إدارة') ||
      normAlias.includes('ادارة') ||
      normName.includes('admin')
    );
    setIsAdmin(adminCheck);

    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return;
    setVisitorPhone(cleanPhone);

    // 1. Listen for real-time assigned employee alias in website_chats
    const chatDocRef = doc(db, 'website_chats', `chat_${cleanPhone}`);
    const unsubChat = onSnapshot(chatDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const emp = data.assignedEmp;
        if (emp && emp.empCode && emp.empCode !== 'CS' && emp.empCode !== 'cs') {
          const qEmp = query(collection(db, 'users'), where('empCode', '==', emp.empCode));
          getDocs(qEmp).then((snap) => {
            if (!snap.empty) {
              const uData = snap.docs[0].data();
              const resolvedAlias = uData.aliasName || uData.pseudonym || uData.displayName || uData.username || uData.name || emp.name;
              setEmpAliasName(resolvedAlias);
            } else if (emp.name) {
              setEmpAliasName(emp.name);
            }
          }).catch(() => {
            if (emp.name) setEmpAliasName(emp.name);
          });
        } else if (emp && emp.name) {
          setEmpAliasName(emp.name);
        }
      }
    });

    // 2. Real-time incoming notifications listener for customer
    const qMsgs = query(
      collection(db, 'رسائل_الموظفين_للعملاء'),
      where('conversationId', '==', cleanPhone)
    );

    const unsubMsgs = onSnapshot(qMsgs, (snap) => {
      const incomingMsgs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.sender !== 'client' && m.sender !== 'customer' && m.sender !== cleanPhone);

      incomingMsgs.sort((a, b) => {
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return tB - tA;
      });

      setChatNotifications(incomingMsgs);
    }, (err) => console.error("Navbar chat notifications error:", err));

    return () => {
      unsubChat();
      unsubMsgs();
    };
  }, [visitorPhone]);

  // Real-time visitor account status check (Instant automatic logout when deleted from control panel)
  useEffect(() => {
    const phone = localStorage.getItem('visitorPhone');
    const isEmpLogged = localStorage.getItem('isEmpLoggedIn') === 'true';
    if (!phone || isEmpLogged) return;

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return;

    const visDocRef = doc(db, 'visitor_customers', cleanPhone);
    const unsubVis = onSnapshot(visDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.isLoggedOut === true || data.status === 'deleted' || data.isDeleted === true) {
          localStorage.removeItem('visitorPhone');
          localStorage.removeItem('visitorName');
          toast.error('تم تسجيل الخروج تلقائياً نظراً لحذف حسابك من قِبل الإدارة ⚠️');
          window.location.href = '/visitor-login';
        }
      } else {
        const custDocRef = doc(db, 'بيانات_تسجيل_العملاء', cleanPhone);
        getDoc(custDocRef).then((cSnap) => {
          if (!cSnap.exists() || cSnap.data()?.status === 'deleted' || cSnap.data()?.isLoggedOut === true || cSnap.data()?.isDeleted === true) {
            localStorage.removeItem('visitorPhone');
            localStorage.removeItem('visitorName');
            toast.error('تم تسجيل الخروج تلقائياً نظراً لحذف حسابك من قِبل الإدارة ⚠️');
            window.location.href = '/visitor-login';
          }
        }).catch(() => {});
      }
    });

    return () => unsubVis();
  }, [visitorPhone]);

  // 3. Real-time broadcast listener for platform PDF reports, videos & notifications
  useEffect(() => {
    let platformFromDb = [];
    let reportsFromDb = [];

    const unsubPlatform = onSnapshot(collection(db, 'platform_notifications'), (snap) => {
      platformFromDb = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          isPlatformNotif: true,
          senderName: data.title || (data.type === 'pdf_report' ? '📄 تقرير أسبوعي جديد' : '🎥 فيديو جديد بالمنصة'),
          text: data.body || (data.type === 'pdf_report' ? 'المكان: صفحة فيديوهات المنصة والنتائج السابقة (انقر للمعاينة والتحميل 📄)' : 'المكان: صفحة فيديوهات المنصة والنتائج السابقة (انقر للمشاهدة 🎥)'),
          url: data.url || '/platform-videos',
          timestamp: data.createdAt || data.timestamp,
          timestampMillis: data.timestampMillis || (data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now()),
          type: data.type,
          market: data.market
        };
      });
      updateCombinedPlatformNotifs();
    }, (err) => console.warn("Navbar platform notifications error:", err));

    const unsubWeekly = onSnapshot(collection(db, 'weekly_reports'), (snap) => {
      reportsFromDb = [];
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.pdfUrl && data.pdfUrl !== '#') {
          const isSaudi = data.market === 'saudi' || docSnap.id === 'saudi_latest';
          reportsFromDb.push({
            id: 'weekly_report_live_' + docSnap.id,
            isPlatformNotif: true,
            senderName: isSaudi ? '📄 تم رفع التقرير الأسبوعي للسوق السعودي' : '📄 تم رفع التقرير الأسبوعي للسوق الأمريكي',
            text: `المكان: صفحة فيديوهات المنصة والنتائج السابقة 📄 (${data.uploadedAtFormatted || 'تقرير أسبوعي معتمد'})`,
            url: '/platform-videos',
            timestamp: data.uploadedAt || data.createdAt,
            timestampMillis: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
            type: 'pdf_report',
            market: data.market || (isSaudi ? 'saudi' : 'us')
          });
        }
      });
      updateCombinedPlatformNotifs();
    }, (err) => console.warn("Navbar weekly reports error:", err));

    function updateCombinedPlatformNotifs() {
      const combined = [...platformFromDb, ...reportsFromDb];
      const uniqueMap = new Map();
      combined.forEach(item => uniqueMap.set(item.id, item));
      setPlatformNotifications(Array.from(uniqueMap.values()));
    }

    return () => {
      unsubPlatform();
      unsubWeekly();
    };
  }, []);

  const [remoteReadMsgIds, setRemoteReadMsgIds] = useState([]);
  const [remoteReadPlatformIds, setRemoteReadPlatformIds] = useState([]);
  const [remoteLastReadTime, setRemoteLastReadTime] = useState(0);

  const getUserNotifKey = () => {
    if (auth.currentUser?.uid) return `user_${auth.currentUser.uid}`;
    if (visitorPhone) return visitorPhone.replace(/[^0-9]/g, '');
    return isEmp ? 'employee' : 'guest';
  };

  // Cross-device real-time listener for Navbar Notification State
  useEffect(() => {
    const userKey = getUserNotifKey();

    const navNotifRef = doc(db, 'users_notif_state', `navbar_${userKey}`);
    const unsubNav = onSnapshot(navNotifRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.readMsgIds) && data.readMsgIds.length > 0) {
          setRemoteReadMsgIds(prev => Array.from(new Set([...prev, ...data.readMsgIds])));
        }
        if (Array.isArray(data.readPlatformIds) && data.readPlatformIds.length > 0) {
          setRemoteReadPlatformIds(prev => Array.from(new Set([...prev, ...data.readPlatformIds])));
        }
        if (typeof data.lastReadTime === 'number') {
          setRemoteLastReadTime(prev => Math.max(prev, data.lastReadTime));
        }
      }
    }, (err) => console.warn("Navbar Firestore notif sync error:", err));

    return () => unsubNav();
  }, [visitorPhone, isEmp, currentUser?.uid]);

  const syncNavbarToFirestore = (extraMsgIds = [], extraPlatformIds = [], updateTimestamp = false) => {
    const userKey = getUserNotifKey();
    const now = Date.now();
    const payload = {
      updatedAt: serverTimestamp()
    };
    if (extraMsgIds.length > 0) payload.readMsgIds = arrayUnion(...extraMsgIds);
    if (extraPlatformIds.length > 0) payload.readPlatformIds = arrayUnion(...extraPlatformIds);
    if (updateTimestamp) payload.lastReadTime = now;

    setDoc(doc(db, 'users_notif_state', `navbar_${userKey}`), payload, { merge: true }).catch(() => {});
  };

  // Merge chat and platform notifications
  useEffect(() => {
    const userKey = getUserNotifKey();
    const savedReadMsgIds = JSON.parse(localStorage.getItem(`etegah_read_ids_${userKey}`) || '[]');
    const savedReadPlatformIds = JSON.parse(localStorage.getItem(`etegah_read_platform_ids_${userKey}`) || '[]');

    const allReadMsgIds = Array.from(new Set([...savedReadMsgIds, ...remoteReadMsgIds]));
    const allReadPlatformIds = Array.from(new Set([...savedReadPlatformIds, ...remoteReadPlatformIds]));

    // Admin receives ALL notifications (Customer WhatsApp chats, website chats, reports & videos).
    // Non-admin employees receive ONLY Reports 📄 & Videos 🎥 notifications (customer chats suppressed).
    // Visitors/Customers receive their chat notifications + platform reports & videos.
    const shouldSuppressCustomerChats = isEmp && !isAdmin;
    const filteredChatMsgs = shouldSuppressCustomerChats ? [] : chatNotifications.filter(m => !allReadMsgIds.includes(m.id));
    const filteredPlatformMsgs = platformNotifications.filter(m => !allReadPlatformIds.includes(m.id));

    const merged = [...filteredChatMsgs, ...filteredPlatformMsgs].sort((a, b) => {
      const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : (a.timestampMillis || 0));
      const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : (b.timestampMillis || 0));
      return tB - tA;
    });

    setNotifications(merged);

    const savedLastRead = localStorage.getItem(`etegah_notif_last_read_${cleanPhone}`);
    const localLastReadTime = savedLastRead ? parseInt(savedLastRead, 10) : 0;
    const effectiveLastReadTime = Math.max(localLastReadTime, remoteLastReadTime);

    const unreadList = merged.filter(m => {
      const msgTime = m.timestamp?.toMillis ? m.timestamp.toMillis() : (m.timestamp ? new Date(m.timestamp).getTime() : (m.timestampMillis || 0));
      return msgTime > effectiveLastReadTime;
    });

    if (!isInitialNotifMount.current && unreadList.length > prevUnreadNotifCountRef.current) {
      playNotificationChime();
    }
    isInitialNotifMount.current = false;
    prevUnreadNotifCountRef.current = unreadList.length;

    setUnreadCount(unreadList.length);
  }, [chatNotifications, platformNotifications, visitorPhone, isEmp, isAdmin, remoteReadMsgIds, remoteReadPlatformIds, remoteLastReadTime]);

  // Listen to custom window events for clearing notifications
  useEffect(() => {
    const handleUnreadEvent = (e) => {
      if (e.detail && e.detail.hasUnread === false) {
        const cleanPhone = visitorPhone ? visitorPhone.replace(/[^0-9]/g, '') : (isEmp ? 'employee' : 'guest');
        localStorage.setItem(`etegah_notif_last_read_${cleanPhone}`, Date.now().toString());
        setUnreadCount(0);
        syncNavbarToFirestore([], [], true);
      }
    };
    window.addEventListener('etegah_unread_msg', handleUnreadEvent);
    return () => window.removeEventListener('etegah_unread_msg', handleUnreadEvent);
  }, [visitorPhone, isEmp]);

  // Click Outside listener to close notifications dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!isNotifOpen) return;
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isNotifOpen]);

  const toggleNotifications = () => {
    const nextState = !isNotifOpen;
    setIsNotifOpen(nextState);
    if (nextState) {
      const cleanPhone = visitorPhone ? visitorPhone.replace(/[^0-9]/g, '') : (isEmp ? 'employee' : 'guest');
      localStorage.setItem(`etegah_notif_last_read_${cleanPhone}`, Date.now().toString());
      setUnreadCount(0);
      syncNavbarToFirestore([], [], true);
    }
  };

  const handleOpenNotificationMessage = (msgId) => {
    const targetMsg = notifications.find(m => m.id === msgId);
    const cleanPhone = visitorPhone ? visitorPhone.replace(/[^0-9]/g, '') : (isEmp ? 'employee' : 'guest');

    if (targetMsg?.isPlatformNotif) {
      const savedReadPlatform = JSON.parse(localStorage.getItem(`etegah_read_platform_ids_${cleanPhone}`) || '[]');
      if (msgId && !savedReadPlatform.includes(msgId)) {
        savedReadPlatform.push(msgId);
        localStorage.setItem(`etegah_read_platform_ids_${cleanPhone}`, JSON.stringify(savedReadPlatform));
      }
      syncNavbarToFirestore([], [msgId], true);
      setNotifications(prev => prev.filter(m => m.id !== msgId));
      setIsNotifOpen(false);
      setIsMobileMenuOpen(false);
      localStorage.setItem(`etegah_notif_last_read_${cleanPhone}`, Date.now().toString());
      setUnreadCount(prev => Math.max(0, prev - 1));
      navigate(targetMsg.url || '/platform-videos');
      return;
    }

    window.dispatchEvent(new CustomEvent('open_whatsapp_widget', { detail: { targetMsgId: msgId } }));
    setIsNotifOpen(false);
    setIsMobileMenuOpen(false);

    const savedReadIds = JSON.parse(localStorage.getItem(`etegah_read_ids_${cleanPhone}`) || '[]');
    if (msgId && !savedReadIds.includes(msgId)) {
      savedReadIds.push(msgId);
      localStorage.setItem(`etegah_read_ids_${cleanPhone}`, JSON.stringify(savedReadIds));
    }
    syncNavbarToFirestore([msgId], [], true);
    setNotifications(prev => prev.filter(m => m.id !== msgId));
    localStorage.setItem(`etegah_notif_last_read_${cleanPhone}`, Date.now().toString());
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleClearAllNotifications = () => {
    const cleanPhone = visitorPhone ? visitorPhone.replace(/[^0-9]/g, '') : (isEmp ? 'employee' : 'guest');
    const chatIds = notifications.filter(m => !m.isPlatformNotif).map(m => m.id);
    const platformIds = notifications.filter(m => m.isPlatformNotif).map(m => m.id);

    const savedReadChat = JSON.parse(localStorage.getItem(`etegah_read_ids_${cleanPhone}`) || '[]');
    const savedReadPlatform = JSON.parse(localStorage.getItem(`etegah_read_platform_ids_${cleanPhone}`) || '[]');

    const newChatIds = Array.from(new Set([...savedReadChat, ...chatIds]));
    const newPlatformIds = Array.from(new Set([...savedReadPlatform, ...platformIds]));

    localStorage.setItem(`etegah_read_ids_${cleanPhone}`, JSON.stringify(newChatIds));
    localStorage.setItem(`etegah_read_platform_ids_${cleanPhone}`, JSON.stringify(newPlatformIds));
    localStorage.setItem(`etegah_notif_last_read_${cleanPhone}`, Date.now().toString());

    syncNavbarToFirestore(chatIds, platformIds, true);

    setNotifications([]);
    setUnreadCount(0);
  };

  const handleLogout = () => {
    localStorage.removeItem('visitorName');
    localStorage.removeItem('visitorPhone');
    localStorage.removeItem('isEmpLoggedIn');
    localStorage.removeItem('empAliasName');
    localStorage.removeItem('empTitle');
    localStorage.removeItem('empCode');
    window.location.href = '/';
  };

  const handleOpenChat = () => {
    window.dispatchEvent(new Event('open_whatsapp_widget'));
    setIsMobileMenuOpen(false);
  };

  // User login status check
  const isLoggedIn = isEmp || Boolean(visitorName) || Boolean(visitorPhone);
  const displayName = isEmp ? (empAliasName || visitorName || 'موظف اتجاه') : (visitorName || 'عميل اتجاه');

  return (
    <nav className="navbar-container">
      <div className="container nav-wrapper">
        {/* Brand Logo & Name */}
        <Link to="/" className="brand-logo" onClick={() => setIsMobileMenuOpen(false)}>
          <img src={logoImg} alt="Etegah Logo" className="logo-img" />
          <span className="mobile-logo-text">اتجاه للتحليل الذكي</span>
        </Link>

        {/* Navigation Links (Center in RTL) */}
        <div className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <Link to="/" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
            الرئيسية
          </Link>
          <Link to="/platform-videos" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
            فيديوهات المنصة والنتائج السابقة
          </Link>
          <Link to="/news" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
            أخبار السوق السعودي
          </Link>
          <Link to="/us-options" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
            أخبار السوق الأمريكي
          </Link>
        </div>

        {/* Top bar left section (RTL): Bell + User/Emp badge + Single Left Logout + Hamburger Menu */}
        <div className="mobile-controls flex items-center gap-2">
          {isLoggedIn && (
            <div className="flex items-center gap-2">
              {/* ALWAYS VISIBLE Single Notification Bell Button */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={toggleNotifications}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-cyan-300 hover:text-white transition relative cursor-pointer flex items-center justify-center shadow-md"
                  title="الإشعارات المباشرة"
                >
                  <Bell size={16} className={unreadCount > 0 ? "text-cyan-300 animate-pulse" : "text-gray-400"} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 flex h-4 w-4 sm:h-4.5 sm:w-4.5 items-center justify-center rounded-full bg-rose-500 text-[9px] sm:text-[10px] font-black text-white shadow-md animate-bounce">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* SINGLE UNIFIED DROPDOWN MENU - PERFECTLY CENTERED DIRECTLY UNDER BELL */}
                {isNotifOpen && (
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-slate-950/98 backdrop-blur-2xl border-2 border-cyan-500/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] z-[9999] p-3 text-right text-xs animate-in fade-in zoom-in-95 duration-200"
                    dir="rtl"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                      <span className="font-extrabold text-cyan-300 flex items-center gap-1 text-[11px]">
                        <Bell size={14} className="text-cyan-400" /> إشعارات الرسائل الواردة
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 font-mono">({notifications.length})</span>
                        {notifications.length > 0 && (
                          <button
                            onClick={handleClearAllNotifications}
                            className="text-[10px] text-rose-300 hover:text-rose-100 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 px-1.5 py-0.5 rounded-md transition cursor-pointer flex items-center gap-0.5"
                            title="تصفير ومسح الإشعارات"
                          >
                            <Trash2 size={10} /> تحديد الكل كمقروء 🧹
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-60 sm:max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {notifications.map((msg) => (
                        <div
                          key={msg.id}
                          onClick={() => handleOpenNotificationMessage(msg.id)}
                          className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-cyan-950/40 border border-white/5 hover:border-cyan-500/30 transition cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-white text-[11px] flex items-center gap-1">
                              {msg.isPlatformNotif ? (msg.type === 'pdf_report' ? '📄 ' : '🎥 ') : null}
                              {msg.senderName || (msg.sender === 'admin' ? '👑 الإدارة' : (empAliasName || 'خدمة العملاء'))}
                            </span>
                            <span className="text-[9px] text-cyan-400 font-mono shrink-0">
                              {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '')}
                            </span>
                          </div>
                          <p className="text-gray-300 text-[11px] line-clamp-2 dir-auto">
                            {msg.text || (msg.mediaUrl ? '📎 مرفق ملف' : 'رسالة جديدة')}
                          </p>
                        </div>
                      ))}

                      {notifications.length === 0 && (
                        <div className="py-6 text-center text-gray-400 text-[11px]">
                          لا توجد إشعارات جديدة حالياً ✨
                        </div>
                      )}
                    </div>

                    {notifications.length > 0 && !isEmp && (
                      <button
                        onClick={() => {
                          handleOpenChat();
                          setIsNotifOpen(false);
                        }}
                        className="w-full mt-2 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-center text-[11px] hover:from-cyan-400 hover:to-blue-500 transition cursor-pointer shadow-md active:scale-95"
                      >
                        فتح المحادثة الكاملة 💬
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* User / Employee Badge Button */}
              {isEmp ? (
                <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-cyan-400/50 text-cyan-300 font-bold flex items-center gap-1.5 shadow-[0_4px_15px_rgba(6,182,212,0.25)] text-xs sm:text-sm">
                  <ShieldCheck size={15} className="text-cyan-400 shrink-0" />
                  <span>👨‍💼 {displayName}</span>
                  <span className="text-[10px] text-cyan-200/80 bg-cyan-950/80 px-1.5 py-0.5 rounded-md border border-cyan-500/30 hidden sm:inline">
                    {empTitle || 'مستشار مالي'}
                  </span>
                </div>
              ) : (
                <button 
                  onClick={handleOpenChat}
                  className="visitor-badge-mobile relative flex items-center gap-1 cursor-pointer"
                  title="فتح الواتساب"
                >
                  <User size={13} className="text-cyan-400" />
                  <span>{displayName}</span>
                </button>
              )}
            </div>
          )}

          {/* Single Left Logout Button */}
          <div className="flex items-center">
            {isLoggedIn ? (
              <button onClick={handleLogout} className="px-3 py-1.5 rounded-xl bg-rose-950/60 backdrop-blur-xl border border-rose-500/40 text-rose-300 hover:text-white hover:bg-rose-900/80 font-bold transition text-xs flex items-center gap-1 cursor-pointer shadow-sm">
                <LogOut size={14} /> خروج
              </button>
            ) : (
              <Link 
                to="/visitor-login" 
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-[0_4px_15px_rgba(6,182,212,0.3)] border border-cyan-300/40 transition" 
              >
                تسجيل الدخول
              </Link>
            )}
          </div>

          <button 
            className="mobile-toggle-btn" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="القائمة"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </nav>
  );
}
