import React, { useState, useEffect, useRef } from 'react';
import { auth, db, signOut, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, where, getDocs, deleteDoc, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Send, User, Clock, CheckCircle2, MessageSquare, ChevronRight, UserPlus, X, BarChart3, Trash2, Paperclip, FileText, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Inbox() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeChat, setActiveChat] = useState(null);
  const [message, setMessage] = useState('');
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const messagesContainerRef = useRef(null);
  const isFirstLoad = useRef(true);
  const previousUnreadCounts = useRef({});
  
  // New state for Add Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  // Attachment state
  const [attachment, setAttachment] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef(null);
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerCountryCode, setNewCustomerCountryCode] = useState('+966');
  const [selectedAssigneeUid, setSelectedAssigneeUid] = useState('');

  // Swipe to go back on mobile
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    // السحب لليمين (نفس اتجاه سهم الرجوع في اللغة العربية)
    if (distance < -50) {
      setActiveChat(null);
    }
  };

  const currentUser = auth.currentUser;
  const isAdmin = currentUser?.email?.toLowerCase() === 'etegahanalysis@gmail.com';
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');

  // جلب الموظفين للأدمن
  useEffect(() => {
    if (isAdmin) {
      const fetchEmployees = async () => {
        const usersSnap = await getDocs(collection(db, 'users'));
        const emps = [];
        usersSnap.forEach(doc => {
          if (doc.data().role === 'employee') {
            emps.push(doc.data());
          }
        });
        setEmployees(emps);
      };
      fetchEmployees();
    }
  }, [isAdmin]);

  // جلب المحادثات لحظياً من Firebase
  useEffect(() => {
    if (!currentUser) return;
    
    // الأدمن يرى كل المحادثات، الموظف يرى المحادثات المسندة له فقط
    const q = isAdmin 
      ? query(collection(db, 'بيانات_تسجيل_العملاء'), orderBy('updatedAt', 'desc'))
      : query(collection(db, 'بيانات_تسجيل_العملاء'), where('assignedToUid', '==', currentUser.uid)); // No orderBy to avoid needing a composite index

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let chatsData = [];
      snapshot.forEach((doc) => {
        chatsData.push({ id: doc.id, ...doc.data() });
      });
      
      // إشعارات للرسائل والعملاء الجدد
      if (!isFirstLoad.current) {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const docId = change.doc.id;

          if (change.type === 'added') {
            toast.success('تم دخول عميل جديد للواتساب!', { icon: '👋', id: `new-${docId}` });
            try { new Audio('/notification.mp3').play(); } catch(e){}
            previousUnreadCounts.current[docId] = data.unread || 0;
          }
          if (change.type === 'modified') {
            const prevUnread = previousUnreadCounts.current[docId] || 0;
            // Show notification ONLY if unread count actually increased
            if (data.unread > prevUnread && activeChat?.id !== docId) {
              toast('رسالة جديدة من: ' + (data.name || data.phoneNumber), { 
                icon: '💬', 
                id: `msg-${docId}-${data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now()}` 
              });
              try { new Audio('/notification.mp3').play(); } catch(e){}
            }
            previousUnreadCounts.current[docId] = data.unread || 0;
          }
        });
      } else {
        // Initialize the ref on first load
        snapshot.docs.forEach((doc) => {
          previousUnreadCounts.current[doc.id] = doc.data().unread || 0;
        });
      }

      // إذا كان موظف، نقوم بترتيب المحادثات يدوياً (Client-side) لتجنب أخطاء الفهارس في Firebase
      if (!isAdmin) {
        chatsData.sort((a, b) => {
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
          return timeB - timeA;
        });
      }

      setChats(chatsData);
      
      // تحديث المحادثة النشطة إذا تغيرت بياناتها
      setActiveChat(prev => {
        if (!prev) return null;
        const updatedActiveChat = chatsData.find(c => c.id === prev.id);
        return updatedActiveChat || prev;
      });
      
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
      }
    });
    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  // Handle routing state to open a specific chat
  useEffect(() => {
    if (location.state?.selectedCustomerId && chats.length > 0) {
      const targetChat = chats.find(c => c.id === location.state.selectedCustomerId);
      if (targetChat) {
        setActiveChat(targetChat);
        // Clear the state so it doesn't reopen if they navigate away and back without state
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state?.selectedCustomerId, chats]);

  // جلب رسائل المحادثة النشطة لحظياً
  useEffect(() => {
    if (!activeChat) return;
    
    const q = query(
      collection(db, 'رسائل_الموظفين_للعملاء'), 
      where('conversationId', '==', activeChat.id),
      orderBy('timestamp', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgsData = [];
      snapshot.forEach((doc) => {
        msgsData.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgsData);
      scrollToBottom();
    });
    
    return () => unsubscribe();
  }, [activeChat]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  // وظيفة إسناد المحادثة للموظف (من قبل الأدمن) من الخارج
  const handleAssignChat = async (chatId, empUid) => {
    if (!currentUser || !isAdmin || !empUid) return;
    try {
      const newAssignee = employees.find(e => e.uid === empUid);
      const chat = chats.find(c => c.id === chatId);
      if (!newAssignee || !chat) return;
      await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', chatId), {
        assignedTo: newAssignee.email,
        assignedToUid: newAssignee.uid,
        status: 'unassigned', // يظل في الانتظار حتى يرد عليه الموظف الجديد
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unread: 1 // تفعيل الإنذار الأحمر عند الموظف
      });
      toast.success(`تم تحويل المحادثة (${chat.name || chat.phoneNumber}) إلى ${newAssignee.name || newAssignee.email} بنجاح`);
    } catch (error) {
      console.error("خطأ في إسناد المحادثة:", error);
    }
  };

  // وظيفة فتح الشات وقراءة الرسالة تلقائياً
  const handleChatClick = async (chat) => {
    setActiveChat(chat);
    if (chat.unread > 0) {
      try {
        const chatRef = doc(db, 'بيانات_تسجيل_العملاء', chat.id);
        await updateDoc(chatRef, { unread: 0 }); // تتحول للأخضر فوراً
      } catch (err) {
        console.error("خطأ في تصفير العداد", err);
      }
    }
  };

  // وظيفة إرسال رسالة
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!message.trim() && !attachment) || !activeChat) return;

    const msgText = message.trim();
    setMessage(''); // مسح المربع فوراً لتجربة مستخدم أسرع

    let mediaUrl = null;
    let fileType = null;
    let fileName = null;

    if (attachment) {
      setUploadingAttachment(true);
      try {
        const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const fileRef = ref(storage, `chat_media/${activeChat.id}_${uniqueId}_${attachment.name}`);
        
        // Timeout for Firebase upload
        const uploadPromise = async () => {
          await uploadBytes(fileRef, attachment);
          return await getDownloadURL(fileRef);
        };
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Storage Timeout")), 15000)
        );

        mediaUrl = await Promise.race([uploadPromise(), timeoutPromise]);
        
        fileType = attachment.type;
        fileName = attachment.name;
        
        setAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error("خطأ في رفع الملف:", err);
        if (err.message === "Storage Timeout") {
          toast.error('انتهى وقت الرفع. يرجى التأكد من تفعيل خدمة Storage في Firebase.');
        } else {
          toast.error('حدث خطأ أثناء رفع الملف. هل تم إعداد Storage؟');
        }
        setUploadingAttachment(false);
        return;
      }
      setUploadingAttachment(false);
    }

    try {
      // 1. حفظ الرسالة في Firestore لتظهر فوراً للموظف
      const msgData = {
        conversationId: activeChat.id,
        text: msgText,
        sender: 'agent',
        senderEmail: currentUser.email,
        timestamp: serverTimestamp()
      };

      if (mediaUrl) {
        msgData.mediaUrl = mediaUrl;
        msgData.fileType = fileType;
        msgData.fileName = fileName;
      }

      await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), msgData);

      // 2. تحديث آخر رسالة في المحادثة
      const chatRef = doc(db, 'بيانات_تسجيل_العملاء', activeChat.id);
      
      const updateData = {
        lastMessage: msgText,
        updatedAt: serverTimestamp(),
        unread: 0
      };

      // إذا كانت المحادثة في الانتظار، يتم استلامها تلقائياً للموظف الذي أرسل الرسالة
      if (activeChat.status === 'unassigned') {
        updateData.status = 'assigned';
        updateData.assignedTo = currentUser.email;
        updateData.assignedToUid = currentUser.uid;
        updateData.assignedAt = serverTimestamp();
      }

      await updateDoc(chatRef, updateData);

      // 3. مناداة Vercel API لإرسالها فعلياً لواتساب العميل
      await fetch('/api/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: activeChat.phoneNumber,
          text: msgText,
          mediaUrl: mediaUrl
        })
      });
      
    } catch (error) {
      console.error("خطأ في إرسال الرسالة:", error);
    }
  };

  // تنسيق الوقت
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  const addDummyData = async () => {
    try {
      const docRef = await addDoc(collection(db, 'بيانات_تسجيل_العملاء'), {
        name: 'عميل تجريبي',
        phoneNumber: '+966500000000',
        lastMessage: 'مرحباً، هل يمكنني الاستفسار عن خدماتكم؟',
        unread: 1,
        status: 'unassigned',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
        conversationId: docRef.id,
        text: 'مرحباً، هل يمكنني الاستفسار عن خدماتكم؟',
        sender: 'client',
        phoneNumber: '+966500000000',
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMessage = async (msg) => {
    if (!isAdmin) return;
    if (window.confirm('هل أنت متأكد من نقل هذه الرسالة لسلة المهملات؟')) {
      try {
        await addDoc(collection(db, 'recycle_bin'), {
          ...msg,
          originalCollection: 'رسائل_الموظفين_للعملاء',
          type: 'message',
          deletedAt: serverTimestamp()
        });
        await deleteDoc(doc(db, 'رسائل_الموظفين_للعملاء', msg.id));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // وظيفة إضافة عميل يدوياً
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerPhone.trim() || !currentUser) {
      alert('يجب إدخال رقم هاتف العميل لإضافته عبر واتساب.');
      return;
    }
    
    const fullPhone = `${newCustomerCountryCode}${newCustomerPhone.trim().replace(/^0+/, '')}`;

    let assigneeEmail = currentUser.email;
    let assigneeUid = currentUser.uid;

    if (isAdmin && selectedAssigneeUid) {
      const emp = employees.find(e => e.uid === selectedAssigneeUid);
      if (emp) {
        assigneeEmail = emp.email;
        assigneeUid = emp.uid;
      }
    }

    try {
      const docRef = await addDoc(collection(db, 'بيانات_تسجيل_العملاء'), {
        phoneNumber: fullPhone,
        name: newCustomerName.trim() || 'عميل جديد (يدوي)',
        addedBy: currentUser.email,
        status: 'unassigned', // المضاف يدوياً يكون في الانتظار حتى يتم إرسال أول رسالة
        assignedTo: assigneeEmail,
        assignedToUid: assigneeUid,
        createdAt: serverTimestamp(),
        assignedAt: null,
        updatedAt: serverTimestamp(),
        lastMessage: 'تم التسجيل يدوياً بانتظار بدء المراسلة',
        unread: 0
      });
      
      // Auto open this chat
      setActiveChat({
        id: docRef.id,
        phoneNumber: fullPhone,
        name: newCustomerName.trim() || 'عميل جديد (يدوي)',
        status: 'assigned',
        assignedTo: assigneeEmail,
        assignedToUid: assigneeUid
      });
      
      setIsAddModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setSelectedAssigneeUid('');
    } catch (err) {
      console.error('Error adding customer:', err);
    }
  };

  return (
    <div className="flex h-[100dvh] w-full font-sans relative overflow-hidden bg-slate-900" dir="rtl">
      {/* 3D Modern Gradient Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-blue-600/30 blur-[120px] mix-blend-screen animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-500/20 blur-[100px] mix-blend-screen"></div>
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[100px] mix-blend-screen"></div>
      </div>

      {/* القائمة الجانبية */}
      <div className={`w-full md:w-1/3 md:max-w-sm bg-black/20 backdrop-blur-xl border-l border-white/10 flex-col relative z-10 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="bg-black/30 backdrop-blur-md p-4 border-b border-white/10 flex justify-between items-center shadow-sm">
          <div className="flex items-center space-x-3 space-x-reverse">
            <img src="/logo.jpg" alt="Etegah Logo" className="w-10 h-10 rounded-full object-cover border border-white/20 shadow-sm" />
            <span className="font-bold text-gray-100 text-sm truncate max-w-[150px]">
              {currentUser?.email?.split('@')[0]} ({isAdmin ? 'أدمن' : 'موظف'})
            </span>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <button 
              onClick={() => setIsAddModalOpen(true)} 
              className="text-gray-300 hover:text-primary transition bg-white/10 hover:bg-white/20 p-2 rounded-full" 
              title="إضافة عميل جديد يدوياً"
            >
              <UserPlus size={18} />
            </button>
            {isAdmin && (
              <button 
                onClick={() => navigate('/dashboard')} 
                className="text-white hover:bg-gray-700 transition bg-white/10 hover:bg-white/20 p-2 rounded-full shadow-sm" 
                title="لوحة إحصائيات العملاء"
              >
                <BarChart3 size={18} />
              </button>
            )}
            <button 
              onClick={handleLogout} 
              className="flex items-center space-x-1 space-x-reverse text-gray-300 hover:text-red-400 transition text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-full" 
              title="تسجيل الخروج"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]"></div>
              <span>خروج</span>
            </button>
          </div>
        </div>

        <div 
          className="flex-1 overflow-y-auto relative cursor-pointer"
          onClick={() => setActiveChat(null)}
        >
          {chats.length === 0 ? (
            <div className="text-center text-gray-400 p-8 flex flex-col items-center relative z-10">
              <p className="text-sm mb-4">لا توجد محادثات حالياً</p>
              <button 
                onClick={addDummyData}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded text-xs transition"
              >
                إضافة رسالة تجريبية للاختبار
              </button>
            </div>
          ) : (
            chats.map((chat) => {
              const isUnread = chat.status === 'unassigned' || chat.unread > 0;
              const statusColorClass = isUnread 
                ? 'bg-red-500/10 border-r-4 border-r-red-500 hover:bg-red-500/20' 
                : 'bg-green-500/10 border-r-4 border-r-green-500 hover:bg-green-500/20';
              const activeClass = activeChat?.id === chat.id ? 'bg-white/10 shadow-md' : '';

              return (
              <div 
                key={chat.id} 
                onClick={(e) => { e.stopPropagation(); handleChatClick(chat); }}
                className={`p-4 border-b border-white/5 cursor-pointer transition relative z-10 ${statusColorClass} ${activeClass}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-gray-100" dir="ltr">{chat.phoneNumber || chat.name}</h3>
                  <span className="text-xs text-gray-400">{formatTime(chat.updatedAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-300 truncate w-full">{chat.lastMessage}</p>
                </div>
                <div className="mt-2 flex flex-col space-y-2">
                  <div className="flex items-center text-xs">
                    {chat.status === 'unassigned' || chat.unread > 0 ? (
                      <span className="text-red-600 font-bold flex items-center">
                        <Clock size={12} className="ml-1" /> في انتظار الاستلام {chat.status !== 'unassigned' && `(${chat.assignedTo?.split('@')[0]})`}
                      </span>
                    ) : (
                      <span className="text-green-600 font-bold flex items-center">
                        <CheckCircle2 size={12} className="ml-1" /> مستلمة ({chat.assignedTo?.split('@')[0]})
                      </span>
                    )}
                  </div>
                  
                  {isAdmin && (
                    <div className="flex items-center mt-2 relative" onClick={e => e.stopPropagation()}>
                      <select 
                        value={chat.assignedToUid || ""}
                        onChange={(e) => handleAssignChat(chat.id, e.target.value)}
                        className="appearance-none border border-white/10 rounded-lg px-3 py-2 text-xs font-semibold text-gray-200 w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-black/20 hover:bg-black/40 transition-all cursor-pointer shadow-sm"
                      >
                        <option value="" disabled className="bg-gray-800 text-gray-400">-- سحب أو تعيين --</option>
                        {employees.map(emp => (
                          <option key={emp.uid} value={emp.uid} className="bg-gray-800 text-white">
                            {emp.role === 'admin' ? `👑 الإدارة (${emp.name || emp.email})` : (emp.name || emp.email)}
                          </option>
                        ))}
                      </select>
                      <div className="absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )})
          )}
        </div>
      </div>

      {/* شاشة الدردشة */}
      <div 
        className={`w-full md:w-2/3 md:flex-1 flex-col relative z-10 ${activeChat ? 'flex' : 'hidden md:flex'}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* خلفية الشعار الشفافة */}
        <div 
          className="absolute inset-0 opacity-10 bg-center bg-no-repeat pointer-events-none z-0"
          style={{ backgroundImage: "url('/logo.jpg')", backgroundSize: "400px" }}
        ></div>

        {activeChat ? (
          <>
            <div className="bg-black/30 backdrop-blur-xl p-4 border-b border-white/10 flex justify-between items-center shadow-sm z-10 relative">
              <div className="flex items-center space-x-3 space-x-reverse">
                <button onClick={() => setActiveChat(null)} className="md:hidden text-gray-300 ml-1 hover:text-white">
                  <ChevronRight size={28} />
                </button>
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-gray-200 font-bold shrink-0">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-gray-100" dir="ltr">{activeChat.phoneNumber}</h2>
                  <p className="text-xs text-gray-400">{activeChat.name || 'عميل جديد'}</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveChat(null)} 
                className="hidden md:flex items-center justify-center text-gray-300 hover:text-red-400 bg-white/10 hover:bg-white/20 border border-white/10 transition p-2 rounded-full shadow-sm"
                title="إغلاق المحادثة"
              >
                <X size={18} />
              </button>
            </div>

            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10 cursor-pointer scroll-smooth"
              onClick={() => setActiveChat(null)}
            >
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 text-sm mt-10">لا توجد رسائل سابقة.</div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'} group mb-2 cursor-default`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={`max-w-[70%] rounded-lg p-3 shadow-sm relative ${msg.sender === 'agent' ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}`}>
                      <div className="flex justify-between items-start">
                        <div className="ml-6 flex-1">
                          {msg.mediaUrl && (
                            <div className="mb-2">
                              {msg.fileType && msg.fileType.startsWith('image/') ? (
                                <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
                                  <img src={msg.mediaUrl} alt="مرفق" className="max-w-full h-auto rounded-lg border border-black/10 max-h-48 object-contain" />
                                </a>
                              ) : (
                                <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 space-x-reverse bg-black/5 p-2 rounded-lg hover:bg-black/10 transition">
                                  <FileText size={24} className="text-blue-600" />
                                  <span className="text-sm truncate max-w-[150px]" dir="ltr">{msg.fileName || 'ملف مرفق'}</span>
                                  <Download size={16} className="text-gray-500" />
                                </a>
                              )}
                            </div>
                          )}
                          {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                        </div>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteMessage(msg)}
                            className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition flex-shrink-0 mr-2"
                            title="حذف الرسالة (للإدارة فقط)"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 flex justify-end mt-1">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-black/30 backdrop-blur-xl p-4 border-t border-white/10 relative z-10">
              {attachment && (
                <div className="mb-2 flex items-center justify-between bg-white/10 p-2 rounded-lg border border-white/20">
                  <div className="flex items-center space-x-2 space-x-reverse text-white">
                    {attachment.type.startsWith('image/') ? (
                      <div className="w-8 h-8 rounded bg-black/20 flex items-center justify-center overflow-hidden">
                        <img src={URL.createObjectURL(attachment)} alt="preview" className="object-cover w-full h-full" />
                      </div>
                    ) : (
                      <FileText size={20} className="text-blue-300" />
                    )}
                    <span className="text-sm truncate max-w-[200px]" dir="ltr">{attachment.name}</span>
                    <span className="text-xs text-gray-400">({(attachment.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={() => { setAttachment(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="text-red-400 hover:text-red-300 transition">
                    <X size={18} />
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex space-x-2 space-x-reverse items-center">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      setAttachment(e.target.files[0]);
                    }
                  }} 
                  className="hidden" 
                  accept="image/*,.pdf,.doc,.docx"
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition"
                  title="إرفاق ملف"
                >
                  <Paperclip size={20} />
                </button>
                <input 
                  type="text" 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتب رسالة..."
                  className="flex-1 px-4 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-primary focus:bg-white/20 transition-all"
                  disabled={uploadingAttachment}
                />
                <button 
                  type="submit"
                  disabled={(!message.trim() && !attachment) || uploadingAttachment}
                  className="bg-primary hover:bg-green-600 text-white p-3 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px]"
                >
                  {uploadingAttachment ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Send size={20} className="transform rotate-180" />
                  )}
                </button>
              </form>
              {activeChat.status === 'unassigned' && (
                <p className="text-xs text-center text-orange-400 mt-2 font-bold">
                  بمجرد إرسالك لأول رسالة، سيتم استلام المحادثة باسمك تلقائياً.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <div className="bg-white p-6 rounded-full shadow-sm mb-4">
              <MessageSquare size={48} className="text-gray-300" />
            </div>
            <h2 className="text-xl font-medium">واتساب ويب لخدمة العملاء</h2>
            <p className="mt-2 text-sm">اختر محادثة من القائمة الجانبية للبدء</p>
          </div>
        )}
      </div>

      {/* شاشة إضافة عميل جديد */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" dir="rtl">
            <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">إضافة عميل جديد يدوياً</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل (اختياري)</label>
                <input 
                  type="text" 
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف (مطلوب)</label>
                <div className="flex border rounded-lg focus-within:border-primary overflow-hidden" dir="ltr">
                  <select 
                    value={newCustomerCountryCode}
                    onChange={(e) => setNewCustomerCountryCode(e.target.value)}
                    className="bg-gray-50 border-r px-3 py-2 focus:outline-none appearance-none font-bold text-sm"
                  >
                    <option value="+966">SA +966</option>
                    <option value="+20">EG +20</option>
                    <option value="+971">AE +971</option>
                    <option value="+1">US +1</option>
                  </select>
                  <input 
                    type="tel" 
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="5XXXXXXXX"
                    className="w-full px-4 py-2 focus:outline-none text-left"
                    required
                  />
                </div>
              </div>
              
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تحديد الموظف المستهدف (اختياري)</label>
                  <select 
                    value={selectedAssigneeUid}
                    onChange={(e) => setSelectedAssigneeUid(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-primary text-sm"
                  >
                    <option value="">-- تعيين لنفسي --</option>
                    {employees.map(emp => (
                      <option key={emp.uid} value={emp.uid}>
                        {emp.name} ({emp.role === 'admin' ? 'أدمن' : 'موظف'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button 
                type="submit"
                disabled={!newCustomerPhone.trim()}
                className="w-full bg-primary hover:bg-green-600 text-white py-3 rounded-lg font-bold transition mt-4 disabled:opacity-50"
              >
                حفظ وبدء محادثة
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
