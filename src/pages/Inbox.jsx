import React, { useState, useEffect, useRef } from 'react';
import { auth, db, signOut, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, where, getDocs, deleteDoc, storage, setDoc } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Send, User, Clock, CheckCircle2, MessageSquare, ChevronRight, UserPlus, X, BarChart3, Trash2, Paperclip, FileText, Download, Check, CheckCheck, Smile, Pin, Forward, Search, Reply, ArrowRight, Globe, AlertCircle, Upload, Users, Plus, Crown, Shield, ShieldCheck, UserMinus, Info, Sparkles, Hash, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function Inbox() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.dir = 'rtl';
  }, []);

  const [activeChat, setActiveChat] = useState(null);
  const [message, setMessage] = useState('');
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);

  // Internal Employee Groups States
  const [internalGroups, setInternalGroups] = useState([]);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMemberUids, setSelectedGroupMemberUids] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isGroupInfoModalOpen, setIsGroupInfoModalOpen] = useState(false);
  const [chatTabFilter, setChatTabFilter] = useState('all'); // 'all' | 'direct' | 'groups'
  const [newMemberToAddUid, setNewMemberToAddUid] = useState('');

  React.useEffect(() => {
    document.title = 'CRM WhatsApp Etegah';
  }, []);
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
  const excelFileInputRef = useRef(null);
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerCountryCode, setNewCustomerCountryCode] = useState('+966');
  const [selectedAssigneeUid, setSelectedAssigneeUid] = useState('');
  const [currentEmpName, setCurrentEmpName] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchCurrentEmp = async () => {
      try {
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', auth.currentUser.uid)));
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          setCurrentEmpName(userData.name || userData.username || '');
        }
      } catch (err) { console.error(err); }
    };
    fetchCurrentEmp();
  }, [navigate]);

  // Swipe to go back on mobile
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const COMMON_EMOJIS = ["😀","😂","🤣","😊","😍","🥰","😘","😭","😅","🥺","😎","🤔","🙄","😴","😷","👍","👎","👏","🙌","🙏","🔥","❤️","💔","🎉","✨","🌟","🎈","🎁","💯","✅"];
  const emojiPickerRef = useRef(null);

  // Excel Bulk Import State
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [bulkTemplateName, setBulkTemplateName] = useState('welcome_msg');
  const [bulkLanguage, setBulkLanguage] = useState('ar_EG');
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkResults, setBulkResults] = useState({ success: 0, failed: 0 });

  // Single Template State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [singleTemplateName, setSingleTemplateName] = useState('welcome_msg');
  const [singleLanguage, setSingleLanguage] = useState('ar_EG');
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);

  // Forward Message State
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);
  const [forwardSearchTerm, setForwardSearchTerm] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);

  // Sidebar Search
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getTemplateDisplayMessage = (name) => {
    if (name === 'welcome_msg') {
      return `السلام عليكم 🤝 .. مع حضرتك منصه اتجاه التحليل الذكي 📉📈 .. نقدم خدمات دعم فني للسوق السعودي 🇸🇦 و السوق الامريكي 🇺🇸
لو حضرتك مهتم بالتفاصيل ارسل تم

نأسف للازعاج . نحن هنا لخدمتك وتحقيق عائد مضمون لك
--------------------------------------------
[🔘 مهتم | 🔘 غير مهتم]`;
    }
    return `[قالب: ${name}]`;
  };

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
    if (distance > 50) {
      setActiveChat(null);
    }
  };

  const currentUser = auth.currentUser;
  const adminEmails = ['etegahanalysis@gmail.com', 'mohamed.gamal.work0@gmail.com'];
  const isAdmin = adminEmails.includes(currentUser?.email?.toLowerCase());
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('hide'); // default to 'hide' for Admin on load and return from Dashboard

  const currentEmpUser = employees.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
  const isCoordinator = !isAdmin && (currentEmpUser?.jobTitle === 'Coordinator' || currentEmpUser?.jobTitle === 'منسق للإدارة' || currentEmpUser?.role === 'coordinator');
  const isLeader = !isAdmin && (currentEmpUser?.jobTitle === 'Leader' || currentEmpUser?.jobTitle === 'ليدر' || currentEmpUser?.role === 'leader');
  const isAgent = !isAdmin && !isCoordinator && !isLeader;
  const myTeamMembers = employees.filter(e => e.leaderUid === currentUser?.uid);
  const canCreateGroup = isAdmin || isCoordinator || isLeader;

  // Allowed members when creating or adding to a group based on role
  const getEligibleMembersForGroup = () => {
    if (isAdmin || isCoordinator) {
      return employees.filter(e => e.role !== 'admin' && e.uid !== currentUser?.uid);
    }
    if (isLeader) {
      return myTeamMembers;
    }
    return [];
  };

  useEffect(() => {
    if (!currentUser) return;
    const fetchEmployees = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const emps = [];

        if (isAdmin) {
          emps.push({
            uid: currentUser.uid,
            id: currentUser.uid,
            name: '👑 الإدارة',
            email: currentUser.email,
            role: 'admin',
            jobTitle: 'Admin',
            leaderUid: ''
          });
        }

        usersSnap.forEach(doc => {
          const d = doc.data();
          if (!isAdmin || (d.uid !== currentUser.uid && d.email?.toLowerCase() !== currentUser.email?.toLowerCase())) {
            emps.push({
              uid: d.uid || doc.id,
              id: d.uid || doc.id,
              name: d.name || d.displayName || d.username || d.email?.split('@')[0] || 'موظف',
              username: d.username || d.name || d.displayName || d.email?.split('@')[0] || 'موظف',
              email: d.email || '',
              role: d.role || 'employee',
              jobTitle: d.jobTitle || 'موظف',
              leaderUid: d.leaderUid || ''
            });
          }
        });
        setEmployees(emps);
      } catch (err) {
        console.error('Error fetching employees:', err);
      }
    };
    fetchEmployees();
  }, [currentUser, isAdmin]);

  // Realtime subscription to Internal Employee Groups
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'internal_groups'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupsData = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const isMember = 
          isAdmin || 
          data.members?.includes(currentUser.uid) || 
          data.members?.includes(currentUser.email?.toLowerCase()) ||
          data.members?.includes('admin') ||
          data.createdByUid === currentUser.uid;

        if (isMember) {
          groupsData.push({
            id: docSnap.id,
            isGroup: true,
            ...data
          });
        }
      });
      setInternalGroups(groupsData);
    }, (err) => {
      console.error("Error fetching internal groups:", err);
    });
    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  // Anti-Screenshot & Window Blur Protection for Employees
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);

  useEffect(() => {
    if (isAdmin) return; // Admin has unrestricted access

    const handleBlur = () => setIsWindowBlurred(true);
    const handleFocus = () => setIsWindowBlurred(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsWindowBlurred(true);
      } else {
        setIsWindowBlurred(false);
      }
    };

    const handleKeyDown = (e) => {
      // Intercept PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        setIsWindowBlurred(true);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('');
        }
        setTimeout(() => setIsWindowBlurred(false), 2500);
      }
      // Block Ctrl+P (Print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        toast.error('الطباعة غير مسموحة لحماية خصوصية العملاء');
      }
      // Block Ctrl+S (Save page)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAdmin]);

  const formatJobTitle = (title) => {
    if (!title) return 'Agent';
    const clean = title.toString().trim().toLowerCase();
    if (clean.includes('leader') || clean.includes('ليدر')) return 'Leader';
    return 'Agent';
  };

  const getEmployeeDisplayName = (senderEmail) => {
    if (!senderEmail) return 'الموظف';
    const cleanSender = senderEmail.toLowerCase().trim();
    if (adminEmails.includes(cleanSender)) return '👑 أدمن منصة اتجاه التحليل الذكي';

    const emp = employees.find(e => 
      e.email?.toLowerCase().trim() === cleanSender ||
      e.email?.split('@')[0]?.toLowerCase().trim() === cleanSender.split('@')[0]
    );

    if (emp) {
      const displayName = emp.username || emp.name || senderEmail.split('@')[0];
      const title = ` (${formatJobTitle(emp.jobTitle)})`;
      return `${displayName}${title}`;
    }

    return senderEmail.split('@')[0];
  };

  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [employeeAnalytics, setEmployeeAnalytics] = useState([]);
  const [showOnlyUnreplied, setShowOnlyUnreplied] = useState(false);

  useEffect(() => {
    if (!isAnalyticsModalOpen || !currentUser) return;
    
    let q;
    if (isAdmin) {
      q = query(collection(db, 'رسائل_الموظفين_للعملاء'));
    } else {
      q = query(
        collection(db, 'رسائل_الموظفين_للعملاء'),
        where('senderEmail', '==', currentUser.email)
      );
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const grouped = {};
      snapshot.forEach(doc => {
        const msg = doc.data();
        if (msg.isTemplate || (msg.text && msg.text.includes('[قالب'))) {
          const templateName = msg.templateName || (msg.text?.match(/\[قالب.*?:(.*?)\]/)?.[1]?.trim() || 'قالب غير معروف');
          const sender = msg.senderEmail ? msg.senderEmail.split('@')[0] : 'موظف';
          const key = `${templateName}_${sender}`;
          const chatId = msg.conversationId || msg.recipientPhone || msg.to || 'unknown';

          if (!grouped[key]) {
            grouped[key] = { templateName, sender, sent: 0, delivered: 0, read: 0, chatMap: {} };
          }
          grouped[key].sent++;
          if (msg.status === 'delivered' || msg.status === 'read') grouped[key].delivered++;
          if (msg.status === 'read') grouped[key].read++;

          grouped[key].chatMap[chatId] = (grouped[key].chatMap[chatId] || 0) + 1;
        }
      });

      const analyticsResult = Object.values(grouped).map(campaign => {
        let sentOnce = 0, sentTwice = 0, sentMore = 0;
        Object.values(campaign.chatMap).forEach(cnt => {
          if (cnt === 1) sentOnce++;
          else if (cnt === 2) sentTwice++;
          else if (cnt >= 3) sentMore++;
        });
        const openRate = campaign.sent > 0 ? Math.round((campaign.read / campaign.sent) * 100) : 0;
        return { ...campaign, sentOnce, sentTwice, sentMore, openRate };
      }).sort((a,b) => b.sent - a.sent);

      setEmployeeAnalytics(analyticsResult);
    });
    
    return () => unsubscribe();
  }, [isAnalyticsModalOpen, currentUser, isAdmin]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('ServiceWorker registration failed:', err));
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showSystemNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
              body: body,
              icon: '/logo.jpg',
              badge: '/logo.jpg',
              vibrate: [200, 100, 200]
            });
          });
        } else {
          new Notification(title, { body: body, icon: '/logo.jpg' });
        }
      } catch (e) {
        console.error("Error displaying notification", e);
      }
    }
  };

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.log('Audio Context play error:', e);
    }
  };

  // جلب المحادثات الخاصة بالعملاء (محجوبة بالكامل عن حساب المنسق)
  useEffect(() => {
    if (!currentUser || isCoordinator) {
      setChats([]);
      return;
    }

    // Query all customer documents so no composite index is needed and no chats are lost for employees
    const q = query(collection(db, 'بيانات_تسجيل_العملاء'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsData = [];
      const currentUnreadMap = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const chatId = doc.id;

        // Check if chat belongs to employee or admin
        const isAssignedToThisEmp = 
          isAdmin || 
          data.assignedToUid === currentUser.uid || 
          (data.assignedTo && currentUser.email && data.assignedTo.toLowerCase() === currentUser.email.toLowerCase());

        if (!isAssignedToThisEmp) return;

        const unreadCount = data.unread || 0;
        currentUnreadMap[chatId] = unreadCount;

        if (!isFirstLoad.current) {
          const prevUnread = previousUnreadCounts.current[chatId] || 0;
          if (unreadCount > prevUnread) {
            playNotificationSound();
            showSystemNotification(
              `رسالة جديدة من: ${data.name || data.phoneNumber}`,
              data.lastMessage || 'رسالة جديدة'
            );
          }
        }

        chatsData.push({
          id: chatId,
          ...data
        });
      });

      chatsData.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
        return timeB - timeA;
      });

      previousUnreadCounts.current = currentUnreadMap;
      isFirstLoad.current = false;
      setChats(chatsData);

      if (location.state?.selectedCustomerId && !activeChat) {
        const foundChat = chatsData.find(c => c.id === location.state.selectedCustomerId);
        if (foundChat) {
          setActiveChat(foundChat);
        }
      }
    }, (error) => {
      console.error("Error fetching chats:", error);
    });

    return () => unsubscribe();
  }, [currentUser, isAdmin, isCoordinator, location.state]);

  // حماية إضافية لحساب المنسق: إغلاق أي شات ليس جروب فوراً
  useEffect(() => {
    if (isCoordinator && activeChat && !activeChat.isGroup) {
      setActiveChat(null);
    }
  }, [isCoordinator, activeChat]);

  // جلب الرسائل الخاصة بالمحادثة النشطة
  useEffect(() => {
    if (!activeChat) return;

    const q = query(
      collection(db, 'رسائل_الموظفين_للعملاء'),
      where('conversationId', '==', activeChat.id)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgsData = [];
      snapshot.forEach((doc) => {
        msgsData.push({ id: doc.id, ...doc.data() });
      });
      msgsData.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeA - timeB;
      });
      setMessages(msgsData);
      scrollToBottom();
    }, (error) => {
      console.error("Error fetching messages:", error);
    });
    
    return () => unsubscribe();
  }, [activeChat?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleAssignChat = async (chatId, empUid) => {
    if (!currentUser || !isAdmin || !empUid) return;
    try {
      const newAssignee = employees.find(e => e.uid === empUid);
      const chat = chats.find(c => c.id === chatId);
      if (!newAssignee || !chat) return;
      await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', chatId), {
        assignedTo: newAssignee.email,
        assignedToUid: newAssignee.uid,
        status: 'unassigned',
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unread: 1
      });
      toast.success(`تم تحويل المحادثة (${chat.name || chat.phoneNumber}) إلى ${newAssignee.name || newAssignee.email} بنجاح`);
    } catch (error) {
      console.error("خطأ في إسناد المحادثة:", error);
    }
  };

  const handleChatClick = async (chat) => {
    if (isCoordinator && !chat.isGroup) {
      toast.error('غير مصرح لحساب المنسق بالدخول لمحادثات العملاء 🔒');
      return;
    }
    setActiveChat(chat);
    if (chat.unread > 0) {
      try {
        if (chat.isGroup) {
          const groupRef = doc(db, 'internal_groups', chat.id);
          await updateDoc(groupRef, { unread: 0 });
        } else {
          const chatRef = doc(db, 'بيانات_تسجيل_العملاء', chat.id);
          await updateDoc(chatRef, { unread: 0 });
        }
      } catch (err) {
        console.error("خطأ في تصفير العداد", err);
      }
    }
  };

  // Create New Employee Group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      toast.error('يرجى إدخال اسم الجروب');
      return;
    }
    if (!canCreateGroup) {
      toast.error('غير مصرح لك بإنشاء جروبات');
      return;
    }
    setIsCreatingGroup(true);
    try {
      const creatorName = isAdmin ? '👑 الإدارة' : (currentEmpName || currentUser.email?.split('@')[0] || 'موظف');
      const creatorRole = isAdmin ? 'admin' : isCoordinator ? 'coordinator' : isLeader ? 'leader' : 'agent';

      // Ensure Admin is always included in members
      const finalMembers = Array.from(new Set([
        'admin',
        currentUser.uid,
        ...selectedGroupMemberUids
      ])).filter(Boolean);

      const groupDoc = {
        name: newGroupName.trim(),
        isGroup: true,
        createdByUid: currentUser.uid,
        createdByName: creatorName,
        createdByEmail: currentUser.email,
        createdByRole: creatorRole,
        members: finalMembers,
        adminMandatory: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: '🎉 تم إنشاء الجروب',
        lastMessageSender: creatorName,
        unread: 0
      };

      const docRef = await addDoc(collection(db, 'internal_groups'), groupDoc);

      // Add welcome system message
      await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
        conversationId: docRef.id,
        text: `🎉 تم إنشاء الجروب بنجاح بواسطة ${creatorName}`,
        sender: 'system',
        senderName: 'النظام',
        isGroupMessage: true,
        timestamp: serverTimestamp(),
        status: 'delivered'
      });

      toast.success('تم إنشاء جروب الموظفين بنجاح 🚀');
      setIsCreateGroupModalOpen(false);
      setNewGroupName('');
      setSelectedGroupMemberUids([]);
      setActiveChat({ id: docRef.id, isGroup: true, ...groupDoc });
    } catch (err) {
      console.error(err);
      toast.error('خطأ في إنشاء الجروب: ' + err.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Add Member to Active Group
  const handleAddMemberToGroup = async () => {
    if (!newMemberToAddUid || !activeChat?.isGroup) return;
    const empToAdd = employees.find(e => e.uid === newMemberToAddUid);
    if (!empToAdd) return;

    if (isLeader && !myTeamMembers.some(m => m.uid === newMemberToAddUid)) {
      toast.error('بصفتك ليدر، يمكنك فقط إضافة أعضاء فريقك المعينين تحتك 🔒');
      return;
    }

    try {
      const updatedMembers = Array.from(new Set([...(activeChat.members || []), newMemberToAddUid, 'admin']));
      await updateDoc(doc(db, 'internal_groups', activeChat.id), {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });

      const actorName = isAdmin ? '👑 الإدارة' : (currentEmpName || currentUser.email?.split('@')[0] || 'موظف');
      const addedName = empToAdd.name || empToAdd.username || empToAdd.email;

      await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
        conversationId: activeChat.id,
        text: `➕ قام ${actorName} بإضافة (${addedName}) إلى الجروب`,
        sender: 'system',
        senderName: 'النظام',
        isGroupMessage: true,
        timestamp: serverTimestamp(),
        status: 'delivered'
      });

      setActiveChat(prev => ({ ...prev, members: updatedMembers }));
      setNewMemberToAddUid('');
      toast.success(`تمت إضافة ${addedName} بنجاح`);
    } catch (err) {
      console.error(err);
      toast.error('خطأ في إضافة العضو');
    }
  };

  // Remove Member from Active Group
  const handleRemoveMemberFromGroup = async (memberUid) => {
    if (!activeChat?.isGroup) return;

    // Check if target is admin
    const isTargetAdmin = memberUid === 'admin' || employees.some(e => e.uid === memberUid && (e.role === 'admin' || adminEmails.includes(e.email?.toLowerCase())));
    if (isTargetAdmin) {
      toast.error('لا يمكن إخراج الإدارة من الجروب إطلاقاً 🔒');
      return;
    }

    if (isLeader && !myTeamMembers.some(m => m.uid === memberUid)) {
      toast.error('بصفتك ليدر، يمكنك فقط إخراج أعضاء فريقك المعينين تحتك 🔒');
      return;
    }

    if (isAgent) {
      toast.error('ليس لديك صلاحية لإخراج الأعضاء');
      return;
    }

    const targetEmp = employees.find(e => e.uid === memberUid);
    const targetName = targetEmp ? (targetEmp.name || targetEmp.username) : 'الموظف';

    if (!window.confirm(`هل أنت متأكد من إخراج (${targetName}) من الجروب؟`)) return;

    try {
      const updatedMembers = (activeChat.members || []).filter(u => u !== memberUid);
      if (!updatedMembers.includes('admin')) updatedMembers.push('admin');

      await updateDoc(doc(db, 'internal_groups', activeChat.id), {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });

      const actorName = isAdmin ? '👑 الإدارة' : (currentEmpName || currentUser.email?.split('@')[0] || 'موظف');

      await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
        conversationId: activeChat.id,
        text: `❌ قام ${actorName} بإخراج (${targetName}) من الجروب`,
        sender: 'system',
        senderName: 'النظام',
        isGroupMessage: true,
        timestamp: serverTimestamp(),
        status: 'delivered'
      });

      setActiveChat(prev => ({ ...prev, members: updatedMembers }));
      toast.success(`تم إخراج ${targetName} من الجروب`);
    } catch (err) {
      console.error(err);
      toast.error('خطأ في إخراج العضو');
    }
  };

  // وظيفة إرسال رسالة
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!message.trim() && !attachment) || !activeChat) return;

    const msgText = message.trim();
    setMessage('');

    let mediaUrl = null;
    let fileType = null;
    let fileName = null;

    if (attachment) {
      setUploadingAttachment(true);
      try {
        const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const fileRef = ref(storage, `chat_media/${activeChat.id}_${uniqueId}_${attachment.name}`);
        
        const uploadPromise = async () => {
          await uploadBytes(fileRef, attachment);
          return await getDownloadURL(fileRef);
        };
        
        mediaUrl = await uploadPromise();
        fileType = attachment.type;
        fileName = attachment.name;
        
        setAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error("خطأ في رفع الملف:", err);
        toast.error(`خطأ الرفع: ${err.message || 'غير معروف'}`);
        setUploadingAttachment(false);
        return;
      }
      setUploadingAttachment(false);
    }

    // Group Message Handling (Internal WhatsApp Group)
    if (activeChat.isGroup) {
      try {
        const senderDisplayName = isAdmin ? '👑 الإدارة' : (currentEmpName || currentUser?.email?.split('@')[0] || 'موظف');
        const senderRoleName = isAdmin ? 'admin' : isCoordinator ? 'coordinator' : isLeader ? 'leader' : 'agent';

        const msgData = {
          conversationId: activeChat.id,
          text: msgText,
          sender: currentUser.uid,
          senderUid: currentUser.uid,
          senderName: senderDisplayName,
          senderEmail: currentUser.email,
          senderRole: senderRoleName,
          isGroupMessage: true,
          timestamp: serverTimestamp(),
          status: 'delivered',
          replyTo: replyingToMessage || null
        };

        if (mediaUrl) {
          msgData.mediaUrl = mediaUrl;
          msgData.fileType = fileType;
          msgData.fileName = fileName;
        }

        await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), msgData);

        await updateDoc(doc(db, 'internal_groups', activeChat.id), {
          lastMessage: msgText || (fileName ? `📎 ${fileName}` : 'مرفق'),
          lastMessageSender: senderDisplayName,
          updatedAt: serverTimestamp()
        });

        setReplyingToMessage(null);
      } catch (err) {
        console.error("خطأ في إرسال رسالة الجروب:", err);
        toast.error('خطأ في إرسال الرسالة: ' + err.message);
      }
      return;
    }

    try {
      // تحديد رقم الإرسال تلقائياً حسب مصدر العميل (يحدده الأدمن ولا يستطيع الموظف تغييره)
      const senderType = activeChat.assignedSender || (activeChat.source === 'website' ? 'website' : 'campaigns');
      // 3. مناداة Vercel API لإرسالها فعلياً لواتساب العميل
      const response = await fetch('/api/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: activeChat.phoneNumber,
          text: msgText,
          mediaUrl: mediaUrl,
          fileType: fileType,
          fileName: fileName,
          senderType: senderType,
          contextMessageId: replyingToMessage?.metaMessageId || undefined
        })
      });
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        toast.error(`فشل الإرسال: ${result.error || 'خطأ غير معروف من واتساب'}`);
        return;
      }
      
      // 1. حفظ الرسالة في Firestore لتظهر فوراً للموظف
      const msgData = {
        conversationId: activeChat.id,
        text: msgText,
        sender: 'agent',
        senderEmail: currentUser.email,
        senderType: senderType,
        timestamp: serverTimestamp(),
        metaMessageId: result.metaMessageId || null,
        status: result.simulated ? 'sent' : 'pending',
        replyTo: replyingToMessage || null
      };

      setReplyingToMessage(null);

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

      if (activeChat.status === 'unassigned') {
        updateData.status = 'assigned';
        updateData.assignedTo = currentUser.email;
        updateData.assignedToUid = currentUser.uid;
        updateData.assignedAt = serverTimestamp();
      }

      await updateDoc(chatRef, updateData);
    } catch (err) {
      console.error("خطأ الإرسال:", err);
      toast.error(`خطأ في الإرسال: ${err.message || 'حدث خطأ غير متوقع'}`);
    }
  };

  const handleSendSingleTemplate = async (e) => {
    e.preventDefault();
    if (!singleTemplateName.trim() || !activeChat) return;
    setIsSendingTemplate(true);
    try {
      const response = await fetch('/api/sendTemplate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: activeChat.phoneNumber,
          templateName: singleTemplateName.trim(),
          languageCode: singleLanguage
        })
      });
      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(result.message || 'تم إرسال القالب بنجاح');
        setIsTemplateModalOpen(false);

        const templateDisplayText = getTemplateDisplayMessage(singleTemplateName.trim());

        await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
          conversationId: activeChat.id,
          text: templateDisplayText,
          templateName: singleTemplateName.trim(),
          isTemplate: true,
          sender: 'agent',
          senderEmail: currentUser.email,
          timestamp: serverTimestamp(),
          metaMessageId: result.metaMessageId || null,
          status: result.simulated ? 'sent' : 'pending'
        });

        const updateData = {
          lastMessage: templateDisplayText,
          updatedAt: serverTimestamp(),
          unread: 0
        };
        if (activeChat.status === 'unassigned') {
          updateData.status = 'assigned';
          updateData.assignedTo = currentUser.email;
          updateData.assignedToUid = currentUser.uid;
          updateData.assignedAt = serverTimestamp();
        }
        await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', activeChat.id), updateData);
      } else {
        toast.error(`فشل إرسال القالب: ${result.error || result.message || 'خطأ من ميتا'}`);
      }
    } catch (err) {
      console.error("Error sending template:", err);
      toast.error('حدث خطأ غير متوقع أثناء إرسال القالب');
    } finally {
      setIsSendingTemplate(false);
    }
  };

  const handleDownloadExcelTemplate = () => {
    const sampleData = [
      { Phone: '+966501234567', Name: 'أحمد محمود' },
      { Phone: '+201098765432', Name: 'محمد علي' },
      { Phone: '+971501112233', Name: 'خالد عبدالله' }
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج الحملة');
    XLSX.writeFile(workbook, 'نموذج_حملة_إكسيل_منصة_اتجاه.xlsx');
    toast.success('تم تحميل نموذج الإكسيل بنجاح');
  };

  const handleExcelImport = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      toast.error('يرجى اختيار ملف إكسيل أولاً');
      return;
    }

    try {
      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet);

      if (!rows || rows.length === 0) {
        toast.error('ملف الإكسيل فارغ');
        return;
      }

      setIsBulkSending(true);
      setBulkTotal(rows.length);
      setBulkProgress(0);
      setBulkResults({ success: 0, failed: 0 });

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let phone = row.phone || row.Phone || row['رقم الهاتف'] || row['الهاتف'] || row['الرقم'] || row.mobile || row.Mobile;
        let name = row.name || row.Name || row['الاسم'] || row['اسم العميل'] || 'عميل';

        if (!phone) {
          failedCount++;
          setBulkResults({ success: successCount, failed: failedCount });
          setBulkProgress(i + 1);
          continue;
        }

        phone = String(phone).replace(/[^0-9+]/g, '');
        if (!phone.startsWith('+')) {
          if (phone.startsWith('0')) phone = '+20' + phone.substring(1);
          else if (phone.startsWith('5')) phone = '+966' + phone;
          else if (!phone.startsWith('20') && !phone.startsWith('966')) phone = '+' + phone;
        }

        try {
          const res = await fetch('/api/sendTemplate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: phone,
              templateName: bulkTemplateName.trim(),
              languageCode: bulkLanguage
            })
          });
          const resData = await res.json();

          if (res.ok && resData.success) {
            successCount++;
            
            const chatQuery = query(collection(db, 'بيانات_تسجيل_العملاء'), where('phoneNumber', '==', phone));
            const chatSnap = await getDocs(chatQuery);
            let customerDocId = null;

            if (!chatSnap.empty) {
              customerDocId = chatSnap.docs[0].id;
              await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', customerDocId), {
                lastMessage: getTemplateDisplayMessage(bulkTemplateName.trim()),
                updatedAt: serverTimestamp()
              });
            } else {
              const newDoc = await addDoc(collection(db, 'بيانات_تسجيل_العملاء'), {
                phoneNumber: phone,
                name: name,
                assignedTo: currentUser.email,
                assignedToUid: currentUser.uid,
                source: 'excel_import',
                assignedSender: 'campaigns',
                status: 'assigned',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessage: getTemplateDisplayMessage(bulkTemplateName.trim()),
                unread: 0
              });
              customerDocId = newDoc.id;
            }

            await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
              conversationId: customerDocId,
              text: getTemplateDisplayMessage(bulkTemplateName.trim()),
              templateName: bulkTemplateName.trim(),
              isTemplate: true,
              sender: 'agent',
              senderEmail: currentUser.email,
              timestamp: serverTimestamp(),
              metaMessageId: resData.metaMessageId || null,
              status: 'sent'
            });
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
        }

        setBulkResults({ success: successCount, failed: failedCount });
        setBulkProgress(i + 1);
        await new Promise(r => setTimeout(r, 200));
      }

      toast.success(`اكتملت الحملة: تم إرسال ${successCount} بنجاح، و ${failedCount} فشل`);
    } catch (err) {
      console.error('Error processing excel file:', err);
      toast.error('خطأ في قراءة ملف الإكسيل');
    } finally {
      setIsBulkSending(false);
    }
  };

  const handleConfirmForward = async (targetChat) => {
    if (!messageToForward || !targetChat || isForwarding) return;
    setIsForwarding(true);
    try {
      let forwardText = messageToForward.text || '';
      
      const res = await fetch('/api/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetChat.phoneNumber,
          text: forwardText,
          mediaUrl: messageToForward.mediaUrl || null,
          fileType: messageToForward.fileType || null,
          fileName: messageToForward.fileName || null
        })
      });

      const resData = await res.json();

      if (res.ok && resData.success) {
        await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
          conversationId: targetChat.id,
          text: forwardText,
          mediaUrl: messageToForward.mediaUrl || null,
          fileType: messageToForward.fileType || null,
          fileName: messageToForward.fileName || null,
          sender: 'agent',
          senderEmail: currentUser.email,
          timestamp: serverTimestamp(),
          metaMessageId: resData.metaMessageId || null,
          status: 'sent',
          isForwarded: true
        });

        await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', targetChat.id), {
          lastMessage: forwardText || 'إعادة توجيه ملف 📷',
          updatedAt: serverTimestamp()
        });

        toast.success(`تمت إعادة التوجيه إلى ${targetChat.name || targetChat.phoneNumber} بنجاح`);
        setIsForwardModalOpen(false);
        setMessageToForward(null);
      } else {
        toast.error(`فشل التوجيه: ${resData.error || 'خطأ غير معروف'}`);
      }
    } catch (err) {
      console.error('Error forwarding message:', err);
      toast.error('حدث خطأ أثناء إعادة التوجيه');
    } finally {
      setIsForwarding(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleDeleteMessage = async (msg) => {
    if (!isAdmin) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return;
    try {
      await deleteDoc(doc(db, 'رسائل_الموظفين_للعملاء', msg.id));
      toast.success('تم حذف الرسالة بنجاح');
    } catch (err) {
      console.error("خطأ في حذف الرسالة:", err);
      toast.error('حدث خطأ أثناء حذف الرسالة');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  const handlePhoneChange = (val) => {
    let cleanVal = val.trim();
    
    if (cleanVal.startsWith('+20') || cleanVal.startsWith('20')) {
      setNewCustomerCountryCode('+20');
      cleanVal = cleanVal.replace(/^\+?20/, '');
    } else if (cleanVal.startsWith('+966') || cleanVal.startsWith('966')) {
      setNewCustomerCountryCode('+966');
      cleanVal = cleanVal.replace(/^\+?966/, '');
    } else if (cleanVal.startsWith('+971') || cleanVal.startsWith('971')) {
      setNewCustomerCountryCode('+971');
      cleanVal = cleanVal.replace(/^\+?971/, '');
    } else if (cleanVal.startsWith('+1') && cleanVal.length > 5) {
      setNewCustomerCountryCode('+1');
      cleanVal = cleanVal.replace(/^\+?1/, '');
    } else if (/^0?1[0125]/.test(cleanVal)) {
      setNewCustomerCountryCode('+20');
      if (cleanVal.startsWith('0')) cleanVal = cleanVal.substring(1);
    } else if (/^0?5[0-9]/.test(cleanVal) && cleanVal.length <= 10) {
      setNewCustomerCountryCode('+966');
      if (cleanVal.startsWith('0')) cleanVal = cleanVal.substring(1);
    } else if (/^0?5[024568]/.test(cleanVal) && cleanVal.length === 9) {
      setNewCustomerCountryCode('+971');
      if (cleanVal.startsWith('0')) cleanVal = cleanVal.substring(1);
    }

    setNewCustomerPhone(cleanVal);
  };

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
      const chatQuery = query(collection(db, 'بيانات_تسجيل_العملاء'), where('phoneNumber', '==', fullPhone));
      const chatSnap = await getDocs(chatQuery);
      
      let docRefId = null;
      let existingData = null;

      if (!chatSnap.empty) {
        const existingDoc = chatSnap.docs[0];
        existingData = existingDoc.data();
        
        if (!isAdmin && existingData.assignedToUid && existingData.assignedToUid !== currentUser.uid) {
          toast.error('عذراً، هذا الرقم مسجل بالفعل مع موظف آخر.');
          setNewCustomerName('');
          setNewCustomerPhone('');
          return;
        }
        
        docRefId = existingDoc.id;
        await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', docRefId), {
          name: newCustomerName.trim() || existingData.name || 'عميل جديد (يدوي)',
          assignedTo: assigneeEmail,
          assignedToUid: assigneeUid,
          updatedAt: serverTimestamp(),
          status: 'assigned'
        });
      } else {
        const docRef = await addDoc(collection(db, 'بيانات_تسجيل_العملاء'), {
          phoneNumber: fullPhone,
          name: newCustomerName.trim() || 'عميل جديد (يدوي)',
          addedBy: currentUser.email,
          addedByUid: currentUser.uid,
          source: 'manual',
          assignedSender: 'campaigns',
          status: 'unassigned',
          assignedTo: assigneeEmail,
          assignedToUid: assigneeUid,
          createdAt: serverTimestamp(),
          assignedAt: null,
          updatedAt: serverTimestamp(),
          lastMessage: 'تم التسجيل يدوياً بانتظار بدء المراسلة',
          unread: 0
        });
        docRefId = docRef.id;

        // Also add to employee_leads so it immediately appears in "داتا مضافة بواسطة الموظف"
        try {
          const empCleanId = fullPhone.replace(/[^0-9]/g, '');
          const empUser = employees?.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
          const empName = empUser?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'موظف';
          
          await setDoc(doc(db, 'employee_leads', empCleanId), {
            phoneNumber: fullPhone,
            name: newCustomerName.trim() || 'عميل جديد (يدوي)',
            source: 'إضافة يدوية (WhatsApp)',
            addedBy: empName,
            addedByUid: currentUser.uid,
            assignedTo: assigneeEmail || currentUser.email,
            assignedToUid: assigneeUid || currentUser.uid,
            status: 'assigned',
            crmStatus: 'unassigned',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            unread: 0
          }, { merge: true });
        } catch (e) {
          console.error("Error syncing to employee_leads:", e);
        }
      }
      
      setActiveChat({
        id: docRefId,
        phoneNumber: fullPhone,
        name: newCustomerName.trim() || (existingData ? existingData.name : 'عميل جديد (يدوي)'),
        status: existingData ? 'assigned' : 'unassigned',
        assignedTo: assigneeEmail,
        assignedToUid: assigneeUid
      });
      
      setIsAddModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setSelectedAssigneeUid('');
      toast.success('تمت الإضافة/التحديث بنجاح');
    } catch (err) {
      console.error('Error adding customer:', err);
      toast.error('حدث خطأ أثناء الإضافة.');
      setNewCustomerName('');
      setNewCustomerPhone('');
    }
  };

  const combinedChats = React.useMemo(() => {
    if (isCoordinator) {
      const all = [...internalGroups];
      all.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
        return timeB - timeA;
      });
      return all;
    }
    const all = [...chats, ...internalGroups];
    all.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
      const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
      return timeB - timeA;
    });
    return all;
  }, [chats, internalGroups, isCoordinator]);

  const isChatUnreplied = (chat) => {
    return chat.unread > 0 || chat.status === 'unassigned' || chat.lastMessageSender === 'user' || chat.lastSender === 'user';
  };

  const filteredChats = combinedChats.filter(chat => {
    // For Coordinator: Strictly allow only groups
    if (isCoordinator) {
      if (!chat.isGroup) return false;
      if (sidebarSearch.trim()) {
        const term = sidebarSearch.toLowerCase();
        const matchName = chat.name?.toLowerCase().includes(term);
        const matchCreator = chat.createdByName?.toLowerCase().includes(term);
        if (!matchName && !matchCreator) return false;
      }
      return true;
    }

    // Tab filter
    if (chatTabFilter === 'direct' && chat.isGroup) return false;
    if (chatTabFilter === 'groups' && !chat.isGroup) return false;

    if (chat.isGroup) {
      if (sidebarSearch.trim()) {
        const term = sidebarSearch.toLowerCase();
        const matchName = chat.name?.toLowerCase().includes(term);
        const matchCreator = chat.createdByName?.toLowerCase().includes(term);
        if (!matchName && !matchCreator) return false;
      }
      return true;
    }

    let matchEmployee = true;
    if (isAdmin) {
      if (selectedEmployee === 'hide') matchEmployee = false;
      else if (selectedEmployee === 'unassigned') matchEmployee = chat.status === 'unassigned';
      else if (selectedEmployee && selectedEmployee !== 'all') matchEmployee = chat.assignedToUid === selectedEmployee;
    } else {
      if (selectedEmployee === 'unassigned') {
        matchEmployee = chat.status === 'unassigned';
      } else {
        matchEmployee = chat.assignedToUid === currentUser?.uid || (chat.assignedTo && currentUser?.email && chat.assignedTo.toLowerCase() === currentUser?.email.toLowerCase());
      }
    }
    
    if (!matchEmployee) return false;

    if (showOnlyUnreplied && !isChatUnreplied(chat)) {
      return false;
    }
    
    if (sidebarSearch.trim()) {
      const term = sidebarSearch.toLowerCase();
      if (!chat.name?.toLowerCase().includes(term) && !chat.phoneNumber?.includes(term)) {
        return false;
      }
    }
    
    return true;
  });

  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
      if (snap.exists()) {
        setUserProfile(snap.data());
      }
    });
    return () => unsub();
  }, [currentUser]);

  let lastDateMsg = null;

  return (
    <div className="flex fixed inset-0 w-full font-sans overflow-hidden bg-slate-900" dir="rtl" onClick={() => setShowOnlyUnreplied(false)}>
      {/* Anti-Screenshot & Window Blur Frosted Shield for Employees */}
      {isWindowBlurred && !isAdmin && (
        <div 
          onClick={() => setIsWindowBlurred(false)}
          className="fixed inset-0 z-50 bg-gray-950/85 backdrop-blur-2xl flex flex-col items-center justify-center text-white p-6 select-none transition-all cursor-pointer"
        >
          <div className="bg-gray-900/95 border border-purple-500/40 rounded-3xl p-8 max-w-md text-center shadow-2xl">
            <div className="w-16 h-16 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
              🛡️
            </div>
            <h3 className="text-xl font-black text-white mb-2">شاشة محادثات محمية</h3>
            <p className="text-sm text-purple-200/80 mb-6 font-medium leading-relaxed">
              تم تعتيم وحجب شاشة المحادثات تلقائياً لحماية خصوصية بيانات العملاء أثناء استخدام أدوات التقاط الشاشة أو مغادرة النافذة.
            </p>
            <div className="inline-flex items-center gap-2 bg-purple-950/60 border border-purple-500/30 text-purple-300 text-xs px-4 py-2 rounded-xl font-bold">
              <span>يرجى النقر داخل النافذة للمتابعة ↵</span>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Security Watermark for Employees */}
      {!isAdmin && currentUser && (() => {
        const currentEmp = employees.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
        const empLabel = `${currentEmp?.name || currentUser?.email?.split('@')[0] || 'Employee'} • ${currentUser?.email || ''} • Etegah CRM`;
        const svgContent = `<svg xmlns='http://www.w3.org/2000/svg' width='340' height='220' opacity='0.08'><text x='50%' y='50%' font-size='13' font-weight='bold' font-family='sans-serif' fill='%23000' text-anchor='middle' transform='rotate(-25 170 110)'>${empLabel}</text></svg>`;
        const bgUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}")`;
        return (
          <div 
            className="fixed inset-0 pointer-events-none z-30 select-none overflow-hidden"
            style={{
              backgroundImage: bgUrl,
              backgroundRepeat: 'repeat',
            }}
          />
        );
      })()}

      {/* 3D Modern Gradient Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-blue-600/30 blur-[120px] mix-blend-screen animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-500/20 blur-[100px] mix-blend-screen"></div>
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[100px] mix-blend-screen"></div>
      </div>

      {/* القائمة الجانبية */}
      <div className={`w-full md:w-1/3 md:max-w-sm bg-black/20 backdrop-blur-xl border-l border-white/10 flex-col relative z-10 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="bg-black/40 backdrop-blur-md px-3 py-3 border-b border-white/10 flex justify-between items-center shadow-sm gap-2">
          <div className="flex items-center space-x-2 space-x-reverse min-w-0 flex-1">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-purple-500 rounded-full blur-[4px] opacity-85 group-hover:opacity-100 transition duration-300 animate-pulse"></div>
              <img 
                src="/logo.jpg" 
                alt="Etegah Logo 3D" 
                className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-cyan-300 shadow-[0_4px_16px_rgba(6,182,212,0.6)] transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 cursor-pointer" 
              />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-white text-xs truncate max-w-[120px]" dir="ltr">
                  {userProfile?.name || userProfile?.username || (isAdmin ? 'etegah-analysis' : currentUser?.email?.split('@')[0])}
                </span>
                {isAdmin ? (
                  <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm shrink-0 flex items-center gap-0.5">
                    👑 أدمن
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm shrink-0 bg-blue-600/30 text-blue-300 border border-blue-400/40">
                    {userProfile?.jobTitle === 'Leader' || userProfile?.jobTitle === 'ليدر' ? 'Leader' : (userProfile?.jobTitle || userProfile?.role || 'Agent')}
                  </span>
                )}
                {/* Logout Button right next to Admin / Employee badge */}
                <button 
                  onClick={handleLogout} 
                  className="flex items-center space-x-1 space-x-reverse text-gray-300 hover:text-red-400 transition text-[11px] font-semibold bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full border border-white/10 shrink-0" 
                  title="تسجيل الخروج"
                >
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_4px_#22c55e]"></div>
                  <span>خروج</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1.5 space-x-reverse shrink-0">
            {canCreateGroup && (
              <button 
                onClick={() => setIsCreateGroupModalOpen(true)} 
                className="flex items-center justify-center p-2 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white shadow-[0_4px_12px_rgba(168,85,247,0.5)] border border-purple-300/60 hover:from-purple-500 hover:to-pink-400 transition-all transform hover:scale-110 active:scale-95 shrink-0" 
                title="إنشاء جروب واتساب للموظفين"
              >
                <Users size={16} />
              </button>
            )}
            {!isCoordinator && (
              <>
                <button 
                  onClick={() => setIsAddModalOpen(true)} 
                  className="flex items-center justify-center p-2 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 text-white shadow-[0_4px_12px_rgba(16,185,129,0.5)] border border-emerald-300/60 hover:from-emerald-500 hover:to-cyan-300 transition-all transform hover:scale-110 active:scale-95 shrink-0" 
                  title="إضافة عميل جديد يدوياً"
                >
                  <UserPlus size={16} />
                </button>
                <button 
                  onClick={() => setIsExcelModalOpen(true)} 
                  className="flex items-center justify-center p-2 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 text-white shadow-[0_4px_12px_rgba(99,102,241,0.5)] border border-blue-300/60 hover:from-blue-500 hover:to-purple-400 transition-all transform hover:scale-110 active:scale-95 shrink-0" 
                  title="استيراد من إكسيل (الحملات)"
                >
                  <FileText size={16} />
                </button>
                {!isAdmin && (
                  <button 
                    onClick={() => setIsAnalyticsModalOpen(true)} 
                    className="flex items-center justify-center p-2 rounded-full bg-gradient-to-tr from-cyan-500 via-teal-500 to-emerald-400 text-white shadow-[0_4px_14px_rgba(6,182,212,0.6)] border border-cyan-200/80 hover:from-cyan-400 hover:to-emerald-300 transition-all transform hover:scale-110 active:scale-95 shrink-0" 
                    title="إحصائيات حملاتي"
                  >
                    <BarChart3 size={16} />
                  </button>
                )}
              </>
            )}
            <button 
              onClick={() => navigate('/dashboard')} 
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-full shadow-[0_4px_14px_rgba(245,158,11,0.6)] border-2 border-yellow-200 hover:from-amber-300 hover:to-amber-400 transition-all transform hover:scale-105 active:scale-95 shrink-0" 
              title="الانتقال إلى جدول Leads CRM"
            >
              <BarChart3 size={15} className="text-slate-950" />
              <span className="font-extrabold text-xs tracking-wide">Leads CRM 🎯</span>
            </button>
          </div>
        </div>

        {/* التبديل بين الكل / العملاء / جروبات الموظفين (مخصص للجروبات فقط عند المنسق) */}
        {isCoordinator ? (
          <div className="bg-gradient-to-r from-purple-950/80 via-indigo-950/60 to-slate-900 p-2.5 px-4 border-b border-purple-500/20 flex items-center justify-between relative z-10">
            <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
              <span>👥 جروبات الموظفين الداخلية</span>
            </span>
            <span className="bg-purple-900/60 text-purple-200 border border-purple-400/40 text-[10px] px-2.5 py-0.5 rounded-full font-black shadow-sm">
              {internalGroups.length} جروب
            </span>
          </div>
        ) : (
          <div className="flex items-center bg-black/40 p-1.5 gap-1 border-b border-white/10 relative z-10 text-xs">
            <button 
              onClick={() => setChatTabFilter('all')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 ${chatTabFilter === 'all' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <span>💬 الكل</span>
              <span className="text-[10px] opacity-75">({combinedChats.length})</span>
            </button>
            <button 
              onClick={() => setChatTabFilter('direct')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 ${chatTabFilter === 'direct' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <span>👤 العملاء</span>
              <span className="text-[10px] opacity-75">({chats.length})</span>
            </button>
            <button 
              onClick={() => setChatTabFilter('groups')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 ${chatTabFilter === 'groups' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <span>👥 الجروبات</span>
              <span className="text-[10px] opacity-75">({internalGroups.length})</span>
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="bg-black/20 border-b border-white/5 p-2 px-4 relative z-10">
            <select 
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full bg-white/10 text-white text-sm border-none rounded-lg focus:ring-0 focus:outline-none py-2 px-3 cursor-pointer appearance-none transition hover:bg-white/20"
              style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'left .7em top 50%', backgroundSize: '.65em auto' }}
            >
              <option value="hide" className="text-red-600 font-bold bg-gray-100">🚫 إخفاء المحادثات</option>
              <option value="all" className="text-black font-bold">👥 جميع المحادثات ({chats.length})</option>
              <option value="unassigned" className="text-orange-700 font-bold bg-orange-50">⏳ عملاء الانتظار ({chats.filter(c => c.status === 'unassigned').length})</option>
              {employees.map(emp => {
                const empChatsCount = chats.filter(c => c.assignedToUid === emp.uid).length;
                const empName = emp.username || emp.name;
                const empTitle = formatJobTitle(emp.jobTitle);
                return (
                  <option key={emp.uid} value={emp.uid} className="text-black font-semibold">
                    👤 {empName} | {empTitle} ({empChatsCount} محادثة)
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {!isAdmin && !isCoordinator && (
          <div className="bg-black/20 border-b border-white/5 p-2 px-4 relative z-10">
            <select 
              value={selectedEmployee === 'all' ? 'my_chats' : selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full bg-white/10 text-white text-sm border-none rounded-lg focus:ring-0 focus:outline-none py-2 px-3 cursor-pointer appearance-none transition hover:bg-white/20"
              style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'left .7em top 50%', backgroundSize: '.65em auto' }}
            >
              <option value="my_chats" className="text-black font-bold">💬 محادثاتي المخصصة ({chats.filter(c => c.assignedToUid === currentUser?.uid || (c.assignedTo && currentUser?.email && c.assignedTo.toLowerCase() === currentUser?.email.toLowerCase())).length})</option>
              <option value="unassigned" className="text-orange-700 font-bold bg-orange-50">⏳ عملاء الانتظار ({chats.filter(c => c.status === 'unassigned').length})</option>
            </select>
          </div>
        )}

        {/* البحث في قائمة المحادثات */}
        <div className="p-3 bg-black/10 border-b border-white/5 relative z-10">
          <div className="relative">
            <input 
              type="text" 
              placeholder={isCoordinator ? "ابحث عن اسم الجروب..." : "ابحث عن اسم، رقم، أو جروب..."} 
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full bg-white/10 text-white placeholder-gray-400 border border-white/10 rounded-full py-2 pr-9 pl-4 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-black/30 transition-all"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
          </div>
        </div>

        {/* قائمة الشات والجروبات الجانبية */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5 relative z-10">
          {filteredChats.map((chat) => {
            const isUnassignedOrUnread = chat.status === 'unassigned' || chat.unread > 0;
            const itemBg = activeChat?.id === chat.id 
              ? 'bg-white/20 border-r-4 border-cyan-400' 
              : isUnassignedOrUnread 
                ? 'bg-red-950/50 border-r-4 border-r-red-500 hover:bg-red-900/60 shadow-inner' 
                : 'hover:bg-white/5 border-r-4 border-r-transparent';

            // Group Card Item
            if (chat.isGroup) {
              return (
                <div 
                  key={chat.id}
                  onClick={() => handleChatClick(chat)}
                  className={`p-4 cursor-pointer transition flex items-center justify-between ${itemBg}`}
                >
                  <div className="flex items-center space-x-3 space-x-reverse min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white border border-purple-400/40">
                        <Users size={20} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-white text-sm flex items-center gap-1.5 truncate">
                        <span className="text-purple-300">👥</span>
                        <span className="truncate">{chat.name}</span>
                        <span className="bg-purple-900/60 text-purple-200 border border-purple-400/40 text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0">
                          {chat.members?.length || 1} عضو
                        </span>
                      </h3>
                      <p className="text-[11px] text-purple-300/80 truncate">
                        أنشئ بواسطة: {chat.createdByName}
                      </p>
                      <p className="text-xs truncate mt-1 text-gray-300">
                        <span className="text-cyan-400 font-bold">{chat.lastMessageSender ? `${chat.lastMessageSender}: ` : ''}</span>
                        {chat.lastMessage || 'بدء المحادثة في الجروب...'}
                      </p>
                    </div>
                  </div>
                  <div className="text-left flex flex-col items-end shrink-0 ml-2">
                    <span className="text-[10px] text-gray-400">{formatTime(chat.updatedAt)}</span>
                    <span className="mt-1 bg-purple-950/60 text-purple-300 border border-purple-500/30 rounded px-1.5 py-0.5 text-[9px] font-bold">
                      جروب موظفين
                    </span>
                  </div>
                </div>
              );
            }

            // Regular Customer Card Item
            return (
              <div 
                key={chat.id}
                onClick={() => handleChatClick(chat)}
                className={`p-4 cursor-pointer transition flex items-center justify-between ${itemBg}`}
              >
                <div className="flex items-center space-x-3 space-x-reverse min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md ${isUnassignedOrUnread ? 'bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-gradient-to-tr from-cyan-600 to-blue-500 text-white'}`}>
                      {chat.name ? chat.name.charAt(0) : <User size={20} />}
                    </div>
                    {chat.unread > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-md animate-pulse">
                        {chat.unread}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2 truncate">
                      <span>{chat.name || 'عميل بدون اسم'}</span>
                      {chat.status === 'unassigned' && (
                        <span className="bg-red-600/30 text-red-200 border border-red-500/50 text-[10px] px-1.5 py-0.2 rounded font-extrabold shrink-0 animate-pulse">⏳ في الانتظار</span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono truncate" dir="ltr">{chat.phoneNumber}</p>
                    <p className={`text-xs truncate mt-1 ${isUnassignedOrUnread ? 'text-red-200 font-bold' : 'text-gray-300'}`}>{chat.lastMessage || 'بدء المحادثة...'}</p>
                  </div>
                </div>
                <div className="text-left flex flex-col items-end shrink-0 ml-2">
                  <span className="text-[10px] text-gray-400">{formatTime(chat.updatedAt)}</span>
                  {isAdmin && (
                    <select 
                      value={chat.assignedToUid || ""}
                      onChange={(e) => handleAssignChat(chat.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 bg-black/40 text-cyan-300 border border-cyan-500/30 rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none focus:border-cyan-400 cursor-pointer max-w-[100px]"
                    >
                      <option value="" disabled className="bg-slate-900 text-gray-400">تحويل إلى...</option>
                      <option value={currentUser.uid} className="bg-slate-900 text-amber-300 font-bold">👑 تحويل إلى الأدمن</option>
                      {employees
                        .filter(emp => emp.uid !== currentUser.uid)
                        .map(emp => {
                          const empName = emp.username || emp.name;
                          const empTitle = ` (${formatJobTitle(emp.jobTitle)})`;
                          return (
                            <option key={emp.uid} value={emp.uid} className="bg-slate-900 text-white">
                              {emp.role === 'admin' ? `👑 الإدارة (${empName})` : `${empName}${empTitle}`}
                            </option>
                          );
                        })}
                    </select>
                  )}
                </div>
              </div>
            );
          })}
          {filteredChats.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-xs leading-relaxed">
              {isCoordinator ? "لا توجد جروبات موظفين منشأة أو مضافة لك حالياً." : "لا توجد محادثات أو جروبات مطابقة للفلتر المختار."}
            </div>
          )}
        </div>
      </div>

      {/* منطقة الشات الرئيسية */}
      <div 
        onClick={() => setActiveChat(null)}
        className={`flex-1 flex-col bg-black/40 backdrop-blur-2xl relative z-10 ${!activeChat ? 'hidden md:flex' : 'flex'}`}
      >
        {activeChat ? (
          <>
            {/* هيدر الشات */}
            <div onClick={(e) => e.stopPropagation()} className="bg-black/40 backdrop-blur-md p-4 border-b border-white/10 flex justify-between items-center shadow-md">
              <div className="flex items-center space-x-3 space-x-reverse min-w-0 flex-1">
                <button 
                  onClick={() => setActiveChat(null)} 
                  className="md:hidden text-gray-300 hover:text-white p-1 ml-1 transition shrink-0"
                  title="رجوع للقائمة"
                >
                  <ChevronRight size={24} />
                </button>
                
                {activeChat.isGroup ? (
                  /* Group Header Avatar & Title */
                  <>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white font-bold shadow-md shrink-0 border border-purple-400/40">
                      <Users size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-bold text-white text-base flex items-center gap-1.5 truncate">
                        <span className="text-purple-300">👥</span>
                        <span className="truncate">{activeChat.name}</span>
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-purple-200/80 flex-wrap">
                        <span className="bg-purple-900/60 border border-purple-400/40 text-[10px] px-2 py-0.2 rounded-full font-bold">
                          {activeChat.members?.length || 1} أعضاء
                        </span>
                        <span className="text-[11px] text-gray-300">
                          أنشئ بواسطة: <span className="font-bold text-cyan-300">{activeChat.createdByName}</span>
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Customer Header Avatar & Title */
                  <>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white font-bold shadow-md shrink-0">
                      {activeChat.name ? activeChat.name.charAt(0) : <User size={20} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-bold text-white text-base truncate">{activeChat.name || 'عميل بدون اسم'}</h2>
                      <p className="text-xs text-gray-400 font-mono" dir="ltr">{activeChat.phoneNumber}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {/* شارة مصدر العميل */}
                        {activeChat.source === 'website' ? (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            🌐 عميل موقع
                          </span>
                        ) : activeChat.source === 'excel_import' ? (
                          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            📊 حملة إكسيل
                          </span>
                        ) : activeChat.source === 'manual' ? (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            ✋ مضاف يدوياً
                          </span>
                        ) : (
                          <span className="bg-gray-500/20 text-gray-300 border border-gray-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            👤 عميل
                          </span>
                        )}
                        {/* شارة رقم الإرسال */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          (activeChat.assignedSender || (activeChat.source === 'website' ? 'website' : 'campaigns')) === 'website'
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                            : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        }`}>
                          📞 {(activeChat.assignedSender || (activeChat.source === 'website' ? 'website' : 'campaigns')) === 'website' ? 'رقم الموقع' : 'رقم الحملات'}
                        </span>

                        {/* CRM Status Dropdown Selector */}
                        <select
                          value={activeChat.crmStatus || 'unassigned'}
                          onChange={async (e) => {
                            const newCrmStatus = e.target.value;
                            try {
                              await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', activeChat.id), { crmStatus: newCrmStatus });
                              setActiveChat(prev => ({ ...prev, crmStatus: newCrmStatus }));
                              toast.success('تم تحديث حالة العميل');
                            } catch (err) { toast.error('خطأ في تحديث حالة العميل'); }
                          }}
                          className="bg-slate-900 text-amber-300 border border-amber-500/40 rounded-full px-2.5 py-0.5 text-[10px] font-bold focus:outline-none cursor-pointer"
                        >
                          <option value="unassigned" className="bg-slate-900 text-gray-300">⏳ في الانتظار</option>
                          <option value="assigned" className="bg-slate-900 text-blue-300">📋 تم التوجيه</option>
                          <option value="interested" className="bg-slate-900 text-emerald-300">🌟 مهتم</option>
                          <option value="not_interested" className="bg-slate-900 text-rose-300">❌ غير مهتم</option>
                          <option value="no_answer" className="bg-slate-900 text-amber-300">📵 لم يرد</option>
                          <option value="lost" className="bg-slate-900 text-red-300">🥀 مفقود</option>
                          <option value="subscribed" className="bg-slate-900 text-purple-300">🎉 تم الاشتراك</option>
                          <option value="started_trial" className="bg-slate-900 text-cyan-300">🚀 بدأ تجربة بالفعل</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right Side Header Controls */}
              <div className="flex items-center space-x-2 space-x-reverse flex-col sm:flex-row gap-1.5 shrink-0">
                {activeChat.isGroup ? (
                  /* Group Action Buttons */
                  <button 
                    onClick={() => setIsGroupInfoModalOpen(true)}
                    className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border border-purple-400/50 px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md"
                    title="عرض وإدارة أعضاء الجروب"
                  >
                    <Users size={15} />
                    <span>إدارة الأعضاء ({activeChat.members?.length || 1})</span>
                  </button>
                ) : (
                  /* Customer Action Buttons */
                  <>
                    <button
                      onClick={() => {
                        const phoneNum = activeChat.phoneNumber.replace(/[^0-9]/g, '');
                        window.open(`https://wa.me/${phoneNum}`, '_blank');
                      }}
                      className="bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 border border-emerald-500/40 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      title="فتح محادثة الواتساب المباشرة"
                    >
                      <MessageCircle size={14} />
                      <span className="hidden sm:inline">فتح الواتساب</span>
                    </button>

                    {isAdmin && (
                      <select
                        value={activeChat.assignedSender || (activeChat.source === 'website' ? 'website' : 'campaigns')}
                        onChange={async (e) => {
                          const newSender = e.target.value;
                          try {
                            await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', activeChat.id), { assignedSender: newSender });
                            setActiveChat(prev => ({ ...prev, assignedSender: newSender }));
                            toast.success(`تم تحديد رقم الإرسال: ${newSender === 'website' ? 'رقم الموقع' : 'رقم الحملات'}`);
                          } catch (err) { toast.error('خطأ في تحديث رقم الإرسال'); }
                        }}
                        className="bg-black/40 text-white border border-white/20 rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none focus:border-cyan-400 cursor-pointer"
                        title="تحديد رقم الإرسال (للأدمن فقط)"
                      >
                        <option value="website" className="bg-slate-900 text-teal-300">📞 رقم الموقع</option>
                        <option value="campaigns" className="bg-slate-900 text-purple-300">📣 رقم الحملات</option>
                      </select>
                    )}
                    <button 
                      onClick={() => setIsTemplateModalOpen(true)}
                      className="bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 space-x-reverse"
                    >
                      <Send size={14} />
                      <span>إرسال قالب</span>
                    </button>
                  </>
                )}
              </div>
            </div>


            {/* محتوى المحادثة */}
            <div 
              ref={messagesContainerRef}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onClick={(e) => {
                if (e.target === messagesContainerRef.current) {
                  setActiveChat(null);
                }
              }}
              className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/40 cursor-pointer"
            >
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  {activeChat.isGroup ? 'لا توجد رسائل في هذا الجروب بعد. ابدأ المحادثة مع فريق العمل!' : 'لا توجد رسائل سابقة. ابدأ المحادثة الآن!'}
                </div>
              ) : (
                messages.map((msg, index) => {
                  const dateObj = msg.timestamp?.toDate ? msg.timestamp.toDate() : null;
                  const dateStr = dateObj ? dateObj.toDateString() : null;
                  const dateLabel = dateObj ? dateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;
                  
                  let showDateSep = false;
                  if (dateStr && dateStr !== lastDateMsg) {
                    lastDateMsg = dateStr;
                    showDateSep = true;
                  }

                  // System notices in group or chat
                  if (msg.sender === 'system') {
                    return (
                      <React.Fragment key={msg.id}>
                        {showDateSep && (
                          <div className="flex items-center gap-3 my-4 px-2">
                            <div className="flex-1 h-px bg-white/20"></div>
                            <span className="text-xs text-gray-400 bg-black/20 px-3 py-1 rounded-full whitespace-nowrap">{dateLabel}</span>
                            <div className="flex-1 h-px bg-white/20"></div>
                          </div>
                        )}
                        <div className="flex justify-center my-2">
                          <div className="bg-slate-800/80 text-cyan-300 text-xs px-3.5 py-1 rounded-full border border-cyan-500/30 flex items-center gap-1.5 shadow-md font-medium">
                            <span>📢</span>
                            <span>{msg.text}</span>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }

                  const isGroupChat = activeChat.isGroup || msg.isGroupMessage;
                  const isSentByMe = isGroupChat 
                    ? (msg.senderUid === currentUser?.uid || msg.sender === currentUser?.uid || msg.senderEmail?.toLowerCase() === currentUser?.email?.toLowerCase())
                    : (msg.sender === 'agent');

                  return (
                  <React.Fragment key={msg.id}>
                    {showDateSep && (
                      <div className="flex items-center gap-3 my-4 px-2">
                        <div className="flex-1 h-px bg-white/20"></div>
                        <span className="text-xs text-gray-400 bg-black/20 px-3 py-1 rounded-full whitespace-nowrap">{dateLabel}</span>
                        <div className="flex-1 h-px bg-white/20"></div>
                      </div>
                    )}
                    <div 
                      className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} group mb-2 cursor-default`}
                      onClick={(e) => e.stopPropagation()}
                    >
                    <div className={`max-w-[75%] sm:max-w-[70%] rounded-2xl p-3 shadow-md relative ${isSentByMe ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}`}>
                      <div className="flex justify-between items-start">
                        <div className="ml-6 flex-1">
                          {/* Sender Badges */}
                          {isGroupChat ? (
                            <div className="mb-1.5 flex items-center gap-1.5">
                              {adminEmails.includes(msg.senderEmail?.toLowerCase()) || msg.senderRole === 'admin' ? (
                                <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm border border-yellow-300 flex items-center gap-1">
                                  👑 الإدارة
                                </span>
                              ) : msg.senderRole === 'coordinator' || msg.senderRole === 'منسق للإدارة' ? (
                                <span className="bg-cyan-100 text-cyan-900 font-black text-[10px] px-2 py-0.5 rounded-full border border-cyan-300 flex items-center gap-1">
                                  📋 {msg.senderName || msg.senderEmail?.split('@')[0]} (منسق)
                                </span>
                              ) : msg.senderRole === 'leader' || msg.senderRole === 'ليدر' ? (
                                <span className="bg-purple-100 text-purple-900 font-black text-[10px] px-2 py-0.5 rounded-full border border-purple-300 flex items-center gap-1">
                                  👑 {msg.senderName || msg.senderEmail?.split('@')[0]} (Leader)
                                </span>
                              ) : (
                                <span className="bg-blue-100 text-blue-900 font-bold text-[10px] px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                                  👤 {msg.senderName || getEmployeeDisplayName(msg.senderEmail)}
                                </span>
                              )}
                            </div>
                          ) : (
                            msg.sender === 'agent' && (
                              <div className="mb-2 flex items-center gap-1.5">
                                {adminEmails.includes(msg.senderEmail?.toLowerCase()) ? (
                                  <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full shadow-[0_2px_8px_rgba(245,158,11,0.5)] border border-yellow-200 flex items-center gap-1">
                                    👑 أدمن منصة اتجاه التحليل الذكي
                                  </span>
                                ) : (
                                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                                    👤 {getEmployeeDisplayName(msg.senderEmail)}
                                  </span>
                                )}
                              </div>
                            )
                          )}
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
                          {msg.replyTo && (
                            <div className="bg-white/50 p-2 rounded mb-1 border-l-4 border-green-500 text-xs text-gray-500 truncate max-w-[200px]">
                              <span className="text-green-600 font-bold block">{msg.replyTo.sender === 'user' ? activeChat.name : 'أنت'}</span>
                              {msg.replyTo.text || '📷 مرفق'}
                            </div>
                          )}
                          {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mr-2 opacity-80 sm:opacity-0 group-hover:opacity-100 transition">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setReplyingToMessage(msg); }}
                            className="text-gray-500 hover:text-emerald-600 transition p-1 rounded hover:bg-black/10"
                            title="الرد على الرسالة (Reply)"
                          >
                            <Reply size={14} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setMessageToForward(msg); setIsForwardModalOpen(true); }}
                            className="text-gray-500 hover:text-blue-600 transition p-1 rounded hover:bg-black/10"
                            title="إعادة توجيه (Forward)"
                          >
                            <Forward size={14} />
                          </button>
                          {isAdmin && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg); }}
                              className="text-red-400 hover:text-red-600 transition p-1 rounded hover:bg-red-50"
                              title="حذف الرسالة (للإدارة فقط)"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-500 flex items-center justify-end gap-1 mt-1 font-mono">
                        <span>{formatTime(msg.timestamp)}</span>
                        {msg.sender === 'agent' && (
                          <span className="flex items-center">
                            {msg.status === 'read' ? (
                              <CheckCheck size={14} className="text-cyan-600 font-black" title="تم القراءة (تم فتح الرسالة ✔✔)" />
                            ) : msg.status === 'delivered' ? (
                              <CheckCheck size={14} className="text-gray-500" title="تم التسليم للعميل (✔✔)" />
                            ) : msg.status === 'sent' ? (
                              <Check size={14} className="text-gray-500" title="تم الإرسال (✔)" />
                            ) : msg.status === 'failed' ? (
                              <AlertCircle size={13} className="text-red-500" title="فشل الإرسال ⚠️" />
                            ) : (
                              <Clock size={12} className="text-gray-400 animate-spin" title="جاري الإرسال (بدون إنترنت أو قيد المعالجة 🕒)" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  </React.Fragment>
                  );
                })
              )}
            </div>

            {/* مربع كتابة الرسالة */}
            <div onClick={(e) => e.stopPropagation()} className="bg-black/30 backdrop-blur-xl p-4 border-t border-white/10 relative z-10">
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
              {replyingToMessage && (
                <div className="bg-white border-t-2 border-gray-100 border-l-4 border-l-green-500 px-4 py-2 flex justify-between items-center shadow-inner">
                  <div className="flex-1 truncate min-w-0">
                    <span className="text-green-600 font-bold text-xs block">{replyingToMessage.sender === 'user' ? activeChat.name : 'أنت'}</span>
                    <span className="text-gray-700 text-sm truncate block">{replyingToMessage.text || 'ملف مرفق 📷'}</span>
                  </div>
                  <button onClick={() => setReplyingToMessage(null)} className="text-gray-400 hover:text-red-600 transition bg-gray-100 hover:bg-red-50 p-1.5 rounded-full mr-2 flex-shrink-0">
                    <X size={16} />
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex space-x-2 space-x-reverse items-center relative z-10">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setAttachment(e.target.files[0]);
                    }
                  }} 
                  className="hidden" 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="p-2.5 rounded-full text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 transition shrink-0" 
                  title="إرفاق ملف أو صورة"
                >
                  <Paperclip size={18} />
                </button>
                
                <div className="relative flex-1">
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب رسالتك هنا... (اضغط Enter للإرسال)"
                    rows={1}
                    className="w-full bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-2xl py-2.5 pr-4 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-black/40 transition-all resize-none max-h-32"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-yellow-400 transition"
                  >
                    <Smile size={18} />
                  </button>
                  {showEmojiPicker && (
                    <div ref={emojiPickerRef} className="absolute left-0 bottom-12 bg-slate-800 border border-white/20 rounded-xl p-3 shadow-2xl grid grid-cols-6 gap-2 z-50">
                      {COMMON_EMOJIS.map((emoji, idx) => (
                        <button key={idx} type="button" onClick={() => { setMessage(prev => prev + emoji); setShowEmojiPicker(false); }} className="text-xl hover:bg-white/10 p-1.5 rounded transition">
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={uploadingAttachment}
                  className="p-2.5 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 text-white shadow-lg transition transform hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0" 
                  title="إرسال"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative z-10">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 rounded-full blur-2xl opacity-60 group-hover:opacity-80 transition duration-700 animate-pulse"></div>
              <img 
                src="/logo.jpg" 
                alt="منصة اتجاه التحليل الذكي" 
                className="relative w-36 h-36 rounded-full object-cover border-4 border-cyan-400/50 shadow-[0_15px_35px_rgba(0,0,0,0.6)] transform hover:scale-105 transition-all duration-500 hover:rotate-3"
              />
            </div>
          </div>
        )}
      </div>

      {/* Modal: إضافة عميل جديد */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl text-right">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-lg">إضافة عميل جديد يدوياً</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">اسم العميل (اختياري)</label>
                <input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="مثال: أحمد محمد" className="w-full bg-white/10 text-white border border-white/20 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">رقم الواتساب (مطلوب)</label>
                <div className="flex gap-2" dir="ltr">
                  <select value={newCustomerCountryCode} onChange={(e) => setNewCustomerCountryCode(e.target.value)} className="bg-slate-700 text-white border border-white/20 rounded-lg px-2 py-2 text-sm">
                    <option value="+966">🇸🇦 +966</option>
                    <option value="+20">🇪🇬 +20</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+1">🇺🇸 +1</option>
                  </select>
                  <input type="text" value={newCustomerPhone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="50xxxxxxx" className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">تعيين العميل لموظف (اختياري)</label>
                  <select value={selectedAssigneeUid} onChange={(e) => setSelectedAssigneeUid(e.target.value)} className="w-full bg-slate-700 text-white border border-white/20 rounded-lg p-2.5 text-sm">
                    <option value="">-- اختياري (تلقائي حسابي) --</option>
                    {employees.map(emp => (
                      <option key={emp.uid} value={emp.uid}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold">إلغاء</button>
                <button type="submit" className="px-5 py-2 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg flex items-center gap-1">
                  <UserPlus size={14} />
                  <span>إضافة العميل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: إرسال قالب منفرد */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl text-right">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-lg">إرسال قالب محادثة (Meta)</h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSendSingleTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">اختر اسم القالب المسجل في ميتا</label>
                <select 
                  value={singleTemplateName} 
                  onChange={(e) => setSingleTemplateName(e.target.value)} 
                  className="w-full bg-slate-700 text-white border border-white/20 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="welcome_msg">welcome_msg (ترحيب)</option>
                  <option value="hello_world">hello_world (عام)</option>
                  <option value="followup_msg">followup_msg (متابعة)</option>
                  <option value="offer_details">offer_details (عرض خاص)</option>
                </select>
              </div>
              <div className="bg-black/30 p-3 rounded-lg border border-white/10 text-xs text-gray-300">
                <span className="font-bold text-cyan-400 block mb-1">معاينة القالب:</span>
                <p className="whitespace-pre-wrap">{getTemplateDisplayMessage(singleTemplateName)}</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold">إلغاء</button>
                <button type="submit" disabled={isSendingTemplate} className="px-5 py-2 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 text-white text-xs font-bold shadow-lg disabled:opacity-50 flex items-center gap-1">
                  {isSendingTemplate ? 'جاري الإرسال...' : 'إرسال القالب للعميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: استيراد من إكسيل (الحملات) */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-white/20 rounded-2xl p-6 w-full max-w-lg shadow-2xl text-right">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <FileText className="text-blue-400" size={20} />
                <span>إرسال حملة جماعية عبر ملف إكسيل</span>
              </h3>
              <button onClick={() => setIsExcelModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleExcelImport} className="space-y-4">
              {/* نموذج وقالب ملف الإكسيل */}
              <div className="bg-cyan-950/40 border border-cyan-500/30 p-3.5 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <FileText size={15} />
                    <span>صيغة ملف الإكسيل المطلوب:</span>
                  </span>
                  <button 
                    type="button" 
                    onClick={handleDownloadExcelTemplate} 
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-md text-xs transform hover:scale-105 active:scale-95"
                  >
                    <Download size={14} />
                    <span>تحميل ملف إكسيل نموذجي 📥</span>
                  </button>
                </div>
                <p className="text-gray-300 leading-relaxed text-[11px]">
                  يجب أن يحتوي ملف الإكسيل على العمودين التاليين في الصف الأول:
                </p>
                <div className="bg-black/40 p-2.5 rounded-lg font-mono text-[11px] text-cyan-200 border border-white/10 space-y-1">
                  <div>• العمـود الأول (رقم الهاتـف): <span className="text-white font-bold">Phone</span> أو <span className="text-white font-bold">الهاتف</span> (مثال: +966501234567)</div>
                  <div>• العمـود الثانـي (اسم العميـل): <span className="text-white font-bold">Name</span> أو <span className="text-white font-bold">الاسم</span> (اختياري)</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">اختيار وتحميل ملف إكسيل للحملة</label>
                <div 
                  onClick={() => excelFileInputRef.current?.click()} 
                  className="w-full bg-white/10 hover:bg-white/20 border-2 border-dashed border-cyan-500/50 hover:border-cyan-400 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group shadow-inner"
                >
                  <input 
                    type="file" 
                    ref={excelFileInputRef}
                    accept=".xlsx, .xls, .csv" 
                    onChange={(e) => setExcelFile(e.target.files[0])} 
                    className="hidden" 
                  />
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 group-hover:bg-cyan-500/30 flex items-center justify-center text-cyan-300 transition shadow-md">
                    <Upload size={20} className="animate-bounce text-cyan-400" />
                  </div>
                  {excelFile ? (
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-500/40">
                      <FileText size={14} className="text-emerald-400" />
                      <span dir="ltr" className="truncate max-w-[250px]">{excelFile.name}</span>
                      <span className="text-[10px] text-gray-300">({(excelFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white block flex items-center justify-center gap-1">
                        <span>انقر هنا لاختيار وتحميل ملف الإكسيل</span>
                        <Upload size={14} className="text-cyan-400" />
                      </span>
                      <span className="text-[10px] text-gray-400 block">يقبل صيغ الإكسيل (.xlsx / .xls / .csv)</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">القالب المطلوب إرساله</label>
                <select value={bulkTemplateName} onChange={(e) => setBulkTemplateName(e.target.value)} className="w-full bg-slate-700 text-white border border-white/20 rounded-lg p-2 text-xs">
                  <option value="welcome_msg">welcome_msg</option>
                  <option value="hello_world">hello_world</option>
                  <option value="followup_msg">followup_msg</option>
                  <option value="offer_details">offer_details</option>
                </select>
              </div>

              {isBulkSending && (
                <div className="bg-black/40 p-3 rounded-lg border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs text-gray-300 font-bold">
                    <span>جاري الإرسال... {bulkProgress} من {bulkTotal}</span>
                    <span>{Math.round((bulkProgress / bulkTotal) * 100)}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300" style={{ width: `${(bulkProgress / bulkTotal) * 100}%` }}></div>
                  </div>
                  <div className="flex justify-around text-xs pt-1 font-bold">
                    <span className="text-emerald-400">نجاح: {bulkResults.success}</span>
                    <span className="text-red-400">فشل: {bulkResults.failed}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsExcelModalOpen(false)} className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold">إلغاء</button>
                <button type="submit" disabled={isBulkSending || !excelFile} className="px-5 py-2 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white text-xs font-bold shadow-lg disabled:opacity-50">
                  {isBulkSending ? 'جاري بدء الحملة...' : 'بدء إرسال الحملة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: إحصائيات الموظف (جدول شامل) */}
      {isAnalyticsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 w-full max-w-4xl shadow-2xl text-right max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <BarChart3 className="text-amber-400" size={22} />
                <span>إحصائيات أداء القوالب والحملات التسويقية</span>
              </h3>
              <button onClick={() => setIsAnalyticsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-x-auto overflow-y-auto pr-1">
              {employeeAnalytics.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  لا توجد سجلات رسائل قوالب حتى الآن.
                </div>
              ) : (
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-black/40 text-gray-300 border-b border-white/10 font-bold">
                      <th className="p-3">اسم القالب</th>
                      <th className="p-3">الموظف المُرْسِل</th>
                      <th className="p-3 text-center">إجمالي الإرسال</th>
                      <th className="p-3 text-center bg-blue-500/10 text-blue-300">مرة واحدة</th>
                      <th className="p-3 text-center bg-purple-500/10 text-purple-300">مرتين</th>
                      <th className="p-3 text-center bg-amber-500/10 text-amber-300">🔥 3+ مرات</th>
                      <th className="p-3 text-center">تم التسليم (✔✔)</th>
                      <th className="p-3 text-center text-emerald-400">تم الفتح (✔✔)</th>
                      <th className="p-3 text-center">نسبة الفتح (Open Rate)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {employeeAnalytics.map((campaign, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition">
                        <td className="p-3 font-bold text-cyan-300">{campaign.templateName}</td>
                        <td className="p-3 text-gray-300 font-mono">{campaign.sender}</td>
                        <td className="p-3 text-center font-bold text-white">{campaign.sent}</td>
                        <td className="p-3 text-center font-bold text-blue-300 bg-blue-500/5">{campaign.sentOnce}</td>
                        <td className="p-3 text-center font-bold text-purple-300 bg-purple-500/5">{campaign.sentTwice}</td>
                        <td className="p-3 text-center font-bold text-amber-300 bg-amber-500/5">{campaign.sentMore}</td>
                        <td className="p-3 text-center text-gray-300">{campaign.delivered}</td>
                        <td className="p-3 text-center font-bold text-emerald-400">{campaign.read}</td>
                        <td className="p-3 text-center font-bold">
                          <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                            %{campaign.openRate}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-4 shrink-0 border-t border-white/10 mt-2">
              <button onClick={() => setIsAnalyticsModalOpen(false)} className="px-5 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: إعادة توجيه الرسالة */}
      {isForwardModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl text-right max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Forward className="text-cyan-400" size={20} />
                <span>إعادة توجيه الرسالة</span>
              </h3>
              <button onClick={() => setIsForwardModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="bg-black/30 p-3 rounded-lg border border-white/10 text-xs text-gray-300 mb-3 shrink-0">
              <span className="font-bold text-cyan-400 block mb-1">الرسالة المراد توجيهها:</span>
              <p className="truncate">{messageToForward?.text || '📷 ملف مرفق'}</p>
            </div>

            <div className="mb-3 relative shrink-0">
              <input 
                type="text" 
                placeholder="ابحث عن العميل المراد التوجيه إليه..." 
                value={forwardSearchTerm} 
                onChange={(e) => setForwardSearchTerm(e.target.value)} 
                className="w-full bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-lg py-2 pr-9 pl-4 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500" 
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5 pr-1">
              {chats
                .filter(c => !forwardSearchTerm || c.name?.toLowerCase().includes(forwardSearchTerm.toLowerCase()) || c.phoneNumber?.includes(forwardSearchTerm))
                .map(c => (
                  <div key={c.id} className="py-2.5 px-2 flex justify-between items-center hover:bg-white/5 rounded-lg transition">
                    <div>
                      <h4 className="font-bold text-white text-xs">{c.name || 'عميل بدون اسم'}</h4>
                      <p className="text-[10px] text-gray-400 font-mono" dir="ltr">{c.phoneNumber}</p>
                    </div>
                    <button 
                      onClick={() => handleConfirmForward(c)} 
                      disabled={isForwarding} 
                      className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50 flex items-center gap-1"
                    >
                      <span>توجيه</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
            </div>

            <div className="flex justify-end pt-3 shrink-0 border-t border-white/10 mt-2">
              <button onClick={() => setIsForwardModalOpen(false)} className="px-4 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: إنشاء جروب واتساب جديد للموظفين */}
      {isCreateGroupModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 w-full max-w-lg shadow-[0_10px_40px_rgba(147,51,234,0.3)] text-right max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10 shrink-0">
              <h3 className="font-black text-white text-lg flex items-center gap-2">
                <Users className="text-purple-400" size={22} />
                <span>👥 إنشاء جروب واتساب جديد للموظفين</span>
              </h3>
              <button 
                onClick={() => setIsCreateGroupModalOpen(false)} 
                className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4 flex-1 flex flex-col overflow-hidden">
              {/* Group Name Input */}
              <div className="shrink-0">
                <label className="block text-xs font-bold text-purple-200 mb-1.5">
                  اسم الجروب: <span className="text-rose-400">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="مثال: جروب فريق المبيعات والتداول، مناقشات التيم..." 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-slate-950 text-white placeholder-gray-500 border border-purple-500/40 rounded-xl py-2.5 px-3.5 text-xs font-bold focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Members Selection List */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-2 shrink-0">
                  <label className="text-xs font-bold text-purple-200">
                    أعضاء الجروب المتاحين لك:
                  </label>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={() => setSelectedGroupMemberUids(getEligibleMembersForGroup().map(m => m.uid))}
                      className="text-[10px] text-cyan-400 hover:underline font-bold"
                    >
                      تحديد الكل
                    </button>
                    <span className="text-gray-500 text-xs">|</span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedGroupMemberUids([])}
                      className="text-[10px] text-rose-400 hover:underline font-bold"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-950/80 p-3 rounded-2xl border border-purple-500/20 space-y-2">
                  {/* Mandatory Admin Item */}
                  <div className="p-2.5 bg-gradient-to-r from-amber-950/40 to-yellow-950/30 rounded-xl border border-amber-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="checkbox" 
                        checked={true} 
                        disabled={true} 
                        className="w-4 h-4 rounded text-amber-500 cursor-not-allowed opacity-80" 
                      />
                      <div>
                        <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                          <span>👑 إدارة النظام (الإدارة)</span>
                          <Crown size={12} className="text-amber-400" />
                        </span>
                        <span className="text-[10px] text-amber-400/80 block font-semibold">
                          (عضو إجباري دائم في كل الجروبات 🔒)
                        </span>
                      </div>
                    </div>
                    <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                      محمي
                    </span>
                  </div>

                  {/* Eligible Team Members / Staff */}
                  {getEligibleMembersForGroup().map((emp) => {
                    const isChecked = selectedGroupMemberUids.includes(emp.uid);
                    const title = formatJobTitle(emp.jobTitle);

                    return (
                      <div 
                        key={emp.uid}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedGroupMemberUids(prev => prev.filter(u => u !== emp.uid));
                          } else {
                            setSelectedGroupMemberUids(prev => [...prev, emp.uid]);
                          }
                        }}
                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${isChecked ? 'bg-purple-950/50 border-purple-400' : 'bg-slate-900 border-white/5 hover:border-purple-500/30'}`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => {}} 
                            className="w-4 h-4 rounded text-purple-600 focus:ring-0 cursor-pointer" 
                          />
                          <div className="overflow-hidden">
                            <span className="text-xs font-bold text-white block truncate">
                              {emp.name || emp.username}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono block truncate" dir="ltr">
                              {emp.email}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                          title === 'Leader' 
                            ? 'bg-purple-900/60 text-purple-200 border-purple-400/40' 
                            : emp.jobTitle === 'Coordinator' || emp.role === 'coordinator'
                              ? 'bg-cyan-900/60 text-cyan-200 border-cyan-400/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {title === 'Leader' ? '👑 Leader' : (emp.jobTitle === 'Coordinator' ? '📋 منسق' : '👤 Agent')}
                        </span>
                      </div>
                    );
                  })}

                  {getEligibleMembersForGroup().length === 0 && (
                    <div className="text-center py-6 text-xs text-gray-400">
                      {isLeader ? 'لا يوجد أعضاء معينين تحت فريقك حالياً.' : 'لا يوجد موظفين متاحين.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 shrink-0 border-t border-white/10">
                <button 
                  type="button" 
                  onClick={() => setIsCreateGroupModalOpen(false)} 
                  className="px-4 py-2 rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold transition"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={isCreatingGroup || !newGroupName.trim()} 
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-black shadow-lg disabled:opacity-50 flex items-center gap-1.5 transition active:scale-95"
                >
                  <Users size={15} />
                  <span>{isCreatingGroup ? 'جاري إنشاء الجروب...' : '🚀 تأكيد وإنشاء الجروب'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: إدارة وتفاصيل أعضاء الجروب */}
      {isGroupInfoModalOpen && activeChat?.isGroup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 w-full max-w-lg shadow-[0_10px_40px_rgba(147,51,234,0.3)] text-right max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold shadow-md">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="font-black text-white text-base truncate max-w-[280px]">
                    👥 {activeChat.name}
                  </h3>
                  <span className="text-[11px] text-purple-300 font-medium block">
                    أنشئ بواسطة: {activeChat.createdByName} • {activeChat.members?.length || 1} أعضاء
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsGroupInfoModalOpen(false)} 
                className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden space-y-4">
              {/* Add New Member Section (for Admin, Coordinator, Leader) */}
              {canCreateGroup && (
                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-purple-500/20 shrink-0 space-y-2">
                  <label className="block text-xs font-bold text-purple-200">
                    ➕ إضافة عضو جديد للجروب:
                  </label>
                  <div className="flex gap-2">
                    <select 
                      value={newMemberToAddUid}
                      onChange={(e) => setNewMemberToAddUid(e.target.value)}
                      className="flex-1 bg-slate-900 text-white border border-purple-500/40 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-cyan-400"
                    >
                      <option value="">-- اختر موظفاً لإضافته --</option>
                      {getEligibleMembersForGroup()
                        .filter(emp => !activeChat.members?.includes(emp.uid))
                        .map(emp => (
                          <option key={emp.uid} value={emp.uid} className="bg-slate-900 text-white">
                            {emp.name || emp.username} ({formatJobTitle(emp.jobTitle)})
                          </option>
                        ))}
                    </select>
                    <button 
                      type="button" 
                      onClick={handleAddMemberToGroup}
                      disabled={!newMemberToAddUid}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-xl text-xs font-black transition disabled:opacity-50 shrink-0 shadow-md"
                    >
                      إضافة
                    </button>
                  </div>
                </div>
              )}

              {/* Current Members List */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-purple-200 mb-2 shrink-0">
                  قائمة الأعضاء الحاليين ({activeChat.members?.length || 1}):
                </span>

                <div className="flex-1 overflow-y-auto bg-slate-950/60 p-3 rounded-2xl border border-white/10 space-y-2">
                  {/* Mandatory Admin Display */}
                  <div className="p-2.5 bg-gradient-to-r from-amber-950/40 to-yellow-950/30 rounded-xl border border-amber-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                        👑
                      </div>
                      <div>
                        <span className="text-xs font-black text-amber-300 block">
                          إدارة النظام (الإدارة)
                        </span>
                        <span className="text-[10px] text-amber-400/80 font-mono">
                          admin@etegah.com
                        </span>
                      </div>
                    </div>
                    <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                      محمي 🔒
                    </span>
                  </div>

                  {/* Other Group Members */}
                  {(activeChat.members || []).map((memberUid) => {
                    if (memberUid === 'admin') return null;
                    const emp = employees.find(e => e.uid === memberUid);
                    if (emp?.role === 'admin' || adminEmails.includes(emp?.email?.toLowerCase())) return null;

                    const title = formatJobTitle(emp?.jobTitle);
                    const canRemoveThisMember = 
                      isAdmin || 
                      isCoordinator || 
                      (isLeader && myTeamMembers.some(m => m.uid === memberUid));

                    return (
                      <div 
                        key={memberUid}
                        className="p-2.5 bg-slate-900 rounded-xl border border-white/5 flex items-center justify-between hover:border-purple-500/20 transition"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-8 h-8 rounded-full bg-purple-900/60 text-purple-200 flex items-center justify-center font-bold text-xs shrink-0">
                            {emp ? (emp.name ? emp.name.charAt(0) : '👤') : '👤'}
                          </div>
                          <div className="overflow-hidden">
                            <span className="text-xs font-bold text-white block truncate">
                              {emp?.name || emp?.username || 'موظف'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono block truncate" dir="ltr">
                              {emp?.email || memberUid}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
                            {title === 'Leader' ? '👑 Leader' : (emp?.jobTitle === 'Coordinator' ? '📋 منسق' : '👤 Agent')}
                          </span>

                          {canRemoveThisMember && (
                            <button 
                              type="button" 
                              onClick={() => handleRemoveMemberFromGroup(memberUid)}
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 p-1.5 rounded-lg transition text-[11px] font-bold flex items-center gap-1 border border-rose-500/20"
                              title="إخراج هذا العضو من الجروب"
                            >
                              <UserMinus size={13} />
                              <span className="hidden sm:inline">إخراج</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-3 shrink-0 border-t border-white/10">
                <button 
                  type="button" 
                  onClick={() => setIsGroupInfoModalOpen(false)} 
                  className="px-5 py-2 rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold transition"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
