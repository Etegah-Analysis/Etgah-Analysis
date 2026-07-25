import React, { useState, useEffect, useRef } from 'react';
import { auth, db, signOut, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, where, getDocs, deleteDoc } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { LogOut, Send, User, Clock, CheckCircle2, MessageSquare, ChevronRight, UserPlus, X, BarChart3, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Inbox() {
  const navigate = useNavigate();
  const [activeChat, setActiveChat] = useState(null);
  const [message, setMessage] = useState('');
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const isFirstLoad = useRef(true);
  
  // New state for Add Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerCountryCode, setNewCustomerCountryCode] = useState('+966');

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
          if (change.type === 'added') {
            toast.success('تم دخول عميل جديد للواتساب!', { icon: '👋' });
            try { new Audio('/notification.mp3').play(); } catch(e){}
          }
          if (change.type === 'modified') {
            const data = change.doc.data();
            // Show notification if it's unread and not the currently active chat
            if (data.unread > 0 && activeChat?.id !== change.doc.id) {
              toast('رسالة جديدة من: ' + (data.name || data.phoneNumber), { icon: '💬' });
              try { new Audio('/notification.mp3').play(); } catch(e){}
            }
          }
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  // وظيفة إسناد المحادثة للموظف (من قبل الأدمن) من الخارج
  const handleAssignChat = async (chatId, empUid) => {
    if (!currentUser || !isAdmin || !empUid) return;
    try {
      const emp = employees.find(e => e.uid === empUid);
      if (!emp) return;
      const chatRef = doc(db, 'بيانات_تسجيل_العملاء', chatId);
      await updateDoc(chatRef, {
        status: 'assigned',
        assignedTo: emp.email,
        assignedToUid: emp.uid,
        updatedAt: serverTimestamp(),
        assignedAt: serverTimestamp(),
        unread: 1 // تفعيل الإنذار الأحمر عند الموظف
      });
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
    if (!message.trim() || !activeChat || activeChat.status === 'unassigned') return;

    const msgText = message.trim();
    setMessage(''); // مسح المربع فوراً لتجربة مستخدم أسرع

    try {
      // 1. حفظ الرسالة في Firestore لتظهر فوراً للموظف
      await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
        conversationId: activeChat.id,
        text: msgText,
        sender: 'agent',
        senderEmail: currentUser.email,
        timestamp: serverTimestamp()
      });

      // 2. تحديث آخر رسالة في المحادثة
      const chatRef = doc(db, 'بيانات_تسجيل_العملاء', activeChat.id);
      await updateDoc(chatRef, {
        lastMessage: msgText,
        updatedAt: serverTimestamp(),
        unread: 0
      });

      // 3. مناداة Vercel API لإرسالها فعلياً لواتساب العميل
      await fetch('/api/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: activeChat.phoneNumber,
          text: msgText
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

  const handleDeleteMessage = async (msgId) => {
    if (!isAdmin) return;
    if (window.confirm('هل أنت متأكد من حذف هذه الرسالة نهائياً؟')) {
      try {
        await deleteDoc(doc(db, 'رسائل_الموظفين_للعملاء', msgId));
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

    try {
      const docRef = await addDoc(collection(db, 'بيانات_تسجيل_العملاء'), {
        phoneNumber: fullPhone,
        name: newCustomerName.trim() || 'عميل جديد (يدوي)',
        addedBy: currentUser.email,
        status: 'assigned',
        assignedTo: currentUser.email,
        assignedToUid: currentUser.uid,
        createdAt: serverTimestamp(),
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: 'تم التسجيل يدوياً بواسطة الموظف',
        unread: 0
      });
      
      // Auto open this chat
      setActiveChat({
        id: docRef.id,
        phoneNumber: fullPhone,
        name: newCustomerName.trim() || 'عميل جديد (يدوي)',
        status: 'assigned',
        assignedTo: currentUser.email,
        assignedToUid: currentUser.uid
      });
      
      setIsAddModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } catch (err) {
      console.error('Error adding customer:', err);
    }
  };

  return (
    <div className="flex h-screen font-sans relative overflow-hidden bg-slate-900" dir="rtl">
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
                  
                  {isAdmin && chat.status === 'unassigned' && (
                    <div className="flex items-center mt-2" onClick={e => e.stopPropagation()}>
                      <select 
                        onChange={(e) => handleAssignChat(chat.id, e.target.value)}
                        defaultValue=""
                        className="border border-red-300 rounded px-2 py-1.5 text-xs font-bold text-red-700 w-full focus:outline-none focus:border-red-500 bg-white cursor-pointer shadow-sm"
                      >
                        <option value="" disabled>-- اضغط لاختيار موظف وتحويلها --</option>
                        {employees.map(emp => (
                          <option key={emp.uid} value={emp.uid}>
                            {emp.role === 'admin' ? `👑 الإدارة (${emp.name || emp.email})` : (emp.name || emp.email)}
                          </option>
                        ))}
                      </select>
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
              className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10 cursor-pointer"
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
                        <p className="text-sm whitespace-pre-wrap ml-6">{msg.text}</p>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteMessage(msg.id)}
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
              <div ref={messagesEndRef} />
            </div>

            <div className="bg-black/30 backdrop-blur-xl p-4 border-t border-white/10 relative z-10">
              <form onSubmit={handleSendMessage} className="flex space-x-2 space-x-reverse items-center">
                <input 
                  type="text" 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتب رسالة..."
                  disabled={activeChat.status === 'unassigned'}
                  className="flex-1 px-4 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-primary focus:bg-white/20 disabled:bg-white/5 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!message.trim() || activeChat.status === 'unassigned'}
                  className="bg-primary hover:bg-green-600 text-white p-3 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={20} className="transform rotate-180" />
                </button>
              </form>
              {activeChat.status === 'unassigned' && (
                <p className="text-xs text-center text-red-500 mt-2">
                  {isAdmin ? 'قم بتحويل المحادثة لأحد الموظفين أولاً.' : 'هذه المحادثة في الانتظار.'}
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
