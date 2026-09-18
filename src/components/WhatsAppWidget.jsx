import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, X, Send, Headphones, ShieldCheck, Sparkles, 
  Paperclip, Image as ImageIcon, Smile, Maximize2, Minimize2, 
  Reply, User, Phone, PhoneCall, FileText, Download, CheckCheck, ArrowRight, LogOut
} from 'lucide-react';
import { db, collection, query, where, getDocs, getDoc, doc, setDoc, onSnapshot, serverTimestamp, addDoc } from '../firebase';

export default function WhatsAppWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [userName, setUserName] = useState('');
  
  // Step in widget: 'code_input' | 'chat_room'
  const [widgetStep, setWidgetStep] = useState('code_input');
  const [empCodeInput, setEmpCodeInput] = useState('');
  const [assignedEmp, setAssignedEmp] = useState(null);
  const [codeError, setCodeError] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [hasUnread, setHasUnread] = useState(false);
  const [toastAlert, setToastAlert] = useState(null);

  // Media & Reply & Emoji states
  const [pendingMedia, setPendingMedia] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const widgetRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const prevMsgCountRef = useRef(0);
  const titleIntervalRef = useRef(null);

  const audioCtxRef = useRef(null);
  const isInitialLoadRef = useRef(true);

  // Popular Emojis without SA text string
  const popularEmojis = [
    '😀', '😂', '😍', '😎', '👍', '👎', '❤️', '🔥', 
    '⚡', '🎯', '📊', '📱', '🚀', '💬', '📌', '✨', 
    '🛑', '✅', '❌', '💡', '🏆', '📈', '📉'
  ];

  const ringingIntervalRef = useRef(null);
  const [activeInternalCall, setActiveInternalCall] = useState(null);

  // Play repeating telephone ringing chime
  const startRingingBellSound = () => {
    stopRingingBellSound();
    const ring = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(480, ctx.currentTime);

        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.2);
        osc2.stop(ctx.currentTime + 1.2);
      } catch (e) {}
    };
    ring();
    ringingIntervalRef.current = setInterval(ring, 2500);
  };

  const stopRingingBellSound = () => {
    if (ringingIntervalRef.current) {
      clearInterval(ringingIntervalRef.current);
      ringingIntervalRef.current = null;
    }
  };

  // Listen for internal call rings in real-time
  useEffect(() => {
    if (!userPhone) return;
    const cleanPhone = userPhone.replace(/[^0-9]/g, '');
    const callDocRef = doc(db, 'internal_calls', cleanPhone);

    const unsub = onSnapshot(callDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'ringing' && data.callerType === 'staff') {
          setActiveInternalCall(data);
          startRingingBellSound();
          triggerBrowserNotification(`📞 اتصال داخلي جاري من ${data.empName || 'الموظف'}...`);
        } else {
          setActiveInternalCall(null);
          stopRingingBellSound();
        }
      } else {
        setActiveInternalCall(null);
        stopRingingBellSound();
      }
    }, (err) => console.error("Internal call listener error:", err));

    return () => {
      unsub();
      stopRingingBellSound();
    };
  }, [userPhone]);

  // Trigger internal call from client to staff
  const handleTriggerInternalCall = async () => {
    if (!userPhone) return;
    const cleanPhone = userPhone.replace(/[^0-9]/g, '');
    const callDocRef = doc(db, 'internal_calls', cleanPhone);

    try {
      await setDoc(callDocRef, {
        id: cleanPhone,
        userPhone: userPhone,
        cleanPhone: cleanPhone,
        clientName: userName || 'عميل اتجاه',
        callerType: 'client',
        status: 'ringing',
        empCode: assignedEmp?.empCode || 'CS',
        empName: assignedEmp?.name || 'خدمة العملاء',
        updatedAt: serverTimestamp()
      }, { merge: true });

      await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
        conversationId: cleanPhone,
        phoneNumber: userPhone,
        sender: 'client',
        text: "تنبيه بوجود رسالة",
        timestamp: serverTimestamp()
      });

      startRingingBellSound();
      alert(`جاري الاتصال والتنبيه للموظف (${assignedEmp?.name || 'خدمة العملاء'})... 📞🔔`);

      setTimeout(async () => {
        try {
          const snap = await getDoc(callDocRef);
          if (snap.exists() && snap.data().status === 'ringing') {
            await setDoc(callDocRef, { status: 'cancelled' }, { merge: true });
          }
        } catch (e) {}
      }, 30000);

    } catch (err) {
      console.error("Call trigger error:", err);
    }
  };

  const handleCancelCall = async () => {
    stopRingingBellSound();
    setActiveInternalCall(null);
    if (!userPhone) return;
    const cleanPhone = userPhone.replace(/[^0-9]/g, '');
    try {
      await setDoc(doc(db, 'internal_calls', cleanPhone), { status: 'cancelled' }, { merge: true });
    } catch (e) {}
  };

  const handleAnswerCall = async () => {
    stopRingingBellSound();
    setActiveInternalCall(null);
    setIsOpen(true);
    clearNotifications();
    if (!userPhone) return;
    const cleanPhone = userPhone.replace(/[^0-9]/g, '');
    try {
      await setDoc(doc(db, 'internal_calls', cleanPhone), { status: 'answered' }, { merge: true });
    } catch (e) {}
  };

  // Global user interaction listener to unlock AudioContext for sound alerts
  useEffect(() => {
    const unlockAudio = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
      } catch (e) {}
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Request Browser Push Notification permission on load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Clear Title Flasher interval on unmount
  useEffect(() => {
    return () => {
      if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);
    };
  }, []);

  // Listen for custom trigger to open WhatsApp widget from anywhere in app
  useEffect(() => {
    const handleOpenWidget = () => {
      const phone = localStorage.getItem('visitorPhone') || '';
      if (!phone) {
        alert('يرجى تسجيل الدخول أولاً بالـ OTP لتأكيد حسابك وبدء التواصل المباشر 🔐');
        window.location.href = '/visitor-login';
        return;
      }
      setIsOpen(true);
      clearNotifications();
    };
    window.addEventListener('open_whatsapp_widget', handleOpenWidget);
    return () => window.removeEventListener('open_whatsapp_widget', handleOpenWidget);
  }, []);

  // Synthesize pleasant notification chime sound using Web Audio API
  const playChimeSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // Ignore audio autoplay restrictions
    }
  };

  // Trigger Browser Desktop Push Notification
  const triggerBrowserNotification = (msgText) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('منصة اتجاه التحليل الذكي 💬', {
          body: msgText || 'رسالة جديدة من خدمة العملاء',
          icon: '/logo.jpg',
          tag: 'whatsapp_msg'
        });
      }
    } catch (e) {}
  };

  // Update browser favicon dynamically with red badge
  const updateFaviconBadge = (hasUnread) => {
    try {
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }

      if (!hasUnread) {
        link.href = '/logo.jpg';
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = '/logo.jpg';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0, 64, 64);

        // Draw glowing red notification badge in top-right corner
        ctx.beginPath();
        ctx.arc(50, 14, 11, 0, Math.PI * 2, false);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        link.href = canvas.toDataURL('image/png');
      };
    } catch (e) {}
  };

  // Clear all unread notifications, title flasher, favicon badge & toast alerts
  const clearNotifications = () => {
    if (titleIntervalRef.current) {
      clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
    }
    document.title = 'اتجاه للتحليل الذكي';
    setHasUnread(false);
    updateFaviconBadge(false);
    setToastAlert(null);
    window.dispatchEvent(new CustomEvent('etegah_unread_msg', { detail: { hasUnread: false } }));
  };

  // Trigger all notification alerts (sound, push, title flasher, favicon badge, in-app toast)
  const triggerNotifications = (msgText) => {
    playChimeSound();
    triggerBrowserNotification(msgText);

    setHasUnread(true);
    updateFaviconBadge(true);
    setToastAlert(msgText);
    window.dispatchEvent(new CustomEvent('etegah_unread_msg', { detail: { hasUnread: true } }));

    // Flash browser tab title repeatedly
    if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);
    let toggle = false;
    titleIntervalRef.current = setInterval(() => {
      document.title = toggle ? '(1) رسالة جديدة 💬' : '🔔 اتجاه للتحليل الذكي';
      toggle = !toggle;
    }, 1000);
  };

  // Check login authentication state from localStorage & Firestore
  useEffect(() => {
    const phone = localStorage.getItem('visitorPhone') || '';
    const name = localStorage.getItem('visitorName') || 'عميل اتجاه';
    setUserPhone(phone);
    setUserName(name);

    if (phone) {
      getDocs(query(collection(db, 'بيانات_تسجيل_العملاء'), where('phoneNumber', '==', phone)))
        .then((snap) => {
          if (!snap.empty) {
            const data = snap.docs[0].data();
            if (data.name) setUserName(data.name);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Click outside listener to close emoji picker or widget modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current && 
        !emojiPickerRef.current.contains(event.target) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
      if (isOpen && widgetRef.current && !widgetRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsExpanded(false);
        clearNotifications();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, isExpanded]);

  // Restore assigned employee & chat session automatically on load
  useEffect(() => {
    if (!userPhone) return;
    const cleanPhone = userPhone.replace(/[^0-9]/g, '');
    const chatId = `chat_${cleanPhone}`;

    // 1. Check local storage for instant state restoration
    const savedLocalEmp = localStorage.getItem(`assignedEmp_${cleanPhone}`);
    if (savedLocalEmp) {
      try {
        const parsedEmp = JSON.parse(savedLocalEmp);
        if (parsedEmp && parsedEmp.name) {
          setAssignedEmp(parsedEmp);
          setWidgetStep('chat_room');
        }
      } catch (e) {}
    }

    // 2. Listen to Firestore website_chats for real-time assigned emp sync
    const chatDocRef = doc(db, 'website_chats', chatId);
    const unsub = onSnapshot(chatDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.assignedEmp) {
          setAssignedEmp(data.assignedEmp);
          setWidgetStep('chat_room');
          localStorage.setItem(`assignedEmp_${cleanPhone}`, JSON.stringify(data.assignedEmp));
        }
        if (data.name && (!userName || userName === 'عميل اتجاه')) {
          setUserName(data.name);
        }
      }
    }, (err) => console.error("Firestore website_chat restore error:", err));

    return () => unsub();
  }, [userPhone]);

  // Listen strictly to رسائل_الموظفين_للعملاء for real-time, non-duplicated messages
  useEffect(() => {
    if (!userPhone) return;
    const cleanPhone = userPhone.replace(/[^0-9]/g, '');
    let localPhone = '';
    if (cleanPhone.startsWith('9665')) {
      localPhone = '0' + cleanPhone.substring(3);
    } else if (cleanPhone.startsWith('9715')) {
      localPhone = '0' + cleanPhone.substring(3);
    }

    const possibleIds = Array.from(new Set([
      cleanPhone, 
      userPhone, 
      `+${cleanPhone}`, 
      `chat_${cleanPhone}`,
      localPhone
    ])).filter(Boolean);

    const q1 = query(
      collection(db, 'رسائل_الموظفين_للعملاء'),
      where('conversationId', 'in', possibleIds)
    );

    const q2 = query(
      collection(db, 'رسائل_الموظفين_للعملاء'),
      where('phoneNumber', 'in', possibleIds)
    );

    const processSnapshots = (snaps) => {
      const msgMap = new Map();
      snaps.forEach((snap) => {
        if (!snap) return;
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          let tsMs = Date.now();
          if (data.timestamp?.toDate) {
            tsMs = data.timestamp.toDate().getTime();
          } else if (data.timestamp) {
            tsMs = new Date(data.timestamp).getTime();
          }

          msgMap.set(docSnap.id, {
            id: docSnap.id,
            ...data,
            tsMs
          });
        });
      });

      const msgList = Array.from(msgMap.values());
      msgList.sort((a, b) => a.tsMs - b.tsMs);

      setMessages(msgList);

      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        prevMsgCountRef.current = msgList.length;
      } else {
        // Play sound notification & browser push for new staff responses
        if (msgList.length > prevMsgCountRef.current) {
          const lastMsg = msgList[msgList.length - 1];
          if (lastMsg && (lastMsg.sender === 'staff' || lastMsg.sender === 'employee' || lastMsg.sender === 'admin' || lastMsg.sender === 'agent')) {
            triggerNotifications(lastMsg.text || 'رسالة جديدة من خدمة العملاء');
          }
        }
        prevMsgCountRef.current = msgList.length;
      }
    };

    let s1 = null;
    let s2 = null;

    const unsub1 = onSnapshot(q1, (snap) => {
      s1 = snap;
      processSnapshots([s1, s2]);
    }, (err) => console.error("q1 error:", err));

    const unsub2 = onSnapshot(q2, (snap) => {
      s2 = snap;
      processSnapshots([s1, s2]);
    }, (err) => console.error("q2 error:", err));

    return () => {
      unsub1();
      unsub2();
    };
  }, [userPhone, isOpen]);

  // Auto scroll to latest message
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      clearNotifications();
    }
  }, [messages, isOpen]);

  // Handle open trigger click
  const handleTriggerClick = () => {
    if (!userPhone) {
      alert('يرجى تسجيل الدخول أولاً بالـ OTP لتأكيد حسابك وبدء التواصل المباشر 🔐');
      window.location.href = '/visitor-login';
      return;
    }
    setIsOpen(!isOpen);
    clearNotifications();
  };

  // Back Button Navigation inside Widget
  const handleBackButtonClick = () => {
    if (widgetStep === 'chat_room') {
      setWidgetStep('code_input');
    } else {
      setIsOpen(false);
      setIsExpanded(false);
      clearNotifications();
    }
  };

  // Verify Employee Code
  const handleVerifyEmpCode = async (e) => {
    if (e) e.preventDefault();
    const rawCode = empCodeInput.trim().replace(/^#/, '');
    if (!rawCode) {
      setCodeError('يرجى إدخال كود الموظف صحيحاً');
      return;
    }

    setIsVerifyingCode(true);
    setCodeError('');

    try {
      const q = query(collection(db, 'users'), where('empCode', '==', rawCode));
      const snap = await getDocs(q);

      let empObj = null;
      if (!snap.empty) {
        const empData = snap.docs[0].data();
        empObj = {
          uid: snap.docs[0].id,
          name: empData.username || empData.name || `موظف #${rawCode}`,
          empCode: rawCode,
          jobTitle: empData.jobTitle || 'مستشار اتجاه'
        };
      } else {
        const q2 = query(collection(db, 'users'), where('username', '==', rawCode));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          const empData = snap2.docs[0].data();
          empObj = {
            uid: snap2.docs[0].id,
            name: empData.username || empData.name || `موظف #${rawCode}`,
            empCode: empData.empCode || rawCode,
            jobTitle: empData.jobTitle || 'مستشار اتجاه'
          };
        }
      }

      if (empObj) {
        setAssignedEmp(empObj);
        setWidgetStep('chat_room');
        if (userPhone) {
          const cleanPhone = userPhone.replace(/[^0-9]/g, '');
          localStorage.setItem(`assignedEmp_${cleanPhone}`, JSON.stringify(empObj));
          // Send message to staff when employee code is entered
          addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
            conversationId: cleanPhone,
            phoneNumber: userPhone,
            sender: 'client',
            text: `💬 بدء محادثة جديدة وتواصل مباشر مع المختص #${rawCode} (${empObj.name})`,
            timestamp: serverTimestamp()
          }).catch(console.error);
        }
        initChatSession(empObj);
      } else {
        setCodeError(`الكود #${rawCode} غير مسجل بالنظام، يرجى المحاولة أو التواصل مع خدمة العملاء`);
      }
    } catch (err) {
      console.error("Code lookup error:", err);
      setCodeError('حدث خطأ أثناء التحقق من الكود');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Connect to Customer Service
  const handleConnectCustomerService = () => {
    const csObj = {
      uid: null,
      name: 'خدمة العملاء والدعم الفني',
      empCode: 'CS',
      jobTitle: 'الدعم الفني المباشر'
    };
    setAssignedEmp(csObj);
    setWidgetStep('chat_room');
    if (userPhone) {
      const cleanPhone = userPhone.replace(/[^0-9]/g, '');
      localStorage.setItem(`assignedEmp_${cleanPhone}`, JSON.stringify(csObj));
    }
    initChatSession(csObj);
  };

  // Logout from assigned employee chat session with confirmation alert
  const handleLogoutAssignedEmp = async () => {
    const confirmLogout = window.confirm("⚠️ تنبيه هام: عند الخروج من محادثة الموظف المختص سينتهي التخصيص ويمكنك التواصل مع موظف آخر أو خدمة العملاء. هل أنت متأكد من الاستمرار؟");
    if (!confirmLogout) return;

    if (userPhone) {
      const cleanPhone = userPhone.replace(/[^0-9]/g, '');
      localStorage.removeItem(`assignedEmp_${cleanPhone}`);
      try {
        const chatId = `chat_${cleanPhone}`;
        await setDoc(doc(db, 'website_chats', chatId), {
          assignedEmp: null,
          assignedTo: 'خدمة العملاء',
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {}
    }
    setAssignedEmp(null);
    setWidgetStep('code_input');
  };

  // Save session metadata in website_chats, بيانات_تسجيل_العملاء & customers
  const initChatSession = async (targetEmp) => {
    if (!userPhone) return;
    const cleanPhone = userPhone.replace(/[^0-9]/g, '');
    const chatId = `chat_${cleanPhone}`;

    const chatDocRef = doc(db, 'website_chats', chatId);
    const regCustomerDocRef = doc(db, 'بيانات_تسجيل_العملاء', cleanPhone);
    const customerDocRef = doc(db, 'customers', cleanPhone);

    const chatData = {
      id: chatId,
      phoneNumber: userPhone,
      cleanPhone: cleanPhone,
      name: userName || 'عميل اتجاه',
      source: 'website_whatsapp',
      crmStatus: 'unassigned',
      assignedToUid: targetEmp?.uid || null,
      assignedTo: targetEmp?.name || 'خدمة العملاء',
      assignedEmp: targetEmp,
      updatedAt: serverTimestamp(),
      lastMsgText: 'بدأت محادثة من موقع اتجاه',
      lastMsgTime: new Date().toISOString()
    };

    try {
      await setDoc(chatDocRef, chatData, { merge: true });

      await setDoc(regCustomerDocRef, {
        phoneNumber: userPhone,
        name: userName || 'عميل اتجاه',
        source: 'website_whatsapp',
        addedBy: 'WhatsApp Webhook',
        crmStatus: 'unassigned',
        assignedToUid: targetEmp?.uid || null,
        assignedTo: targetEmp?.name || 'خدمة العملاء',
        unread: 1,
        timestamp: serverTimestamp()
      }, { merge: true });

      await setDoc(customerDocRef, {
        phoneNumber: userPhone,
        name: userName || 'عميل اتجاه',
        source: 'website_whatsapp',
        addedBy: 'WhatsApp Webhook',
        crmStatus: 'unassigned',
        assignedToUid: targetEmp?.uid || null,
        assignedTo: targetEmp?.name || 'خدمة العملاء',
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Error creating chat doc:", err);
    }
  };

  // File / Image selection handler
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPendingMedia({
        url: event.target.result,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  // Select Emoji from picker
  const handleEmojiSelect = (emoji) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Send message handler
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const textToSend = inputText;
    const mediaToSend = pendingMedia;
    const replyToSend = replyToMessage;

    if ((!textToSend || !textToSend.trim()) && !mediaToSend) return;
    if (!userPhone) return;

    const cleanPhone = userPhone.replace(/[^0-9]/g, '');

    // Reset local input states immediately
    setInputText('');
    setPendingMedia(null);
    setReplyToMessage(null);
    setShowEmojiPicker(false);

    const newMsgDoc = {
      conversationId: cleanPhone,
      phoneNumber: userPhone,
      sender: 'client',
      text: textToSend.trim(),
      mediaUrl: mediaToSend?.url || null,
      mediaType: mediaToSend?.type || null,
      mediaName: mediaToSend?.name || null,
      replyTo: replyToSend ? { sender: replyToSend.sender, text: replyToSend.text || 'مرفق' } : null,
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), newMsgDoc);

      const chatId = `chat_${cleanPhone}`;
      const chatDocRef = doc(db, 'website_chats', chatId);
      await setDoc(chatDocRef, {
        id: chatId,
        phoneNumber: userPhone,
        cleanPhone: cleanPhone,
        name: userName || 'عميل اتجاه',
        source: 'website_whatsapp',
        lastMsgText: textToSend.trim() || (mediaToSend ? '📎 مرفق' : ''),
        lastMsgTime: new Date().toISOString(),
        updatedAt: serverTimestamp(),
        unreadCountStaff: (messages.length || 0) + 1
      }, { merge: true });

      const regCustomerDocRef = doc(db, 'بيانات_تسجيل_العملاء', cleanPhone);
      const customerDocRef = doc(db, 'customers', cleanPhone);

      await setDoc(regCustomerDocRef, {
        phoneNumber: userPhone,
        name: userName || 'عميل اتجاه',
        source: 'website_whatsapp',
        addedBy: 'WhatsApp Webhook',
        unread: 1,
        lastMessage: textToSend.trim() || (mediaToSend ? '📎 مرفق' : ''),
        timestamp: serverTimestamp()
      }, { merge: true });

      await setDoc(customerDocRef, {
        phoneNumber: userPhone,
        name: userName || 'عميل اتجاه',
        source: 'website_whatsapp',
        addedBy: 'WhatsApp Webhook',
        lastComment: textToSend.trim() || (mediaToSend ? '📎 مرفق' : ''),
        updatedAt: serverTimestamp()
      }, { merge: true });

    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // Keyboard Enter key handler
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <>
      {/* Floating Ringing Call Banner / Modal */}
      {activeInternalCall && activeInternalCall.status === 'ringing' && (
        <div className="fixed top-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[9999] bg-gradient-to-r from-slate-900/95 via-indigo-950/95 to-slate-900/95 backdrop-blur-2xl border-2 border-cyan-400 text-white p-4.5 rounded-3xl shadow-[0_20px_60px_rgba(6,182,212,0.6)] animate-bounce font-sans border-t-2 border-t-cyan-300" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 animate-ping shrink-0">
              <PhoneCall size={24} />
            </div>
            <div className="flex-1">
              <h4 className="font-extrabold text-xs sm:text-sm text-cyan-300">
                📞 اتصال داخلي جاري من {activeInternalCall.empName || 'الموظف'}!
              </h4>
              <p className="text-[11px] text-gray-200 mt-0.5">ويرغب في تنبيهك والتواصل الفوري معك في الشات.</p>
            </div>
          </div>
          <div className="mt-3.5 flex gap-2">
            <button
              onClick={handleAnswerCall}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold py-2 px-3 rounded-xl text-xs shadow-md cursor-pointer transition active:scale-95"
            >
              فتح المحادثة والرد 💬
            </button>
            <button
              onClick={handleCancelCall}
              className="bg-rose-950/80 hover:bg-rose-900/90 border border-rose-500/40 text-rose-300 font-bold py-2 px-3 rounded-xl text-xs cursor-pointer transition"
            >
              إلغاء / كنسل
            </button>
          </div>
        </div>
      )}

      {/* In-App Floating Toast Alert Banner */}
      {toastAlert && !isOpen && (
        <div 
          onClick={() => { setIsOpen(true); clearNotifications(); }}
          className="fixed top-20 right-4 sm:right-6 z-[9999] bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-cyan-400 text-white px-4 py-3 rounded-2xl shadow-[0_10px_35px_rgba(6,182,212,0.5)] flex items-center gap-3 cursor-pointer animate-bounce max-w-sm"
        >
          <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center shrink-0">
            <MessageCircle size={20} className="text-cyan-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="font-bold text-xs text-cyan-300 flex items-center gap-1">
              رسالة جديدة من خدمة العملاء 💬
            </h5>
            <p className="text-[11px] text-gray-200 truncate">{toastAlert}</p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setToastAlert(null); }} 
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div 
        ref={widgetRef} 
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsOpen(false);
            setIsExpanded(false);
            clearNotifications();
          }
        }}
        className={`fixed ${
          isExpanded 
            ? 'inset-0 z-[9999] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-2 sm:p-6 overflow-hidden' 
            : 'bottom-4 left-4 sm:bottom-6 sm:left-6 z-50'
        } font-sans transition-all duration-300`} 
        dir="rtl"
      >
        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          accept="image/*,.pdf,.doc,.docx,.txt" 
          className="hidden" 
        />

        {/* Main Chat Modal */}
        {isOpen && (
          <div className={`${
            isExpanded 
              ? 'w-full max-w-5xl h-[92vh] rounded-3xl' 
              : 'mb-3 w-[calc(100vw-32px)] max-w-88 sm:max-w-96 rounded-3xl h-[520px]'
          } bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/40 text-white shadow-[0_20px_80px_rgba(0,0,0,0.9)] flex flex-col relative overflow-hidden animate-fade-in border-t-2 border-t-cyan-400`}>
            
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <img src="/logo.jpg" alt="Logo" className="w-9 h-9 rounded-full object-cover border-2 border-cyan-400 shadow-md" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900"></span>
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1 truncate">
                    منصة اتجاه التحليل الذكي
                  </h4>
                  <p className="text-[10px] text-cyan-300 font-semibold flex items-center gap-1 truncate">
                    {assignedEmp ? `💬 ${assignedEmp.name}` : 'تواصل مباشر ومعاينة لحظية ⚡'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Logout / Switch Specialist Employee (Only in Specialist Chat, NOT Customer Service) */}
                {widgetStep === 'chat_room' && assignedEmp && assignedEmp.empCode && assignedEmp.empCode !== 'CS' && (
                  <button
                    onClick={handleLogoutAssignedEmp}
                    className="text-[9px] font-bold text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-900/90 border border-rose-500/40 px-1.5 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-0.5 shrink-0 shadow-sm"
                    title="تسجيل الخروج من محادثة الموظف المختص"
                  >
                    <LogOut size={11} className="shrink-0" />
                    <span>خروج</span>
                  </button>
                )}

                {/* Back Arrow Button */}
                <button
                  onClick={handleBackButtonClick}
                  className="text-gray-400 hover:text-cyan-300 transition p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
                  title="رجوع للخلف"
                >
                  <ArrowRight size={18} />
                </button>

                {/* Expand / Fullscreen Toggle Button */}
                <button 
                  onClick={() => setIsExpanded(!isExpanded)} 
                  className="text-gray-400 hover:text-cyan-300 transition p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
                  title={isExpanded ? 'تصغير الشاشة' : 'توسيع بملء الصفحة'}
                >
                  {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                {/* Close Button */}
                <button 
                  onClick={() => { setIsOpen(false); setIsExpanded(false); clearNotifications(); }} 
                  className="text-gray-400 hover:text-white transition p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* User Status Bar with Client Name & Phone on right, Internal Call Alert button on left */}
            <div className="bg-cyan-950/40 px-4 py-2 border-b border-cyan-500/20 flex items-center justify-between text-[11px] shrink-0">
              {/* Right Side: Client Name + Phone Number underneath */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 truncate">
                  <User size={13} className="text-cyan-400 shrink-0" />
                  <span className="font-bold text-cyan-200 truncate">{userName || 'عميل اتجاه'}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-cyan-400/90 font-mono mt-0.5" dir="ltr">
                  <ShieldCheck size={12} className="text-emerald-400 shrink-0" title="حساب موثق بالـ OTP" />
                  <span>{userPhone}</span>
                </div>
              </div>

              {/* Left Side: Standalone Internal Call Alert Trigger Button */}
              <button
                type="button"
                onClick={handleTriggerInternalCall}
                className="flex items-center gap-1.5 text-cyan-200 text-[10px] sm:text-[11px] font-bold bg-cyan-900/70 hover:bg-cyan-800/90 p-1.5 px-2.5 rounded-xl border border-cyan-400/50 shadow-md transition cursor-pointer active:scale-95 animate-pulse"
                title="اضغط لإرسال اتصال داخلي للتنبيه بالرسائل فوراً 📞"
              >
                <PhoneCall size={13} className="text-cyan-300 shrink-0" />
                <span>اتصال داخلي للتنبيه بالرسائل</span>
              </button>
            </div>

            {/* Step 1: Code Input / Selection */}
            {widgetStep === 'code_input' && (
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-xs text-gray-300 leading-relaxed">
                  أهلاً بك <strong className="text-white">{userName}</strong>! يرجى إدخال كود الموظف المباشر للتواصل معه، أو الاختيار المباشر لخدمة العملاء:
                </div>

                <form onSubmit={handleVerifyEmpCode} className="space-y-2.5">
                  <label className="block text-[11px] font-bold text-cyan-200">
                    المتابعة مع مختص ( ادخل كود الموظف المختص ):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={empCodeInput}
                      onChange={(e) => setEmpCodeInput(e.target.value)}
                      placeholder="أدخل كود الموظف..."
                      className="flex-1 bg-slate-900 border border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={isVerifyingCode}
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isVerifyingCode ? 'جاري الفحص...' : 'دخول'}
                    </button>
                  </div>
                  {codeError && <p className="text-[10px] text-rose-400 font-semibold">{codeError}</p>}
                </form>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                  <div className="relative flex justify-center text-[10px]"><span className="bg-slate-950 px-2 text-gray-400">أو</span></div>
                </div>

                <button
                  onClick={handleConnectCustomerService}
                  className="w-full flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg transition-all text-xs border border-purple-400/40 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Headphones size={16} /> التواصل مع خدمة العملاء ( الدعم الفني )
                  </span>
                  <Sparkles size={14} className="text-amber-300" />
                </button>
              </div>
            )}

            {/* Step 2: Live Chat Room */}
            {widgetStep === 'chat_room' && (
              <div className="flex flex-col flex-1 min-h-0 relative">
                
                {/* 3D Glassmorphism Logo Watermark Background */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden opacity-10">
                  <img 
                    src="/logo.jpg" 
                    alt="3D Logo Watermark" 
                    className="w-48 h-48 sm:w-64 sm:h-64 rounded-full object-cover shadow-[0_0_80px_rgba(6,182,212,0.6)] backdrop-blur-xl border-4 border-cyan-400/30 transform rotate-12 scale-125" 
                  />
                </div>

                {/* Message List */}
                <div 
                  onClick={() => setShowEmojiPicker(false)}
                  className="flex-1 p-3.5 space-y-3 overflow-y-auto custom-scrollbar relative z-10"
                >
                  {messages.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-xs">
                      <p className="mb-2">👋 مرحباً بك! أرسل استفسارك وسيجيبك الموظف فوراً.</p>
                      <span className="inline-block bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] text-cyan-300">
                        متصل مع: {assignedEmp?.name}
                      </span>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isClient = msg.sender === 'client';
                      return (
                        <div key={msg.id || idx} className={`group flex flex-col ${isClient ? 'items-end' : 'items-start'} relative`}>
                          <div className={`relative ${isExpanded ? 'max-w-md sm:max-w-xl' : 'max-w-[85%]'} p-3 rounded-2xl text-xs leading-relaxed shadow-lg ${
                            isClient 
                              ? 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white rounded-br-none border border-cyan-400/30' 
                              : 'bg-slate-900/90 text-gray-100 border border-white/15 rounded-bl-none'
                          }`}>
                            
                            {/* Reply Context Bubble */}
                            {msg.replyTo && (
                              <div className="mb-2 p-1.5 rounded-lg bg-black/30 border-r-2 border-cyan-300 text-[10px] text-cyan-200 truncate">
                                <span className="font-bold block text-cyan-300">
                                  ↩️ الرد على ({msg.replyTo.sender === 'client' ? 'رسالتك' : 'الموظف'}):
                                </span>
                                <span className="opacity-90">{msg.replyTo.text}</span>
                              </div>
                            )}

                            {/* Media Preview (Image or Document) */}
                            {msg.mediaUrl && (
                              <div className="my-1.5">
                                {msg.mediaType === 'image' ? (
                                  <img 
                                    src={msg.mediaUrl} 
                                    alt="Attachment" 
                                    onClick={() => window.open(msg.mediaUrl, '_blank')}
                                    className="rounded-xl max-h-56 max-w-full object-cover border border-white/20 hover:opacity-90 transition cursor-pointer"
                                  />
                                ) : (
                                  <a 
                                    href={msg.mediaUrl} 
                                    download={msg.mediaName || 'file'}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 rounded-xl bg-white/10 border border-white/20 text-cyan-200 hover:bg-white/20 transition text-xs"
                                  >
                                    <FileText size={16} />
                                    <span className="truncate max-w-[150px]">{msg.mediaName || 'تحميل المستند'}</span>
                                    <Download size={14} className="ml-auto shrink-0" />
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Message Text */}
                            {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}

                            {/* Inline Reply Trigger Icon */}
                            <button
                              onClick={() => setReplyToMessage(msg)}
                              className="absolute -top-2 left-1 opacity-0 group-hover:opacity-100 transition bg-slate-800 border border-cyan-400/40 text-cyan-300 hover:text-white p-1 rounded-full text-[9px] cursor-pointer"
                              title="إعادة توجيه / ريبلاي"
                            >
                              <Reply size={11} />
                            </button>
                          </div>

                          {/* Timestamp & Status */}
                          <div className="flex items-center gap-1 mt-0.5 px-1 text-[9px] text-gray-400">
                            <span>
                              {msg.tsMs ? new Date(msg.tsMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            {isClient && <CheckCheck size={11} className="text-cyan-400" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Emoji Picker Popover */}
                {showEmojiPicker && (
                  <div 
                    ref={emojiPickerRef}
                    className="absolute bottom-16 right-3 left-3 z-30 p-2.5 bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl grid grid-cols-8 gap-1 text-base animate-fade-in"
                  >
                    {popularEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleEmojiSelect(emoji)}
                        className="p-1.5 hover:bg-white/10 rounded-xl transition cursor-pointer text-center"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Reply Preview Bar */}
                {replyToMessage && (
                  <div className="px-3 py-1.5 bg-cyan-950/80 border-t border-cyan-500/30 flex items-center justify-between text-xs text-cyan-200 z-20 shrink-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <Reply size={13} className="text-cyan-400 shrink-0" />
                      <span className="truncate">الرد على: {replyToMessage.text || 'مرفق'}</span>
                    </div>
                    <button onClick={() => setReplyToMessage(null)} className="text-gray-400 hover:text-white cursor-pointer p-0.5">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Pending Media Preview Bar */}
                {pendingMedia && (
                  <div className="px-3 py-1.5 bg-slate-900 border-t border-cyan-500/30 flex items-center justify-between text-xs text-emerald-300 z-20 shrink-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <Paperclip size={13} className="shrink-0" />
                      <span className="truncate">{pendingMedia.name}</span>
                    </div>
                    <button onClick={() => setPendingMedia(null)} className="text-rose-400 hover:text-rose-300 cursor-pointer p-0.5">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Chat Input Form */}
                <form onSubmit={handleSendMessage} className="p-2.5 bg-slate-950 border-t border-white/10 flex items-center gap-1.5 relative z-20 shrink-0">
                  
                  {/* File Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-gray-400 hover:text-cyan-300 transition p-2 rounded-xl hover:bg-white/10 cursor-pointer"
                    title="إرفاق صورة أو مستند"
                  >
                    <Paperclip size={17} />
                  </button>

                  {/* Emoji Button */}
                  <button
                    ref={emojiBtnRef}
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="text-gray-400 hover:text-amber-300 transition p-2 rounded-xl hover:bg-white/10 cursor-pointer"
                    title="إيموجي"
                  >
                    <Smile size={17} />
                  </button>

                  {/* Text Input */}
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب رسالتك هنا... (اضغط Enter للإرسال)"
                    className="flex-1 bg-slate-900 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                  />

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!inputText.trim() && !pendingMedia}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white p-2.5 rounded-xl transition shadow-md cursor-pointer disabled:opacity-40"
                    title="إرسال"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}

          </div>
        )}

        {/* Floating Trigger Button */}
        {!isExpanded && (
          <button
            onClick={handleTriggerClick}
            className="relative flex items-center gap-2 bg-gradient-to-r from-green-500 via-emerald-600 to-teal-600 hover:from-green-400 hover:to-teal-500 text-white font-black px-4 py-3 rounded-full shadow-[0_8px_30px_rgba(16,185,129,0.5)] border-2 border-emerald-300 transition-all transform hover:scale-105 active:scale-95 cursor-pointer z-50"
          >
            <MessageCircle size={22} className="animate-bounce shrink-0" />
            <span className="text-xs tracking-wide whitespace-nowrap">تواصل معنا</span>
            
            {/* Red Notification Badge */}
            {hasUnread && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white text-[9px] font-bold items-center justify-center">!</span>
              </span>
            )}
          </button>
        )}
      </div>
    </>
  );
}
