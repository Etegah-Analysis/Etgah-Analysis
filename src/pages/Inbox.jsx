// WhatsApp Inbox - Version 1.5 - Updated Campaign Customers & Website WhatsApp Filters
import { setGlobalNotificationAlert } from '../utils/notificationBadge';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { auth, db, signOut, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, where, getDocs, getDoc, deleteDoc, storage, setDoc, writeBatch, arrayUnion } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Send, User, Clock, CheckCircle2, CheckSquare, MessageSquare, ChevronRight, UserPlus, X, BarChart3, Trash2, Paperclip, FileText, Download, Check, CheckCheck, Smile, Pin, Forward, Search, Reply, ArrowRight, Globe, AlertCircle, Upload, Users, Plus, Crown, Shield, ShieldCheck, UserMinus, Info, MessageSquarePlus, Sparkles, Hash, MessageCircle, PhoneCall, Phone, Radio, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { hasPermission } from '../config/permissionsConfig';
import * as XLSX from 'xlsx';

// Error Boundary to catch React runtime crashes in Inbox
class InboxErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Inbox crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      const errMsg = this.state.error?.stack || this.state.error?.message || 'Unknown React Error';
      return (
        <div style={{ padding: 32, textAlign: 'center', background: '#090d16', minHeight: '100vh', color: 'white', direction: 'rtl', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: '900', marginBottom: 8, color: '#38bdf8' }}>حدث خطأ في عرض محادثات الواتساب</h2>
          <p style={{ color: '#94a3b8', marginBottom: 16, fontSize: 13 }}>يرجى النقر على زر التحديث أدناه بعد اكتمال رفع التحديثات:</p>
          <pre style={{ background: '#1e293b', padding: 16, borderRadius: 14, fontSize: 11, textAlign: 'left', overflowX: 'auto', maxWidth: 750, width: '100%', margin: '0 auto 20px', color: '#fca5a5', border: '1px solid rgba(244,63,94,0.3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
            {errMsg}
          </pre>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload(true)}
              style={{ background: '#059669', color: 'white', border: 'none', padding: '12px 30px', borderRadius: 12, fontWeight: 'bold', cursor: 'pointer', fontSize: 14, boxShadow: '0 4px 14px rgba(5,150,105,0.4)' }}
            >
              🔄 تحديث فوري وإعادة تحميل
            </button>
            <button
              onClick={() => { window.location.href = '/dashboard'; }}
              style={{ background: '#4338ca', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 'bold', cursor: 'pointer', fontSize: 14 }}
            >
              📊 العودة للوحة التحكم
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function InboxContent() {
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
  const [rawInternalGroups, setRawInternalGroups] = useState([]);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMemberUids, setSelectedGroupMemberUids] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isGroupInfoModalOpen, setIsGroupInfoModalOpen] = useState(false);
  const [chatTabFilter, setChatTabFilter] = useState('all'); // 'all' | 'direct' | 'website' | 'waiting' | 'groups' | 'colleagues'
  const [newMemberToAddUid, setNewMemberToAddUid] = useState('');
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [directSearchTerm, setDirectSearchTerm] = useState('');

  // Admin Bulk Message Selection & Delete States
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [isHeaderCallRinging, setIsHeaderCallRinging] = useState(false);

  // Broadcast Lists States
  const [broadcastLists, setBroadcastLists] = useState([]);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTab, setBroadcastTab] = useState('lists'); // 'lists' | 'create' | 'members' | 'send'
  const [newBroadcastName, setNewBroadcastName] = useState('');
  const [selectedBroadcastId, setSelectedBroadcastId] = useState('');
  const [broadcastSelectedCustomerIds, setBroadcastSelectedCustomerIds] = useState([]);
  const [broadcastSearchCustomer, setBroadcastSearchCustomer] = useState('');
  const [broadcastCustomerSourceFilter, setBroadcastCustomerSourceFilter] = useState('all'); // 'all' | 'website' | 'campaign'
  const [broadcastMessageText, setBroadcastMessageText] = useState('');
  const [broadcastAttachment, setBroadcastAttachment] = useState(null);
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState({ current: 0, total: 0, currentName: '' });

  const isWebsiteLead = (chat) => {
    if (!chat) return false;
    return (
      chat.addedBy === 'WhatsApp Webhook' ||
      chat.addedBy === 'website_otp' ||
      chat.source === 'website' ||
      chat.source === 'website_whatsapp' ||
      chat.source === 'website_otp' ||
      chat.source === 'موقع الويب (OTP)' ||
      chat.status === 'website_visitor' ||
      chat.addedBy?.includes?.('WhatsApp Webhook') ||
      chat.addedBy?.includes?.('website') ||
      chat.addedBy?.includes?.('otp') ||
      chat.isWebsiteWhatsapp === true ||
      chat.hasEmployeeCode === true ||
      chat.source?.includes?.('موقع') ||
      chat.source?.includes?.('واتساب') ||
      chat.contactReason === 'support' ||
      chat.contactReason === 'details'
    );
  };

  const normalizePhone = (p) => {
    if (!p) return '';
    let str = String(p).replace(/[^0-9]/g, '');
    if (str.startsWith('0')) str = '20' + str.substring(1);
    else if (str.startsWith('5')) str = '966' + str.substring(1);
    else if (str.length === 10 && str.startsWith('1')) str = '20' + str;
    return str;
  };

  const hasCustomerSentMessage = (chat) => {
    if (!chat) return false;
    if (!isWebsiteLead(chat)) return true;
    if (chat.assignedToUid || chat.status === 'assigned' || chat.isResponded || chat.transferredToWhatsapp || isAdmin) return true;
    if (chat.lastMessage && chat.lastMessage.trim() !== '' && !chat.lastMessage.includes('سجّل عبر موقع')) return true;
    if (chat.lastMessageFrom === 'user' || chat.lastSender === 'user' || chat.lastMessageSender === 'user') return true;
    if (Array.isArray(chat.messages) && chat.messages.some(m => m.sender === 'user' || m.from === 'user' || m.sender === 'customer')) return true;
    return false;
  };

  const isWaitingListLead = (chat) => {
    if (!isWebsiteLead(chat)) return false;
    return (
      chat.isResponded !== true &&
      chat.hasReplied !== true &&
      chat.waitingStatus !== 'responded' &&
      chat.lastMessageFrom !== 'emp' &&
      chat.lastMessageFrom !== 'agent' &&
      chat.lastMessageFrom !== 'admin'
    );
  };


  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isFirstLoad = useRef(true);
  const previousUnreadCounts = useRef({});
  
  // New state for Add Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  // Attachment state
  const [attachment, setAttachment] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [previewMediaModal, setPreviewMediaModal] = useState(null);
  const fileInputRef = useRef(null);
  const excelFileInputRef = useRef(null);
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerCountryCode, setNewCustomerCountryCode] = useState('+966');
  const [selectedAssigneeUid, setSelectedAssigneeUid] = useState('');
  const [currentEmpName, setCurrentEmpName] = useState('');

  const handleDownloadFile = (url, fileName = 'ملف_مرفق') => {
    if (!url) return;
    try {
      if (url.startsWith('data:')) {
        // Convert base64 Data URL to Blob for reliable browser download without pop-up blocking
        const arr = url.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        return;
      }

      // For standard HTTP/HTTPS URLs (Firebase Storage)
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download error:", e);
      window.open(url, '_blank');
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchCurrentEmp = async () => {
      try {
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', auth.currentUser.uid)));
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          setCurrentEmpName(userData.username || userData.name || '');
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
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const handleMessagesScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 40;
    setShowScrollBottomBtn(isFarFromBottom);
  };

  const scrollToBottomSmooth = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  const scrollToMessage = useCallback((replyToObj) => {
    if (!replyToObj) return;
    let targetEl = null;

    const targetId = typeof replyToObj === 'string' ? replyToObj : replyToObj.id;
    const metaId = typeof replyToObj === 'object' ? (replyToObj.metaMessageId || replyToObj.stanzaId) : null;
    const targetText = typeof replyToObj === 'object' ? replyToObj.text : null;

    if (targetId) {
      targetEl = document.getElementById(`msg-${targetId}`) || 
                 messagesContainerRef.current?.querySelector(`[data-msg-id="${targetId}"]`);
    }

    if (!targetEl && metaId) {
      targetEl = document.getElementById(`msg-${metaId}`) || 
                 messagesContainerRef.current?.querySelector(`[data-meta-id="${metaId}"]`);
    }

    if (!targetEl && targetText) {
      const cleanText = targetText.trim();
      if (cleanText) {
        const allMsgs = messagesContainerRef.current?.querySelectorAll('[data-msg-id], [data-msg-text]');
        if (allMsgs) {
          for (const el of allMsgs) {
            const attrText = el.getAttribute('data-msg-text');
            if ((attrText && (attrText.includes(cleanText) || cleanText.includes(attrText))) || 
                (el.textContent && el.textContent.includes(cleanText))) {
              targetEl = el;
              break;
            }
          }
        }
      }
    }

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetEl.classList.add('ring-4', 'ring-amber-400', 'bg-amber-200/80', 'dark:bg-amber-500/30', 'scale-[1.02]', 'shadow-2xl');
      setTimeout(() => {
        targetEl.classList.remove('ring-4', 'ring-amber-400', 'bg-amber-200/80', 'dark:bg-amber-500/30', 'scale-[1.02]', 'shadow-2xl');
      }, 2000);
    } else {
      toast.error('لم يتم العثور على الرسالة الأصلية في هذه المحادثة');
    }
  }, []);

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

  const closeActiveChat = useCallback(() => {
    setActiveChat(null);
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (_) {}
  }, []);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) {
      closeActiveChat();
    }
  };

  const [impersonatedEmp, setImpersonatedEmp] = useState(() => {
    try {
      const saved = sessionStorage.getItem('impersonatedEmp');
      if (saved) return JSON.parse(saved);
      if (location.state?.impersonatedEmp) {
        sessionStorage.setItem('impersonatedEmp', JSON.stringify(location.state.impersonatedEmp));
        return location.state.impersonatedEmp;
      }
      return null;
    } catch {
      return null;
    }
  });

  // Keep impersonatedEmp synced with location.state & sessionStorage
  useEffect(() => {
    if (location.state?.impersonatedEmp) {
      setImpersonatedEmp(location.state.impersonatedEmp);
      try {
        sessionStorage.setItem('impersonatedEmp', JSON.stringify(location.state.impersonatedEmp));
      } catch (_) {}
    } else {
      try {
        const saved = sessionStorage.getItem('impersonatedEmp');
        if (saved) {
          setImpersonatedEmp(JSON.parse(saved));
        }
      } catch (_) {}
    }
  }, [location.state]);

  const realCurrentUser = auth.currentUser;
  const adminEmails = ['etegahanalysis@gmail.com', 'mohamed.gamal.work0@gmail.com', 'admin@etegah.com'];
  const adminUids = ['admin', 'KZoAQt0FQ8MfKLt2aasGhES4ZOF3'];

  const isAdminMember = (uid) => {
    if (!uid) return false;
    const lower = String(uid).toLowerCase().trim();
    if (lower === 'admin' || adminUids.includes(uid) || adminEmails.includes(lower)) return true;
    const emp = employees.find(e => e.uid === uid || e.email?.toLowerCase() === lower);
    return emp?.role === 'admin' || adminEmails.includes(emp?.email?.toLowerCase());
  };

  const isAdminIdentifier = (val) => {
    if (!val) return false;
    const lower = String(val).toLowerCase().trim();
    if (lower === 'admin' || lower === 'الإدارة' || lower === 'ادارة' || lower === '👑 الإدارة' || lower === 'الرئيسي' || lower === 'حساب رئيسي') return true;
    if (adminEmails.includes(lower)) return true;
    if (lower === 'etegahanalysis' || lower.startsWith('etegahanalysis@') || lower.startsWith('mohamed.gamal.work0@')) return true;
    return false;
  };

  const realIsAdmin = realCurrentUser && (
    adminEmails.includes(realCurrentUser.email?.toLowerCase()) || 
    isAdminIdentifier(realCurrentUser.email) || 
    isAdminIdentifier(realCurrentUser.displayName)
  );

  // If Admin is impersonating an employee, evaluate identity & permissions strictly as that employee
  const currentUser = React.useMemo(() => {
    return (realIsAdmin && impersonatedEmp)
      ? { uid: impersonatedEmp.uid, email: impersonatedEmp.email, displayName: impersonatedEmp.username || impersonatedEmp.name }
      : realCurrentUser;
  }, [realIsAdmin, impersonatedEmp?.uid, impersonatedEmp?.email, impersonatedEmp?.name, impersonatedEmp?.username, realCurrentUser]);

  const isAdmin = realIsAdmin && !impersonatedEmp;
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('hide');

  useEffect(() => {
    if (!realIsAdmin && impersonatedEmp) {
      setImpersonatedEmp(null);
      try {
        sessionStorage.removeItem('impersonatedEmp');
        localStorage.removeItem('impersonatedEmp');
      } catch (_) {}
    }
  }, [realIsAdmin, impersonatedEmp]);

  const currentEmpUser = (realIsAdmin && impersonatedEmp)
    ? impersonatedEmp
    : employees.find(e => 
        (e.uid && e.uid === currentUser?.uid) || 
        (e.id && e.id === currentUser?.uid) || 
        (e.email && e.email?.toLowerCase() === currentUser?.email?.toLowerCase()) ||
        (e.authEmail && e.authEmail?.toLowerCase() === currentUser?.email?.toLowerCase()) ||
        (e.username && currentUser?.email && currentUser.email.toLowerCase().startsWith(e.username.toLowerCase() + '@'))
      );

  const isCoordinator = !isAdmin && (currentEmpUser?.jobTitle === 'Coordinator' || currentEmpUser?.jobTitle === 'منسق للإدارة' || currentEmpUser?.role === 'coordinator');
  const isLeader = !isAdmin && (currentEmpUser?.jobTitle === 'Leader' || currentEmpUser?.jobTitle === 'ليدر' || currentEmpUser?.role === 'leader');
  const isAgent = !isAdmin && !isCoordinator && !isLeader;
  const myTeamMembers = employees.filter(e => e.leaderUid === currentUser?.uid);
  const canCreateGroup = isAdmin || hasPermission(currentEmpUser, 'canManageInternalGroups') || isCoordinator || isLeader;

  // Allowed members when creating or adding to a group based on role
  const getEligibleMembersForGroup = () => {
    if (isAdmin || isCoordinator) {
      return employees.filter(e => e.role !== 'admin' && !isAdminMember(e.uid) && e.uid !== currentUser?.uid);
    }
    if (isLeader) {
      return myTeamMembers.filter(e => !isAdminMember(e.uid));
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
  }, [currentUser?.uid, isAdmin]);

  // Realtime subscription to Internal Employee Groups
  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'internal_groups'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupsData = [];
      snapshot.forEach((docSnap) => {
        groupsData.push({
          id: docSnap.id,
          isGroup: true,
          ...docSnap.data()
        });
      });
      setRawInternalGroups(groupsData);
    }, (err) => {
      console.error("Error fetching internal groups:", err);
    });
    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Reactively filter internalGroups based on role, members, and impersonation (Airtight Strict Isolation)
  const internalGroups = React.useMemo(() => {
    const myUid = currentUser?.uid;
    const myEmail = currentUser?.email?.toLowerCase();
    const myEmpUid = currentEmpUser?.uid;
    const myEmpEmail = currentEmpUser?.email?.toLowerCase();
    const impersonatedUid = impersonatedEmp?.uid;
    const impersonatedEmail = impersonatedEmp?.email?.toLowerCase();

    return rawInternalGroups.filter(data => {
      // 1. Super Admin oversees all groups and conversations
      if (isAdmin) return true;

      // 2. Direct Colleague Chat: Strictly visible ONLY to the two participants (plus Admin)
      if (data.isDirect) {
        const membersList = Array.isArray(data.members) ? data.members : [];
        const emailsList = Array.isArray(data.memberEmails) ? data.memberEmails.map(e => String(e).toLowerCase()) : [];
        const isParticipant = 
          (myUid && membersList.includes(myUid)) ||
          (myEmpUid && membersList.includes(myEmpUid)) ||
          (impersonatedUid && membersList.includes(impersonatedUid)) ||
          (myEmail && (emailsList.includes(myEmail) || membersList.includes(myEmail))) ||
          (myEmpEmail && (emailsList.includes(myEmpEmail) || membersList.includes(myEmpEmail))) ||
          (impersonatedEmail && (emailsList.includes(impersonatedEmail) || membersList.includes(impersonatedEmail)));
        return Boolean(isParticipant);
      }

      // 3. Regular Groups: Coordinator sees group ONLY if explicitly listed in members or creator
      const membersList = Array.isArray(data.members) ? data.members : [];
      const emailsList = Array.isArray(data.memberEmails) ? data.memberEmails.map(e => String(e).toLowerCase()) : [];

      // Strict Membership Check for all employees (Coordinator, Leader, Agent)
      const isMember = 
        (myUid && (membersList.includes(myUid) || membersList.includes(myEmail))) || 
        (myEmpUid && (membersList.includes(myEmpUid) || membersList.includes(myEmpEmail))) ||
        (impersonatedUid && (membersList.includes(impersonatedUid) || membersList.includes(impersonatedEmail))) ||
        (myEmail && (membersList.includes(myEmail) || emailsList.includes(myEmail))) ||
        (myEmpEmail && (membersList.includes(myEmpEmail) || emailsList.includes(myEmpEmail))) ||
        (myUid && data.createdByUid && data.createdByUid === myUid) ||
        (myEmpUid && data.createdByUid && data.createdByUid === myEmpUid);

      return Boolean(isMember);
    });
  }, [rawInternalGroups, currentUser, currentEmpUser, impersonatedEmp, isAdmin]);

  useEffect(() => {
    if (location.state?.selectedGroupId && internalGroups.length > 0) {
      const foundGroup = internalGroups.find(g => g.id === location.state.selectedGroupId);
      if (foundGroup) {
        setActiveChat(foundGroup);
        setChatTabFilter('groups');
      }
    }
  }, [location.state, internalGroups]);

  // حساب إجمالي تنبيهات الواتساب غير المقروءة والجروبات للموظف الحالي
  const totalInboxUnread = React.useMemo(() => {
    const customerUnread = (chats || []).reduce((sum, c) => sum + (Number(c.unread) || 0), 0);
    const groupUnread = (internalGroups || []).filter(g => {
      if (!g.lastMessage) return false;
      const isMe = g.lastMessageSenderUid === currentUser?.uid || (isAdmin && (g.lastMessageSenderUid === 'admin' || g.lastMessageSenderUid === currentUser?.uid));
      if (isMe) return false;
      const isReadByMe = g.readBy?.includes(currentUser?.uid) || (isAdmin && g.readBy?.includes('admin'));
      return !isReadByMe;
    }).length;
    return customerUnread + groupUnread;
  }, [chats, internalGroups, currentUser, isAdmin]);

  // تحديث شارة التبويب (Favicon) وعنوان الصفحة تلقائياً لكافة الموظفين
  useEffect(() => {
    setGlobalNotificationAlert(totalInboxUnread, 'CRM WhatsApp Etegah');
  }, [totalInboxUnread]);

  // Global ESC Key Handler to close modals, image previews, emoji pickers, or active chats
  useEffect(() => {
    const handleGlobalEsc = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (attachment) setAttachment(null);
        else if (showEmojiPicker) setShowEmojiPicker(false);
        else if (isGroupInfoModalOpen) setIsGroupInfoModalOpen(false);
        else if (isCreateGroupModalOpen) setIsCreateGroupModalOpen(false);
        else if (isAddModalOpen) setIsAddModalOpen(false);
        else if (isExcelModalOpen) setIsExcelModalOpen(false);
        else if (isTemplateModalOpen) setIsTemplateModalOpen(false);
        else if (isForwardModalOpen) setIsForwardModalOpen(false);
        else if (isAnalyticsModalOpen) setIsAnalyticsModalOpen(false);
        else if (replyingToMessage) setReplyingToMessage(null);
        else if (activeChat && window.innerWidth < 768) closeActiveChat();
      }
    };
    window.addEventListener('keydown', handleGlobalEsc);
    return () => window.removeEventListener('keydown', handleGlobalEsc);
  }, [
    attachment,
    showEmojiPicker,
    isGroupInfoModalOpen,
    isCreateGroupModalOpen,
    isAddModalOpen,
    isExcelModalOpen,
    isTemplateModalOpen,
    isForwardModalOpen,
    isAnalyticsModalOpen,
    replyingToMessage,
    activeChat
  ]);

  // Anti-Screenshot, Window Blur, and Anti-Select / Anti-Copy Protection for Employees
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      document.body.classList.remove('no-select');
      return; // Admin has unrestricted access
    }

    document.body.classList.add('no-select');

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
      const isInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

      // Intercept PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        setIsWindowBlurred(true);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('');
        }
        setTimeout(() => setIsWindowBlurred(false), 2500);
      }

      // Block Ctrl+P (Print)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        toast.error('الطباعة غير مسموحة لحماية خصوصية بيانات العملاء 🔒', { id: 'no-print-toast' });
      }

      // Block Ctrl+S (Save page)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
      }

      // Block Ctrl+C (Copy), Ctrl+A (Select All), Ctrl+X (Cut), Ctrl+U (View Source) outside text inputs
      if (!isInput && (e.ctrlKey || e.metaKey)) {
        const k = e.key.toLowerCase();
        if (k === 'c' || k === 'x' || k === 'a' || k === 'u') {
          e.preventDefault();
          toast.error('نسخ وتحديد النصوص غير مسموح لحماية خصوصية بيانات العملاء 🔒', { id: 'no-copy-toast' });
        }
      }
    };

    const handleContextMenu = (e) => {
      const isInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
        return false;
      }
    };

    const handleCopy = (e) => {
      const isInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', '');
        }
        toast.error('نسخ وتحديد النصوص غير مسموح لحماية خصوصية بيانات العملاء 🔒', { id: 'no-copy-toast' });
      }
    };

    const handleDragStart = (e) => {
      const isInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      document.body.classList.remove('no-select');
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, [isAdmin]);

  // Bulletproof Saudi Phone Formatter for MicroSIP (Strictly 05XXXXXXXX)
  const formatPhoneNumberForMicroSip = (rawPhone) => {
    if (!rawPhone) return '';
    let digits = String(rawPhone).replace(/\D/g, '');
    if (digits.startsWith('00966')) {
      digits = digits.slice(5);
    } else if (digits.startsWith('966')) {
      digits = digits.slice(3);
    }
    if (digits.startsWith('05')) {
      // already starts with 05
    } else if (digits.startsWith('5')) {
      digits = '0' + digits;
    } else if (!digits.startsWith('0') && digits.length >= 8) {
      digits = '0' + digits;
    }
    return digits;
  };

  // Direct Click-to-Call via MicroSIP Handler with Firestore Logging
  const handleCallViaMicroSip = async (rawPhone, customer = {}) => {
    if (!rawPhone) {
      toast.error('رقم الهاتف غير متوفر للاتصال');
      return;
    }
    // Format strictly for MicroSIP: Local Saudi starting with 05 (remove + and 966 / 00966)
    const cleanPhone = formatPhoneNumberForMicroSip(rawPhone);

    if (!cleanPhone) {
      toast.error('رقم الهاتف غير صالح');
      return;
    }
    
    // Trigger MicroSIP / SIP URL
    window.location.href = `sip:${cleanPhone}`;
    toast.success(`جاري توجيه الاتصال بالرقم (${cleanPhone}) إلى MicroSIP 📞`, { id: 'microsip-call-toast', duration: 3000 });

    // Save Call Log in Firestore
    try {
      if (currentUser) {
        const callerName = isAdmin ? '👑 الإدارة' : (currentEmpUser?.username || currentEmpName || currentEmpUser?.name || currentUser.email?.split('@')[0] || 'موظف');
        const callerRole = isAdmin ? 'Admin' : (currentEmpUser?.jobTitle || currentEmpUser?.role || 'Agent');
        const docRef = null;
        if (false) await addDoc(collection(db, 'call_logs'), {
          phoneNumber: cleanPhone,
          customerId: customer?.id || activeChat?.id || '',
          customerName: customer?.name || activeChat?.name || 'عميل',
          customerSource: activeChat?.source || 'WhatsApp CRM',
          employeeUid: currentUser.uid,
          employeeEmail: currentUser.email || '',
          employeeName: callerName,
          employeeJobTitle: callerRole,
          leaderUid: currentEmpUser?.leaderUid || '',
          leaderName: currentEmpUser?.leaderName || '',
          calledAt: serverTimestamp(),
          calledDateStr: new Date().toISOString().split('T')[0],
          timestampMillis: Date.now(),
          source: 'MicroSIP WhatsApp',
          status: 'calling',
          durationSeconds: 0,
          durationFormatted: '00:00'
        });

        // Auto-finalize after 45 seconds if no response
        setTimeout(async () => {
          try {
            const snap = await getDoc(docRef);
            if (snap.exists() && snap.data()?.status === 'calling') {
              await updateDoc(docRef, {
                status: 'no_answer',
                durationFormatted: 'لم يرد 📵'
              });
            }
          } catch (e) {}
        }, 45000);
      }
    } catch (err) {
      console.error('Error logging call event in Inbox:', err);
    }
  };

  // Calculate accurate distinct group members count (1 Admin + distinct real employees)
  const getGroupMembersCount = (membersList) => {
    if (!Array.isArray(membersList) || membersList.length === 0) return 1;
    const validEmpUids = new Set();

    membersList.forEach(m => {
      if (!m || isAdminMember(m)) return;
      const emp = employees.find(e => e.uid === m || e.email?.toLowerCase() === String(m).toLowerCase());
      if (emp && !isAdminMember(emp.uid)) {
        validEmpUids.add(emp.uid);
      }
    });

    return 1 + validEmpUids.size;
  };

  const formatJobTitle = (title) => {
    if (!title) return 'Agent';
    const clean = title.toString().trim().toLowerCase();
    if (clean.includes('leader') || clean.includes('ليدر')) return 'Leader';
    if (clean.includes('coordinator') || clean.includes('منسق')) return 'Coordinator';
    if (clean.includes('customer') || clean.includes('خدمة العملاء') || clean.includes('عملاء')) return 'Customer Service';
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

  const getCustomerChatDisplayName = (senderEmail) => {
    if (!senderEmail) return 'الموظف';
    const cleanSender = senderEmail.toLowerCase().trim();
    if (adminEmails.includes(cleanSender)) return '👑 أدمن منصة اتجاه التحليل الذكي';

    const emp = employees.find(e => 
      e.email?.toLowerCase().trim() === cleanSender ||
      e.email?.split('@')[0]?.toLowerCase().trim() === cleanSender.split('@')[0]
    );

    if (emp) {
      const aliasName = emp.name || emp.nameEn || emp.englishName || emp.username || senderEmail.split('@')[0];
      const title = ` (${formatJobTitle(emp.jobTitle)})`;
      return `${aliasName}${title}`;
    }

    return senderEmail.split('@')[0];
  };

  
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
      const rawChats = [];
      const currentUnreadMap = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const chatId = doc.id;

        // Check if chat belongs to employee or admin
        const empUid = currentUser?.uid;
        const empEmail = currentUser?.email?.toLowerCase();
        const empName = currentEmpUser?.username || currentEmpUser?.name || currentUser?.displayName;
        const empUsername = currentEmpUser?.username;

        const isAssignedToThisEmp = 
          isAdmin || 
          (empUid && (data.assignedToUid === empUid || data.addedByUid === empUid)) || 
          (empEmail && (data.assignedTo?.toLowerCase() === empEmail || data.addedBy?.toLowerCase() === empEmail)) ||
          (empName && (data.assignedTo === empName || data.addedBy === empName)) ||
          (empUsername && (data.assignedTo === empUsername || data.addedBy === empUsername));

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

        rawChats.push({
          id: chatId,
          ...data
        });
      });

      // Smart Deduplication by phone number to eliminate duplicate chat items
      const phoneMap = new Map();
      rawChats.forEach(item => {
        const rawPhone = item.phoneNumber || item.phone || item.id;
        const cleanKey = rawPhone ? String(rawPhone).replace(/[^0-9]/g, '') : item.id;

        if (!phoneMap.has(cleanKey)) {
          phoneMap.set(cleanKey, item);
        } else {
          const existing = phoneMap.get(cleanKey);
          const timeExisting = existing.updatedAt?.toMillis ? existing.updatedAt.toMillis() : (existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0);
          const timeItem = item.updatedAt?.toMillis ? item.updatedAt.toMillis() : (item.updatedAt ? new Date(item.updatedAt).getTime() : 0);

          if (timeItem > timeExisting || (item.unread || 0) > (existing.unread || 0) || (item.lastMessage && existing.lastMessage === 'بدء المحادثة...')) {
            phoneMap.set(cleanKey, item);
          }
        }
      });

      const chatsData = Array.from(phoneMap.values());

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

      if (location.state?.selectedCustomerId) {
        const targetId = location.state.selectedCustomerId;
        const targetPhone = location.state.searchPhone ? normalizePhone(location.state.searchPhone) : normalizePhone(targetId);
        let foundChat = chatsData.find(c => c.id === targetId || (targetPhone && normalizePhone(c.phoneNumber || c.phone || c.id) === targetPhone));
        if (!foundChat) {
          foundChat = {
            id: targetId,
            name: location.state.customerName || 'عميل اتجاه',
            phone: targetPhone || targetId,
            phoneNumber: targetPhone || targetId,
            assignedTo: currentUser?.email || 'admin',
            assignedToUid: currentUser?.uid || 'admin',
            unread: 0
          };
        }
        if (foundChat && (!activeChat || activeChat.id !== foundChat.id)) {
          setActiveChat(foundChat);
        }
      }
    }, (error) => {
      console.error("Error fetching chats:", error);
    });

    return () => unsubscribe();
  }, [currentUser, isAdmin, isCoordinator, location.state]);

  // Instant selection and opening of transferred chat on navigation
  useEffect(() => {
    if (location.state?.selectedCustomerId) {
      const targetId = location.state.selectedCustomerId;
      const targetPhone = location.state.searchPhone ? normalizePhone(location.state.searchPhone) : normalizePhone(targetId);
      
      const foundInChats = chats.find(c => c.id === targetId || (targetPhone && normalizePhone(c.phoneNumber || c.phone || c.id) === targetPhone));
      
      const fallbackChat = foundInChats || {
        id: targetId,
        name: location.state.customerName || 'عميل اتجاه',
        phone: targetPhone || targetId,
        phoneNumber: targetPhone || targetId,
        assignedTo: currentUser?.email || 'admin',
        assignedToUid: currentUser?.uid || 'admin',
        unread: 0
      };

      if (!activeChat || activeChat.id !== fallbackChat.id) {
        setActiveChat(fallbackChat);
      }
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (_) {}
    } else if (location.state?.selectedGroupId) {
      const foundGroup = chats.find(c => c.id === location.state.selectedGroupId);
      if (foundGroup && (!activeChat || activeChat.id !== foundGroup.id)) {
        setActiveChat(foundGroup);
      }
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (_) {}
    }
  }, [location.state]);

  // Listen for real-time internal call ringing status for activeChat
  useEffect(() => {
    if (!activeChat) {
      setIsHeaderCallRinging(false);
      return;
    }

    const targetPhone = (activeChat.phoneNumber || activeChat.phone || activeChat.id || '').replace(/[^0-9]/g, '');
    const callDocId = targetPhone || activeChat.id;
    if (!callDocId) return;

    const callDocRef = doc(db, 'internal_calls', callDocId);
    const unsub = onSnapshot(callDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'ringing') {
          setIsHeaderCallRinging(true);
        } else {
          setIsHeaderCallRinging(false);
        }
      } else {
        setIsHeaderCallRinging(false);
      }
    }, (err) => console.error("Call status listener error:", err));

    return () => unsub();
  }, [activeChat?.id]);

  const [activeRingingCall, setActiveRingingCall] = useState(null);
  const audioCallRef = useRef(null);

  // Global listener for real-time customer internal call ringing status
  useEffect(() => {
    const qCalls = query(collection(db, 'internal_calls'), where('status', '==', 'ringing'));
    const unsubCalls = onSnapshot(qCalls, (snap) => {
      if (!snap.empty) {
        const docItem = snap.docs[0];
        const data = docItem.data();
        setActiveRingingCall({ id: docItem.id, ...data });

        // Play ringing sound
        try {
          if (!audioCallRef.current) {
            audioCallRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audioCallRef.current.loop = true;
          }
          audioCallRef.current.play().catch(() => {});
        } catch (e) {}

        // Note: Global ringing notification is handled by Dashboard.jsx to prevent duplicate alerts
      } else {
        setActiveRingingCall(null);
        if (audioCallRef.current) {
          audioCallRef.current.pause();
          audioCallRef.current.currentTime = 0;
        }
      }
    }, (err) => console.error("Global internal calls listener error:", err));

    return () => unsubCalls();
  }, []);

  // Listen for real-time Broadcast lists from Firestore
  useEffect(() => {
    const q = query(collection(db, 'broadcast_lists'));
    const unsub = onSnapshot(q, (snap) => {
      const lists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lists.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      setBroadcastLists(lists);
    }, (err) => console.error("Broadcast lists listener error:", err));

    return () => unsub();
  }, []);

  // حماية إضافية لحساب المنسق: إغلاق أي شات ليس جروب فوراً
  useEffect(() => {
    if (isCoordinator && activeChat && !activeChat.isGroup) {
      setActiveChat(null);
    }
  }, [isCoordinator, activeChat]);

  const markChatAsReadCrossDevice = async (chat) => {
    if (!chat || !currentUser?.uid) return;
    const myUid = currentUser.uid;
    const chatId = chat.id;
    const cleanPhone = (chat.phoneNumber || chat.cleanPhone || chat.phone || chat.id || '').replace(/[^0-9]/g, '');
    const normPhone = normalizePhone(cleanPhone);
    let localPhone = '';
    if (cleanPhone.startsWith('20') && cleanPhone.length === 12) {
      localPhone = '0' + cleanPhone.substring(2);
    } else if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      localPhone = cleanPhone;
    }

    try {
      if (chat.isGroup || chat.isDirect) {
        await updateDoc(doc(db, 'internal_groups', chatId), {
          readBy: arrayUnion(myUid, 'admin'),
          unread: 0,
          updatedAt: serverTimestamp()
        }).catch(() => {});
      } else {
        const updates = {
          unread: 0,
          unreadCount: 0,
          unreadCountStaff: 0,
          readBy: arrayUnion(myUid, 'admin'),
          updatedAt: serverTimestamp()
        };

        const targetDocIds = Array.from(new Set([
          chatId,
          cleanPhone,
          normPhone,
          localPhone,
          `chat_${cleanPhone}`,
          `chat_${normPhone}`
        ].filter(Boolean)));

        const collections = ['بيانات_تسجيل_العملاء', 'website_chats', 'customers', 'leadsCrm', 'visitor_customers'];

        const targets = [];
        collections.forEach(col => {
          targetDocIds.forEach(id => {
            targets.push(doc(db, col, id));
          });
        });

        await Promise.allSettled(targets.map(tRef => updateDoc(tRef, updates)));

        const cleanUserId = String(myUid).replace(/[^a-zA-Z0-9_-]/g, '_');
        const idsToDismiss = Array.from(new Set([
          chatId,
          cleanPhone,
          normPhone,
          localPhone,
          `chat_${cleanPhone}`,
          `chat_${normPhone}`
        ].filter(Boolean)));

        setDoc(doc(db, 'users_notif_state', cleanUserId), {
          dismissedNotifIds: arrayUnion(...idsToDismiss),
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});

        if (cleanPhone) {
          setDoc(doc(db, 'users_notif_state', `widget_${cleanPhone}`), {
            hasUnread: false,
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Error marking chat read cross-device:", e);
    }
  };

  // جلب الرسائل الخاصة بالمحادثة النشطة
  useEffect(() => {
    if (!activeChat) return;

    // Immediately mark active chat/group as read on open cross-device
    markChatAsReadCrossDevice(activeChat);

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

  const handleBulkDeleteMessages = async () => {
    if (!selectedMessageIds || selectedMessageIds.length === 0) return;
    const count = selectedMessageIds.length;
    if (!window.confirm(`هل أنت متأكد من حذف ${count} رسالة محددة نهائياً من عند الموظفين والعملاء؟`)) {
      return;
    }

    const deleteSet = new Set(selectedMessageIds);
    const deleteList = [...selectedMessageIds];

    // 1. INSTANT ZERO-LATENCY OPTIMISTIC UI REMOVAL (0ms)
    setMessages(prev => prev.filter(m => !deleteSet.has(m.id)));
    setSelectedMessageIds([]);
    setIsSelectMode(false);
    toast.success(`تم حذف ${count} رسالة بنجاح 🗑️`);

    // 2. Fast background Firestore batch delete
    try {
      const BATCH_SIZE = 400;
      for (let i = 0; i < deleteList.length; i += BATCH_SIZE) {
        const chunk = deleteList.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const mId of chunk) {
          batch.delete(doc(db, 'رسائل_الموظفين_للعملاء', mId));
        }
        await batch.commit().catch(() => {});
      }
    } catch (err) {
      console.error('Error during bulk message delete:', err);
    }
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
        assignedBy: '👑 الإدارة',
        assignedByRole: 'admin',
        assignedByUid: 'admin',
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

  // Bulk Customer Selection & Delete States for Inbox Sidebar (All Employees)
  const [isChatSelectMode, setIsChatSelectMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState([]);

  const toggleSelectChat = (chatId) => {
    setSelectedChatIds(prev => 
      prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]
    );
  };

  const toggleSelectAllChats = () => {
    const candidateIds = filteredChats.filter(c => !c.isGroup && !c.isDirect).map(c => c.id);
    if (selectedChatIds.length === candidateIds.length && candidateIds.length > 0) {
      setSelectedChatIds([]);
    } else {
      setSelectedChatIds(candidateIds);
    }
  };

  const handleSoftDeleteChat = async (targetChats) => {
    const chatList = Array.isArray(targetChats) ? targetChats : [targetChats];
    if (chatList.length === 0) return;

    const count = chatList.length;
    const confirmMsg = count === 1 
      ? `هل أنت متأكد من مسح شات العميل (${chatList[0].name || chatList[0].phoneNumber || 'هذا العميل'}) من الانبوكس؟\n(ملاحظة: سيتم الاحتفاظ بالعميل في كارت CRM والحملات كالمعتاد)`
      : `هل أنت متأكد من مسح شات ${count} عميل محدد من الانبوكس؟\n(ملاحظة: سيتم الاحتفاظ بالعملاء في كروت CRM والحملات كالمعتاد)`;

    if (!window.confirm(confirmMsg)) return;

    try {
      let empName = 'الموظف';
      if (isAdmin) {
        empName = '👑 الإدارة';
      } else if (isLeader) {
        const leaderName = currentEmpUser?.name || employees.find(e => e.email?.toLowerCase() === currentUser?.email?.toLowerCase() || e.uid === currentUser?.uid)?.name || currentUser?.displayName;
        empName = `⭐ ليدر: ${leaderName || 'قائد فريق'}`;
      } else {
        const name = currentEmpUser?.username || currentEmpUser?.name || employees.find(e => e.email?.toLowerCase() === currentUser?.email?.toLowerCase() || e.uid === currentUser?.uid)?.name || currentUser?.displayName;
        empName = `👤 ${name || currentUser?.email?.split('@')[0] || 'موظف'}`;
      }

      const empUid = currentUser?.uid || '';
      const empRole = isAdmin ? 'admin' : (isLeader ? 'leader' : 'agent');
      const batch = writeBatch(db);

      for (const chatItem of chatList) {
        const docId = chatItem.id;
        const rawPhone = chatItem.phoneNumber || chatItem.phone || docId;

        const trashRef = doc(collection(db, 'recycle_bin'));
        const trashObj = {
          id: trashRef.id,
          originalDocId: docId,
          type: isWebsiteLead(chatItem) ? 'visitor' : 'customer',
          originalCollection: 'بيانات_تسجيل_العملاء',
          name: chatItem.name || rawPhone || 'عميل محذوف',
          phone: rawPhone,
          phoneNumber: rawPhone,
          source: chatItem.source || (isWebsiteLead(chatItem) ? 'موقع الويب (OTP)' : 'عملاء الحملات'),
          deletedBy: empName,
          deletedByUid: empUid,
          deletedByRole: empRole,
          deletedAt: serverTimestamp(),
          deletedAtFormatted: new Date().toLocaleString('ar-EG'),
          data: chatItem
        };
        batch.set(trashRef, trashObj);

        // Delete ONLY from inbox collections (بيانات_تسجيل_العملاء & visitor_customers)
        // Keep customer card intact in leads_crm and employee_leads as requested!
        batch.delete(doc(db, 'بيانات_تسجيل_العملاء', docId));
        batch.delete(doc(db, 'visitor_customers', docId));

        if (activeChat?.id === docId) {
          setActiveChat(null);
        }
      }

      await batch.commit();

      const deletedIdsSet = new Set(chatList.map(c => c.id));
      setChats(prev => prev.filter(c => !deletedIdsSet.has(c.id)));
      setSelectedChatIds([]);

      toast.success(count === 1 ? 'تم مسح شات العميل ونقله لسلة المهملات لدى الإدارة 🗑️' : `تم مسح شات ${count} عميل ونقلهم لسلة المهملات لدى الإدارة 🗑️`);
    } catch (err) {
      console.error('Error soft-deleting chat:', err);
      toast.error('حدث خطأ أثناء مسح شات العميل: ' + err.message);
    }
  };

  // Admin-only: Permanently delete any internal group and all its messages
  const handleDeleteGroup = async (group) => {
    if (!isAdmin) {
      toast.error('صلاحية حذف الجروبات مخصصة للإدارة فقط 🔒');
      return;
    }
    const groupName = group?.name || 'هذا الجروب';
    if (!window.confirm(`هل أنت متأكد من حذف جروب (${groupName}) نهائياً؟\n\nسيتم مسح الجروب وكافة رسائله واختفاؤه من عند جميع الموظفين.`)) {
      return;
    }
    try {
      // 1. Delete group document from internal_groups
      await deleteDoc(doc(db, 'internal_groups', group.id));

      // 2. Delete all messages of this group from رسائل_الموظفين_للعملاء
      const msgsQuery = query(collection(db, 'رسائل_الموظفين_للعملاء'), where('conversationId', '==', group.id));
      const msgsSnap = await getDocs(msgsQuery);
      if (!msgsSnap.empty) {
        const batch = writeBatch(db);
        msgsSnap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // 3. Reset activeChat if current activeChat is this group
      if (activeChat?.id === group.id) {
        setActiveChat(null);
        setIsGroupInfoModalOpen(false);
      }

      toast.success(`تم حذف جروب (${groupName}) بنجاح من عند الجميع 🗑️`);
    } catch (err) {
      console.error('Error deleting group:', err);
      toast.error('حدث خطأ أثناء حذف الجروب: ' + err.message);
    }
  };

  const handleChatClick = async (chat) => {
    if (isCoordinator && !chat.isGroup) {
      toast.error('غير مصرح لحساب المنسق بالدخول لمحادثات العملاء 🔒');
      return;
    }
    setActiveChat(chat);
    markChatAsReadCrossDevice(chat);
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

      // Ensure Admin is always included uniquely (not duplicating Admin UID)
      const nonAdminUids = selectedGroupMemberUids.filter(uid => {
        const emp = employees.find(e => e.uid === uid);
        return emp && emp.role !== 'admin' && !adminEmails.includes(emp.email?.toLowerCase());
      });
      const finalMembers = Array.from(new Set(['admin', ...nonAdminUids, currentUser.uid]));

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

  // Start or Open 1-on-1 Direct Colleague Chat
  const handleStartDirectChat = async (targetEmp) => {
    if (!targetEmp) return;
    if (!isAdmin && !hasPermission(currentEmpUser, 'canChatColleagues')) {
      toast.error('صلاحية محادثة الزملاء غير مفعّلة لحسابك ⛔');
      return;
    }
    const myId = currentUser?.uid;
    const targetId = targetEmp.uid || targetEmp.id;
    if (myId === targetId || currentEmpUser?.uid === targetId) {
      toast.error('لا يمكنك بدء محادثة مع نفسك');
      return;
    }

    // Deterministic ID for 1-on-1 chat so both colleagues share the exact same room
    const sortedIds = [String(myId), String(targetId)].sort();
    const directChatId = `direct_${sortedIds[0]}_${sortedIds[1]}`;

    try {
      const myName = isAdmin ? '👑 الإدارة' : (currentEmpName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'موظف');
      const targetName = isAdminIdentifier(targetEmp.email) || targetEmp.role === 'admin' || targetId === 'admin' ? '👑 الإدارة' : (targetEmp.username || targetEmp.name || 'موظف');
      
      const chatRef = doc(db, 'internal_groups', directChatId);
      const chatSnap = await getDoc(chatRef);

      let chatData;
      if (!chatSnap.exists()) {
        chatData = {
          id: directChatId,
          isGroup: false,
          isDirect: true,
          members: [myId, targetId],
          memberEmails: [currentUser?.email?.toLowerCase(), (targetEmp.email || '').toLowerCase()].filter(Boolean),
          memberNames: {
            [myId]: myName,
            [targetId]: targetName
          },
          memberTitles: {
            [myId]: isAdmin ? 'Admin' : (currentEmpUser?.jobTitle || currentEmpUser?.role || 'Agent'),
            [targetId]: targetEmp.jobTitle || targetEmp.role || 'Agent'
          },
          name: targetName,
          createdByUid: myId,
          createdByName: myName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: '🎉 تم بدء المحادثة المباشرة',
          lastMessageSender: myName,
          readBy: [myId],
          unread: 0
        };
        await setDoc(chatRef, chatData);
      } else {
        chatData = { id: chatSnap.id, ...chatSnap.data(), isDirect: true };
      }

      setIsDirectModalOpen(false);
      setDirectSearchTerm('');
      setActiveChat(chatData);
      toast.success(`تم فتح المحادثة المباشرة مع ${targetName} 💬`);
    } catch (err) {
      console.error('Error starting direct chat:', err);
      toast.error('خطأ في بدء المحادثة: ' + err.message);
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
      const currentClean = (activeChat.members || []).filter(m => m !== 'admin');
      const updatedMembers = Array.from(new Set(['admin', ...currentClean, newMemberToAddUid]));
      await updateDoc(doc(db, 'internal_groups', activeChat.id), {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });

      const actorName = isAdmin ? '👑 الإدارة' : (currentEmpName || currentUser.email?.split('@')[0] || 'موظف');
      const addedName = empToAdd.username || empToAdd.name || empToAdd.email;

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
    const targetName = targetEmp ? (targetEmp.username || targetEmp.name) : 'الموظف';

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
      const fileToUpload = attachment;
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      try {
        const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const fileRef = ref(storage, `chat_media/${activeChat.id}_${uniqueId}_${fileToUpload.name}`);
        
        try {
          await uploadBytes(fileRef, fileToUpload);
          mediaUrl = await getDownloadURL(fileRef);
        } catch (storageErr) {
          console.warn("Firebase Storage upload failed, converting attachment to Base64 Data URL:", storageErr);
          mediaUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => resolve(evt.target.result);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(fileToUpload);
          });
        }
        
        fileType = fileToUpload.type || (fileToUpload.name?.endsWith('.png') ? 'image/png' : 'application/octet-stream');
        fileName = fileToUpload.name || 'file.png';
      } catch (err) {
        console.error("خطأ في معالجة المرفق:", err);
        toast.error(`خطأ المرفق: ${err.message || 'غير معروف'}`);
        setUploadingAttachment(false);
        return;
      } finally {
        setUploadingAttachment(false);
      }
    }

    // Internal Message Handling (Group or 1-on-1 Colleague Direct Chat)
    if (activeChat.isGroup || activeChat.isDirect) {
      // Security Check: Must be Admin or authorized member
      const myId = currentUser?.uid;
      const myEmpId = currentEmpUser?.uid;
      const myMail = currentUser?.email?.toLowerCase();
      const isAuthorizedMember = 
        isAdmin || 
        (myId && activeChat.members?.includes(myId)) || 
        (myEmpId && activeChat.members?.includes(myEmpId)) || 
        (myMail && (activeChat.members?.includes(myMail) || activeChat.memberEmails?.includes(myMail)));

      if (!isAuthorizedMember) {
        toast.error('غير مصرح لك بإرسال رسائل في هذه المحادثة (لست عضواً مسجلاً) 🔒');
        return;
      }

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
          isGroupMessage: Boolean(activeChat.isGroup),
          isDirectMessage: Boolean(activeChat.isDirect),
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
          lastMessageSenderUid: currentUser.uid,
          readBy: [currentUser.uid, ...(isAdmin ? ['admin'] : [])],
          unread: 0,
          updatedAt: serverTimestamp()
        });

        setReplyingToMessage(null);
      } catch (err) {
        console.error("خطأ في إرسال رسالة المحادثة الداخلية:", err);
        toast.error('خطأ في إرسال الرسالة: ' + err.message);
      }
      return;
    }

    try {
      const senderType = activeChat.assignedSender || (activeChat.source === 'website' ? 'website' : 'campaigns');
      let metaResultId = null;
      let isSimulated = false;

      try {
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
        if (response.ok && result.success) {
          metaResultId = result.metaMessageId || null;
          isSimulated = Boolean(result.simulated);
        }
      } catch (apiErr) {
        console.warn("API sendMessage fetch error (saving message to Firestore):", apiErr);
      }

      // Always save message to Firestore so it appears immediately in chat
      const msgData = {
        conversationId: activeChat.id,
        text: msgText,
        sender: 'agent',
        senderEmail: currentUser.email,
        senderType: senderType,
        timestamp: serverTimestamp(),
        metaMessageId: metaResultId,
        status: isSimulated ? 'sent' : 'delivered',
        replyTo: replyingToMessage || null
      };

      setReplyingToMessage(null);

      if (mediaUrl) {
        msgData.mediaUrl = mediaUrl;
        msgData.fileType = fileType;
        msgData.fileName = fileName;
      }

      await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), msgData);

      const chatRef = doc(db, 'بيانات_تسجيل_العملاء', activeChat.id);
      const updateData = {
        lastMessage: msgText || (fileName ? `📎 ${fileName}` : 'مرفق'),
        updatedAt: serverTimestamp(),
        unread: 0,
        unreadCount: 0,
        unreadCountStaff: 0,
        readBy: arrayUnion(currentUser.uid, 'admin')
      };

      if (isWebsiteLead(activeChat)) {
        updateData.isResponded = true;
        updateData.hasReplied = true;
        updateData.waitingStatus = 'responded';
        updateData.lastMessageFrom = 'emp';
        updateData.lastRepliedAt = serverTimestamp();
      }

      if (activeChat.status === 'unassigned') {
        updateData.status = 'assigned';
        updateData.assignedTo = currentUser.email;
        updateData.assignedToUid = currentUser.uid;
        updateData.assignedAt = serverTimestamp();
      }

      await updateDoc(chatRef, updateData).catch(() => {});

      const cleanPhone = (activeChat.phoneNumber || activeChat.cleanPhone || activeChat.phone || activeChat.id || '').replace(/[^0-9]/g, '');
      if (cleanPhone) {
        await updateDoc(doc(db, 'website_chats', `chat_${cleanPhone}`), updateData).catch(() => {});
        await updateDoc(doc(db, 'website_chats', cleanPhone), updateData).catch(() => {});
        await updateDoc(doc(db, 'customers', cleanPhone), updateData).catch(() => {});
      }
      if (activeChat.id) {
        await updateDoc(doc(db, 'website_chats', activeChat.id), updateData).catch(() => {});
        await updateDoc(doc(db, 'customers', activeChat.id), updateData).catch(() => {});
      }

      markChatAsReadCrossDevice(activeChat);

      // Sync local states immediately (0ms) so waiting list lead automatically leaves the waiting list
      setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, ...updateData, isResponded: true, hasReplied: true, waitingStatus: 'responded', lastMessageFrom: 'emp' } : c));
      setActiveChat(prev => (prev && prev.id === activeChat.id ? { ...prev, ...updateData, isResponded: true, hasReplied: true, waitingStatus: 'responded', lastMessageFrom: 'emp' } : prev));
    } catch (err) {
      console.error("خطأ في إرسال الرسالة للعميل:", err);
      toast.error('خطأ في الإرسال: ' + err.message);
    }
  };

  // Toggle trigger or cancel internal call alert from top header across ALL chat types (Customers, Direct Colleague, Groups)
  const handleTriggerInternalCallFromHeader = async () => {
    if (!activeChat) return;

    const targetPhone = (activeChat.phoneNumber || activeChat.phone || activeChat.id || '').replace(/[^0-9]/g, '');
    const callDocId = targetPhone || activeChat.id;
    const callDocRef = doc(db, 'internal_calls', callDocId);

    const callerName = isAdmin 
      ? '👑 الإدارة' 
      : (currentEmpName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'موظف');

    if (isHeaderCallRinging) {
      // End / Cancel active internal call alert
      try {
        await setDoc(callDocRef, {
          status: 'cancelled',
          cancelledBy: callerName,
          cancelledByUid: currentUser?.uid,
          updatedAt: serverTimestamp()
        }, { merge: true });

        setIsHeaderCallRinging(false);

        await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
          conversationId: activeChat.id,
          phoneNumber: activeChat.phoneNumber || activeChat.phone || activeChat.id,
          sender: 'system',
          senderName: callerName,
          text: `🛑 تم إنهاء اتصال التنبيه الداخلي بواسطة (${callerName})`,
          timestamp: serverTimestamp(),
          isGroupMessage: Boolean(activeChat.isGroup),
          isDirectMessage: Boolean(activeChat.isDirect)
        });

        toast.success(`تم إنهاء اتصال التنبيه الداخلي 🛑`);
      } catch (err) {
        console.error("Error cancelling call:", err);
        toast.error('خطأ في إنهاء التنبيه: ' + (err.message || 'حاول مرة أخرى'));
      }
      return;
    }

    // Otherwise, start/trigger internal call alert
    try {
      const chatName = activeChat.name || activeChat.cardName || activeChat.title || 'المحادثة';

      await setDoc(callDocRef, {
        id: callDocId,
        userPhone: activeChat.phoneNumber || activeChat.phone || activeChat.id,
        cleanPhone: callDocId,
        clientName: chatName,
        callerType: 'staff',
        callerName: callerName,
        callerUid: currentUser?.uid,
        status: 'ringing',
        chatId: activeChat.id,
        isGroupCall: Boolean(activeChat.isGroup),
        isDirectCall: Boolean(activeChat.isDirect),
        updatedAt: serverTimestamp()
      }, { merge: true });

      setIsHeaderCallRinging(true);

      // Add alert message into the active conversation history
      await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
        conversationId: activeChat.id,
        phoneNumber: activeChat.phoneNumber || activeChat.phone || activeChat.id,
        sender: 'system',
        senderName: callerName,
        text: `📞 اتصال تنبيه داخلي جاري بالرسائل من (${callerName})...`,
        timestamp: serverTimestamp(),
        isGroupMessage: Boolean(activeChat.isGroup),
        isDirectMessage: Boolean(activeChat.isDirect)
      });

      toast.success(`تم إرسال اتصال تنبيه داخلي بالرسائل بنجاح 📞🔔 (اضغط مجدداً لإنهاء التنبيه)`);

      // Auto cancel after 30 seconds if still ringing
      setTimeout(async () => {
        try {
          const snap = await getDoc(callDocRef);
          if (snap.exists() && snap.data().status === 'ringing') {
            await setDoc(callDocRef, { status: 'cancelled' }, { merge: true });
          }
        } catch (e) {}
      }, 30000);

    } catch (err) {
      console.error("Error triggering internal call:", err);
      toast.error('خطأ في إرسال اتصال التنبيه: ' + (err.message || 'حاول مرة أخرى'));
    }
  };

  // Create Broadcast List
  const handleCreateBroadcastList = async (e) => {
    e.preventDefault();
    if (!newBroadcastName.trim()) {
      toast.error('يرجى كتابة اسم قائمة الـ Broadcast');
      return;
    }
    if (broadcastSelectedCustomerIds.length === 0) {
      toast.error('يرجى اختيار عميل واحد على الأقل لإضافته للقائمة');
      return;
    }

    try {
      const selectedCustomerObjects = chats
        .filter(c => !c.isGroup && !c.isDirect && broadcastSelectedCustomerIds.includes(c.id))
        .map(c => ({
          id: c.id,
          name: c.name || c.cardName || 'عميل اتجاه',
          phone: c.phoneNumber || c.phone || c.id,
          phoneNumber: c.phoneNumber || c.phone || c.id,
          source: c.source || (isWebsiteLead(c) ? 'website' : 'excel_import')
        }));

      const creatorName = isAdmin ? '👑 الإدارة' : (currentEmpName || currentUser?.email?.split('@')[0] || 'موظف');

      const newDocRef = await addDoc(collection(db, 'broadcast_lists'), {
        name: newBroadcastName.trim(),
        createdBy: currentUser?.email || 'admin',
        createdByName: creatorName,
        createdByUid: currentUser?.uid || 'admin',
        members: selectedCustomerObjects,
        memberCount: selectedCustomerObjects.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success(`تم إنشاء قائمة الـ Broadcast (${newBroadcastName.trim()}) بنجاح 🎉`);
      setNewBroadcastName('');
      setBroadcastSelectedCustomerIds([]);
      setSelectedBroadcastId(newDocRef.id);
      setBroadcastTab('lists');
    } catch (err) {
      console.error("Error creating broadcast list:", err);
      toast.error('خطأ في إنشاء القائمة: ' + (err.message || 'حاول مرة أخرى'));
    }
  };

  // Delete Broadcast List
  const handleDeleteBroadcastList = async (listId, listName) => {
    if (!isAdmin) {
      toast.error('حذف القوائم متاح للإدارة فقط 🔒');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من حذف قائمة الـ Broadcast (${listName || 'المحددة'}) نهائياً؟`)) return;

    try {
      await deleteDoc(doc(db, 'broadcast_lists', listId));
      if (selectedBroadcastId === listId) setSelectedBroadcastId('');
      toast.success('تم حذف قائمة الـ Broadcast بنجاح');
    } catch (err) {
      console.error("Error deleting broadcast list:", err);
      toast.error('خطأ في حذف القائمة');
    }
  };

  // Remove Member from Broadcast List
  const handleRemoveMemberFromBroadcast = async (listId, memberId, memberName) => {
    const list = broadcastLists.find(l => l.id === listId);
    if (!list) return;

    try {
      const updatedMembers = (list.members || []).filter(m => m.id !== memberId);
      await updateDoc(doc(db, 'broadcast_lists', listId), {
        members: updatedMembers,
        memberCount: updatedMembers.length,
        updatedAt: serverTimestamp()
      });
      toast.success(`تم حذف العميل (${memberName || 'المحدد'}) من القائمة`);
    } catch (err) {
      console.error("Error removing broadcast member:", err);
      toast.error('خطأ في حذف العميل من القائمة');
    }
  };

  // Send Broadcast Message individually to all list members
  const handleSendBroadcastMessage = async (e) => {
    e.preventDefault();
    if (!selectedBroadcastId) {
      toast.error('يرجى تحديد قائمة Broadcast أولاً');
      return;
    }
    const targetList = broadcastLists.find(l => l.id === selectedBroadcastId);
    if (!targetList || !targetList.members || targetList.members.length === 0) {
      toast.error('القائمة المحددة لا تحتوي على أي عملاء لإرسال الرسائل لهم');
      return;
    }
    if (!broadcastMessageText.trim() && !broadcastAttachment) {
      toast.error('يرجى كتابة نص الرسالة أو إرفاق ملف قبل الإرسال');
      return;
    }

    const membersToReceive = targetList.members;
    const msgContent = broadcastMessageText.trim();

    setIsSendingBroadcast(true);
    setBroadcastProgress({ current: 0, total: membersToReceive.length, currentName: membersToReceive[0]?.name || '' });

    let mediaUrl = null;
    let fileType = null;
    let fileName = null;

    if (broadcastAttachment) {
      try {
        const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const fileRef = ref(storage, `chat_media/broadcast_${selectedBroadcastId}_${uniqueId}_${broadcastAttachment.name}`);
        await uploadBytes(fileRef, broadcastAttachment);
        mediaUrl = await getDownloadURL(fileRef);
        fileType = broadcastAttachment.type;
        fileName = broadcastAttachment.name;
        setBroadcastAttachment(null);
      } catch (err) {
        console.error("Broadcast attachment upload error:", err);
        toast.error('خطأ في رفع مرفق البرودكاست: ' + err.message);
        setIsSendingBroadcast(false);
        return;
      }
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < membersToReceive.length; i++) {
      const member = membersToReceive[i];
      setBroadcastProgress({
        current: i + 1,
        total: membersToReceive.length,
        currentName: member.name || member.phoneNumber || `عميل ${i + 1}`
      });

      try {
        const phone = (member.phoneNumber || member.phone || member.id || '').replace(/[^0-9]/g, '');
        const senderType = member.source === 'website' ? 'website' : 'campaigns';

        // 1. Call API to send WhatsApp message individually
        const response = await fetch('/api/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: phone,
            text: msgContent,
            mediaUrl: mediaUrl,
            fileType: fileType,
            fileName: fileName,
            senderType: senderType
          })
        });

        const resData = await response.json();

        // 2. Save individual 1-on-1 message in Firestore chat history for this customer
        const msgData = {
          conversationId: member.id,
          phoneNumber: phone,
          text: msgContent,
          mediaUrl: mediaUrl,
          fileType: fileType,
          fileName: fileName,
          sender: currentUser?.uid || 'admin',
          senderEmail: currentUser?.email || 'admin',
          senderName: isAdmin ? '👑 الإدارة' : (currentEmpName || 'الموظف'),
          timestamp: serverTimestamp(),
          status: response.ok && resData.success ? 'sent' : 'pending',
          metaMessageId: resData.metaMessageId || null,
          isBroadcastSent: true,
          broadcastListName: targetList.name
        };

        await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), msgData);

        // 3. Update customer doc lastMessage so it appears in normal conversation list
        const customerRef = doc(db, 'بيانات_تسجيل_العملاء', member.id);
        await updateDoc(customerRef, {
          lastMessage: msgContent || (fileName ? `📎 ${fileName}` : 'مرفق'),
          updatedAt: serverTimestamp(),
          unread: 0
        }).catch(() => {});

        successCount++;
      } catch (err) {
        console.error(`Error sending broadcast to ${member.name}:`, err);
        failCount++;
      }

      // Small delay between calls for API stability
      await new Promise(res => setTimeout(res, 400));
    }

    setIsSendingBroadcast(false);
    setBroadcastMessageText('');
    toast.success(`تم الانتهاء من إرسال البرودكاست بنجاح! 🚀 (تم إرسال ${successCount} من أصل ${membersToReceive.length})`);
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
        const getRowVal = (keys) => {
          const rowKeys = Object.keys(row);
          for (const k of keys) {
            if (row[k] !== undefined && String(row[k]).trim() !== '') return String(row[k]).trim();
            const found = rowKeys.find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase());
            if (found && row[found] !== undefined && String(row[found]).trim() !== '') return String(row[found]).trim();
          }
          return '';
        };
        let phone = getRowVal(['phone', 'Phone', 'mobile', 'Mobile', 'Primary Phone', 'Mobile Phone', 'Phone Number', 'Mobile Number', 'Tel', 'Contact', 'رقم الهاتف', 'الهاتف', 'الرقم', 'الجوال', 'رقم الجوال']);
        let name = getRowVal(['name', 'Name', 'Full Name', 'full_name', 'Customer Name', 'customer_name', 'Client Name', 'client_name', 'First Name', 'الاسم', 'اسم العميل', 'الاسم بالكامل']) || 'عميل';

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

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          const file = new File([blob], `screenshot_${Date.now()}.png`, { type: blob.type || 'image/png' });
          setAttachment(file);
          toast.success('تم إرفاق الصورة المنسوخة من الحافظة 📋');
          e.preventDefault();
          break;
        }
      }
    }
  }, []);

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
          const empName = empUser?.username || empUser?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'موظف';
          
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

    // Filter out website leads that haven't actually sent a message
    if (isWebsiteLead(chat) && !hasCustomerSentMessage(chat)) return false;

    // Tab filter
    if (chatTabFilter === 'direct' && (chat.isGroup || chat.isDirect || isWebsiteLead(chat))) return false;
    if (chatTabFilter === 'website' && (!isWebsiteLead(chat) || chat.isGroup || chat.isDirect)) return false;
    if (chatTabFilter === 'groups' && (!chat.isGroup || chat.isDirect)) return false;
    if (chatTabFilter === 'colleagues' && !chat.isDirect) return false;

    if (chat.isGroup || chat.isDirect) {
      if (sidebarSearch.trim()) {
        const term = sidebarSearch.toLowerCase();
        const otherUid = (chat.members || []).find(m => m !== currentUser?.uid && m !== currentEmpUser?.uid);
        const otherEmp = employees.find(e => e.uid === otherUid);
        const otherName = otherEmp?.name || otherEmp?.username || chat.memberNames?.[otherUid] || '';
        const matchName = chat.name?.toLowerCase().includes(term) || otherName.toLowerCase().includes(term);
        const matchCreator = chat.createdByName?.toLowerCase().includes(term);
        if (!matchName && !matchCreator) return false;
      }
      return true;
    }

    let matchEmployee = true;
    if (isAdmin) {
      if (selectedEmployee === 'hide') matchEmployee = false;
      else if (selectedEmployee === 'unassigned') matchEmployee = chat.status === 'unassigned' || isWaitingListLead(chat);
      else if (selectedEmployee && selectedEmployee !== 'all') matchEmployee = chat.assignedToUid === selectedEmployee;
    } else {
      if (selectedEmployee === 'unassigned') {
        matchEmployee = chat.status === 'unassigned' || isWaitingListLead(chat);
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
    if (isAdmin) {
      setUserProfile({
        name: 'etegah-analysis',
        username: 'الإدارة',
        email: realCurrentUser?.email || 'etegahanalysis@gmail.com',
        role: 'admin',
        jobTitle: 'Admin'
      });
      return;
    }
    const targetUid = impersonatedEmp?.uid || currentUser.uid;
    const unsub = onSnapshot(doc(db, 'users', targetUid), (snap) => {
      if (snap.exists()) {
        setUserProfile(snap.data());
      } else {
        setUserProfile(impersonatedEmp || null);
      }
    });
    return () => unsub();
  }, [currentUser, isAdmin, impersonatedEmp, realCurrentUser]);

  let lastDateMsg = null;

  return (
    <div className="flex flex-col fixed inset-0 w-full font-sans overflow-hidden bg-slate-900" dir="rtl" onClick={() => setShowOnlyUnreplied(false)}>
      {/* Floating Ringing Call Banner / Modal for Staff (Image 1) */}
      {activeRingingCall && activeRingingCall.status === 'ringing' && (
        <div className="fixed top-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[9999] bg-gradient-to-r from-slate-900/95 via-indigo-950/95 to-slate-900/95 backdrop-blur-2xl border-2 border-cyan-400 text-white p-4.5 rounded-3xl shadow-[0_20px_60px_rgba(6,182,212,0.6)] animate-bounce font-sans border-t-2 border-t-cyan-300" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 animate-ping shrink-0">
              <PhoneCall size={24} />
            </div>
            <div className="flex-1">
              <h4 className="font-extrabold text-xs sm:text-sm text-cyan-300">
                📞 اتصال داخلي جاري من {activeRingingCall.clientName || 'العميل'}!
              </h4>
              <p className="text-[11px] text-gray-200 mt-0.5">ويرغب في تنبيهك والتواصل الفوري معك في الشات.</p>
            </div>
          </div>
          <div className="mt-3.5 flex gap-2">
            <button
              onClick={async () => {
                if (audioCallRef.current) {
                  audioCallRef.current.pause();
                  audioCallRef.current.currentTime = 0;
                }
                try {
                  await setDoc(doc(db, 'internal_calls', activeRingingCall.id), { status: 'answered' }, { merge: true });
                } catch (e) {}
                const targetPhone = (activeRingingCall.userPhone || activeRingingCall.cleanPhone || activeRingingCall.id || '').replace(/[^0-9]/g, '');
                const targetChat = chats.find(c => (c.phoneNumber || c.phone || c.id || '').replace(/[^0-9]/g, '').includes(targetPhone));
                if (targetChat) {
                  setActiveChat(targetChat);
                }
                setActiveRingingCall(null);
              }}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold py-2 px-3 rounded-xl text-xs shadow-md cursor-pointer transition active:scale-95 text-center font-bold"
            >
              فتح المحادثة والرد 💬
            </button>
            <button
              onClick={async () => {
                if (audioCallRef.current) {
                  audioCallRef.current.pause();
                  audioCallRef.current.currentTime = 0;
                }
                try {
                  await setDoc(doc(db, 'internal_calls', activeRingingCall.id), { status: 'cancelled' }, { merge: true });
                } catch (e) {}
                setActiveRingingCall(null);
              }}
              className="bg-rose-950/80 hover:bg-rose-900/90 border border-rose-500/40 text-rose-300 font-bold py-2 px-3 rounded-xl text-xs cursor-pointer transition"
            >
              إلغاء / كنسل
            </button>
          </div>
        </div>
      )}
      {/* Floating Impersonation Banner for WhatsApp */}
      {impersonatedEmp && (
        <div className="shrink-0 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-300 z-50">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">👁️</span>
            <div className="text-xs sm:text-sm font-black flex items-center gap-1.5 flex-wrap">
              <span>أنت تتصفح الواتساب حالياً كـ:</span>
              <span className="bg-amber-950/80 px-3 py-0.5 rounded-lg border border-amber-300 text-amber-200 font-bold">
                {impersonatedEmp.username || impersonatedEmp.name}
              </span>
              <span className="text-amber-200 text-xs font-semibold">
                ({impersonatedEmp.jobTitle || impersonatedEmp.role || 'موظف'})
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('impersonatedEmp');
              setImpersonatedEmp(null);
              setSelectedEmployee('hide');
              setActiveChat(null);
              setUserProfile({
                name: 'etegah-analysis',
                username: 'الإدارة',
                email: realCurrentUser?.email || 'etegahanalysis@gmail.com',
                role: 'admin',
                jobTitle: 'Admin'
              });
              try {
                window.history.replaceState({}, document.title, window.location.pathname);
              } catch(e) {}
              toast.success('تم إنهاء المعاينة والرجوع لواتساب الأدمن بنجاح 👑');
            }}
            className="bg-white text-rose-700 hover:bg-rose-50 px-3.5 py-1.5 rounded-xl font-black text-xs transition shadow-md flex items-center gap-1 cursor-pointer active:scale-95 border border-rose-300"
          >
            <span>🔴 إنهاء المعاينة والرجوع لواتساب الأدمن</span>
          </button>
        </div>
      )}
      <div className="flex flex-1 w-full overflow-hidden relative">
      {/* Anti-Screenshot & Window Blur Frosted Shield + Security Watermark on Blur / Screenshot */}
      {!isAdmin && currentUser && (() => {
        const currentEmp = employees.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
        const empName = currentEmp?.username || currentEmp?.name || currentUser?.email?.split('@')[0] || 'Employee';
        const empJob = currentEmp?.jobTitle || (currentEmp?.role === 'coordinator' ? 'Coordinator' : 'Agent');
        const empEmail = currentUser?.email || '';
        const empCode = currentEmp?.empCode ? `#${currentEmp.empCode}` : '';
        
        const svgContent = `<svg xmlns='http://www.w3.org/2000/svg' width='440' height='260' opacity='0.35'>
          <g transform='rotate(-22 220 130)' text-anchor='middle' font-family='Cairo, sans-serif' font-weight='900'>
            <text x='220' y='105' font-size='16' fill='%236366f1'>👤 ${empName} (${empJob}) ${empCode}</text>
            <text x='220' y='130' font-size='13' fill='%239333ea'>✉️ ${empEmail}</text>
            <text x='220' y='155' font-size='11' fill='%23ffffff'>🔒 سرّي ومحمي • منصة اتجاه CRM</text>
          </g>
        </svg>`;
        const bgUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(svgContent.replace(/\n\s+/g, ''))}")`;

        if (isWindowBlurred) {
          return (
            <div 
              onClick={() => setIsWindowBlurred(false)}
              className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-3xl flex flex-col items-center justify-center text-white p-6 select-none transition-all cursor-pointer overflow-hidden"
              style={{
                backgroundImage: bgUrl,
                backgroundRepeat: 'repeat',
              }}
            >
              <div className="bg-gray-900/95 border-2 border-purple-500/60 rounded-3xl p-8 max-w-md text-center shadow-[0_15px_40px_rgba(0,0,0,0.8)] relative z-10">
                <div className="w-16 h-16 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
                  🛡️
                </div>
                <h3 className="text-xl font-black text-white mb-2">شاشة محادثات محمية</h3>
                <p className="text-xs text-purple-200/90 mb-4 font-bold leading-relaxed">
                  تم تعتيم وحجب شاشة المحادثات وتوثيق هويتك تلقائياً لحماية خصوصية بيانات العملاء أثناء استخدام أدوات التقاط الشاشة.
                </p>
                <div className="bg-slate-950/80 border border-purple-400/40 rounded-xl p-3 mb-5 text-right space-y-1">
                  <div className="text-xs text-cyan-300 font-bold">👤 الموظف: <span className="text-white font-extrabold">{empName} ({empJob})</span></div>
                  <div className="text-xs text-purple-300 font-mono" dir="ltr">✉️ {empEmail}</div>
                </div>
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs px-5 py-2.5 rounded-xl font-black shadow-lg">
                  <span>انقر للمتابعة والرجوع للعمل ↵</span>
                </div>
              </div>
            </div>
          );
        }

        // Return hidden printable watermark for print / PDF export
        return (
          <div 
            className="hidden print:block fixed inset-0 pointer-events-none z-50 select-none overflow-hidden"
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
        <div className="bg-black/40 backdrop-blur-md px-2.5 py-2 border-b border-white/10 flex justify-between items-center shadow-sm gap-1.5">
          <div className="flex items-center space-x-1.5 space-x-reverse min-w-0 flex-1">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-purple-500 rounded-full blur-[3px] opacity-85 group-hover:opacity-100 transition duration-300"></div>
              <img 
                src="/logo.jpg" 
                alt="Etegah Logo" 
                className="relative w-8 h-8 rounded-full object-cover border border-cyan-300 shadow-[0_2px_8px_rgba(6,182,212,0.5)] shrink-0" 
              />
              {totalInboxUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white animate-bounce shadow-md z-10">
                  {totalInboxUnread > 99 ? '99+' : totalInboxUnread}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-black text-white text-[11px] truncate max-w-[100px] sm:max-w-[130px]" dir="ltr">
                  {impersonatedEmp ? (impersonatedEmp.username || impersonatedEmp.name) : (userProfile?.username || userProfile?.name || currentEmpUser?.username || currentEmpUser?.name || (isAdmin ? 'etegah-analysis' : currentUser?.email?.split('@')[0]))}
                </span>
                {impersonatedEmp ? (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs shrink-0 bg-blue-600/40 text-blue-200 border border-blue-400/40">
                    {impersonatedEmp.jobTitle === 'Leader' || impersonatedEmp.jobTitle === 'ليدر' ? '👑 Leader' : (impersonatedEmp.jobTitle === 'Coordinator' ? '📋 Coordinator' : (impersonatedEmp.jobTitle === 'Customer Service' || impersonatedEmp.jobTitle === 'خدمة العملاء' || String(impersonatedEmp.jobTitle).toLowerCase().includes('customer') ? '🎧 Customer Service' : (impersonatedEmp.jobTitle || impersonatedEmp.role || '👤 Agent')))}
                  </span>
                ) : isAdmin ? (
                  <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs shrink-0 flex items-center gap-0.5">
                    👑 Admin
                  </span>
                ) : (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs shrink-0 bg-blue-600/40 text-blue-200 border border-blue-400/40">
                    {userProfile?.jobTitle === 'Leader' || userProfile?.jobTitle === 'ليدر' ? '👑 Leader' : (userProfile?.jobTitle === 'Coordinator' ? '📋 Coordinator' : (userProfile?.jobTitle === 'Customer Service' || userProfile?.jobTitle === 'خدمة العملاء' || String(userProfile?.jobTitle).toLowerCase().includes('customer') ? '🎧 Customer Service' : (userProfile?.jobTitle || userProfile?.role || 'Agent')))}
                  </span>
                )}
                {/* Logout Button */}
                <button 
                  onClick={handleLogout} 
                  className="flex items-center gap-0.5 text-gray-300 hover:text-red-400 transition text-[10px] font-bold bg-white/10 hover:bg-white/20 px-1.5 py-0.2 rounded-md border border-white/10 shrink-0 cursor-pointer" 
                  title="Logout"
                >
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_3px_#22c55e]"></div>
                  <span className="font-bold">Logout</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 space-x-reverse shrink-0">
            {/* بدء محادثة مباشرة مع زميل (1-on-1) - متاح للجميع */}
            <button 
              type="button"
              onClick={() => {
                setDirectSearchTerm('');
                setIsDirectModalOpen(true);
              }}
              className="flex items-center justify-center p-1.5 rounded-full bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white shadow-[0_2px_8px_rgba(6,182,212,0.4)] border border-cyan-300/50 hover:from-cyan-500 hover:to-indigo-500 transition-all transform hover:scale-105 active:scale-95 shrink-0 cursor-pointer" 
              title="بدء محادثة مباشرة مع زميل عمل (1-on-1)"
            >
              <MessageSquarePlus size={13} />
            </button>

            {canCreateGroup && (
              <button 
                onClick={() => setIsCreateGroupModalOpen(true)} 
                className="flex items-center justify-center p-1.5 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white shadow-[0_2px_8px_rgba(168,85,247,0.4)] border border-purple-300/50 hover:from-purple-500 hover:to-pink-400 transition-all transform hover:scale-105 active:scale-95 shrink-0 cursor-pointer" 
                title="إنشاء جروب واتساب للموظفين"
              >
                <Users size={13} />
              </button>
            )}
            {!isCoordinator && (
              <>
                <button 
                  onClick={() => setIsAddModalOpen(true)} 
                  className="flex items-center justify-center p-1.5 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 text-white shadow-[0_2px_8px_rgba(16,185,129,0.4)] border border-emerald-300/50 hover:from-emerald-500 hover:to-cyan-300 transition-all transform hover:scale-105 active:scale-95 shrink-0 cursor-pointer" 
                  title="إضافة عميل جديد يدوياً"
                >
                  <UserPlus size={13} />
                </button>
                <button 
                  onClick={() => setIsExcelModalOpen(true)} 
                  className="flex items-center justify-center p-1.5 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 text-white shadow-[0_2px_8px_rgba(99,102,241,0.4)] border border-blue-300/50 hover:from-blue-500 hover:to-purple-400 transition-all transform hover:scale-105 active:scale-95 shrink-0 cursor-pointer" 
                  title="استيراد من إكسيل (الحملات)"
                >
                  <FileText size={13} />
                </button>
              </>
            )}
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (impersonatedEmp) {
                  sessionStorage.setItem('impersonatedEmp', JSON.stringify(impersonatedEmp));
                }
                navigate('/dashboard', { state: { impersonatedEmp, targetTab: 'leads_crm' } });
              }} 
              className="flex items-center gap-1 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-[11px] px-2.5 py-1 rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.5)] border border-yellow-200 hover:from-amber-300 hover:to-amber-400 transition-all transform hover:scale-105 active:scale-95 shrink-0 cursor-pointer relative z-30" 
              title="الانتقال الفوري إلى لوحة التحكم Leads CRM"
            >
              <BarChart3 size={13} className="text-slate-950" />
              <span className="font-black text-[11px]">Leads CRM 🎯</span>
              {totalInboxUnread > 0 && (
                <span className="min-w-4 h-4 px-1 bg-red-600 text-white rounded-full text-[9px] font-black flex items-center justify-center border border-white shadow-xs animate-pulse">
                  {totalInboxUnread > 99 ? '99+' : totalInboxUnread}
                </span>
              )}
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
          <div className="bg-slate-950/90 p-2 border-b border-white/10 relative z-10 w-full space-y-1.5">
            {/* Row 1: External Customer Tabs (الكل / الحملات / الموقع) */}
            <div className="grid grid-cols-3 gap-1.5 w-full">
              <button 
                onClick={() => setChatTabFilter('all')}
                className={`py-1.5 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 min-w-0 w-full text-center ${chatTabFilter === 'all' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md ring-1 ring-blue-400/50' : 'bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10'}`}
                title="جميع المحادثات"
              >
                <span>💬 الكل</span>
                <span className="bg-black/40 text-white px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono">({chats.filter(c => !c.isGroup && !c.isDirect && (!isWebsiteLead(c) || hasCustomerSentMessage(c))).length})</span>
              </button>
              <button 
                onClick={() => setChatTabFilter('direct')}
                className={`py-1.5 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 min-w-0 w-full text-center ${chatTabFilter === 'direct' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md ring-1 ring-emerald-400/50' : 'bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10'}`}
                title="عملاء الحملات التسويقية"
              >
                <span>👤 الحملات</span>
                <span className="bg-black/40 text-white px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono">({chats.filter(c => !isWebsiteLead(c) && !c.isGroup && !c.isDirect).length})</span>
              </button>
              <button 
                onClick={() => setChatTabFilter('website')}
                className={`py-1.5 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 min-w-0 w-full text-center ${chatTabFilter === 'website' ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md ring-1 ring-amber-400/50' : 'bg-white/5 text-amber-300/90 hover:text-amber-200 hover:bg-white/10 border border-amber-500/20'}`}
                title="رسائل وزوار الموقع"
              >
                <span>🌐 الموقع</span>
                <span className="bg-black/40 text-amber-200 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono">({chats.filter(c => isWebsiteLead(c) && hasCustomerSentMessage(c) && !c.isGroup && !c.isDirect).length})</span>
              </button>
            </div>

            {/* Row 2: Internal Staff Tabs (جروبات الموظفين / محادثات الزملاء) */}
            <div className="grid grid-cols-2 gap-1.5 w-full">
              <button 
                onClick={() => setChatTabFilter('groups')}
                className={`py-1.5 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 min-w-0 w-full text-center ${chatTabFilter === 'groups' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md ring-1 ring-purple-400/50' : 'bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10'}`}
                title="جروبات الموظفين الداخلية"
              >
                <span>👥 جروبات الموظفين</span>
                <span className="bg-black/40 text-white px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono">({internalGroups.filter(g => g.isGroup && !g.isDirect).length})</span>
              </button>
              <button 
                onClick={() => setChatTabFilter('colleagues')}
                className={`py-1.5 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 min-w-0 w-full text-center ${chatTabFilter === 'colleagues' ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md ring-1 ring-cyan-400/50' : 'bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10'}`}
                title="محادثات الزملاء المباشرة"
              >
                <span>🤝 محادثات الزملاء</span>
                <span className="bg-black/40 text-white px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono">({internalGroups.filter(g => g.isDirect).length})</span>
              </button>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="bg-black/30 border-b border-white/5 p-2 px-4 relative z-10">
            <select 
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full bg-slate-900/90 text-white text-xs font-bold border border-white/15 rounded-xl focus:ring-2 focus:ring-cyan-500 py-2 px-3 cursor-pointer transition hover:bg-slate-800"
            >
              <option value="hide" className="text-red-500 font-bold bg-slate-900">🚫 إخفاء المحادثات</option>
              <option value="all" className="text-cyan-300 font-bold bg-slate-900">
                {chatTabFilter === 'website' ? '🌐 جميع محادثات زوار الموقع' : chatTabFilter === 'direct' ? '👤 جميع محادثات عملاء الحملات' : chatTabFilter === 'groups' ? '👥 جميع جروبات الموظفين' : chatTabFilter === 'colleagues' ? '🤝 جميع محادثات الزملاء' : '💬 جميع المحادثات'} ({filteredChats.length})
              </option>
              <option value="unassigned" className="text-amber-300 font-bold bg-slate-900">
                ⏳ عملاء الانتظار {chatTabFilter === 'website' ? '(الموقع)' : chatTabFilter === 'direct' ? '(الحملات)' : ''} ({filteredChats.filter(c => c.status === 'unassigned' || isWaitingListLead(c)).length})
              </option>
              {employees.map(emp => {
                const empUid = emp.uid;
                const empEmail = emp.email?.toLowerCase();
                const empName = emp.name?.toLowerCase();
                const empUsername = emp.username?.toLowerCase();

                const isEmpChat = (c) => 
                  c.assignedToUid === empUid ||
                  (empEmail && c.assignedTo?.toLowerCase() === empEmail) ||
                  (empName && c.assignedTo?.toLowerCase() === empName) ||
                  (empUsername && c.assignedTo?.toLowerCase() === empUsername);

                const empChatsCount = filteredChats.filter(c => isEmpChat(c)).length;
                const displayName = emp.username || emp.name;
                const empTitle = formatJobTitle(emp.jobTitle);
                return (
                  <option key={emp.uid} value={emp.uid} className="text-white font-semibold bg-slate-900">
                    👤 {displayName} | {empTitle} ({empChatsCount} محادثة)
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {!isAdmin && !isCoordinator && (
          <div className="bg-black/30 border-b border-white/5 p-2 px-4 relative z-10">
            <select 
              value={selectedEmployee === 'all' ? 'my_chats' : selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full bg-slate-900/90 text-white text-xs font-bold border border-white/15 rounded-xl focus:ring-2 focus:ring-cyan-500 py-2 px-3 cursor-pointer transition hover:bg-slate-800"
            >
              <option value="my_chats" className="text-cyan-300 font-bold bg-slate-900">
                💬 محادثاتي المخصصة {chatTabFilter === 'website' ? '(الموقع)' : chatTabFilter === 'direct' ? '(الحملات)' : ''} ({filteredChats.filter(c => c.assignedToUid === currentUser?.uid || (c.assignedTo && currentUser?.email && c.assignedTo.toLowerCase() === currentUser?.email.toLowerCase())).length})
              </option>
              <option value="unassigned" className="text-amber-300 font-bold bg-slate-900">
                ⏳ عملاء الانتظار ({filteredChats.filter(c => c.status === 'unassigned').length})
              </option>
            </select>
          </div>
        )}

        {/* البحث في قائمة المحادثات والتحديد المتعدد */}
        <div className="p-3 bg-black/10 border-b border-white/5 relative z-10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder={isCoordinator ? "ابحث عن اسم الجروب..." : "ابحث عن اسم، رقم، أو جروب..."} 
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full bg-white/10 text-white placeholder-gray-400 border border-white/10 rounded-full py-1.5 pr-8 pl-3 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-black/30 transition-all"
              />
              <Search className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={13} />
            </div>
            {!isCoordinator && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsBroadcastModalOpen(true);
                    setBroadcastTab('lists');
                  }}
                  className="px-2.5 py-1.5 rounded-full text-[11px] font-black bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border border-purple-400/40 flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-md active:scale-95"
                  title="إدارة وإرسال قوائم Broadcast الجماعية"
                >
                  <Radio size={13} className="text-cyan-300 animate-pulse" />
                  <span>Broadcast 📢</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsChatSelectMode(prev => !prev);
                    if (isChatSelectMode) setSelectedChatIds([]);
                  }}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0 border ${
                    isChatSelectMode ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black' : 'bg-white/10 text-gray-200 hover:bg-white/20 border-white/10'
                  }`}
                  title="تحديد عملاء متعدد للمسح"
                >
                  <CheckSquare size={13} />
                  <span>{isChatSelectMode ? 'إلغاء التحديد' : 'تحديد مسح 🗑️'}</span>
                </button>
              </>
            )}
          </div>

          {/* شريط الإجراءات عند تفعيل التحديد المتعدد */}
          {isChatSelectMode && !isCoordinator && (
            <div className="flex items-center justify-between bg-slate-900/90 border border-cyan-500/40 rounded-xl px-3 py-1.5 text-xs text-white shadow-md animate-fadeIn">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllChats}
                  className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
                >
                  {selectedChatIds.length > 0 && selectedChatIds.length === filteredChats.filter(c => !c.isGroup && !c.isDirect).length ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>
                <span className="text-[10px] text-gray-400 font-mono">({selectedChatIds.length} محدد)</span>
              </div>
              {selectedChatIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = filteredChats.filter(c => selectedChatIds.includes(c.id));
                    handleSoftDeleteChat(toDelete);
                  }}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md cursor-pointer transition active:scale-95"
                >
                  <Trash2 size={12} />
                  <span>مسح ({selectedChatIds.length}) 🗑️</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* قائمة الشات والجروبات الجانبية */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5 relative z-10">
          {filteredChats.map((chat) => {
            const isUnread = (Number(chat.unread) || 0) > 0 || chat.unread === true;
            const itemBg = activeChat?.id === chat.id 
              ? 'bg-white/20 border-r-4 border-cyan-400' 
              : isUnread 
                ? 'bg-red-950/50 border-r-4 border-r-red-500 hover:bg-red-900/60 shadow-inner' 
                : 'hover:bg-white/5 border-r-4 border-r-transparent';

            // Direct Colleague Chat Card Item (1-on-1)
            if (chat.isDirect) {
              const otherUid = (chat.members || []).find(m => m !== currentUser?.uid && m !== currentEmpUser?.uid) || chat.members?.[0];
              const otherEmp = employees.find(e => e.uid === otherUid || e.email?.toLowerCase() === String(otherUid).toLowerCase());
              const otherName = otherEmp?.username || otherEmp?.name || chat.memberNames?.[otherUid] || chat.name || 'زميل عمل';
              const isOtherAdmin = isAdminMember(otherUid) || otherEmp?.role === 'admin' || otherUid === 'admin';
              const otherTitle = isOtherAdmin ? '👑 الإدارة' : formatJobTitle(otherEmp?.jobTitle || otherEmp?.role || chat.memberTitles?.[otherUid] || 'Agent');

              return (
                <div 
                  key={chat.id}
                  onClick={() => handleChatClick(chat)}
                  className={`p-4 cursor-pointer transition flex items-center justify-between ${itemBg}`}
                >
                  <div className="flex items-center space-x-3 space-x-reverse min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white border border-cyan-400/40">
                        <User size={18} />
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full shadow-xs"></span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-white text-sm flex items-center gap-1.5 truncate">
                        <span className="text-cyan-400">💬</span>
                        <span className="truncate">{otherName}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border shrink-0 ${
                          isOtherAdmin
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : otherTitle === 'Leader'
                              ? 'bg-purple-900/60 text-purple-200 border-purple-400/30'
                              : otherTitle === 'Coordinator'
                                ? 'bg-cyan-900/60 text-cyan-200 border-cyan-400/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {otherTitle === 'Leader' ? '👑 Leader' : (otherTitle === 'Coordinator' ? '📋 منسق' : (isOtherAdmin ? '👑 الإدارة' : '👤 Agent'))}
                        </span>
                      </h3>
                      <p className="text-xs truncate mt-1 text-gray-300">
                        <span className="text-cyan-400 font-bold">{chat.lastMessageSender ? `${chat.lastMessageSender}: ` : ''}</span>
                        {chat.lastMessage || 'بدء المحادثة المباشرة...'}
                      </p>
                    </div>
                  </div>
                  <div className="text-left flex flex-col items-end shrink-0 ml-2">
                    <span className="text-[10px] text-gray-400">{formatTime(chat.updatedAt)}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(chat);
                        }}
                        className="mt-1.5 px-2 py-0.5 rounded-md bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 hover:text-rose-200 border border-rose-500/40 transition shadow-sm flex items-center gap-1 text-[10px] font-black cursor-pointer active:scale-95"
                        title="حذف هذه المحادثة بالكامل (للإدارة فقط)"
                      >
                        <Trash2 size={11} className="text-rose-400" />
                        <span>حذف</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }

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
                          {getGroupMembersCount(chat.members)} عضو
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
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(chat);
                        }}
                        className="mt-1.5 px-2 py-0.5 rounded-md bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 hover:text-rose-200 border border-rose-500/40 transition shadow-sm flex items-center gap-1 text-[10px] font-black cursor-pointer active:scale-95"
                        title="حذف هذا الجروب بالكامل (للإدارة فقط)"
                      >
                        <Trash2 size={11} className="text-rose-400" />
                        <span>حذف</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Regular Customer Card Item
            return (
              <div 
                key={chat.id}
                onClick={() => handleChatClick(chat)}
                className={`p-4 cursor-pointer transition flex items-center justify-between ${itemBg} ${selectedChatIds.includes(chat.id) ? 'bg-cyan-950/40 border-cyan-400' : ''}`}
              >
                <div className="flex items-center space-x-3 space-x-reverse min-w-0 flex-1">
                  {isChatSelectMode && (
                    <input 
                      type="checkbox" 
                      checked={selectedChatIds.includes(chat.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectChat(chat.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 text-cyan-500 rounded border-gray-400 cursor-pointer shrink-0 ml-1 accent-cyan-500"
                    />
                  )}
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md ${isUnread ? 'bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-gradient-to-tr from-cyan-600 to-blue-500 text-white'}`}>
                      {chat.name ? chat.name.charAt(0) : <User size={20} />}
                    </div>
                    {chat.unread > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-md animate-pulse">
                        {chat.unread}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* Row 1: Customer Name + Website Badge + Admin Assign Dropdown Filter */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-white text-sm truncate max-w-[120px] sm:max-w-[150px]">
                        {chat.name || chat.phoneNumber || 'عميل مسجل'}
                      </h3>

                      {/* 1. Website Badge directly next to Customer Name */}
                      {isWebsiteLead(chat) && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0">🌐 موقع</span>
                      )}

                      {/* 2. Admin Transfer / Assign Dropdown Filter to the left of Website Badge */}
                      {isAdmin && (
                        <select 
                          value={chat.assignedToUid || ""}
                          onChange={(e) => handleAssignChat(chat.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-slate-900/90 text-cyan-300 border border-cyan-500/40 rounded-md px-1.5 py-0.5 text-[9px] font-bold focus:outline-none focus:border-cyan-400 cursor-pointer max-w-[110px] shrink-0"
                          title="تحويل العميل إلى موظف"
                        >
                          <option value="" disabled className="bg-slate-900 text-gray-400">تحويل إلى...</option>
                          <option value={currentUser.uid} className="bg-slate-900 text-amber-300 font-bold">👑 الأدمن</option>
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

                      {isWaitingListLead(chat) && (
                        <span className="bg-rose-600/30 text-rose-200 border border-rose-500/50 text-[9px] px-1.5 py-0.2 rounded font-black shrink-0 animate-pulse">⏳ انتظار</span>
                      )}
                    </div>

                    {/* Row 2: Customer Phone Number directly BELOW Customer Name */}
                    {chat.phoneNumber && (
                      <div className="w-full text-right mt-0.5" dir="rtl">
                        <span className="text-xs text-cyan-300 font-mono font-bold block truncate" dir="ltr">
                          {chat.phoneNumber}
                        </span>
                      </div>
                    )}

                    {/* Row 3: Last Message Preview */}
                    <p className={`text-xs truncate mt-0.5 ${isUnread ? 'text-red-200 font-bold' : 'text-gray-300'}`}>
                      {chat.lastMessage || 'بدء المحادثة...'}
                    </p>
                  </div>
                </div>

                {/* Right/Left Timestamp column */}
                <div className="text-left flex flex-col items-end shrink-0 ml-1">
                  <span className="text-[10px] text-gray-400 font-mono">{formatTime(chat.updatedAt)}</span>
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
        onClick={closeActiveChat}
        className={`flex-1 flex-col bg-black/40 backdrop-blur-2xl relative z-10 ${!activeChat ? 'hidden md:flex' : 'flex'}`}
      >
        {activeChat ? (
          <>
            {/* هيدر الشات */}
            <div onClick={(e) => e.stopPropagation()} className="bg-black/50 backdrop-blur-md p-2.5 sm:p-4 border-b border-white/10 flex justify-between items-center gap-2 shadow-md">
              <div className="flex items-center space-x-2 sm:space-x-3 space-x-reverse min-w-0 flex-1">
                <button 
                  onClick={closeActiveChat} 
                  className="md:hidden text-gray-300 hover:text-white p-1 transition shrink-0"
                  title="رجوع للقائمة"
                >
                  <ChevronRight size={22} />
                </button>
                
                {activeChat.isDirect ? (
                  /* Direct Colleague Header Avatar & Title */
                  (() => {
                    const otherUid = (activeChat.members || []).find(m => m !== currentUser?.uid && m !== currentEmpUser?.uid) || activeChat.members?.[0];
                    const otherEmp = employees.find(e => e.uid === otherUid || e.email?.toLowerCase() === String(otherUid).toLowerCase());
                    const otherName = otherEmp?.name || otherEmp?.username || activeChat.memberNames?.[otherUid] || activeChat.name || 'زميل عمل';
                    const rawTitle = otherEmp?.jobTitle || otherEmp?.role || activeChat.memberTitles?.[otherUid] || 'Agent';
                    const isOtherAdmin = isAdminMember(otherUid) || otherEmp?.role === 'admin' || otherUid === 'admin';
                    const formattedRole = isOtherAdmin ? '👑 الإدارة' : formatJobTitle(rawTitle);

                    return (
                      <>
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md border border-cyan-400/40">
                            <User size={18} />
                          </div>
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full shadow-xs"></span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-1.5 truncate">
                            <span className="text-cyan-400 shrink-0">💬</span>
                            <span className="truncate">{otherName}</span>
                            <span className={`text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full border shrink-0 ${
                              isOtherAdmin 
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                                : formattedRole === 'Leader' 
                                  ? 'bg-purple-900/60 text-purple-200 border-purple-400/40' 
                                  : formattedRole === 'Coordinator' 
                                    ? 'bg-cyan-900/60 text-cyan-200 border-cyan-400/40' 
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}>
                              {formattedRole === 'Leader' ? '👑 Leader' : (formattedRole === 'Coordinator' ? '📋 منسق' : (isOtherAdmin ? '👑 الإدارة' : '👤 Agent'))}
                            </span>
                          </h2>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-300 flex-wrap">
                            <span className="text-[10px] sm:text-[11px] text-cyan-300 font-medium">
                              محادثة مباشرة (مشفرة 🔒)
                            </span>
                            {otherEmp?.email && (
                              <span className="text-[10px] text-gray-400 font-mono hidden sm:inline" dir="ltr">
                                {otherEmp.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()
                ) : activeChat.isGroup ? (
                  /* Group Header Avatar & Title */
                  <>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white font-bold shadow-md shrink-0 border border-purple-400/40">
                      <Users size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-1.5 truncate">
                        <span className="text-purple-300 shrink-0">👥</span>
                        <span className="truncate">{activeChat.name}</span>
                      </h2>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-purple-200/80 flex-wrap">
                        <span className="bg-purple-900/60 border border-purple-400/40 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.2 rounded-full font-bold">
                          {getGroupMembersCount(activeChat.members)} أعضاء
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-gray-300 truncate">
                          أنشئ بواسطة: <span className="font-bold text-cyan-300">{activeChat.createdByName}</span>
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Customer Header Avatar & Title */
                  <>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white font-bold shadow-md shrink-0">
                      {activeChat.name ? activeChat.name.charAt(0) : <User size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-black text-white text-sm sm:text-base truncate max-w-[140px] xs:max-w-[180px] sm:max-w-none">{activeChat.name || 'عميل بدون اسم'}</h2>
                      <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 flex-wrap">
                        <p className="text-[11px] sm:text-xs text-gray-300 font-mono" dir="ltr">{activeChat.phoneNumber}</p>
                        {!isCoordinator && activeChat.phoneNumber && (
                          <button
                            onClick={() => handleCallViaMicroSip(activeChat.phoneNumber)}
                            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)] active:scale-95 border border-blue-300/40 rounded-lg px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black flex items-center gap-0.5 sm:gap-1 cursor-pointer shrink-0"
                            title="اتصال مباشر عبر MicroSIP 📞"
                          >
                            <PhoneCall size={10} className="animate-pulse shrink-0" />
                            <span>Call</span>
                          </button>
                        )}

                        {/* شارة مصدر العميل (اسم الكارت / الحملة / الموقع) */}
                        {activeChat.cardName || activeChat.campaignName || activeChat.cardTitle || activeChat.sourceName ? (
                          <span className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 text-[8px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-0.5 sm:gap-1 shrink-0 shadow-sm">
                            <span>🌐</span>
                            <span>{activeChat.cardName || activeChat.campaignName || activeChat.cardTitle || activeChat.sourceName}</span>
                          </span>
                        ) : activeChat.source === 'website' || isWebsiteLead(activeChat) ? (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[8px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-0.5 sm:gap-1 shrink-0">
                            🌐 داتا الموقع (الواتساب)
                          </span>
                        ) : activeChat.source === 'excel_import' ? (
                          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[8px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-0.5 sm:gap-1 shrink-0">
                            📊 عملاء الحملات (إكسيل)
                          </span>
                        ) : activeChat.source === 'manual' ? (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[8px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-0.5 sm:gap-1 shrink-0">
                            ✋ مضاف يدوياً
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right Side Header Controls */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Internal Call Alert Button for ALL conversation types */}
                <button
                  type="button"
                  onClick={handleTriggerInternalCallFromHeader}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-black transition flex items-center gap-1 sm:gap-1.5 shadow-md active:scale-95 cursor-pointer shrink-0 border ${
                    isHeaderCallRinging
                      ? 'bg-rose-950/90 hover:bg-rose-900 text-rose-200 border-rose-500/80 animate-pulse ring-2 ring-rose-500/40'
                      : 'bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-teal-500/20 hover:from-amber-500/30 hover:to-teal-500/30 text-amber-300 hover:text-white border-amber-500/40'
                  }`}
                  title={isHeaderCallRinging ? "انقر لإنهاء اتصال التنبيه الداخلي 🛑" : "إجراء اتصال تنبيه داخلي بالرسائل لهذه المحادثة 📞"}
                >
                  {isHeaderCallRinging ? (
                    <>
                      <PhoneCall size={12} className="text-rose-400 animate-spin shrink-0" />
                      <span className="hidden sm:inline">🛑 إنهاء اتصال التنبيه</span>
                      <span className="sm:hidden">🛑 إنهاء</span>
                    </>
                  ) : (
                    <>
                      <PhoneCall size={12} className="text-amber-400 animate-pulse shrink-0" />
                      <span className="hidden sm:inline">اتصال داخلي للتنبيه بالرسائل</span>
                      <span className="sm:hidden">اتصال تنبيه 📞</span>
                    </>
                  )}
                </button>

                {activeChat.isDirect ? (
                  /* Direct Colleague Action Buttons */
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <span className="text-[10px] sm:text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 sm:py-1 rounded-xl font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                      <span className="hidden sm:inline">نشط الآن</span>
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(activeChat)}
                        className="bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 hover:text-white border border-rose-500/50 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 shadow-md active:scale-95 cursor-pointer"
                        title="حذف هذه المحادثة نهائياً (للإدارة فقط)"
                      >
                        <Trash2 size={13} className="text-rose-400" />
                        <span className="hidden sm:inline">حذف المحادثة</span>
                      </button>
                    )}
                  </div>
                ) : activeChat.isGroup ? (
                  /* Group Action Buttons */
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setIsGroupInfoModalOpen(true)}
                      className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border border-purple-400/50 px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer"
                      title="عرض وإدارة أعضاء الجروب"
                    >
                      <Users size={14} />
                      <span>الأعضاء ({getGroupMembersCount(activeChat.members)})</span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(activeChat)}
                        className="bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 hover:text-white border border-rose-500/50 px-2.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 shadow-md active:scale-95 cursor-pointer"
                        title="حذف هذا الجروب نهائياً (للإدارة فقط)"
                      >
                        <Trash2 size={13} className="text-rose-400" />
                        <span className="hidden sm:inline">حذف الجروب</span>
                      </button>
                    )}
                  </div>
                ) : (
                  /* Customer Action Buttons */
                  <>
                    <button
                      type="button"
                      onClick={() => handleSoftDeleteChat(activeChat)}
                      className="bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 hover:text-white border border-rose-500/50 px-2.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 shadow-md active:scale-95 cursor-pointer"
                      title="مسح العميل ونقله لسلة المهملات لدى الإدارة 🗑️"
                    >
                      <Trash2 size={13} className="text-rose-400" />
                      <span className="hidden sm:inline">مسح المحادثة</span>
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
                  closeActiveChat();
                }
              }}
              className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/40 cursor-pointer relative"
              onScroll={handleMessagesScroll}
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

                  // System notices in group or chat (e.g. Member addition / removal)
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
                        <div className="flex justify-center my-2 group/sysmsg relative">
                          <div className="bg-slate-800/90 text-cyan-300 text-xs px-3.5 py-1.5 rounded-full border border-cyan-500/30 flex items-center gap-2 shadow-md font-medium hover:border-cyan-400 transition">
                            <span>📢</span>
                            <span>{msg.text}</span>
                            {/* زر مسح إشعار الإدراج / الإخراج (للأدمن فقط ويختفي من عند الجميع) */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMessage(msg);
                                }}
                                className="text-gray-400 hover:text-rose-400 hover:bg-rose-950/60 p-1 rounded-full transition active:scale-95 cursor-pointer ml-1"
                                title="مسح إشعار الإدراج/الإخراج من عند الجميع (للإدارة فقط)"
                              >
                                <Trash2 size={13} className="text-rose-400" />
                              </button>
                            )}
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
                      id={msg.id ? `msg-${msg.id}` : `msg-idx-${index}`}
                      data-msg-id={msg.id || ''}
                      data-msg-text={msg.text || ''}
                      className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} group mb-2 cursor-default transition-all duration-300 rounded-2xl`}
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
                                    👤 {getCustomerChatDisplayName(msg.senderEmail)}
                                  </span>
                                )}
                              </div>
                            )
                          )}
                          {msg.mediaUrl && (
                            <div className="mb-2 max-w-sm">
                              {((msg.fileType && msg.fileType.startsWith('image/')) || (msg.mediaType === 'image') || (msg.mediaUrl && (/\.(jpg|jpeg|png|gif|webp|svg)/i.test(msg.mediaUrl) || msg.mediaUrl.startsWith('data:image/')))) ? (
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewMediaModal({
                                      url: msg.mediaUrl,
                                      name: msg.fileName || msg.mediaName || 'صورة_مرفقة.png',
                                      type: 'image'
                                    });
                                  }}
                                  className="relative group/img overflow-hidden rounded-2xl border border-white/20 cursor-pointer bg-slate-950/60 shadow-md transition-all hover:border-cyan-400/80"
                                  title="انقر للمعاينة المكبرة والتكبير والتحميل 🖼️"
                                >
                                  <img 
                                    src={msg.mediaUrl} 
                                    alt={msg.fileName || msg.mediaName || "مرفق صورة"} 
                                    className="max-w-full h-auto rounded-2xl max-h-72 object-contain mx-auto block group-hover/img:scale-[1.02] transition-transform duration-300" 
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-between p-2.5">
                                    <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-cyan-500/40 backdrop-blur-sm">
                                      🔍 معاينة مكبرة
                                    </span>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadFile(msg.mediaUrl, msg.fileName || msg.mediaName || 'image.png');
                                      }}
                                      className="text-[11px] font-bold text-white flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 rounded-xl shadow-md transition"
                                      title="تحميل المرفق على الجهاز 📥"
                                    >
                                      <Download size={12} />
                                      تنزيل
                                    </button>
                                  </div>
                                </div>
                              ) : ((msg.fileType && msg.fileType.startsWith('video/')) || (msg.mediaType === 'video') || (msg.mediaUrl && /\.(mp4|webm|mov|mkv)/i.test(msg.mediaUrl))) ? (
                                <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-slate-950 shadow-md p-1">
                                  <video src={msg.mediaUrl} controls className="max-w-full rounded-xl max-h-64 mx-auto block" />
                                  <div className="flex items-center justify-between mt-1 px-1">
                                    <span className="text-[10px] text-cyan-300 font-semibold truncate max-w-[150px]">{msg.fileName || msg.mediaName || 'فيديو مرفق'}</span>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadFile(msg.mediaUrl, msg.fileName || msg.mediaName || 'video.mp4');
                                      }}
                                      className="text-[10px] font-bold text-white flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 px-2 py-0.5 rounded-lg transition"
                                    >
                                      <Download size={11} /> تنزيل الفيديو
                                    </button>
                                  </div>
                                </div>
                              ) : ((msg.fileType && msg.fileType.startsWith('audio/')) || (msg.mediaType === 'audio') || (msg.mediaUrl && /\.(mp3|ogg|wav|m4a)/i.test(msg.mediaUrl))) ? (
                                <div className="bg-slate-900/90 p-2.5 rounded-2xl border border-cyan-500/30">
                                  <audio src={msg.mediaUrl} controls className="w-full max-w-xs" />
                                  <div className="flex justify-end mt-1">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadFile(msg.mediaUrl, msg.fileName || msg.mediaName || 'audio.mp3');
                                      }}
                                      className="text-[10px] font-bold text-cyan-300 hover:text-white flex items-center gap-1"
                                    >
                                      <Download size={11} /> تنزيل الصوتي
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewMediaModal({
                                      url: msg.mediaUrl,
                                      name: msg.fileName || msg.mediaName || 'مستند_مرفق',
                                      type: (msg.fileName || msg.mediaName || msg.mediaUrl || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'doc'
                                    });
                                  }}
                                  className="flex items-center space-x-3 space-x-reverse bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-cyan-500/40 hover:bg-slate-800 transition cursor-pointer group/file shadow-md my-1"
                                  title="انقر لفتح ومعاينة أو تنزيل المستند 📄"
                                >
                                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0 group-hover/file:bg-cyan-500/30 transition">
                                    <FileText size={20} className="text-cyan-300" />
                                  </div>
                                  <div className="flex-1 min-w-0 text-right" dir="rtl">
                                    <span className="text-xs font-bold text-white block truncate" dir="ltr">{msg.fileName || msg.mediaName || 'ملف مستند مرفق'}</span>
                                    <span className="text-[10px] text-cyan-300 font-semibold block mt-0.5">انقر للمعاينة التفاعلية 👁️</span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadFile(msg.mediaUrl, msg.fileName || msg.mediaName || 'document');
                                    }}
                                    className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 flex items-center justify-center shrink-0 text-white group-hover/file:scale-105 transition shadow-sm"
                                    title="تنزيل الملف مباشرة على الجهاز 📥"
                                  >
                                    <Download size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {msg.replyTo && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                scrollToMessage(msg.replyTo);
                              }}
                              className="bg-white/70 hover:bg-emerald-100/90 p-2 rounded mb-1 border-r-4 border-emerald-500 text-xs text-gray-700 truncate max-w-[220px] cursor-pointer transition-all hover:scale-[1.01] active:scale-95 shadow-sm group/reply"
                              title="انقر للانتقال للرسالة الأصلية 📍"
                            >
                              <div className="flex items-center justify-between text-[11px] text-emerald-700 font-bold mb-0.5">
                                <span>↩️ الرد على ({msg.replyTo.sender === 'user' || msg.replyTo.sender === 'client' ? (activeChat.name || 'العميل') : 'أنت'}):</span>
                                <span className="text-[9px] text-emerald-600 font-normal opacity-70 group-hover/reply:opacity-100">انتقال 📍</span>
                              </div>
                              <span className="opacity-90 block truncate">{msg.replyTo.text || '📷 مرفق'}</span>
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
                        {(msg.sender !== 'user' && msg.sender !== 'customer') && (
                          <span className="flex items-center">
                            {msg.status === 'read' || msg.status === 'delivered' || msg.status === 'sent' || msg.metaMessageId || !msg.status ? (
                              <CheckCheck size={14} className={msg.status === 'read' ? "text-cyan-400 font-black" : "text-cyan-400/90 font-bold"} title={msg.status === 'read' ? "تم القراءة (تم فتح الرسالة ✔✔)" : "تم التسليم للعميل (✔✔)"} />
                            ) : msg.status === 'failed' || msg.status === 'error' ? (
                              <AlertCircle size={13} className="text-red-500 font-bold" title="فشل الإرسال ⚠️" />
                            ) : msg.status === 'sending' ? (
                              <Clock size={12} className="text-gray-400 animate-spin" title="جاري الإرسال 🕒" />
                            ) : (
                              <CheckCheck size={14} className="text-cyan-400 font-bold" title="تم الإرسال (✔✔)" />
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

              <div ref={messagesEndRef} />
            </div>

            {/* Floating Scroll to Bottom Button (3D Glassmorphism - Image Matched) */}
            {showScrollBottomBtn && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  scrollToBottomSmooth();
                }}
                className="absolute bottom-32 left-6 z-30 w-8 h-8 bg-[#131d2a]/95 backdrop-blur-md border border-cyan-400/80 text-cyan-400 hover:text-cyan-200 hover:border-cyan-300 hover:bg-slate-900 shadow-[0_4px_16px_rgba(0,0,0,0.6),0_0_12px_rgba(6,182,212,0.3)] transition-all duration-200 active:scale-95 hover:scale-105 rounded-full flex items-center justify-center cursor-pointer group shadow-lg mb-2"
                title="الانتقال لآخر رسالة في المحادثة"
              >
                <ChevronDown size={14} className="stroke-[2.5]" />
              </button>
            )}

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
                    onPaste={handlePaste}
                    placeholder="اكتب رسالتك هنا... (اضغط Enter للإرسال)"
                    rows={2}
                    className="w-full bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-2xl py-3 pr-4 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-black/40 transition-all resize-none min-h-[52px] max-h-36"
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
                      <option key={emp.uid} value={emp.uid}>{emp.username || emp.name}</option>
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

      {/* Modal: محادثة مباشرة جديدة مع زميل عمل (1-on-1 Direct Colleague Chat) */}
      {isDirectModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 w-full max-w-lg shadow-[0_10px_40px_rgba(6,182,212,0.3)] text-right max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10 shrink-0">
              <h3 className="font-black text-white text-lg flex items-center gap-2">
                <MessageSquarePlus className="text-cyan-400" size={22} />
                <span>💬 محادثة مباشرة مع زميل عمل</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsDirectModalOpen(false)} 
                className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Input */}
            <div className="mb-3 shrink-0">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="ابحث بالاسم، الإيميل، أو المسمى الوظيفي..." 
                  value={directSearchTerm}
                  onChange={(e) => setDirectSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 text-white placeholder-gray-400 border border-cyan-500/30 rounded-xl py-2.5 pr-9 pl-4 text-xs font-bold focus:outline-none focus:border-cyan-400 transition"
                  autoFocus
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-400" size={15} />
              </div>
            </div>

            {/* Colleague List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {/* Admin Card (Shown if current user is not admin) */}
              {!isAdmin && (() => {
                const term = directSearchTerm.trim().toLowerCase();
                const matchAdmin = !term || term.includes('admin') || term.includes('إدارة') || term.includes('ادارة');
                if (!matchAdmin) return null;

                return (
                  <div 
                    onClick={() => handleStartDirectChat({ uid: 'admin', name: 'إدارة المنصة (Admin)', email: 'admin@etegah.com', role: 'admin', jobTitle: 'Admin' })}
                    className="p-3 bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-slate-900 border border-amber-500/40 hover:border-amber-400 rounded-2xl cursor-pointer transition flex items-center justify-between shadow-sm active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-md shrink-0">
                        <Crown size={18} />
                      </div>
                      <div>
                        <span className="text-xs font-black text-amber-300 block flex items-center gap-1">
                          <span>👑 إدارة المنصة (Admin)</span>
                        </span>
                        <span className="text-[10px] text-amber-400/80 font-mono" dir="ltr">
                          admin@etegah.com
                        </span>
                      </div>
                    </div>
                    <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                      مراسلة الإدارة ➔
                    </span>
                  </div>
                );
              })()}

              {/* Employees List */}
              {employees
                .filter(emp => {
                  const empUid = emp.uid || emp.id;
                  const myUid = currentUser?.uid;
                  const myEmpUid = currentEmpUser?.uid;
                  if (empUid === myUid || empUid === myEmpUid) return false;
                  if (emp.role === 'admin' || isAdminMember(empUid)) return false;

                  if (directSearchTerm.trim()) {
                    const t = directSearchTerm.trim().toLowerCase();
                    const n = (emp.username || emp.name || '').toLowerCase();
                    const em = (emp.email || '').toLowerCase();
                    const j = (emp.jobTitle || emp.role || '').toLowerCase();
                    return n.includes(t) || em.includes(t) || j.includes(t);
                  }
                  return true;
                })
                .map(emp => {
                  const title = formatJobTitle(emp.jobTitle || emp.role);
                  return (
                    <div 
                      key={emp.uid || emp.id}
                      onClick={() => handleStartDirectChat(emp)}
                      className="p-3 bg-slate-950/70 border border-white/5 hover:border-cyan-500/50 hover:bg-slate-950 rounded-2xl cursor-pointer transition flex items-center justify-between group active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shrink-0 border border-cyan-400/30">
                          <User size={16} />
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-xs font-bold text-white block truncate group-hover:text-cyan-300 transition">
                            {emp.username || emp.name}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono block truncate" dir="ltr">
                            {emp.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          title === 'Leader'
                            ? 'bg-purple-900/60 text-purple-200 border-purple-400/40'
                            : emp.jobTitle === 'Coordinator' || emp.role === 'coordinator'
                              ? 'bg-cyan-900/60 text-cyan-200 border-cyan-400/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {title === 'Leader' ? '👑 Leader' : (emp.jobTitle === 'Coordinator' || emp.role === 'coordinator' ? '📋 منسق' : (title === 'Customer Service' ? '🎧 Customer Service' : '👤 Agent'))}
                        </span>
                        <span className="text-cyan-400 opacity-0 group-hover:opacity-100 transition text-xs font-bold">
                          مراسلة ➔
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-3 shrink-0 border-t border-white/10 mt-2">
              <button 
                type="button" 
                onClick={() => setIsDirectModalOpen(false)} 
                className="px-5 py-2 rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
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
                              {emp.username || emp.name}
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
                    أنشئ بواسطة: {activeChat.createdByName} • {getGroupMembersCount(activeChat.members)} أعضاء
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
                            {emp.username || emp.name} ({formatJobTitle(emp.jobTitle)})
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
                  قائمة الأعضاء الحاليين ({getGroupMembersCount(activeChat.members)}):
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
                    if (isAdminMember(memberUid)) return null;
                    const emp = employees.find(e => e.uid === memberUid);
                    if (!emp || isAdminMember(emp.uid)) return null;

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
                            {emp ? ((emp.username || emp.name) ? (emp.username || emp.name).charAt(0) : '👤') : '👤'}
                          </div>
                          <div className="overflow-hidden">
                            <span className="text-xs font-bold text-white block truncate">
                              {emp?.username || emp?.name || 'موظف'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono block truncate" dir="ltr">
                              {emp?.email || memberUid}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
                            {title === 'Leader' ? '👑 Leader' : (emp?.jobTitle === 'Coordinator' || emp?.role === 'coordinator' ? '📋 منسق' : (title === 'Customer Service' ? '🎧 Customer Service' : '👤 Agent'))}
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

              {/* Modal Footer Controls */}
              <div className="flex justify-between items-center pt-3 shrink-0 border-t border-white/10">
                {isAdmin ? (
                  <button 
                    type="button" 
                    onClick={() => handleDeleteGroup(activeChat)} 
                    className="px-4 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white text-xs font-black border border-rose-500/40 transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                    title="حذف هذا الجروب بالكامل نهائياً"
                  >
                    <Trash2 size={14} className="text-rose-300" />
                    <span>حذف الجروب بالكامل</span>
                  </button>
                ) : <div /> }
                <button 
                  type="button" 
                  onClick={() => setIsGroupInfoModalOpen(false)} 
                  className="px-5 py-2 rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal: إدارة وإرسال قوائم الـ Broadcast الجماعية */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-purple-500/40 rounded-3xl p-6 w-full max-w-3xl shadow-[0_10px_50px_rgba(147,51,234,0.35)] text-right max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <Radio className="text-cyan-400 animate-pulse" size={24} />
                <div>
                  <h3 className="font-black text-white text-lg flex items-center gap-2">
                    <span>📢 WhatsApp Broadcast Lists</span>
                    <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                      قوائم المراسلة الجماعية
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    إرسال رسائل خاصة منفردة 1-on-1 لأي عدد من العملاء دون أن يعلم العميل بوجود قائمة
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsBroadcastModalOpen(false)} 
                className="text-gray-400 hover:text-white transition p-1.5 rounded-xl hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 mb-4 bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setBroadcastTab('lists')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  broadcastTab === 'lists' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>📋 قوائم الـ Broadcast ({broadcastLists.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setBroadcastTab('create');
                  setNewBroadcastName('');
                  setBroadcastSelectedCustomerIds([]);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  broadcastTab === 'create' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Plus size={14} />
                <span>➕ إنشاء قائمة جديدة</span>
              </button>
              {selectedBroadcastId && (
                <button
                  type="button"
                  onClick={() => setBroadcastTab('send')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    broadcastTab === 'send' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' : 'text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  <Send size={14} />
                  <span>✉️ إرسال برودكاست</span>
                </button>
              )}
            </div>

            {/* Tab 1: View all Broadcast Lists */}
            {broadcastTab === 'lists' && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {broadcastLists.map((list) => {
                  const isSelected = selectedBroadcastId === list.id;
                  return (
                    <div 
                      key={list.id} 
                      className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-purple-950/40 border-purple-400/80 ring-1 ring-purple-500/40' 
                          : 'bg-slate-900/80 border-white/10 hover:border-purple-500/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-white text-sm dir-auto">{list.name}</h4>
                          <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {list.members?.length || 0} عميل
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          أنشئت بواسطة: <span className="text-cyan-300 font-bold">{list.createdByName || 'الموظف'}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBroadcastId(list.id);
                            setBroadcastTab('send');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3.5 py-1.5 rounded-xl transition flex items-center gap-1 shadow-md active:scale-95 cursor-pointer"
                        >
                          <Send size={13} />
                          <span>إرسال برودكاست ✉️</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBroadcastId(list.id);
                            setBroadcastTab('members');
                          }}
                          className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
                        >
                          <Users size={13} />
                          <span>الأعضاء ({list.members?.length || 0})</span>
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteBroadcastList(list.id, list.name)}
                            className="bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-xs font-bold px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                            title="حذف هذه القائمة نهائياً"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {broadcastLists.length === 0 && (
                  <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-dashed border-white/10">
                    <Radio className="mx-auto text-purple-400/50 mb-2" size={40} />
                    <h4 className="text-white font-bold text-sm">لا توجد قوائم Broadcast منشأة حالياً</h4>
                    <p className="text-gray-400 text-xs mt-1 mb-4">قم بإنشاء أول قائمة برودكاست جديدة وتحديد العملاء المستهدفين لها</p>
                    <button
                      type="button"
                      onClick={() => setBroadcastTab('create')}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-black px-4 py-2 rounded-xl shadow-lg hover:from-purple-500 hover:to-indigo-500 transition"
                    >
                      ➕ إنشاء قائمة جديدة الآن
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Create New Broadcast List */}
            {broadcastTab === 'create' && (
              <form onSubmit={handleCreateBroadcastList} className="flex-1 flex flex-col overflow-hidden space-y-3">
                <div className="shrink-0">
                  <label className="block text-xs font-bold text-purple-200 mb-1">
                    اسم قائمة الـ Broadcast (باللغة الإنجليزية أو العربية): <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: Broadcast 1, VIP Customers, Website Leads..."
                    value={newBroadcastName}
                    onChange={(e) => setNewBroadcastName(e.target.value)}
                    className="w-full bg-slate-900 text-white border border-purple-500/40 rounded-xl py-2 px-3 text-xs font-bold focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Filter and Selection Header */}
                <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-900/60 p-2.5 rounded-2xl border border-white/10">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="ابحث بالاسم أو الهاتف للتحديد..."
                      value={broadcastSearchCustomer}
                      onChange={(e) => setBroadcastSearchCustomer(e.target.value)}
                      className="w-full bg-black/40 text-white placeholder-gray-400 border border-white/10 rounded-xl py-1.5 pr-8 pl-3 text-xs focus:outline-none focus:border-purple-400"
                    />
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={broadcastCustomerSourceFilter}
                      onChange={(e) => setBroadcastCustomerSourceFilter(e.target.value)}
                      className="bg-slate-900 text-white text-xs border border-white/15 rounded-xl py-1.5 px-2 font-bold cursor-pointer"
                    >
                      <option value="all">جميع المصادر (الموقع + الحملات)</option>
                      <option value="website">🌐 عملاء موقع الويب فقط</option>
                      <option value="campaign">📊 عملاء الحملات (إكسيل) فقط</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        const allFiltered = chats
                          .filter(c => !c.isGroup && !c.isDirect)
                          .filter(c => {
                            if (broadcastCustomerSourceFilter === 'website') return isWebsiteLead(c);
                            if (broadcastCustomerSourceFilter === 'campaign') return !isWebsiteLead(c);
                            return true;
                          })
                          .map(c => c.id);
                        setBroadcastSelectedCustomerIds(allFiltered);
                      }}
                      className="text-[11px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded-xl font-bold hover:bg-cyan-500/30 transition"
                    >
                      تحديد الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastSelectedCustomerIds([])}
                      className="text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-xl font-bold hover:bg-rose-500/30 transition"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>

                {/* Customers Selection Scroll List */}
                <div className="flex-1 overflow-y-auto bg-slate-900/90 rounded-2xl border border-white/10 p-2 space-y-1.5">
                  {chats
                    .filter(c => !c.isGroup && !c.isDirect)
                    .filter(c => {
                      if (broadcastCustomerSourceFilter === 'website') return isWebsiteLead(c);
                      if (broadcastCustomerSourceFilter === 'campaign') return !isWebsiteLead(c);
                      return true;
                    })
                    .filter(c => {
                      if (!broadcastSearchCustomer.trim()) return true;
                      const q = broadcastSearchCustomer.toLowerCase();
                      return (
                        (c.name || '').toLowerCase().includes(q) ||
                        (c.phoneNumber || c.phone || c.id || '').includes(q)
                      );
                    })
                    .map((cust) => {
                      const isSelected = broadcastSelectedCustomerIds.includes(cust.id);
                      return (
                        <div
                          key={cust.id}
                          onClick={() => {
                            if (isSelected) {
                              setBroadcastSelectedCustomerIds(prev => prev.filter(id => id !== cust.id));
                            } else {
                              setBroadcastSelectedCustomerIds(prev => [...prev, cust.id]);
                            }
                          }}
                          className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                            isSelected ? 'bg-purple-950/60 border-purple-400' : 'bg-slate-900 border-white/5 hover:border-purple-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-purple-600 focus:ring-0 cursor-pointer"
                            />
                            <div>
                              <span className="text-xs font-bold text-white block">
                                {cust.name || cust.cardName || 'عميل اتجاه'}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono block">
                                {cust.phoneNumber || cust.phone || cust.id}
                              </span>
                            </div>
                          </div>

                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            isWebsiteLead(cust)
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          }`}>
                            {isWebsiteLead(cust) ? '🌐 موقع الويب' : '📊 عميل حملة (إكسيل)'}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {/* Footer submit buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10 shrink-0">
                  <span className="text-xs text-purple-300 font-bold">
                    تم تحديد ({broadcastSelectedCustomerIds.length}) عميل
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBroadcastTab('lists')}
                      className="px-4 py-2 rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold transition"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={!newBroadcastName.trim() || broadcastSelectedCustomerIds.length === 0}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg disabled:opacity-50 transition active:scale-95 cursor-pointer"
                    >
                      🚀 حفظ وإنشاء قائمة الـ Broadcast
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Tab 3: Manage Members of Selected Broadcast List */}
            {broadcastTab === 'members' && selectedBroadcastId && (() => {
              const currentList = broadcastLists.find(l => l.id === selectedBroadcastId);
              if (!currentList) return null;
              return (
                <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                  <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-2xl border border-white/10 shrink-0">
                    <div>
                      <h4 className="text-sm font-black text-white">{currentList.name}</h4>
                      <p className="text-xs text-gray-400">إجمالي الأعضاء: <span className="text-cyan-300 font-bold">{currentList.members?.length || 0} عميل</span></p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBroadcastId(currentList.id);
                        setBroadcastTab('send');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2 rounded-xl shadow-md transition flex items-center gap-1.5"
                    >
                      <Send size={14} />
                      <span>إرسال برودكاست للقائمة ✉️</span>
                    </button>
                  </div>

                  {/* Members list */}
                  <div className="flex-1 overflow-y-auto bg-slate-900/90 rounded-2xl border border-white/10 p-2 space-y-2">
                    {(currentList.members || []).map((m) => (
                      <div key={m.id} className="p-3 bg-slate-900 rounded-xl border border-white/5 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white block">{m.name || 'عميل اتجاه'}</span>
                          <span className="text-[10px] text-gray-400 font-mono block">{m.phoneNumber || m.phone || m.id}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMemberFromBroadcast(currentList.id, m.id, m.name)}
                          className="bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-[11px] font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          <span>إزالة العميل</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-2 border-t border-white/10 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBroadcastTab('lists')}
                      className="px-4 py-2 rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold transition"
                    >
                      عودة للقوائم
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Tab 4: Send Broadcast Message */}
            {broadcastTab === 'send' && selectedBroadcastId && (() => {
              const currentList = broadcastLists.find(l => l.id === selectedBroadcastId);
              if (!currentList) return null;
              return (
                <form onSubmit={handleSendBroadcastMessage} className="flex-1 flex flex-col overflow-hidden space-y-3">
                  <div className="bg-slate-900/80 p-3 rounded-2xl border border-purple-500/30 flex items-center justify-between shrink-0">
                    <div>
                      <span className="text-[10px] text-purple-300 font-bold block">القائمة المستهدفة للإرسال:</span>
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <span>📢 {currentList.name}</span>
                        <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                          ({currentList.members?.length || 0} عميل مستهدف)
                        </span>
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBroadcastTab('lists')}
                      className="text-xs text-cyan-300 hover:underline font-bold"
                    >
                      تغيير القائمة
                    </button>
                  </div>

                  {/* Message Input Box */}
                  <div className="flex-1 flex flex-col space-y-2">
                    <label className="block text-xs font-bold text-purple-200">
                      نص الرسالة الفردية المستقلة: <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      required={!broadcastAttachment}
                      rows={5}
                      placeholder="اكتب نص الرسالة التي ستصل كرسالة خاصة لكل عميل على حظى دون معرفة أنها برودكاست..."
                      value={broadcastMessageText}
                      onChange={(e) => setBroadcastMessageText(e.target.value)}
                      className="w-full flex-1 bg-slate-900 text-white placeholder-gray-500 border border-purple-500/40 rounded-2xl p-3.5 text-xs font-bold focus:outline-none focus:border-cyan-400 resize-none dir-auto"
                    />

                    {/* File Attachment Input */}
                    <div className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-xl border border-white/10 shrink-0">
                      <Paperclip size={16} className="text-purple-400" />
                      <input
                        type="file"
                        onChange={(e) => setBroadcastAttachment(e.target.files[0] || null)}
                        className="text-xs text-gray-300 file:mr-4 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
                      />
                      {broadcastAttachment && (
                        <span className="text-xs text-emerald-400 font-bold truncate max-w-[200px]">
                          📎 {broadcastAttachment.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Live Sending Progress Indicator */}
                  {isSendingBroadcast && (
                    <div className="bg-purple-950/80 border border-purple-500/50 p-3 rounded-2xl space-y-1.5 shrink-0 animate-pulse">
                      <div className="flex justify-between items-center text-xs font-black text-white">
                        <span>🚀 جاري الإرسال الفردي الحصري...</span>
                        <span className="text-cyan-300 font-mono">
                          {broadcastProgress.current} / {broadcastProgress.total}
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/10">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-cyan-400 h-2 transition-all duration-300"
                          style={{
                            width: `${(broadcastProgress.current / (broadcastProgress.total || 1)) * 100}%`
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-purple-200">
                        جاري إرسال الرسالة إلى: <span className="text-amber-300 font-bold">{broadcastProgress.currentName}</span>
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/10 shrink-0">
                    <button
                      type="button"
                      disabled={isSendingBroadcast}
                      onClick={() => setBroadcastTab('lists')}
                      className="px-4 py-2 rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 text-xs font-bold transition disabled:opacity-50"
                    >
                      إلغاء
                    </button>

                    <button
                      type="submit"
                      disabled={isSendingBroadcast || (!broadcastMessageText.trim() && !broadcastAttachment)}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg disabled:opacity-50 transition active:scale-95 cursor-pointer flex items-center gap-2"
                    >
                      <Send size={15} />
                      <span>{isSendingBroadcast ? 'جاري الإرسال للجميع...' : '🚀 إرسال البرودكاست الآن للجميع'}</span>
                    </button>
                  </div>
                </form>
              );
            })()}

          </div>
        </div>
      )}

      {/* Fullscreen Media Lightbox Modal */}
      {previewMediaModal && (
        <div 
          onClick={() => setPreviewMediaModal(null)}
          className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in dir-rtl"
        >
          {/* Modal Header Bar */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-4xl bg-slate-900 border border-cyan-500/40 rounded-t-2xl p-3 flex items-center justify-between shadow-2xl text-white mb-0"
          >
            <div className="flex items-center gap-2 truncate">
              <FileText size={18} className="text-cyan-400 shrink-0" />
              <span className="text-sm font-bold truncate max-w-md" dir="ltr">{previewMediaModal.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadFile(previewMediaModal.url, previewMediaModal.name)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Download size={14} />
                <span>تنزيل على الجهاز</span>
              </button>
              <button
                onClick={() => window.open(previewMediaModal.url, '_blank')}
                className="bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>فتح في تبويب جديد 🔗</span>
              </button>
              <button
                onClick={() => setPreviewMediaModal(null)}
                className="bg-slate-800 hover:bg-rose-600 text-gray-300 hover:text-white p-1.5 rounded-xl transition cursor-pointer mr-1"
                title="إغلاق المعاينة"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Content Frame */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-4xl bg-slate-950 border-x border-b border-cyan-500/40 rounded-b-2xl p-4 flex items-center justify-center overflow-auto max-h-[82vh] shadow-2xl"
          >
            {previewMediaModal.type === 'image' ? (
              <img 
                src={previewMediaModal.url} 
                alt={previewMediaModal.name} 
                className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
              />
            ) : previewMediaModal.type === 'pdf' ? (
              <iframe 
                src={previewMediaModal.url} 
                title={previewMediaModal.name}
                className="w-full h-[75vh] rounded-xl border border-white/10 bg-white"
              />
            ) : (
              <div className="text-center py-12 text-gray-300">
                <FileText size={48} className="mx-auto text-cyan-400 mb-3 animate-pulse" />
                <p className="text-base font-bold text-white mb-2">{previewMediaModal.name}</p>
                <p className="text-xs text-gray-400 mb-4">يمكنك تنزيل هذا المستند أو فتحه مباشرة في المتصفح</p>
                <button
                  onClick={() => handleDownloadFile(previewMediaModal.url, previewMediaModal.name)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-sm shadow-lg transition"
                >
                  📥 تحميل المستند الآن
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export default function Inbox() {
  return (
    <InboxErrorBoundary>
      <InboxContent />
    </InboxErrorBoundary>
  );
}
