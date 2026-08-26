import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, Clock, ArrowRight, UserPlus, X, Trash2, Edit, Edit3, Shield, Play, Pause, BarChart3, Globe, MessageSquare, Search, FileSpreadsheet, Download, Upload, Share2, FileText, CheckCircle, Calendar, MessageCircle, FilePlus, Tag, Filter, UserCheck2, MessageSquarePlus } from 'lucide-react';
import { auth, db, collection, onSnapshot, setDoc, doc, secondaryAuth, createUserWithEmailAndPassword, deleteDoc, updateDoc, serverTimestamp, arrayUnion, getDoc, writeBatch } from '../firebase';
import { signInWithEmailAndPassword, updatePassword, updateEmail } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

// Error Boundary to catch React runtime crashes and show error instead of white screen
class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Dashboard crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', background: '#1e1b4b', minHeight: '100vh', color: 'white', direction: 'rtl' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 12 }}>حدث خطأ في تحميل لوحة التحكم</h2>
          <p style={{ color: '#a5b4fc', marginBottom: 8, fontSize: 14 }}>تفاصيل الخطأ:</p>
          <pre style={{ background: '#312e81', padding: 16, borderRadius: 8, fontSize: 12, textAlign: 'left', overflowX: 'auto', maxWidth: 700, margin: '0 auto 24px', color: '#fca5a5' }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '12px 32px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', fontSize: 16 }}
          >
            🔄 إعادة تحميل الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const CRM_STATUS_MAP = {
  unassigned: { label: '⏳ في الانتظار', bg: 'bg-gray-100 text-gray-700 border-gray-300' },
  assigned: { label: '📋 تم التوجيه', bg: 'bg-blue-100 text-blue-700 border-blue-300' },
  interested: { label: '🌟 مهتم', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  not_interested: { label: '❌ غير مهتم', bg: 'bg-rose-100 text-rose-800 border-rose-300' },
  no_answer: { label: '📵 لم يرد', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
  lost: { label: '🥀 مفقود', bg: 'bg-red-100 text-red-800 border-red-300' },
  subscribed: { label: '🎉 تم الاشتراك', bg: 'bg-purple-100 text-purple-800 border-purple-300' },
  started_trial: { label: '🚀 بدأ تجربة بالفعل', bg: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
};

const getTimestampMillis = (val) => {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  }
  return 0;
};

const formatDate = (val) => {
  const ms = getTimestampMillis(val);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('ar-EG', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'leads_crm', 'customers' or 'employees'
  const [analyticsDetail, setAnalyticsDetail] = useState(null); // 'assigned', 'unread', 'zero' or null
  const [customerFilter, setCustomerFilter] = useState('all');
  const [crmStatusFilter, setCrmStatusFilter] = useState('all');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [tableSearch, setTableSearch] = useState(''); // per-table search
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = أحدث أولاً, 'asc' = أقدم أولاً
  const tableSectionRef = useRef(null);

  const [customers, setCustomers] = useState([]);
  const [leadsCrm, setLeadsCrm] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [recycleBin, setRecycleBin] = useState([]);
  const [rbFilter, setRbFilter] = useState('all');
  const [templateMessages, setTemplateMessages] = useState([]);
  
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [selectedLeadsCrm, setSelectedLeadsCrm] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedVisitors, setSelectedVisitors] = useState([]);
  const [selectedRecycleItems, setSelectedRecycleItems] = useState([]);
  const [selectedEmpFilter, setSelectedEmpFilter] = useState('all');

  // Lead Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState('file'); // 'file', 'gsheet', 'text'
  const [importRows, setImportRows] = useState([]);
  const [gsheetUrl, setGsheetUrl] = useState('');
  const [rawImportText, setRawImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  // Lead Auto/Manual Distribution State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignMode, setAssignMode] = useState('equal'); // 'equal' or 'single'
  const [assignSourcePool, setAssignSourcePool] = useState('all'); // 'selected', 'unassigned', 'all'
  const [assignEmpUids, setAssignEmpUids] = useState([]);
  const [singleAssignEmpUid, setSingleAssignEmpUid] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Leads CRM Date Filter & Sort Order State
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [leadsSortOrder, setLeadsSortOrder] = useState('desc'); // 'desc' (newest first) or 'asc' (oldest first)

  // Pagination State (20 items per page)
  const ITEMS_PER_PAGE = 20;
  const [currentPageLeads, setCurrentPageLeads] = useState(1);
  const [currentPageCustomers, setCurrentPageCustomers] = useState(1);

  useEffect(() => {
    setCurrentPageLeads(1);
  }, [selectedEmpFilter, crmStatusFilter, dateFromFilter, dateToFilter, tableSearch, leadsSortOrder]);

  useEffect(() => {
    setCurrentPageCustomers(1);
  }, [customerFilter, tableSearch, selectedEmpFilter, sortOrder]);

  // Notes & Status Modal State
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedCustomerForNotes, setSelectedCustomerForNotes] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedStatusForNotes, setSelectedStatusForNotes] = useState('interested');
  const [trialDateForNotes, setTrialDateForNotes] = useState('');
  const [isLeadsAnalysisModalOpen, setIsLeadsAnalysisModalOpen] = useState(false);

  // Assignment Transfer Audit Log Helper
  const createAssignmentLog = (fromName, toName) => {
    const isFromAdmin = !fromName || fromName.includes('الرئيسي') || fromName.includes('الإدارة') || fromName.includes('admin') || fromName.includes('gmail');
    const isToAdmin = !toName || toName.includes('الرئيسي') || toName.includes('الإدارة') || toName.includes('admin') || toName.includes('gmail');
    const cleanFrom = isFromAdmin ? '👑 الإدارة' : fromName;
    const cleanTo = isToAdmin ? '👑 الإدارة' : toName;

    return {
      id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 4),
      from: cleanFrom,
      to: cleanTo,
      assignedBy: '👑 الإدارة',
      assignedAt: new Date().toISOString()
    };
  };

  // Add Employee Modal
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [newEmpUsername, setNewEmpUsername] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpCode, setNewEmpCode] = useState('');
  const [newEmpJobTitle, setNewEmpJobTitle] = useState('Agent');
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [errorAdd, setErrorAdd] = useState('');

  // Edit Employee Modal
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [editEmpPassword, setEditEmpPassword] = useState('');
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpUsername, setEditEmpUsername] = useState('');
  const [editEmpCode, setEditEmpCode] = useState('');
  const [editEmpJobTitle, setEditEmpJobTitle] = useState('Agent');
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState('');

  const openAddEmployeeModal = () => {
    setNewEmpName('');
    setNewEmpCode('');
    setNewEmpUsername('');
    setNewEmpPassword('');
    setNewEmpJobTitle('Agent');
    setErrorAdd('');
    setIsAddEmployeeOpen(true);
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const currentUser = auth.currentUser;
  const adminEmails = ['etegahanalysis@gmail.com', 'mohamed.gamal.work0@gmail.com'];
  const isAdmin = currentUser && adminEmails.includes(currentUser.email?.toLowerCase());
  const currentEmpUser = employees.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
  const isCoordinator = !isAdmin && (currentEmpUser?.jobTitle === 'Coordinator' || currentEmpUser?.jobTitle === 'منسق للإدارة' || currentEmpUser?.role === 'coordinator');

  // Anti-Screenshot & Window Blur Protection for Employees
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);

  useEffect(() => {
    if (isAdmin) return; // Admin has full unrestricted access

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

  React.useEffect(() => {
    document.title = 'CRM WhatsApp Etegah';
    document.dir = 'rtl';
    if (!isAdmin) {
      setActiveTab('leads_crm');
    }
  }, [isAdmin]);

  // Fetch Data
  useEffect(() => {
    const custUnsub = onSnapshot(collection(db, 'بيانات_تسجيل_العملاء'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      data.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setCustomers(data);
    });

    const leadsCrmUnsub = onSnapshot(collection(db, 'leads_crm'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      data.sort((a, b) => {
        const timeA = getTimestampMillis(a.updatedAt) || getTimestampMillis(a.createdAt);
        const timeB = getTimestampMillis(b.updatedAt) || getTimestampMillis(b.createdAt);
        return timeB - timeA;
      });
      setLeadsCrm(data);
    }, (error) => {
      console.error("Error fetching leads_crm:", error);
      toast.error("خطأ في جلب بيانات Leads CRM: " + error.message);
    });

    const empUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      
      // إضافة حساب الإدارة يدوياً لضمان ظهوره دائماً كأدمن في القائمة المنسدلة للتعيين
      if (currentUser && !emps.find(e => e.uid === currentUser.uid)) {
        emps.unshift({
          uid: currentUser.uid,
          id: currentUser.uid,
          name: 'الإدارة',
          email: currentUser.email,
          role: 'admin'
        });
      }
      setEmployees(emps);
    }, (error) => {
      console.error("Error fetching employees:", error);
      toast.error("خطأ في جلب بيانات الموظفين: " + error.message);
    });

    const visUnsub = onSnapshot(collection(db, 'visitor_customers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      data.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
      setVisitors(data);
    }, (error) => {
      console.error('Error fetching visitor_customers:', error);
    });

    const rbUnsub = onSnapshot(collection(db, 'recycle_bin'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      data.sort((a, b) => getTimestampMillis(b.deletedAt) - getTimestampMillis(a.deletedAt));
      setRecycleBin(data);
    }, (error) => {
      console.error('Error fetching recycle_bin:', error);
    });

    // Fetch Template Messages for Campaign Analytics
    // Filter messages that start with "[قالب"
    const templatesUnsub = onSnapshot(collection(db, 'رسائل_الموظفين_للعملاء'), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        const msg = doc.data();
        if (msg.isTemplate || (msg.text && msg.text.includes('[قالب'))) {
          data.push({ id: doc.id, ...msg });
        }
      });
      setTemplateMessages(data);
    });

    return () => {
      custUnsub();
      leadsCrmUnsub();
      empUnsub();
      visUnsub();
      rbUnsub();
      templatesUnsub();
    };
  }, []);

  const scrollToTable = () => {
    setTimeout(() => {
      if (tableSectionRef.current) {
        tableSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCardClick = (e, type, filter) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setSelectedEmpFilter('all');
    if (activeTab === type && customerFilter === filter) {
      setActiveTab('analytics');
    } else {
      setActiveTab(type);
      setCustomerFilter(filter);
      setTableSearch('');
      scrollToTable();
    }
  };

  const unassignedCount = customers.filter(c => c.status === 'unassigned').length;
  const whatsappVisitorsCount = visitors.length + customers.filter(c => c.addedBy === 'WhatsApp Webhook').length;

  // --- LEAD IMPORT & EXCEL / GSHEETS / TEXT PARSER HANDLERS ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        // Helper to extract ONLY the clean customer name (removes english usernames, statuses, dates, call log phrases, symbols)
        const extractCleanCustomerName = (raw) => {
          if (!raw || typeof raw !== 'string') return 'عميل جديد';
          let text = String(raw).trim();
          if (!text || text === 'null' || text === 'undefined') return 'عميل جديد';
          
          // 1. Remove English keywords and status labels
          text = text.replace(/\b(Lost Lead|Hot Lead|Cold Lead|Contacted|None|Assigned To|Lead Status|First Name|Last Name|Primary Phone|Mobile Phone|Phone|Email|Notes|Description|vtiger|crm)\b/gi, ' ');
          
          // 2. Remove English words / usernames / code tokens (e.g. Ahmed.Abbas, faten.fayez, Ssdidpxo, didpxo)
          text = text.replace(/[a-zA-Z0-9_.-]*[a-zA-Z][a-zA-Z0-9_.-]*/g, ' ');
          
          // 3. Remove date patterns
          text = text.replace(/(?:\d{1,4}[-/.])?\d{1,2}[-/.]\d{2,4}/g, ' ');
          text = text.replace(/\b(202[0-9]|201[0-9]|203[0-9])\b/g, ' ');
          text = text.replace(/o-\d{2}-\d{2}/gi, ' ');
          
          // 4. Remove common call log notes, phone operator phrases, junk Arabic tags
          const callJunkPhrases = [
            /مش عارف التداول/g,
            /مش عارف/g,
            /قفل السكه/g,
            /قفلت السكه/g,
            /قفل الخط/g,
            /قفلت الخط/g,
            /وانا بشرحله/g,
            /بشرحله/g,
            /شكرا و?قفلت?/g,
            /شكراً و?قفلت?/g,
            /شكرا/g,
            /شكراً/g,
            /غير مهتم/g,
            /مش مهتم/g,
            /رصد/g,
            /لا يرد/g,
            /لم يرد/g,
            /مغلق/g,
            /غير متاح/g,
            /الرقم غير صحيح/g,
            /مستخرج من نص/g,
            /عميل جديد/g
          ];
          for (const phrase of callJunkPhrases) {
            text = text.replace(phrase, ' ');
          }
          
          // 5. Remove unwanted punctuation, symbols, brackets, dashes
          text = text.replace(/[\[\]\(\)\{\}\<\>\-\_\:\;\,\.\|\*\#\@\+\=\\\/\?\!\~\"\']/g, ' ');
          
          // 6. Collapse multiple spaces and trim
          text = text.replace(/\s+/g, ' ').trim();
          
          if (!text || text.length < 2 || /^[\d\s]+$/.test(text)) {
            return 'عميل جديد';
          }
          return text;
        };

        const parsed = data.map((row) => {
          // vtiger columns: First Name, Last Name, Lead Status, Primary Phone, Mobile Phone, Assigned To
          const firstName = row['First Name'] || row['الاسم الاول'] || '';
          const lastName = row['Last Name'] || row['اسم العائله'] || '';
          let name = '';
          if (firstName || lastName) {
            name = extractCleanCustomerName(`${firstName} ${lastName}`);
          } else {
            name = extractCleanCustomerName(row['الاسم'] || row['اسم العميل'] || row['Name'] || row['name'] || String(Object.values(row)[0] || ''));
          }
          // vtiger primary phone
          const phone = row['Primary Phone'] || row['Mobile Phone'] || row['الهاتف'] || row['الجوال'] || row['الرقم'] || row['Phone'] || row['phone'] || row['Mobile'] || String(Object.values(row)[1] || '') || '';
          const email = row['Email'] || row['الايميل'] || row['البريد'] || row['email'] || '';
          const notes = row['ملاحظات'] || row['Notes'] || row['notes'] || '';
          return { name: name || 'عميل جديد', phone: String(phone).trim(), email: String(email).trim(), notes: String(notes).trim() };
        }).filter(item => item.phone || item.name);

        setImportRows(parsed);
        toast.success(`تم قراءة ${parsed.length} عميل من الملف`);
      } catch (err) {
        console.error(err);
        toast.error('حدث خطأ في قراءة ملف Excel');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Global helper for clean customer name extraction
  const extractCleanCustomerName = (raw) => {
    if (!raw || typeof raw !== 'string') return 'عميل جديد';
    let text = String(raw).trim();
    if (!text || text === 'null' || text === 'undefined') return 'عميل جديد';
    
    // 1. Remove English keywords and status labels
    text = text.replace(/\b(Lost Lead|Hot Lead|Cold Lead|Contacted|None|Assigned To|Lead Status|First Name|Last Name|Primary Phone|Mobile Phone|Phone|Email|Notes|Description|vtiger|crm)\b/gi, ' ');
    
    // 2. Remove English words / usernames / code tokens (e.g. Ahmed.Abbas, faten.fayez, Ssdidpxo, didpxo)
    text = text.replace(/[a-zA-Z0-9_.-]*[a-zA-Z][a-zA-Z0-9_.-]*/g, ' ');
    
    // 3. Remove date patterns
    text = text.replace(/(?:\d{1,4}[-/.])?\d{1,2}[-/.]\d{2,4}/g, ' ');
    text = text.replace(/\b(202[0-9]|201[0-9]|203[0-9])\b/g, ' ');
    text = text.replace(/o-\d{2}-\d{2}/gi, ' ');
    
    // 4. Remove common call log notes, phone operator phrases, junk Arabic tags
    const callJunkPhrases = [
      /مش عارف التداول/g,
      /مش عارف/g,
      /قفل السكه/g,
      /قفلت السكه/g,
      /قفل الخط/g,
      /قفلت الخط/g,
      /وانا بشرحله/g,
      /بشرحله/g,
      /شكرا و?قفلت?/g,
      /شكراً و?قفلت?/g,
      /شكرا/g,
      /شكراً/g,
      /غير مهتم/g,
      /مش مهتم/g,
      /رصد/g,
      /لا يرد/g,
      /لم يرد/g,
      /مغلق/g,
      /غير متاح/g,
      /الرقم غير صحيح/g,
      /مستخرج من نص/g,
      /عميل جديد/g
    ];
    for (const phrase of callJunkPhrases) {
      text = text.replace(phrase, ' ');
    }
    
    // 5. Remove unwanted punctuation, symbols, brackets, dashes
    text = text.replace(/[\[\]\(\)\{\}\<\>\-\_\:\;\,\.\|\*\#\@\+\=\\\/\?\!\~\"\']/g, ' ');
    
    // 6. Collapse multiple spaces and trim
    text = text.replace(/\s+/g, ' ').trim();
    
    if (!text || text.length < 2 || /^[\d\s]+$/.test(text)) {
      return 'عميل جديد';
    }
    return text;
  };

  const handleGsheetImport = async () => {
    if (!gsheetUrl.trim()) {
      toast.error('يرجى إدخال رابط Google Sheet');
      return;
    }
    setImportLoading(true);
    try {
      let csvUrl = gsheetUrl.trim();
      if (csvUrl.includes('/edit')) {
        csvUrl = csvUrl.replace(/\/edit.*$/, '/export?format=csv');
      } else if (!csvUrl.includes('/export?format=csv')) {
        csvUrl = csvUrl.replace(/\/pubhtml.*$/, '/pub?output=csv');
      }

      const res = await fetch(csvUrl);
      const csvText = await res.text();
      const wb = XLSX.read(csvText, { type: 'string' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const parsed = data.map((row) => {
          const firstName = row['First Name'] || row['الاسم الاول'] || '';
          const lastName = row['Last Name'] || row['اسم العائله'] || '';
          let name = '';
          if (firstName || lastName) {
            name = extractCleanCustomerName(`${firstName} ${lastName}`);
          } else {
            name = extractCleanCustomerName(row['الاسم'] || row['اسم العميل'] || row['Name'] || row['name'] || String(Object.values(row)[0] || ''));
          }
          const phone = row['Primary Phone'] || row['Mobile Phone'] || row['الهاتف'] || row['الجوال'] || row['الرقم'] || row['Phone'] || row['phone'] || String(Object.values(row)[1] || '') || '';
          const email = row['Email'] || row['الايميل'] || row['email'] || '';
          const notes = row['ملاحظات'] || row['Notes'] || '';
          return { name: name || 'عميل جديد', phone: String(phone).trim(), email: String(email).trim(), notes: String(notes).trim() };
        }).filter(item => item.phone || item.name);

      setImportRows(parsed);
      toast.success(`تم جلب ${parsed.length} عميل من Google Sheet`);
    } catch (err) {
      console.error(err);
      toast.error('فشل جلب البيانات من Google Sheet. يرجى التأكد من أن الشيت متاح للعموم (Public).');
    } finally {
      setImportLoading(false);
    }
  };

  const handleTextExtract = () => {
    if (!rawImportText.trim()) return;
    const lines = rawImportText.split('\n');
    const parsed = [];

    lines.forEach(line => {
      const text = line.trim();
      if (!text) return;

      const phoneMatch = text.match(/(?:\+?\d{1,4}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/);
      if (phoneMatch) {
        const rawPhone = phoneMatch[0].replace(/[\s\-\(\)]/g, '');
        const rawNamePart = text.replace(phoneMatch[0], '').replace(/[,\t:;]/g, '').trim();
        const cleanName = extractCleanCustomerName(rawNamePart);
        parsed.push({
          name: cleanName || 'عميل جديد',
          phone: rawPhone,
          email: '',
          notes: text
        });
      }
    });

    setImportRows(parsed);
    toast.success(`تم استخراج ${parsed.length} عميل من النص`);
  };

  // Ultra-fast batch clean junk, notes, dates, and usernames from all stored lead names
  const handleCleanLeadNames = async () => {
    if (!leadsCrm || leadsCrm.length === 0) {
      toast.error('لا يوجد عملاء لتنظيف أسمائهم حالياً');
      return;
    }
    if (!window.confirm(`سيتم فحص ${leadsCrm.length} سجل وحذف أي نصوص زائدة أو تواريخ أو ملاحظات مدمجة مع أسماء العملاء وإبقاء الاسم النظيف فقط. هل تريد المتابعة؟`)) return;
    
    const toastId = toast.loading(`جاري فحص وتنظيف ${leadsCrm.length} عميل...`);
    let fixed = 0;
    try {
      // Find all leads that need cleaning
      const toUpdate = [];
      for (const lead of leadsCrm) {
        const rawName = lead.name || '';
        const cleaned = extractCleanCustomerName(rawName);
        const shouldClearLastMsg = lead.lastMessage === 'تم استيراد الداتا في Leads CRM' || lead.lastMessage?.includes('استيراد الداتا');
        
        if (cleaned !== rawName || shouldClearLastMsg) {
          toUpdate.push({ 
            id: lead.id, 
            cleanedName: cleaned,
            clearLastMsg: shouldClearLastMsg
          });
        }
      }

      if (toUpdate.length === 0) {
        toast.success('جميع أسماء وبيانات العملاء نظيفة بالفعل ولا تحتاج لتعديل! ✨', { id: toastId });
        return;
      }

      // Execute in Firestore batches of 400
      const BATCH_SIZE = 400;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const chunk = toUpdate.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const item of chunk) {
          const leadRef = doc(db, 'leads_crm', item.id);
          const updateData = {
            name: item.cleanedName,
            updatedAt: serverTimestamp()
          };
          if (item.clearLastMsg) {
            updateData.lastMessage = '';
          }
          batch.update(leadRef, updateData);
        }
        await batch.commit();
        fixed += chunk.length;
        toast.loading(`جاري الحفظ السريع... (${fixed} / ${toUpdate.length})`, { id: toastId });
      }

      toast.success(`✅ تم تنظيف أسماء وبيانات ${fixed} عميل بنجاح تام!`, { id: toastId, duration: 5000 });
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تنظيف الأسماء: ' + err.message, { id: toastId });
    }
  };

  const handleSaveImportedLeads = async () => {
    if (importRows.length === 0) return;
    setImportLoading(true);
    try {
      let savedCount = 0;
      for (const item of importRows) {
        let cleanPhone = item.phone.replace(/[^0-9+]/g, '');
        if (!cleanPhone.startsWith('+')) cleanPhone = `+${cleanPhone}`;

        const crmDocId = cleanPhone.replace(/[^0-9]/g, '');
        const crmRef = doc(db, 'leads_crm', crmDocId);
        const crmSnap = await getDoc(crmRef);

        if (!crmSnap.exists()) {
          await setDoc(crmRef, {
            phoneNumber: cleanPhone,
            name: item.name || 'عميل جديد',
            email: item.email || '',
            notes: item.notes || '',
            source: importTab === 'gsheet' ? 'gsheet' : importTab === 'text' ? 'pdf_text' : 'excel_import',
            assignedSender: 'campaigns',
            status: 'unassigned',
            crmStatus: 'unassigned',
            addedBy: currentUser?.email || 'admin',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: 'تم استيراد الداتا في Leads CRM',
            unread: 0
          });
          savedCount++;
        }
      }
      const skippedCount = importRows.length - savedCount;
      if (skippedCount > 0) {
        toast.success(`تم استيراد وحفظ ${savedCount} عميل جديد (وتخطي ${skippedCount} عميل مكرر مسبقاً في Leads CRM)`);
      } else {
        toast.success(`تم استيراد وحفظ ${savedCount} عميل جديد في قسم Leads CRM المنفصل`);
      }
      setIsImportModalOpen(false);
      setImportRows([]);
      setGsheetUrl('');
      setRawImportText('');
      setActiveTab('leads_crm');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ العملاء في Leads CRM');
    } finally {
      setImportLoading(false);
    }
  };

  // --- LEAD DISTRIBUTION & AUTO-ASSIGNMENT HANDLERS (Leads CRM) ---
  const handleExecuteAssignment = async () => {
    let targetLeads = [];
    if (assignSourcePool === 'selected' && selectedLeadsCrm.length > 0) {
      targetLeads = leadsCrm.filter(c => selectedLeadsCrm.includes(c.id));
    } else if (assignSourcePool === 'unassigned') {
      targetLeads = leadsCrm.filter(c => c.status === 'unassigned' || !c.assignedTo);
    } else {
      targetLeads = [...leadsCrm];
    }

    if (targetLeads.length === 0) {
      toast.error('لا يوجد عملاء في هذه الفئة المحددة للتوزيع في Leads CRM');
      return;
    }

    setAssignLoading(true);
    try {
      if (assignMode === 'single') {
        const emp = employees.find(e => e.uid === singleAssignEmpUid);
        if (!emp) {
          toast.error('يرجى اختيار الموظف');
          setAssignLoading(false);
          return;
        }
        for (const lead of targetLeads) {
          const prevEmpName = employees.find(e => e.uid === lead.assignedToUid || e.email === lead.assignedTo)?.name || (lead.assignedTo === 'admin' || lead.assignedTo === 'الإدارة' ? '👑 الإدارة' : '👑 الإدارة');
          const targetEmpName = emp.role === 'admin' ? `👑 الإدارة (${emp.name})` : `👤 ${emp.name}`;
          const logObj = createAssignmentLog(prevEmpName, targetEmpName);

          await updateDoc(doc(db, 'leads_crm', lead.id), {
            assignedTo: emp.email,
            assignedToUid: emp.uid,
            assignedAt: serverTimestamp(),
            status: 'assigned',
            updatedAt: serverTimestamp(),
            assignmentHistory: arrayUnion(logObj)
          });
        }
        toast.success(`تم تعيين ${targetLeads.length} عميل إلى الموظف ${emp.name}`);
      } else {
        const activeEmps = employees.filter(e => assignEmpUids.includes(e.uid));
        if (activeEmps.length === 0) {
          toast.error('يرجى اختيار موظف واحد على الأقل للتوزيع');
          setAssignLoading(false);
          return;
        }

        for (let i = 0; i < targetLeads.length; i++) {
          const lead = targetLeads[i];
          const emp = activeEmps[i % activeEmps.length];
          const prevEmpName = employees.find(e => e.uid === lead.assignedToUid || e.email === lead.assignedTo)?.name || (lead.assignedTo === 'admin' || lead.assignedTo === 'الإدارة' ? '👑 الإدارة' : '👑 الإدارة');
          const targetEmpName = emp.role === 'admin' ? `👑 الإدارة (${emp.name})` : `👤 ${emp.name}`;
          const logObj = createAssignmentLog(prevEmpName, targetEmpName);

          await updateDoc(doc(db, 'leads_crm', lead.id), {
            assignedTo: emp.email,
            assignedToUid: emp.uid,
            assignedAt: serverTimestamp(),
            status: 'assigned',
            updatedAt: serverTimestamp(),
            assignmentHistory: arrayUnion(logObj)
          });
        }
        toast.success(`تم توزيع ${targetLeads.length} عميل بالتساوي على ${activeEmps.length} موظف في Leads CRM`);
      }

      setIsAssignModalOpen(false);
      setSelectedLeadsCrm([]);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء توزيع العملاء');
    } finally {
      setAssignLoading(false);
    }
  };

  // --- WHATSAPP DIRECT ACTION & CRM STATUS HANDLERS ---
  const toggleLeadCrmSelection = (id) => {
    if (selectedLeadsCrm.includes(id)) {
      setSelectedLeadsCrm(selectedLeadsCrm.filter(item => item !== id));
    } else {
      setSelectedLeadsCrm([...selectedLeadsCrm, id]);
    }
  };

  const toggleAllLeadsCrm = (pageItems) => {
    const items = Array.isArray(pageItems) ? pageItems : leadsCrm;
    const itemIds = items.map(item => item.id);
    const isAllSelected = itemIds.length > 0 && itemIds.every(id => selectedLeadsCrm.includes(id));
    if (isAllSelected) {
      setSelectedLeadsCrm(selectedLeadsCrm.filter(id => !itemIds.includes(id)));
    } else {
      setSelectedLeadsCrm([...new Set([...selectedLeadsCrm, ...itemIds])]);
    }
  };

  const handleDeleteSingleLeadCrm = async (lead) => {
    if (!window.confirm(`هل أنت متأكد من حذف العميل "${lead.name}" من قسم Leads CRM؟`)) return;
    try {
      await deleteDoc(doc(db, 'leads_crm', lead.id));
      toast.success('تم حذف العميل بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const deleteSelectedLeadsCrm = async () => {
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedLeadsCrm.length} عميل محدد من قسم Leads CRM؟`)) return;
    try {
      for (const id of selectedLeadsCrm) {
        await deleteDoc(doc(db, 'leads_crm', id));
      }
      toast.success('تم حذف العملاء المحددين بنجاح');
      setSelectedLeadsCrm([]);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const handleTransferToWhatsapp = async (customer) => {
    try {
      let phoneNum = customer.phoneNumber.replace(/[^0-9]/g, '');
      const waUrl = `https://wa.me/${phoneNum}?text=${encodeURIComponent('مرحباً ' + customer.name + '، متواجدين لخدمتك من منصة اتجاه 📈')}`;
      
      window.open(waUrl, '_blank');

      const noteObj = {
        id: Date.now().toString(),
        text: '🟢 تم فتح محادثة الواتساب المباشرة وتحويل العميل',
        author: currentUser?.email || 'الأدمن',
        createdAt: new Date().toISOString()
      };

      const targetColl = leadsCrm.some(l => l.id === customer.id) ? 'leads_crm' : 'بيانات_تسجيل_العملاء';
      await updateDoc(doc(db, targetColl, customer.id), {
        transferredToWhatsapp: true,
        transferredAt: serverTimestamp(),
        notesHistory: arrayUnion(noteObj),
        updatedAt: serverTimestamp()
      });

      toast.success('تم فتح الواتساب وتعيين العميل كمُحول بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ عند فتح الواتساب');
    }
  };

  const handleUpdateCustomerCrmStatus = async (customerId, newStatus) => {
    try {
      await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', customerId), {
        crmStatus: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success('تم تحديث حالة العميل');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ في تحديث الحالة');
    }
  };

  // Editing Lead Name State (Admin & Employee)
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [editingLeadName, setEditingLeadName] = useState('');
  const [modalCustomerName, setModalCustomerName] = useState('');

  const handleSaveLeadName = async (leadId) => {
    if (!editingLeadName.trim()) {
      toast.error('يرجى إدخال اسم العميل');
      return;
    }
    try {
      const isLead = leadsCrm.some(l => l.id === leadId);
      const targetColl = isLead ? 'leads_crm' : 'بيانات_تسجيل_العملاء';
      await updateDoc(doc(db, targetColl, leadId), {
        name: editingLeadName.trim(),
        updatedAt: serverTimestamp()
      });
      toast.success('تم تعديل اسم العميل بنجاح');
      setEditingLeadId(null);
      setEditingLeadName('');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تعديل اسم العميل');
    }
  };

  const handleOpenNotesModal = (customer, isLeadCrm = false) => {
    setSelectedCustomerForNotes({ ...customer, isLeadCrm });
    setSelectedStatusForNotes(customer.crmStatus || 'unassigned');
    setTrialDateForNotes(customer.trialStartDate || '');
    setModalCustomerName(customer.name || '');
    setNewNoteText('');
    setIsNotesModalOpen(true);
  };

  const handleSaveCustomerNotesAndStatus = async () => {
    if (!selectedCustomerForNotes) return;
    try {
      const updatePayload = {
        crmStatus: selectedStatusForNotes,
        updatedAt: serverTimestamp()
      };

      if (modalCustomerName.trim() && modalCustomerName.trim() !== selectedCustomerForNotes.name) {
        updatePayload.name = modalCustomerName.trim();
      }

      if (selectedStatusForNotes === 'started_trial' && trialDateForNotes) {
        updatePayload.trialStartDate = trialDateForNotes;
      }

      if (newNoteText.trim()) {
        const isCurrentUserAdmin = isAdmin || adminEmails.includes(currentUser?.email?.toLowerCase());
        const authorName = isCurrentUserAdmin ? '👑 الإدارة' : (employees.find(e => e.email === currentUser?.email)?.name || currentUser?.email?.split('@')[0] || 'الموظف');
        const noteObj = {
          id: Date.now().toString(),
          text: newNoteText.trim(),
          author: authorName,
          createdAt: new Date().toISOString()
        };
        updatePayload.notesHistory = arrayUnion(noteObj);
      }

      const targetColl = (selectedCustomerForNotes.isLeadCrm || leadsCrm.some(l => l.id === selectedCustomerForNotes.id)) ? 'leads_crm' : 'بيانات_تسجيل_العملاء';
      await updateDoc(doc(db, targetColl, selectedCustomerForNotes.id), updatePayload);
      toast.success('تم حفظ التغييرات والاسم والملاحظات بنجاح');
      setIsNotesModalOpen(false);
      setNewNoteText('');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ التغييرات');
    }
  };

  const handleDeleteSingleNote = async (noteItem, noteIndex) => {
    if (!isAdmin || !selectedCustomerForNotes) return;
    if (!window.confirm('هل أنت متأكد من مسح هذه الملاحظة نهائياً من التقرير؟')) return;
    try {
      const currentNotes = selectedCustomerForNotes.notesHistory || [];
      const updatedNotes = currentNotes.filter((n, idx) => (n.id ? n.id !== noteItem.id : idx !== noteIndex));
      const targetColl = (selectedCustomerForNotes.isLeadCrm || leadsCrm.some(l => l.id === selectedCustomerForNotes.id)) ? 'leads_crm' : 'بيانات_تسجيل_العملاء';
      await updateDoc(doc(db, targetColl, selectedCustomerForNotes.id), {
        notesHistory: updatedNotes,
        updatedAt: serverTimestamp()
      });
      setSelectedCustomerForNotes(prev => ({ ...prev, notesHistory: updatedNotes }));
      toast.success('تم مسح الملاحظة بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('خطأ في مسح الملاحظة');
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setLoadingAdd(true);
    setErrorAdd('');
    try {
      const safeUsername = newEmpUsername.trim().replace(/\s+/g, '');
      const emailToCreate = newEmpUsername.includes('@') ? newEmpUsername.trim() : `${safeUsername}@etegah.com`;
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToCreate, newEmpPassword);
      const user = userCredential.user;
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        username: newEmpUsername,
        password: newEmpPassword,
        name: newEmpName || newEmpUsername,
        empCode: newEmpCode || '',
        jobTitle: newEmpJobTitle || 'Agent',
        role: 'employee',
        isActive: true,
        createdAt: new Date()
      });
      secondaryAuth.signOut();
      setIsAddEmployeeOpen(false);
      setNewEmpUsername('');
      setNewEmpPassword('');
      setNewEmpName('');
      setNewEmpCode('');
      setNewEmpJobTitle('Agent');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-email') {
        setErrorAdd('اسم المستخدم غير صالح. يرجى استخدام أحرف إنجليزية وأرقام فقط بدون مسافات (مثال: yousef123).');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorAdd('اسم المستخدم هذا مستخدم مسبقاً لموظف آخر.');
      } else if (err.code === 'auth/weak-password') {
        setErrorAdd('كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف على الأقل.');
      } else {
        setErrorAdd('فشل إضافة الموظف. تأكد من صحة البيانات.');
      }
    } finally {
      setLoadingAdd(false);
    }
  };

  const handleEditEmployee = async (e) => {
    e.preventDefault();
    if (!editEmp) return;
    setLoadingEdit(true);
    setErrorEdit('');
    try {
      const emailToCreate = editEmpUsername.includes('@') ? editEmpUsername.trim() : `${editEmpUsername.trim()}@etegah.com`;

      // 1. Update Firestore document directly (Always succeeds!)
      await setDoc(doc(db, 'users', editEmp.uid), { 
        password: editEmpPassword,
        name: editEmpName,
        username: editEmpUsername,
        email: emailToCreate,
        empCode: editEmpCode || '',
        jobTitle: editEmpJobTitle || 'Agent'
      }, { merge: true });

      // 2. Try updating Auth password / email in background if secondary auth credentials exist
      try {
        if (editEmp.email && editEmp.password) {
          await signInWithEmailAndPassword(secondaryAuth, editEmp.email, editEmp.password);
          if (editEmpPassword !== editEmp.password && editEmpPassword.length >= 6) {
            await updatePassword(secondaryAuth.currentUser, editEmpPassword);
          }
          if (emailToCreate !== editEmp.email) {
            await updateEmail(secondaryAuth.currentUser, emailToCreate);
          }
          secondaryAuth.signOut();
        }
      } catch (authErr) {
        console.warn('Secondary auth update skipped/failed, but Firestore profile updated successfully:', authErr);
      }
      
      setIsEditEmployeeOpen(false);
      setEditEmp(null);
      setEditEmpPassword('');
      setEditEmpName('');
      setEditEmpUsername('');
      setEditEmpCode('');
      setEditEmpJobTitle('Agent');
    } catch (err) {
      console.error(err);
      setErrorEdit('حدث خطأ أثناء حفظ التعديلات. يرجى إعادة المحاولة.');
    } finally {
      setLoadingEdit(false);
    }
  };

  // Bulk Actions
  const toggleCustomerSelection = (id) => {
    setSelectedCustomers(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
  };
  const toggleAllCustomers = (pageItems) => {
    const items = Array.isArray(pageItems) ? pageItems : customers;
    const itemIds = items.map(item => item.id);
    const isAllSelected = itemIds.length > 0 && itemIds.every(id => selectedCustomers.includes(id));
    if (isAllSelected) {
      setSelectedCustomers(selectedCustomers.filter(id => !itemIds.includes(id)));
    } else {
      setSelectedCustomers([...new Set([...selectedCustomers, ...itemIds])]);
    }
  };
  const deleteSelectedCustomers = async () => {
    if (!window.confirm(`هل أنت متأكد من نقل ${selectedCustomers.length} عميل إلى سلة المهملات؟`)) return;
    for (const id of selectedCustomers) {
      const customer = customers.find(c => c.id === id);
      if (customer) {
        await setDoc(doc(db, 'recycle_bin', id), {
          ...customer,
          originalCollection: 'بيانات_تسجيل_العملاء',
          type: 'customer',
          deletedAt: serverTimestamp()
        });
      }
      await deleteDoc(doc(db, 'بيانات_تسجيل_العملاء', id));
    }
    setSelectedCustomers([]);
  };

  const toggleEmployeeSelection = (id) => {
    setSelectedEmployees(prev => prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]);
  };
  const toggleAllEmployees = () => {
    const emps = employees.filter(e => e.role !== 'admin');
    if (selectedEmployees.length === emps.length && emps.length > 0) setSelectedEmployees([]);
    else setSelectedEmployees(emps.map(e => e.id));
  };
  const deleteSelectedEmployees = async () => {
    if (!window.confirm(`هل أنت متأكد من نقل ${selectedEmployees.length} موظف إلى سلة المهملات؟`)) return;
    for (const id of selectedEmployees) {
      const emp = employees.find(e => e.id === id);
      if (emp) {
        await setDoc(doc(db, 'recycle_bin', id), {
          ...emp,
          originalCollection: 'users',
          type: 'employee',
          deletedAt: serverTimestamp()
        });
      }
      await deleteDoc(doc(db, 'users', id));
    }
    setSelectedEmployees([]);
  };

  const toggleEmployeeActive = async (emp) => {
    const newStatus = emp.isActive === false ? true : false;
    if (!newStatus && !window.confirm(`هل أنت متأكد من إيقاف الموظف ${emp.name} عن العمل؟ سيتم طرده فوراً ولن يتمكن من الدخول.`)) return;
    await setDoc(doc(db, 'users', emp.uid), { isActive: newStatus }, { merge: true });
  };

  const toggleVisitorSelection = (id) => {
    setSelectedVisitors(prev => prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]);
  };
  const toggleAllVisitors = () => {
    if (selectedVisitors.length === visitors.length && visitors.length > 0) setSelectedVisitors([]);
    else setSelectedVisitors(visitors.map(v => v.id));
  };
  const deleteSelectedVisitors = async () => {
    if (!window.confirm(`هل أنت متأكد من نقل ${selectedVisitors.length} زائر إلى سلة المهملات؟`)) return;
    for (const id of selectedVisitors) {
      const visitor = visitors.find(v => v.id === id);
      const whatsappCustomer = customers.find(c => c.id === id && c.addedBy === 'WhatsApp Webhook');
      
      if (visitor) {
        await setDoc(doc(db, 'recycle_bin', id), {
          ...visitor,
          originalCollection: 'visitor_customers',
          type: 'visitor',
          deletedAt: serverTimestamp()
        });
        await deleteDoc(doc(db, 'visitor_customers', id));
      } else if (whatsappCustomer) {
        await setDoc(doc(db, 'recycle_bin', id), {
          ...whatsappCustomer,
          originalCollection: 'بيانات_تسجيل_العملاء',
          type: 'customer',
          deletedAt: serverTimestamp()
        });
        await deleteDoc(doc(db, 'بيانات_تسجيل_العملاء', id));
      }
    }
    setSelectedVisitors([]);
  };

  const handleDeleteSingleVisitor = async (item) => {
    if (!window.confirm(`هل أنت متأكد من مسح الزائر (${item.name || item.phone}) ونقله إلى سلة المهملات؟`)) return;
    try {
      if (item.source === 'موقع الويب') {
        await setDoc(doc(db, 'recycle_bin', item.id), {
          ...item._raw,
          originalCollection: 'visitor_customers',
          type: 'visitor',
          deletedAt: serverTimestamp()
        });
        await deleteDoc(doc(db, 'visitor_customers', item.id));
      } else {
        await setDoc(doc(db, 'recycle_bin', item.id), {
          ...item._raw,
          originalCollection: 'بيانات_تسجيل_العملاء',
          type: 'customer',
          deletedAt: serverTimestamp()
        });
        await deleteDoc(doc(db, 'بيانات_تسجيل_العملاء', item.id));
      }
      toast.success('تم نقل الزائر إلى سلة المهملات بنجاح');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء المسح');
    }
  };

  const handleDeleteSingleCustomer = async (cust) => {
    if (!window.confirm(`هل أنت متأكد من مسح العميل (${cust.name || cust.phoneNumber}) ونقله إلى سلة المهملات؟`)) return;
    try {
      await setDoc(doc(db, 'recycle_bin', cust.id), {
        ...cust,
        originalCollection: 'بيانات_تسجيل_العملاء',
        type: 'customer',
        deletedAt: serverTimestamp()
      });
      await deleteDoc(doc(db, 'بيانات_تسجيل_العملاء', cust.id));
      toast.success('تم نقل العميل إلى سلة المهملات بنجاح');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء المسح');
    }
  };

  const handleDeleteSingleEmployee = async (emp) => {
    if (!window.confirm(`هل أنت متأكد من مسح الموظف (${emp.name}) ونقله إلى سلة المهملات؟`)) return;
    try {
      await setDoc(doc(db, 'recycle_bin', emp.id), {
        ...emp,
        originalCollection: 'users',
        type: 'employee',
        deletedAt: serverTimestamp()
      });
      await deleteDoc(doc(db, 'users', emp.id));
      toast.success('تم نقل الموظف إلى سلة المهملات بنجاح');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء مسح الموظف');
    }
  };

  const handleRestore = async (item) => {
    try {
      const { originalCollection, type, deletedAt, id, ...restData } = item;
      await setDoc(doc(db, originalCollection, item.id), restData);
      await deleteDoc(doc(db, 'recycle_bin', item.id));
    } catch (e) { console.error(e); }
  };

  const handleDeleteForever = async (id) => {
    if(window.confirm('هل أنت متأكد من الحذف النهائي للأبد؟ لا يمكن التراجع عن هذا الإجراء.')) {
      try {
        await deleteDoc(doc(db, 'recycle_bin', id));
        toast.success('تم الحذف النهائي بنجاح');
      } catch (error) {
        console.error("Error deleting:", error);
        toast.error('حدث خطأ أثناء الحذف');
      }
    }
  };

  const toggleRecycleSelection = (id) => {
    setSelectedRecycleItems(prev => prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]);
  };
  const toggleAllRecycleItems = () => {
    const filteredItems = recycleBin.filter(item => rbFilter === 'all' || item.type === rbFilter);
    if (selectedRecycleItems.length === filteredItems.length && filteredItems.length > 0) setSelectedRecycleItems([]);
    else setSelectedRecycleItems(filteredItems.map(i => i.id));
  };
  const restoreSelectedRecycleItems = async () => {
    if (!window.confirm(`هل أنت متأكد من استرجاع ${selectedRecycleItems.length} عنصر؟`)) return;
    for (const id of selectedRecycleItems) {
      const item = recycleBin.find(i => i.id === id);
      if (item) {
        await handleRestore(item);
      }
    }
    setSelectedRecycleItems([]);
  };
  const deleteSelectedRecycleItemsForever = async () => {
    if (!window.confirm(`هل أنت متأكد من الحذف النهائي لـ ${selectedRecycleItems.length} عنصر للأبد؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    try {
      for (const id of selectedRecycleItems) {
        await deleteDoc(doc(db, 'recycle_bin', id));
      }
      setSelectedRecycleItems([]);
      toast.success('تم الحذف النهائي بنجاح');
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const handleAssignCustomer = async (chatId, empUid) => {
    if (!empUid) return;
    try {
      const emp = employees.find(e => e.uid === empUid);
      if (!emp) return;
      const customer = customers.find(c => c.id === chatId);
      const prevEmpName = employees.find(e => e.uid === customer?.assignedToUid || e.email === customer?.assignedTo)?.name || (customer?.assignedTo === 'admin' || customer?.assignedTo === 'الإدارة' ? '👑 الإدارة' : '👑 الإدارة');
      const targetEmpName = emp.role === 'admin' ? `👑 الإدارة (${emp.name})` : `👤 ${emp.name}`;
      const logObj = createAssignmentLog(prevEmpName, targetEmpName);

      await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', chatId), {
        status: 'unassigned', // يظل في الانتظار حتى يرد عليه الموظف الجديد
        assignedTo: emp.email,
        assignedToUid: emp.uid,
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        assignmentHistory: arrayUnion(logObj),
        unread: 1
      });
      toast.success(`تم تعيين العميل إلى ${emp.name}`);
    } catch (error) {
      console.error("خطأ في إسناد المحادثة:", error);
    }
  };

  const exportLeadsToExcel = () => {
    if (!leadsCrm || leadsCrm.length === 0) {
      toast.error('لا يوجد عملاء لتصديرهم في Leads CRM');
      return;
    }

    try {
      const excelData = leadsCrm.map((lead, idx) => {
        const emp = employees.find(e => e.uid === lead.assignedToUid || e.email?.toLowerCase() === lead.assignedTo?.toLowerCase());
        const empName = emp ? (emp.name || emp.username) : (lead.assignedTo === 'admin' || lead.assignedTo === 'الإدارة' ? '👑 الإدارة' : 'غير محدد');
        const statusLabel = CRM_STATUS_MAP[lead.crmStatus]?.label || lead.crmStatus || '⏳ في الانتظار';
        
        let compiledNotes = '';
        if (lead.notesHistory && lead.notesHistory.length > 0) {
          compiledNotes = lead.notesHistory.map(n => `[${n.author}]: ${n.text}`).join(' | ');
        } else if (lead.notes) {
          compiledNotes = lead.notes;
        }

        return {
          '#': idx + 1,
          'اسم العميل': lead.name || 'عميل جديد',
          'رقم الهاتف': lead.phoneNumber || '',
          'حالة CRM': statusLabel,
          'الموظف المسند إليه': empName,
          'المصدر': lead.source === 'gsheet' ? 'Google Sheet' : lead.source === 'pdf_text' ? 'مستخرج من نص/PDF' : 'إكسيل',
          'تاريخ الإضافة': formatDate(lead.createdAt || lead.updatedAt),
          'تاريخ بدء التجربة': lead.trialStartDate || 'غير محدد',
          'الملاحظات والتقارير': compiledNotes
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'داتا Leads CRM');
      
      const fileName = `تصدير_داتا_Leads_CRM_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`تم تصدير ${leadsCrm.length} عميل إلى ملف إكسيل بنجاح 🟢`);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تصدير ملف الإكسيل');
    }
  };

  return (
    <div 
      className="h-screen overflow-y-auto w-full font-sans relative bg-slate-900 pb-20" 
      dir="rtl"
      onClick={(e) => handleCardClick(e, 'analytics', 'all')}
    >
      {/* 3D Modern Gradient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-blue-600/30 blur-[120px] mix-blend-screen animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-500/20 blur-[100px] mix-blend-screen"></div>
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[100px] mix-blend-screen"></div>
      </div>
      <div 
        className="fixed inset-0 opacity-10 bg-center bg-no-repeat pointer-events-none z-0"
        style={{ backgroundImage: "url('/logo.jpg')", backgroundSize: "600px", backgroundAttachment: "fixed" }}
      ></div>
      
      {/* Header */}
      <header 
        className="bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200 relative z-10 px-4 md:px-6 py-3.5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar / Title & Mobile Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-purple-500 rounded-full blur-[4px] opacity-80 group-hover:opacity-100 transition duration-300 animate-pulse"></div>
              <img 
                src="/logo.jpg" 
                alt="Logo 3D" 
                className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-emerald-300 shadow-[0_4px_16px_rgba(16,185,129,0.6)] transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 cursor-pointer" 
              />
            </div>
            <h1 className="text-base sm:text-lg md:text-2xl font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
              {isAdmin ? (
                <span>Etegah <span className="text-primary text-xs md:text-sm bg-primary/10 px-2 py-0.5 rounded-full font-black">CRM</span></span>
              ) : (
                <span>Etegah <span className="text-purple-700 bg-purple-100 text-xs md:text-sm px-2.5 py-1 rounded-full font-black shadow-sm border border-purple-300">CRM</span></span>
              )}
            </h1>
          </div>
          
          {/* Mobile action buttons inline with title */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            {isAdmin && (
              <button 
                onClick={openAddEmployeeModal}
                className="flex items-center bg-primary text-white p-2 rounded-lg hover:bg-green-600 transition shadow-sm font-bold text-xs"
                title="إضافة موظف"
              >
                <UserPlus size={16} />
              </button>
            )}
            {!isCoordinator && (
              <button 
                onClick={() => navigate('/inbox')}
                className="flex items-center bg-gray-800 text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-700 transition text-xs font-bold gap-1"
              >
                <span>WhatsApp Etegah chat</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Desktop Action Buttons & User Badge */}
        <div className="hidden md:flex items-center space-x-3 space-x-reverse shrink-0">
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 shadow-sm shrink-0">
            <div className="relative group shrink-0">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full blur-[2px] opacity-70"></div>
              <img src="/logo.jpg" alt="Logo" className="relative w-5 h-5 rounded-full object-cover border border-amber-300" />
            </div>
            <span className="text-xs font-bold text-gray-700" dir="ltr">
              {employees.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase())?.name || currentUser?.email?.split('@')[0]}
            </span>
            <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
              {isAdmin ? '👑 أدمن' : (() => {
                const emp = employees.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
                const r = emp?.jobTitle || emp?.role || 'Agent';
                if (r === 'Coordinator' || r === 'منسق للإدارة' || r === 'منسق إدارة') return '📋 منسق إدارة';
                return r === 'Leader' || r === 'ليدر' ? '👑 Leader' : `👤 ${r}`;
              })()}
            </span>
          </div>

          {isAdmin && (
            <button 
              onClick={openAddEmployeeModal}
              className="flex items-center bg-primary text-white px-3.5 py-2 rounded-lg hover:bg-green-600 transition shadow-sm font-bold text-sm"
            >
              <UserPlus size={18} className="ml-1.5" /> إضافة موظف
            </button>
          )}
          {!isCoordinator && (
            <button 
              onClick={() => navigate('/inbox')}
              className="flex items-center bg-gray-800 text-white px-3.5 py-2 rounded-lg hover:bg-gray-700 transition text-sm font-bold gap-1.5"
            >
              <span>WhatsApp Etegah chat</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="p-3 sm:p-6 max-w-7xl mx-auto w-full relative z-10">
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
              <h3 className="text-xl font-black text-white mb-2">شاشة بيانات محمية</h3>
              <p className="text-sm text-purple-200/80 mb-6 font-medium leading-relaxed">
                تم تعتيم وحجب الشاشة تلقائياً لحماية خصوصية بيانات العملاء أثناء استخدام أدوات التقاط الشاشة أو مغادرة النافذة.
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

        {/* Stats Cards */}
        {isAdmin ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-8">
            {/* Card: Dedicated Leads CRM */}
            <div 
              onClick={(e) => handleCardClick(e, 'leads_crm', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'leads_crm' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <FileSpreadsheet className="text-purple-300" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">🎯 Leads CRM</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{leadsCrm.length.toLocaleString()}</h3>
              </div>
            </div>

            {/* Card: Leads CRM Analysis */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsLeadsAnalysisModalOpen(true);
              }}
              className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-3.5 sm:p-5 md:p-6 border border-purple-400/40 hover:border-purple-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
              title="انقر لعرض تحليلات الأداء الشاملة لكل الموظفين ونسبة النجاح"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <BarChart3 className="text-cyan-300" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">📊 Leads CRM Analysis</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300/40">—</h3>
              </div>
            </div>

            {/* Card: Total Customers */}
            <div 
              onClick={(e) => handleCardClick(e, 'customers', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'customers' && customerFilter === 'all' ? 'border-blue-400 scale-105 shadow-[0_8px_25px_rgba(59,130,246,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Users className="text-blue-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">🌐 إجمالي قاعدة العملاء</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{(leadsCrm.length + customers.length).toLocaleString()}</h3>
              </div>
            </div>
            
            {/* Card: Pending Customers */}
            <div 
              onClick={(e) => handleCardClick(e, 'customers', 'unassigned')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'customers' && customerFilter === 'unassigned' ? 'border-red-400 scale-105 shadow-[0_8px_25px_rgba(239,68,68,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Clock className="text-red-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">عملاء في الانتظار</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{unassignedCount.toLocaleString()}</h3>
              </div>
            </div>

            {/* Card: Manual Add */}
            <div 
              onClick={(e) => handleCardClick(e, 'customers', 'manual')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'customers' && customerFilter === 'manual' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <UserPlus className="text-purple-300" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">تسجيل يدوي</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{customers.filter(c => c.addedBy && c.addedBy !== 'WhatsApp Webhook').length.toLocaleString()}</h3>
              </div>
            </div>

            {/* Card: Employees Count */}
            <div 
              onClick={(e) => handleCardClick(e, 'employees', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'employees' ? 'border-green-400 scale-105 shadow-[0_8px_25px_rgba(34,197,94,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <UserCheck className="text-emerald-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">إجمالي الموظفين</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{employees.filter(e => e.role !== 'admin').length.toLocaleString()}</h3>
              </div>
            </div>

            {/* Card: Visitors */}
            <div 
              onClick={(e) => handleCardClick(e, 'whatsapp_visitors', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'whatsapp_visitors' ? 'border-indigo-400 scale-105 shadow-[0_8px_25px_rgba(99,102,241,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Globe className="text-indigo-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">عملاء الزوار</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{whatsappVisitorsCount.toLocaleString()}</h3>
              </div>
            </div>
            
            {/* Card: Recycle Bin */}
            <div 
              onClick={(e) => handleCardClick(e, 'recycle_bin', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'recycle_bin' ? 'border-red-400 scale-105 shadow-[0_8px_25px_rgba(239,68,68,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Trash2 className="text-rose-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">سلة المهملات</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{recycleBin.length.toLocaleString()}</h3>
              </div>
            </div>

            {/* Card: Campaigns */}
            <div 
              onClick={(e) => handleCardClick(e, 'campaigns', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'campaigns' ? 'border-amber-400 scale-105 shadow-[0_8px_25px_rgba(245,158,11,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <BarChart3 className="text-amber-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">أداء الحملات</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{new Set(templateMessages.map(m => m.templateName || (m.text?.match(/\[قالب.*?:(.*?)\]/)?.[1]?.trim() || 'قالب غير معروف'))).size.toLocaleString()} قوالب</h3>
              </div>
            </div>
          </div>
        ) : isCoordinator ? (
          /* Coordinator Cards View */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-8">
            {/* Card 1: Dedicated Leads CRM */}
            <div 
              onClick={(e) => handleCardClick(e, 'leads_crm', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'leads_crm' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <FileSpreadsheet className="text-purple-300" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">🎯 Leads CRM</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{leadsCrm.length.toLocaleString()}</h3>
              </div>
            </div>

            {/* Card 2: Leads CRM Analysis */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsLeadsAnalysisModalOpen(true);
              }}
              className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-3.5 sm:p-5 md:p-6 border border-purple-400/40 hover:border-purple-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
              title="انقر لعرض تقرير تحليلات الأداء الشاملة لكل الموظفين"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <BarChart3 className="text-cyan-300" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">📊 Leads CRM Analysis</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300/40">—</h3>
              </div>
            </div>

            {/* Card 3: Total Customer Database */}
            <div 
              onClick={(e) => handleCardClick(e, 'customers', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'customers' && customerFilter === 'all' ? 'border-blue-400 scale-105 shadow-[0_8px_25px_rgba(59,130,246,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Users className="text-blue-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">🌐 إجمالي قاعدة العملاء</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{(leadsCrm.length + customers.length).toLocaleString()}</h3>
              </div>
            </div>
            
            {/* Card 4: Pending Customers */}
            <div 
              onClick={(e) => handleCardClick(e, 'customers', 'unassigned')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'customers' && customerFilter === 'unassigned' ? 'border-red-400 scale-105 shadow-[0_8px_25px_rgba(239,68,68,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Clock className="text-red-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">عملاء في الانتظار</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{unassignedCount.toLocaleString()}</h3>
              </div>
            </div>

            {/* Card 5: Manual Add */}
            <div 
              onClick={(e) => handleCardClick(e, 'customers', 'manual')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'customers' && customerFilter === 'manual' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <UserPlus className="text-purple-300" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">تسجيل يدوي</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{customers.filter(c => c.addedBy && c.addedBy !== 'WhatsApp Webhook').length.toLocaleString()}</h3>
              </div>
            </div>
          </div>
        ) : (
          /* Employee (Agent / Leader) Cards View */
          <div className="flex flex-wrap gap-4 mb-6">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('leads_crm');
                tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border border-purple-400/40 flex items-center min-w-[240px] cursor-pointer hover:scale-105 transition-all transform"
              title="انقر لعرض وتحديث جدول Leads CRM الخاص بك"
            >
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                <FileSpreadsheet className="text-purple-300" size={28} />
              </div>
              <div>
                <p className="text-sm text-purple-200 font-extrabold mb-1">🎯 Leads CRM</p>
                <h3 className="text-3xl font-black text-cyan-300">
                  {leadsCrm.filter(c => c.assignedToUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase()).length.toLocaleString()} عميل
                </h3>
              </div>
            </div>

            {/* Employee Card: Leads CRM Analysis */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsLeadsAnalysisModalOpen(true);
              }}
              className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border border-purple-400/40 flex items-center min-w-[240px] cursor-pointer hover:scale-105 transition-all transform"
              title="انقر لعرض تحليل الأداء ونسبة النجاح الخاصة بك"
            >
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                <BarChart3 className="text-cyan-300" size={28} />
              </div>
              <div>
                <p className="text-sm text-purple-200 font-extrabold mb-1">📊 Leads CRM Analysis</p>
                <h3 className="text-3xl font-black text-cyan-300/40">—</h3>
              </div>
            </div>
          </div>
        )}

        {/* Campaigns Analytics Tab */}
        {activeTab === 'campaigns' && (() => {
          // Group template messages by template name and employee
          const groupedCampaigns = {};
          
          templateMessages.forEach(msg => {
            const templateName = msg.templateName || (msg.text?.match(/\[قالب.*?:(.*?)\]/)?.[1]?.trim() || 'قالب غير معروف');
            const empEmail = msg.senderEmail || 'مجهول';
            const chatId = msg.conversationId || msg.recipientPhone || msg.to || 'unknown';
            
            const key = `${templateName}_${empEmail}`;
            if (!groupedCampaigns[key]) {
              groupedCampaigns[key] = {
                templateName,
                empEmail,
                sent: 0,
                delivered: 0,
                read: 0,
                chatMap: {}
              };
            }
            
            groupedCampaigns[key].sent++;
            if (msg.status === 'delivered' || msg.status === 'read') groupedCampaigns[key].delivered++;
            if (msg.status === 'read') groupedCampaigns[key].read++;

            groupedCampaigns[key].chatMap[chatId] = (groupedCampaigns[key].chatMap[chatId] || 0) + 1;
          });
          
          const campaignsList = Object.values(groupedCampaigns).map(campaign => {
            let sentOnce = 0, sentTwice = 0, sentMore = 0;
            Object.values(campaign.chatMap).forEach(cnt => {
              if (cnt === 1) sentOnce++;
              else if (cnt === 2) sentTwice++;
              else if (cnt >= 3) sentMore++;
            });
            return { ...campaign, sentOnce, sentTwice, sentMore };
          }).sort((a,b) => b.sent - a.sent);

          return (
            <div 
              ref={tableSectionRef}
              className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden mt-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-white/30 bg-white/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">إحصائيات أداء القوالب والحملات التسويقية</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="p-4 font-semibold text-gray-600 text-sm">اسم القالب</th>
                      <th className="p-4 font-semibold text-gray-600 text-sm">الموظف المُرسل</th>
                      <th className="p-4 font-semibold text-gray-600 text-sm text-center">إجمالي الإرسال</th>
                      <th className="p-4 font-semibold text-blue-700 text-sm text-center bg-blue-50/50">مرة واحدة 📩</th>
                      <th className="p-4 font-semibold text-purple-700 text-sm text-center bg-purple-50/50">مرتين 📩📩</th>
                      <th className="p-4 font-semibold text-amber-700 text-sm text-center bg-amber-50/50">3+ مرات 📩🔥</th>
                      <th className="p-4 font-semibold text-gray-600 text-sm text-center">تم التسليم (✔️✔️)</th>
                      <th className="p-4 font-semibold text-gray-600 text-sm text-center">تم الفتح (✔️✔️)</th>
                      <th className="p-4 font-semibold text-gray-600 text-sm text-center">نسبة الفتح (Open Rate)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/50">
                    {campaignsList.map((campaign, idx) => {
                      const empName = employees.find(e => e.email === campaign.empEmail)?.name || campaign.empEmail.split('@')[0];
                      const openRate = campaign.delivered > 0 ? Math.round((campaign.read / campaign.delivered) * 100) : 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50 transition">
                          <td className="p-4 text-sm font-bold text-gray-800">{campaign.templateName}</td>
                          <td className="p-4 text-sm font-semibold text-blue-600">{empName}</td>
                          <td className="p-4 text-sm font-bold text-gray-700 text-center">{campaign.sent}</td>
                          <td className="p-4 text-sm font-bold text-blue-700 text-center bg-blue-50/30">{campaign.sentOnce}</td>
                          <td className="p-4 text-sm font-bold text-purple-700 text-center bg-purple-50/30">{campaign.sentTwice}</td>
                          <td className="p-4 text-sm font-bold text-amber-700 text-center bg-amber-50/30">{campaign.sentMore}</td>
                          <td className="p-4 text-sm font-bold text-gray-700 text-center">{campaign.delivered}</td>
                          <td className="p-4 text-sm font-bold text-green-600 text-center">{campaign.read}</td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${openRate >= 50 ? 'bg-green-100 text-green-700' : openRate >= 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                %{openRate}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {campaignsList.length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-gray-500">لا يوجد قوالب تم إرسالها بعد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Analytics Tab (Admin Only) */}
        {isAdmin && activeTab === 'analytics' && (() => {
          const employeeStats = employees.filter(e => e.role !== 'admin').map(emp => {
            const empCustomers = customers.filter(c => c.assignedToUid === emp.uid);
            const unreadCustomers = empCustomers.filter(c => c.unread > 0);
            return {
              name: emp.name || emp.username || emp.email?.split('@')[0],
              totalAssigned: empCustomers.length,
              unreadCount: unreadCustomers.length,
            };
          });

          const mostAssigned = [...employeeStats].sort((a,b) => b.totalAssigned - a.totalAssigned)[0];
          const zeroAssigned = employeeStats.filter(e => e.totalAssigned === 0);
          const mostUnread = [...employeeStats].sort((a,b) => b.unreadCount - a.unreadCount)[0];

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              {/* Card 1 */}
              <div 
                onClick={() => setAnalyticsDetail('assigned')}
                className="bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl p-6 rounded-2xl border border-purple-400/30 shadow-[0_8px_32px_rgba(112,26,117,0.35)] cursor-pointer hover:scale-[1.02] hover:border-purple-300 transition-all flex items-center justify-between group"
              >
                <h3 className="font-bold text-xl text-cyan-300 flex items-center m-0">
                  <UserCheck className="ml-3 text-emerald-400" size={26} /> الأكثر استلاماً للعملاء
                </h3>
                <span className="text-xs font-bold bg-white/10 text-purple-200 border border-white/20 px-4 py-2 rounded-full shadow-sm group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  عرض التفاصيل
                </span>
              </div>

              {/* Card 2 */}
              <div 
                onClick={() => setAnalyticsDetail('unread')}
                className="bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl p-6 rounded-2xl border border-purple-400/30 shadow-[0_8px_32px_rgba(112,26,117,0.35)] cursor-pointer hover:scale-[1.02] hover:border-purple-300 transition-all flex items-center justify-between group"
              >
                <h3 className="font-bold text-xl text-rose-300 flex items-center m-0">
                  <Clock className="ml-3 text-rose-400" size={26} /> بطء في الاستجابة (لم يقرأ)
                </h3>
                <span className="text-xs font-bold bg-white/10 text-purple-200 border border-white/20 px-4 py-2 rounded-full shadow-sm group-hover:bg-rose-600 group-hover:text-white transition-colors">
                  عرض التفاصيل
                </span>
              </div>

              {/* Card 3 */}
              <div 
                onClick={() => setAnalyticsDetail('zero')}
                className="bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl p-6 rounded-2xl border border-purple-400/30 shadow-[0_8px_32px_rgba(112,26,117,0.35)] md:col-span-2 cursor-pointer hover:scale-[1.02] hover:border-purple-300 transition-all flex items-center justify-between group"
              >
                <h3 className="font-bold text-xl text-amber-300 flex items-center m-0">
                  <Users className="ml-3 text-amber-400" size={26} /> موظفين لم يستلموا أي عميل بعد
                </h3>
                <span className="text-xs font-bold bg-white/10 text-purple-200 border border-white/20 px-4 py-2 rounded-full shadow-sm group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  عرض التفاصيل
                </span>
              </div>

              {/* Modals for Analytics Details */}
              {analyticsDetail && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setAnalyticsDetail(null)}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 relative" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => setAnalyticsDetail(null)} 
                      className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition"
                    >
                      <X size={24} />
                    </button>
                    
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
                      {analyticsDetail === 'assigned' && 'تفاصيل استلام العملاء (ترتيب الموظفين)'}
                      {analyticsDetail === 'unread' && 'تفاصيل التأخير والرسائل غير المقروءة'}
                      {analyticsDetail === 'zero' && 'قائمة الموظفين غير المستلمين لأي عميل'}
                    </h2>

                    <div className="max-h-[60vh] overflow-y-auto">
                      {analyticsDetail === 'assigned' && (
                        <div className="space-y-4">
                          {employeeStats.sort((a,b) => b.totalAssigned - a.totalAssigned).map((stat, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                              <span className="font-bold text-gray-800 text-base">{stat.name}</span>
                              <span className="bg-blue-100 text-blue-800 text-sm font-black px-3 py-1 rounded-full">
                                {stat.totalAssigned} عميل
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {analyticsDetail === 'unread' && (
                        <div className="space-y-4">
                          {[...employeeStats].sort((a,b) => b.unreadCount - a.unreadCount).map((emp, idx) => (
                            <div key={emp.name} className="flex items-center justify-between p-4 bg-red-50/50 rounded-xl border border-red-100">
                              <span className="font-bold text-lg text-gray-800">{emp.name}</span>
                              <span className={`font-bold px-4 py-1 rounded-full ${emp.unreadCount > 0 ? 'text-red-600 bg-red-100' : 'text-green-600 bg-green-100'}`}>
                                {emp.unreadCount > 0 ? `${emp.unreadCount} غير مقروءة` : 'لا يوجد تأخير'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {analyticsDetail === 'zero' && (
                        <div className="space-y-4">
                          {zeroAssigned.length > 0 ? (
                            zeroAssigned.map((emp) => (
                              <div key={emp.name} className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                                <span className="font-bold text-lg text-gray-800">{emp.name}</span>
                              </div>
                            ))
                          ) : (
                            <div className="p-8 text-center text-gray-500 font-bold bg-gray-50 rounded-xl">لا يوجد موظفين في هذه القائمة.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Dedicated Leads CRM Tab */}
        {(activeTab === 'leads_crm' || !isAdmin) && (
          <div ref={tableSectionRef} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/30 bg-purple-50/50 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                  <FileSpreadsheet className="text-purple-600" size={24} />
                  <span>🎯 Leads CRM</span>
                </h2>
                {(isAdmin || isCoordinator) && (
                  <span className="bg-purple-200 text-purple-800 text-xs font-black px-3 py-1 rounded-full shadow-sm">
                    إجمالي {leadsCrm.length.toLocaleString()} عميل
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isAdmin && (
                  <>
                    <button 
                      onClick={exportLeadsToExcel}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                      title="تنزيل جميع العملاء بتفاصيلهم وملحوظاتهم على شيت إكسيل"
                    >
                      <Download size={14} /> 📊 تصدير الداتا إلى إكسيل
                    </button>
                    <button 
                      onClick={handleCleanLeadNames}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                      title="تنظيف أسماء العملاء وحذف النص الزائد من البيانات المستوردة من vtiger"
                    >
                      🧹 تنظيف الأسماء
                    </button>

                    <button 
                      onClick={() => setIsImportModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                    >
                      <FileSpreadsheet size={14} /> 📥 استيراد Leads جديدة
                    </button>
                  </>
                )}
                {(isAdmin || isCoordinator) && (
                  <button 
                    onClick={() => {
                      setAssignEmpUids(employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(e => e.uid));
                      setIsAssignModalOpen(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    <UserCheck2 size={14} /> ⚖️ توزيع Leads CRM
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            {(() => {
              const isLeadAssignedToAdmin = (c) => {
                if (!c) return false;
                if (!c.assignedToUid || c.assignedToUid === 'admin' || c.assignedToUid === 'unassigned') return true;
                if (!c.assignedTo || c.assignedTo === 'الإدارة' || c.assignedTo?.includes('gmail')) return true;
                const st = c.crmStatus || c.status || 'unassigned';
                if (st === 'unassigned') return true;
                return false;
              };

              const scopeLeadsForCount = (!isAdmin && !isCoordinator) 
                ? leadsCrm.filter(c => c.assignedToUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase())
                : (selectedEmpFilter === 'all' 
                    ? leadsCrm 
                    : (selectedEmpFilter === 'admin' 
                        ? leadsCrm.filter(c => isLeadAssignedToAdmin(c))
                        : leadsCrm.filter(c => c.assignedToUid === selectedEmpFilter || c.assignedTo?.toLowerCase() === employees.find(e => e.uid === selectedEmpFilter)?.email?.toLowerCase())
                      )
                  );

              const getCrmStatusCount = (statusKey) => {
                if (statusKey === 'all') return scopeLeadsForCount.length;
                return scopeLeadsForCount.filter(c => (c.crmStatus || c.status || 'unassigned') === statusKey).length;
              };

              return (
                <div className="px-6 py-3.5 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white border-b flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[200px]">
                    {/* Employee Filter (Admin & Coordinator) - 3D Glassmorphic Dark-Pill */}
                    {(isAdmin || isCoordinator) && (
                      <div className="relative">
                        <select
                          value={selectedEmpFilter}
                          onChange={(e) => setSelectedEmpFilter(e.target.value)}
                          className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white rounded-full py-2 px-4 pl-8 text-xs font-black focus:outline-none shadow-[0_4px_14px_rgba(112,26,117,0.35)] border border-purple-400/40 hover:border-purple-300 hover:shadow-[0_6px_18px_rgba(112,26,117,0.45)] transition-all cursor-pointer appearance-none"
                        >
                          <option value="all" className="bg-purple-950 text-white">👥 جميع الموظفين ({leadsCrm.length.toLocaleString()})</option>
                          <option value="admin" className="bg-purple-950 text-white">👑 الإدارة ({leadsCrm.filter(c => isLeadAssignedToAdmin(c)).length.toLocaleString()})</option>
                          {employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(emp => {
                            const count = leadsCrm.filter(c => c.assignedToUid === emp.uid || c.assignedTo?.toLowerCase() === emp.email?.toLowerCase()).length;
                            return (
                              <option key={emp.uid} value={emp.uid} className="bg-purple-950 text-white">
                                👤 {emp.name || emp.username} ({count.toLocaleString()} عميل)
                              </option>
                            );
                          })}
                        </select>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-purple-300 text-[10px] font-bold">
                          ▼
                        </div>
                      </div>
                    )}

                    {/* CRM Status Filter - 3D Glassmorphic Dark-Pill (Shared for Admin & Employee) */}
                    <div className="relative">
                      <select
                        value={crmStatusFilter}
                        onChange={(e) => setCrmStatusFilter(e.target.value)}
                        className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white rounded-full py-2 px-4 pl-8 text-xs font-black focus:outline-none shadow-[0_4px_14px_rgba(112,26,117,0.35)] border border-purple-400/40 hover:border-purple-300 hover:shadow-[0_6px_18px_rgba(112,26,117,0.45)] transition-all cursor-pointer appearance-none"
                      >
                        <option value="all" className="bg-purple-950 text-white">🌟 جميع الحالات ({getCrmStatusCount('all')})</option>
                        <option value="unassigned" className="bg-purple-950 text-white">⏳ في الانتظار ({getCrmStatusCount('unassigned')})</option>
                        <option value="interested" className="bg-purple-950 text-white">🌟 مهتم ({getCrmStatusCount('interested')})</option>
                        <option value="not_interested" className="bg-purple-950 text-white">❌ غير مهتم ({getCrmStatusCount('not_interested')})</option>
                        <option value="no_answer" className="bg-purple-950 text-white">📵 لم يرد ({getCrmStatusCount('no_answer')})</option>
                        <option value="subscribed" className="bg-purple-950 text-white">🎉 تم الاشتراك ({getCrmStatusCount('subscribed')})</option>
                        <option value="started_trial" className="bg-purple-950 text-white">🚀 بدأ تجربة بالفعل ({getCrmStatusCount('started_trial')})</option>
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-purple-300 text-[10px] font-bold">
                        ▼
                      </div>
                    </div>

                    {/* Modern Glassmorphic Dark-Pill Date Range Selector (Zero Ugly Desktop Placeholder) */}
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white rounded-full px-3 py-1 text-xs font-black shadow-[0_4px_14px_rgba(112,26,117,0.35)] border border-purple-400/40 hover:border-purple-300 transition-all">
                      <span className="flex items-center gap-1 text-purple-200 font-black text-[11px] shrink-0">
                        📅 التاريخ:
                      </span>
                      
                      {/* From Date Box */}
                      <div className="relative flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-lg px-2 py-0.5 border border-white/20 hover:bg-white/15 transition min-w-[105px] justify-between cursor-pointer">
                        <span className="text-[10px] text-purple-200 font-bold shrink-0">من</span>
                        {!dateFromFilter && (
                          <span className="text-[11px] text-purple-300 font-mono font-bold">--/--/----</span>
                        )}
                        <input 
                          type="date" 
                          value={dateFromFilter}
                          onChange={(e) => setDateFromFilter(e.target.value)}
                          className={`bg-transparent text-[11px] text-white font-mono outline-none cursor-pointer font-bold border-none ${!dateFromFilter ? 'opacity-0 absolute inset-0 w-full h-full' : 'w-[95px]'}`}
                        />
                      </div>

                      {/* To Date Box */}
                      <div className="relative flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-lg px-2 py-0.5 border border-white/20 hover:bg-white/15 transition min-w-[105px] justify-between cursor-pointer">
                        <span className="text-[10px] text-purple-200 font-bold shrink-0">إلى</span>
                        {!dateToFilter && (
                          <span className="text-[11px] text-purple-300 font-mono font-bold">--/--/----</span>
                        )}
                        <input 
                          type="date" 
                          value={dateToFilter}
                          onChange={(e) => setDateToFilter(e.target.value)}
                          className={`bg-transparent text-[11px] text-white font-mono outline-none cursor-pointer font-bold border-none ${!dateToFilter ? 'opacity-0 absolute inset-0 w-full h-full' : 'w-[95px]'}`}
                        />
                      </div>

                      {(dateFromFilter || dateToFilter) && (
                        <button 
                          onClick={() => { setDateFromFilter(''); setDateToFilter(''); }}
                          className="bg-rose-500 hover:bg-rose-600 text-white font-black rounded-full w-4 h-4 flex items-center justify-center text-[9px] transition shadow-md cursor-pointer shrink-0 mr-0.5"
                          title="إلغاء فلتر التاريخ"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Sort Order Selector */}
                    <select
                      value={leadsSortOrder}
                      onChange={(e) => setLeadsSortOrder(e.target.value)}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full py-2 px-4 text-xs font-black focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-md hover:from-purple-700 hover:to-indigo-700 transition-all cursor-pointer border border-purple-400/40"
                    >
                      <option value="desc" className="bg-purple-900 text-white">⬇️ ترتيب: الأحدث إلى الأقدم</option>
                      <option value="asc" className="bg-purple-900 text-white">⬆️ ترتيب: الأقدم إلى الأحدث</option>
                    </select>
                  </div>

                  {/* Search Box */}
                  <div className="relative w-full sm:w-64">
                    <input 
                      type="text" 
                      placeholder="بحث باسم أو رقم العميل..." 
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="w-full bg-white/90 border border-purple-200 text-gray-800 placeholder-gray-400 rounded-full py-2 pr-9 pl-4 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400" size={15} />
                  </div>

                  {isAdmin && selectedLeadsCrm.length > 0 && (
                    <button 
                      onClick={deleteSelectedLeadsCrm}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-xs font-black transition flex items-center gap-1.5 shadow-md transform hover:scale-105 active:scale-95"
                    >
                      <Trash2 size={15} /> حذف {selectedLeadsCrm.length} عميل محدد
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Table */}
            {(() => {
              const isLeadAssignedToAdmin = (c) => {
                if (!c) return false;
                if (!c.assignedToUid || c.assignedToUid === 'admin' || c.assignedToUid === 'unassigned') return true;
                if (!c.assignedTo || c.assignedTo === 'الإدارة' || c.assignedTo?.includes('gmail')) return true;
                const st = c.crmStatus || c.status || 'unassigned';
                if (st === 'unassigned') return true;
                return false;
              };

              let filtered = leadsCrm.filter(c => {
                // Employee view restriction
                if (!isAdmin && !isCoordinator) {
                  if (c.assignedToUid !== currentUser?.uid && c.assignedTo?.toLowerCase() !== currentUser?.email?.toLowerCase()) {
                    return false;
                  }
                } else if (selectedEmpFilter && selectedEmpFilter !== 'all') {
                  if (selectedEmpFilter === 'admin' || selectedEmpFilter === 'unassigned') {
                    if (!isLeadAssignedToAdmin(c)) return false;
                  } else {
                    const emp = employees.find(e => e.uid === selectedEmpFilter);
                    if (c.assignedToUid !== selectedEmpFilter && c.assignedTo?.toLowerCase() !== emp?.email?.toLowerCase()) return false;
                  }
                }

                if (crmStatusFilter && crmStatusFilter !== 'all') {
                  const currentStatus = c.crmStatus || c.status || 'unassigned';
                  if (currentStatus !== crmStatusFilter) return false;
                }

                // Date Range Filter
                if (dateFromFilter) {
                  const fromTime = new Date(dateFromFilter).setHours(0, 0, 0, 0);
                  const itemTime = getTimestampMillis(c.createdAt) || getTimestampMillis(c.updatedAt);
                  if (itemTime > 0 && itemTime < fromTime) return false;
                }
                if (dateToFilter) {
                  const toTime = new Date(dateToFilter).setHours(23, 59, 59, 999);
                  const itemTime = getTimestampMillis(c.createdAt) || getTimestampMillis(c.updatedAt);
                  if (itemTime > 0 && itemTime > toTime) return false;
                }

                const search = tableSearch.trim();
                if (!search) return true;
                const term = search.toLowerCase();
                return c.name?.toLowerCase().includes(term) || c.phoneNumber?.includes(term);
              });

              // Sorting
              filtered.sort((a, b) => {
                const timeA = getTimestampMillis(a.createdAt) || getTimestampMillis(a.updatedAt);
                const timeB = getTimestampMillis(b.createdAt) || getTimestampMillis(b.updatedAt);
                return leadsSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
              });

              const totalPagesLeads = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
              const validPageLeads = Math.min(currentPageLeads, totalPagesLeads);
              const startIndexLeads = (validPageLeads - 1) * ITEMS_PER_PAGE;
              const paginatedLeads = filtered.slice(startIndexLeads, startIndexLeads + ITEMS_PER_PAGE);

              const isPageSelected = paginatedLeads.length > 0 && paginatedLeads.every(c => selectedLeadsCrm.includes(c.id));

              return (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-purple-50/80 border-b border-purple-100">
                          {isAdmin && (
                            <th className="p-4 w-12 text-center">
                              <input 
                                type="checkbox" 
                                checked={isPageSelected} 
                                onChange={() => toggleAllLeadsCrm(paginatedLeads)} 
                                className="w-4 h-4 text-purple-600 rounded cursor-pointer accent-purple-600" 
                              />
                            </th>
                          )}
                          <th className="p-4 font-bold text-purple-900 text-sm">رقم الهاتف</th>
                          <th className="p-4 font-bold text-purple-900 text-sm">اسم العميل ومصدر الداتا</th>
                          <th className="p-4 font-bold text-purple-900 text-sm">تاريخ الاستيراد</th>
                          <th className="p-4 font-bold text-purple-900 text-sm">حالة المتابعة (CRM)</th>
                          <th className="p-4 font-bold text-purple-900 text-sm">الموظف المسؤول</th>
                          <th className="p-4 font-bold text-purple-900 text-sm text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLeads.length === 0 ? (
                          <tr><td colSpan="7" className="p-8 text-center text-gray-500 font-bold">لا يوجد عملاء مطابقين للبحث أو التصفية في قسم Leads CRM.</td></tr>
                        ) : (
                          paginatedLeads.map((customer) => {
                            const currentCrmStatus = customer.crmStatus || 'unassigned';
                            const statusInfo = CRM_STATUS_MAP[currentCrmStatus] || CRM_STATUS_MAP.unassigned;

                        return (
                          <tr key={customer.id} className="hover:bg-purple-50/30 transition border-b border-gray-100/50">
                            {isAdmin && (
                              <td className="p-4 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={selectedLeadsCrm.includes(customer.id)} 
                                  onChange={() => toggleLeadCrmSelection(customer.id)} 
                                  className="w-4 h-4 text-purple-600 rounded" 
                                />
                              </td>
                            )}
                            <td className="p-4 text-sm font-bold text-gray-800" dir="ltr">
                              <div className="flex items-center gap-2">
                                <span>{customer.phoneNumber}</span>
                                {!isCoordinator && (
                                  <button
                                    onClick={() => handleTransferToWhatsapp(customer)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-full transition shadow-sm"
                                    title="تحويل وفتح محادثة الواتساب المباشرة"
                                  >
                                    <MessageCircle size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-sm font-semibold text-gray-700">
                              {editingLeadId === customer.id ? (
                                <div className="flex items-center gap-1 mb-1">
                                  <input 
                                    type="text" 
                                    value={editingLeadName} 
                                    onChange={(e) => setEditingLeadName(e.target.value)}
                                    className="border border-purple-400 rounded px-2 py-0.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white shadow-sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveLeadName(customer.id);
                                      if (e.key === 'Escape') setEditingLeadId(null);
                                    }}
                                  />
                                  <button 
                                    onClick={() => handleSaveLeadName(customer.id)} 
                                    className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded transition text-xs font-bold shadow-sm"
                                    title="حفظ الاسم"
                                  >
                                    ✓
                                  </button>
                                  <button 
                                    onClick={() => setEditingLeadId(null)} 
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded transition text-xs font-bold"
                                    title="إلغاء"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 group mb-1">
                                  <span className="font-bold text-gray-800">{customer.name || 'عميل جديد'}</span>
                                  <button 
                                    onClick={() => {
                                      setEditingLeadId(customer.id);
                                      setEditingLeadName(customer.name || '');
                                    }}
                                    className="text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-100/60 transition cursor-pointer"
                                    title="تعديل اسم العميل"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                </div>
                              )}
                              {customer.notesHistory && customer.notesHistory.length > 0 && (
                                <span className="block text-[10px] text-blue-600 font-bold mt-0.5">📝 {customer.notesHistory.length} ملاحظات</span>
                              )}
                            </td>
                            <td className="p-4 text-xs text-gray-500" dir="ltr">{formatDate(customer.createdAt || customer.updatedAt)}</td>
                            <td className="p-4 text-sm">
                              <div className="flex flex-col gap-1">
                                <select 
                                  value={currentCrmStatus}
                                  onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    try {
                                      await updateDoc(doc(db, 'leads_crm', customer.id), { crmStatus: newStatus, updatedAt: serverTimestamp() });
                                      toast.success('تم تحديث حالة العميل');
                                    } catch (err) { toast.error('خطأ في تحديث الحالة'); }
                                  }}
                                  className={`text-xs font-bold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none ${statusInfo.bg}`}
                                >
                                  <option value="unassigned">⏳ في الانتظار</option>
                                  <option value="interested">🌟 مهتم</option>
                                  <option value="not_interested">❌ غير مهتم</option>
                                  <option value="no_answer">📵 لم يرد</option>
                                  <option value="subscribed">🎉 تم الاشتراك</option>
                                  <option value="started_trial">🚀 بدأ تجربة بالفعل</option>
                                </select>
                                {customer.crmStatus === 'started_trial' && customer.trialStartDate && (
                                  <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded">📅 التجربة: {customer.trialStartDate}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-sm text-gray-600 font-medium">
                              {isAdmin || isCoordinator ? (
                                <select 
                                  value={!customer.assignedToUid || customer.assignedToUid === 'admin' || customer.assignedTo === 'الإدارة' || customer.assignedTo?.includes('gmail') ? "admin" : customer.assignedToUid}
                                  onChange={async (e) => {
                                    const uid = e.target.value;
                                    const prevEmpName = employees.find(e => e.uid === customer.assignedToUid || e.email === customer.assignedTo)?.name || (customer.assignedTo === 'admin' || customer.assignedTo === 'الإدارة' ? '👑 الإدارة' : '👑 الإدارة');
                                    
                                    if (uid === 'admin') {
                                      const logObj = createAssignmentLog(prevEmpName, '👑 الإدارة');
                                      try {
                                        await updateDoc(doc(db, 'leads_crm', customer.id), {
                                          assignedToUid: 'admin',
                                          assignedTo: 'الإدارة',
                                          assignedAt: serverTimestamp(),
                                          status: 'unassigned',
                                          updatedAt: serverTimestamp(),
                                          assignmentHistory: arrayUnion(logObj)
                                        });
                                        toast.success('تم إرجاع العميل إلى الإدارة 👑');
                                      } catch (err) { toast.error('حدث خطأ أثناء التعيين'); }
                                    } else {
                                      const emp = employees.find(x => x.uid === uid);
                                      const logObj = createAssignmentLog(prevEmpName, `👤 ${emp?.name}`);
                                      try {
                                        await updateDoc(doc(db, 'leads_crm', customer.id), {
                                          assignedToUid: uid,
                                          assignedTo: emp?.email || '',
                                          assignedAt: serverTimestamp(),
                                          status: 'assigned',
                                          updatedAt: serverTimestamp(),
                                          assignmentHistory: arrayUnion(logObj)
                                        });
                                        toast.success(`تم تعيين العميل إلى ${emp?.name}`);
                                      } catch (err) { toast.error('حدث خطأ أثناء التعيين'); }
                                    }
                                  }}
                                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-800 w-full focus:outline-none focus:border-purple-500 bg-white/70 shadow-sm cursor-pointer mb-1"
                                >
                                  <option value="admin">👑 الإدارة (الإدارة)</option>
                                  {employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(emp => (
                                    <option key={emp.uid} value={emp.uid}>
                                      👤 {emp.name} ({emp.jobTitle === 'Leader' ? '👑 Leader' : 'Agent'})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="inline-block text-xs bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full font-bold">
                                  👤 مخصص لك
                                </span>
                              )}
                            </td>
                            <td className="p-4 flex items-center gap-1.5 justify-center">
                              <button 
                                onClick={() => handleOpenNotesModal({ ...customer, isLeadCrm: true })}
                                className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center whitespace-nowrap shadow-sm"
                              >
                                <FileText size={14} className="ml-1" /> التقرير
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteSingleLeadCrm(customer)}
                                  className="bg-red-50 text-red-600 hover:bg-red-100 p-2 rounded-lg transition shadow-sm"
                                  title="حذف العميل من Leads CRM"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Bar */}
                  {filtered.length > 0 && (
                    <div className="px-6 py-4 border-t border-purple-100 bg-purple-50/40 flex flex-wrap justify-between items-center gap-3">
                      <div className="text-xs font-bold text-purple-900">
                        عرض <span className="text-purple-700 font-black">{startIndexLeads + 1}</span> إلى <span className="text-purple-700 font-black">{Math.min(startIndexLeads + ITEMS_PER_PAGE, filtered.length)}</span> من إجمالي <span className="text-purple-700 font-black">{filtered.length}</span> عميل
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Custom Page Jump Input */}
                        <div className="flex items-center gap-1 bg-white border border-purple-200 rounded-xl px-2 py-1 shadow-sm">
                          <span className="text-[11px] text-purple-900 font-bold">صفحة:</span>
                          <input 
                            type="number"
                            min="1"
                            max={totalPagesLeads}
                            defaultValue=""
                            placeholder={String(validPageLeads)}
                            className="w-14 text-center text-xs font-black border border-purple-200 rounded-lg py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500 text-purple-950 bg-purple-50/50"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = parseInt(e.target.value, 10);
                                if (val >= 1 && val <= totalPagesLeads) {
                                  setCurrentPageLeads(val);
                                  tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                                } else {
                                  toast.error(`يرجى كتابة رقم صفحة بين 1 و ${totalPagesLeads}`);
                                }
                              }
                            }}
                          />
                          <span className="text-[11px] text-purple-400 font-bold">/ {totalPagesLeads}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              const inputEl = e.currentTarget.parentElement.querySelector('input');
                              const val = parseInt(inputEl?.value, 10);
                              if (val >= 1 && val <= totalPagesLeads) {
                                setCurrentPageLeads(val);
                                tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                              } else {
                                toast.error(`يرجى كتابة رقم صفحة بين 1 و ${totalPagesLeads}`);
                              }
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold px-2 py-0.5 rounded-md transition shadow-xs cursor-pointer"
                            title="الانتقال إلى الصفحة المحددة"
                          >
                            انتقال ↵
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            setCurrentPageLeads(prev => Math.max(prev - 1, 1));
                            tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          disabled={validPageLeads === 1}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-white border border-purple-200 text-purple-900 shadow-sm hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          ◀ السابق
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPagesLeads }, (_, i) => i + 1)
                            .filter(page => page === 1 || page === totalPagesLeads || Math.abs(page - validPageLeads) <= 2)
                            .map((page, idx, arr) => {
                              const showDots = idx > 0 && page - arr[idx - 1] > 1;
                              return (
                                <React.Fragment key={page}>
                                  {showDots && <span className="text-xs text-purple-400 font-bold px-1">...</span>}
                                  <button
                                    onClick={() => {
                                      setCurrentPageLeads(page);
                                      tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className={`w-7 h-7 rounded-lg text-xs font-black transition flex items-center justify-center cursor-pointer ${
                                      validPageLeads === page
                                        ? 'bg-purple-600 text-white shadow-md'
                                        : 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-50'
                                    }`}
                                  >
                                    {page}
                                  </button>
                                </React.Fragment>
                              );
                            })}
                        </div>

                        <button
                          onClick={() => {
                            setCurrentPageLeads(prev => Math.min(prev + 1, totalPagesLeads));
                            tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          disabled={validPageLeads === totalPagesLeads}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-white border border-purple-200 text-purple-900 shadow-sm hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          التالي ▶
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === 'customers' && (
          <div ref={tableSectionRef} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/30 bg-white/50 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-gray-800">
                  {customerFilter === 'manual' ? 'العملاء المضافين يدوياً' :
                   customerFilter === 'unassigned' ? 'قائمة عملاء في الانتظار' :
                   'إجمالي قائمة العملاء المسجلين بالنظام'}
                </h2>
                {selectedEmpFilter && selectedEmpFilter !== 'all' && (
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-md flex items-center gap-1 animate-fade-in">
                    👤 {selectedEmpFilter === 'unassigned' ? 'في الانتظار' : (employees.find(e => e.uid === selectedEmpFilter)?.name || 'الموظف المختار')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap flex-1 max-w-xl justify-end">
                {/* Employee Filter Selector */}
                <div className="relative min-w-[210px]">
                  <select
                    value={selectedEmpFilter}
                    onChange={(e) => setSelectedEmpFilter(e.target.value)}
                    className="w-full bg-white text-gray-800 border border-blue-300 rounded-full py-1.5 px-3 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                  >
                    <option value="all">👥 جميع الموظفين ({customers.length} عميل)</option>
                    {customerFilter !== 'manual' && (
                      <option value="unassigned">⏳ في الانتظار ({customers.filter(c => c.status === 'unassigned' || !c.assignedTo).length} عميل)</option>
                    )}
                    {employees.map(emp => {
                      const count = customers.filter(c => c.assignedToUid === emp.uid || c.assignedTo === emp.email).length;
                      return (
                        <option key={emp.uid} value={emp.uid}>
                          {emp.role === 'admin' ? `👑 الإدارة (${emp.name})` : `${emp.jobTitle === 'Leader' ? '👑 Leader:' : '👤 Agent:'} ${emp.name}`} — ({count} عميل)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Search Input */}
                <div className="relative flex-1 min-w-[170px]">
                  <input type="text" placeholder="بحث بالاسم أو الرقم..." value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-full bg-gray-100 text-gray-800 placeholder-gray-400 border border-gray-200 rounded-full py-1.5 pr-8 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                  />
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                </div>
              </div>

              {selectedCustomers.length > 0 && (
                <button 
                  onClick={deleteSelectedCustomers}
                  className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-lg flex items-center text-sm font-bold transition"
                >
                  <Trash2 size={16} className="mr-2" /> حذف {selectedCustomers.length} عميل
                </button>
              )}
            </div>
            {/* Customers Tab Table */}
            {(() => {
              const filtered = customers.filter(c => {
                const matchesFilter = customerFilter === 'all' || (customerFilter === 'unassigned' && c.status === 'unassigned') || (customerFilter === 'manual' && c.addedBy && c.addedBy !== 'WhatsApp Webhook');
                if (!matchesFilter) return false;

                // Filter by selected employee dropdown
                if (selectedEmpFilter && selectedEmpFilter !== 'all') {
                  if (selectedEmpFilter === 'unassigned') {
                    if (c.status !== 'unassigned' && c.assignedTo) return false;
                  } else {
                    const emp = employees.find(e => e.uid === selectedEmpFilter);
                    if (c.assignedToUid !== selectedEmpFilter && c.assignedTo !== emp?.email) return false;
                  }
                }

                // Filter by CRM Status
                if (crmStatusFilter && crmStatusFilter !== 'all') {
                  if (c.crmStatus !== crmStatusFilter) return false;
                }

                const search = tableSearch.trim() || dashboardSearch.trim();
                if (!search) return true;
                const term = search.toLowerCase();
                return c.name?.toLowerCase().includes(term) || c.phoneNumber?.includes(term);
              });

              const sortMultiplier = sortOrder === 'desc' ? 1 : -1;
              filtered.sort((a, b) => {
                const timeA = (a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0)) || (a.updatedAt?.toMillis?.() || (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0)) || 0;
                const timeB = (b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0)) || (b.updatedAt?.toMillis?.() || (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0)) || 0;
                return (timeB - timeA) * sortMultiplier;
              });

              const totalPagesCust = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
              const validPageCust = Math.min(currentPageCustomers, totalPagesCust);
              const startIndexCust = (validPageCust - 1) * ITEMS_PER_PAGE;
              const paginatedCust = filtered.slice(startIndexCust, startIndexCust + ITEMS_PER_PAGE);

              const isCustPageSelected = paginatedCust.length > 0 && paginatedCust.every(c => selectedCustomers.includes(c.id));

              const rows = [];
              let lastDateStr = null;
              paginatedCust.forEach((customer, idx) => {
                const dateObj = customer.createdAt?.toDate ? customer.createdAt.toDate() : (customer.updatedAt?.toDate ? customer.updatedAt.toDate() : null);
                const dateStr = dateObj ? dateObj.toDateString() : null;
                const dateLabel = dateObj ? dateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;
                if (dateStr && dateStr !== lastDateStr) {
                  lastDateStr = dateStr;
                  rows.push(
                    <tr key={`sep-${dateStr}-${idx}`}>
                      <td colSpan="7" className="py-2 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-gray-200"></div>
                          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full whitespace-nowrap font-medium">{dateLabel || dateStr}</span>
                          <div className="flex-1 h-px bg-gray-200"></div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                rows.push(
                  <tr key={customer.id} className="hover:bg-gray-50 transition border-b border-gray-100/50">
                    <td className="p-4 text-center">
                      <input type="checkbox" checked={selectedCustomers.includes(customer.id)} onChange={() => toggleCustomerSelection(customer.id)} className="w-4 h-4 text-primary rounded" />
                    </td>
                    <td className="p-4 text-sm font-bold text-gray-800" dir="ltr">
                      <span>{customer.phoneNumber}</span>
                    </td>
                    <td className="p-4 text-sm font-semibold text-gray-700">
                      <div>{customer.name}</div>
                      {customer.addedBy && customer.addedBy !== 'WhatsApp Webhook' && (() => {
                        const isAdderAdmin = adminEmails.includes(customer.addedBy?.toLowerCase()) || customer.addedBy === 'admin' || customer.addedBy?.includes('gmail') || customer.addedBy?.includes('الإدارة') || customer.addedBy?.includes('الرئيسي');
                        const adderName = isAdderAdmin ? 'الإدارة' : (employees.find(e => e.email === customer.addedBy)?.name || customer.addedBy?.split('@')[0]);
                        return (
                          <span className="inline-block text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mt-1">
                            مضاف بواسطة: {adderName}
                          </span>
                        );
                      })()}
                      {customer.notesHistory && customer.notesHistory.length > 0 && (
                        <span className="block text-[10px] text-blue-600 font-bold mt-0.5">📝 {customer.notesHistory.length} ملاحظات مضافة</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-gray-500" dir="ltr">{formatDate(customer.createdAt || customer.updatedAt)}</td>
                    <td className="p-4 text-sm text-gray-600 font-medium">
                      <select 
                        value={customer.assignedToUid || ""}
                        onChange={(e) => handleAssignCustomer(customer.id, e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-800 w-full focus:outline-none focus:border-blue-500 bg-white/70 shadow-sm cursor-pointer mb-1"
                      >
                        <option value="" disabled>-- سحب أو تعيين --</option>
                        <option value="admin">👑 الإدارة (الإدارة)</option>
                        {employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(emp => (
                          <option key={emp.uid} value={emp.uid}>
                            👤 {emp.name} ({emp.jobTitle === 'Leader' ? '👑 Leader' : 'Agent'})
                          </option>
                        ))}
                      </select>
                      {customer.assignedAt && <span className="block text-xs text-gray-400" dir="ltr">{formatDate(customer.assignedAt)}</span>}
                    </td>
                    <td className="p-4 flex items-center gap-1.5 justify-center">
                      <button 
                        onClick={() => handleOpenNotesModal(customer)}
                        className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center whitespace-nowrap shadow-sm"
                        title="تسجيل تقرير / إضافة ملاحظات وتحديد تاريخ التجربة"
                      >
                        <FileText size={14} className="ml-1" /> التقرير
                      </button>
                      {!isCoordinator && (
                        <button 
                          onClick={() => navigate('/inbox', { state: { selectedCustomerId: customer.id } })}
                          className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center whitespace-nowrap"
                        >
                          مراسلة <MessageSquare size={14} className="mr-1" />
                        </button>
                      )}
                      {!isCoordinator && (
                        <button
                          onClick={() => handleDeleteSingleCustomer(customer)}
                          className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 p-2 rounded-lg transition shadow-sm"
                          title="حذف ونقل إلى سلة المهملات"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              });

              return (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="p-4 w-12 text-center">
                            <input 
                              type="checkbox" 
                              checked={isCustPageSelected} 
                              onChange={() => toggleAllCustomers(paginatedCust)} 
                              className="w-4 h-4 text-primary rounded cursor-pointer accent-blue-600" 
                            />
                          </th>
                          <th className="p-4 font-semibold text-gray-600 text-sm">رقم الهاتف</th>
                          <th className="p-4 font-semibold text-gray-600 text-sm">اسم العميل</th>
                          <th 
                            className="p-4 font-semibold text-gray-600 text-sm cursor-pointer hover:bg-gray-100 transition select-none"
                            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                            title="انقر للتغيير بين الأحدث والأقدم"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>التاريخ والوقت</span>
                              <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 border border-primary/20">
                                {sortOrder === 'desc' ? '⬇️ الأحدث أولاً' : '⬆️ الأقدم أولاً'}
                              </span>
                            </div>
                          </th>
                          <th className="p-4 font-semibold text-gray-600 text-sm">الموظف المسؤول</th>
                          <th className="p-4 font-semibold text-gray-600 text-sm text-center">الإجراءات والواتساب</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr><td colSpan="7" className="p-8 text-center text-gray-500 font-bold">لا يوجد عملاء مسجلين بهذه التصفية.</td></tr>
                        ) : rows}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Bar for Customers Tab */}
                  {filtered.length > 0 && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/60 flex flex-wrap justify-between items-center gap-3">
                      <div className="text-xs font-bold text-gray-700">
                        عرض <span className="text-blue-700 font-black">{startIndexCust + 1}</span> إلى <span className="text-blue-700 font-black">{Math.min(startIndexCust + ITEMS_PER_PAGE, filtered.length)}</span> من إجمالي <span className="text-blue-700 font-black">{filtered.length}</span> عميل
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Custom Page Jump Input */}
                        <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-xl px-2 py-1 shadow-sm">
                          <span className="text-[11px] text-gray-700 font-bold">صفحة:</span>
                          <input 
                            type="number"
                            min="1"
                            max={totalPagesCust}
                            defaultValue=""
                            placeholder={String(validPageCust)}
                            className="w-14 text-center text-xs font-black border border-gray-300 rounded-lg py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-gray-50/50"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = parseInt(e.target.value, 10);
                                if (val >= 1 && val <= totalPagesCust) {
                                  setCurrentPageCustomers(val);
                                  tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                                } else {
                                  toast.error(`يرجى كتابة رقم صفحة بين 1 و ${totalPagesCust}`);
                                }
                              }
                            }}
                          />
                          <span className="text-[11px] text-gray-400 font-bold">/ {totalPagesCust}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              const inputEl = e.currentTarget.parentElement.querySelector('input');
                              const val = parseInt(inputEl?.value, 10);
                              if (val >= 1 && val <= totalPagesCust) {
                                setCurrentPageCustomers(val);
                                tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                              } else {
                                toast.error(`يرجى كتابة رقم صفحة بين 1 و ${totalPagesCust}`);
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2 py-0.5 rounded-md transition shadow-xs cursor-pointer"
                            title="الانتقال إلى الصفحة المحددة"
                          >
                            انتقال ↵
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            setCurrentPageCustomers(prev => Math.max(prev - 1, 1));
                            tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          disabled={validPageCust === 1}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-white border border-gray-300 text-gray-800 shadow-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          ◀ السابق
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPagesCust }, (_, i) => i + 1)
                            .filter(page => page === 1 || page === totalPagesCust || Math.abs(page - validPageCust) <= 2)
                            .map((page, idx, arr) => {
                              const showDots = idx > 0 && page - arr[idx - 1] > 1;
                              return (
                                <React.Fragment key={page}>
                                  {showDots && <span className="text-xs text-gray-400 font-bold px-1">...</span>}
                                  <button
                                    onClick={() => {
                                      setCurrentPageCustomers(page);
                                      tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className={`w-7 h-7 rounded-lg text-xs font-black transition flex items-center justify-center cursor-pointer ${
                                      validPageCust === page
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-100'
                                    }`}
                                  >
                                    {page}
                                  </button>
                                </React.Fragment>
                              );
                            })}
                        </div>

                        <button
                          onClick={() => {
                            setCurrentPageCustomers(prev => Math.min(prev + 1, totalPagesCust));
                            tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          disabled={validPageCust === totalPagesCust}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-white border border-gray-300 text-gray-800 shadow-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          التالي ▶
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/30 bg-white/50 flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-lg font-bold text-gray-800">قائمة الموظفين وإدارة الصلاحيات</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input type="text" placeholder="ابحث باسم الموظف..." value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-52 bg-gray-100 text-gray-800 placeholder-gray-400 border border-gray-200 rounded-full py-1.5 pr-8 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                  />
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                </div>
                {selectedEmployees.length > 0 && (
                  <button 
                    onClick={deleteSelectedEmployees}
                    className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-lg flex items-center text-sm font-bold transition"
                  >
                    <Trash2 size={16} className="mr-2" /> حذف {selectedEmployees.length} موظف
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 w-12 text-center">
                      <input type="checkbox" checked={selectedEmployees.length > 0 && selectedEmployees.length === employees.filter(e => e.role !== 'admin').length} onChange={toggleAllEmployees} className="w-4 h-4 text-primary rounded" />
                    </th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">اسم الموظف / الكود</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">التدرج الوظيفي</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">بيانات الدخول (م/س)</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">أول دخول</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">آخر دخول</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm text-center">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.filter(emp => {
                    if (!tableSearch.trim() && !dashboardSearch.trim()) return true;
                    const term = (tableSearch.trim() || dashboardSearch.trim()).toLowerCase();
                    return emp.name?.toLowerCase().includes(term) || emp.email?.toLowerCase().includes(term) || emp.empCode?.toLowerCase().includes(term);
                  }).map(emp => {
                    if (emp.role === 'admin') return null;
                    return (
                      <tr key={emp.id} className={`hover:bg-gray-50 transition ${emp.isActive === false ? 'opacity-60 bg-red-50/50' : ''}`}>
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={selectedEmployees.includes(emp.id)} onChange={() => toggleEmployeeSelection(emp.id)} className="w-4 h-4 text-primary rounded" />
                        </td>
                        <td className="p-4 text-sm font-bold text-gray-800">
                          <div className="flex items-center gap-2">
                            {emp.isActive === false && <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" title="موقوف"></span>}
                            {emp.isActive !== false && <span className="w-2 h-2 bg-green-500 rounded-full shrink-0" title="نشط"></span>}
                            <span>{emp.name}</span>
                            {emp.empCode && (
                              <span className="bg-gray-100 text-gray-700 font-mono text-[11px] px-2 py-0.5 rounded border border-gray-200" dir="ltr">
                                #{emp.empCode}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm">
                          {emp.jobTitle === 'Leader' ? (
                            <span className="bg-gradient-to-r from-amber-500 to-purple-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm">
                              👑 Leader
                            </span>
                          ) : emp.jobTitle === 'Coordinator' ? (
                            <span className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm">
                              📋 منسق للإدارة (Coordinator)
                            </span>
                          ) : (
                            <span className="bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                              Agent
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-sm">
                          <div className="flex flex-col space-y-1">
                            <span className="text-blue-600 font-mono" dir="ltr">{emp.username || emp.email?.split('@')[0]}</span>
                            <span className="text-red-600 font-mono font-bold text-xs" dir="ltr">{emp.password || 'غير محفوظ (قم بتعديله ليظهر)'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-gray-500" dir="ltr">{formatDate(emp.firstLoginAt)}</td>
                        <td className="p-4 text-xs text-gray-500" dir="ltr">{formatDate(emp.lastLoginAt)}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center space-x-2 space-x-reverse">
                            <button 
                              onClick={() => { 
                                setEditEmp(emp); 
                                setEditEmpPassword(emp.password || ''); 
                                setEditEmpName(emp.name || ''); 
                                setEditEmpUsername(emp.username || emp.email?.split('@')[0] || '');
                                setEditEmpCode(emp.empCode || '');
                                setEditEmpJobTitle(emp.jobTitle || 'Agent');
                                setIsEditEmployeeOpen(true); 
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="تعديل بيانات الموظف"
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              onClick={() => toggleEmployeeActive(emp)}
                              className={`p-2 rounded-lg transition shadow-sm border ${emp.isActive === false ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'}`}
                              title={emp.isActive === false ? "السماح بالدخول (تفعيل)" : "إيقاف الموظف مؤقتاً"}
                            >
                              {emp.isActive === false ? <Play size={18} /> : <Pause size={18} />}
                            </button>
                            <button
                              onClick={() => handleDeleteSingleEmployee(emp)}
                              className="p-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg transition shadow-sm"
                              title="مسح الموظف ونقله لسلة المهملات"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {employees.filter(e => e.role !== 'admin').length === 0 && (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-gray-500">لا يوجد موظفين مسجلين بعد.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Visitors Tab - موقع الويب فقط */}
        {activeTab === 'visitors' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/30 bg-white/50 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">عملاء الزوار (مسجلي الدخول بالموقع)</h2>
                <p className="text-xs text-gray-500 mt-0.5">هؤلاء العملاء سجلوا دخولهم عبر الموقع الإلكتروني فقط</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input type="text" placeholder="بحث بالاسم أو الرقم..." value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-52 bg-gray-100 text-gray-800 placeholder-gray-400 border border-gray-200 rounded-full py-1.5 pr-8 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                  />
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                </div>
                {selectedVisitors.length > 0 && (
                  <button 
                    onClick={deleteSelectedVisitors}
                    className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-lg flex items-center text-sm font-bold transition"
                  >
                    <Trash2 size={16} className="mr-2" /> حذف {selectedVisitors.length}
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 w-12 text-center">
                      <input type="checkbox" checked={selectedVisitors.length > 0 && selectedVisitors.length === visitors.length} onChange={toggleAllVisitors} className="w-4 h-4 text-primary rounded" />
                    </th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">اسم الزائر</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">رقم الهاتف</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">البريد الإلكتروني</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">تاريخ التسجيل</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visitors.filter(v => {
                    const search = tableSearch.trim() || dashboardSearch.trim();
                    if (!search) return true;
                    const term = search.toLowerCase();
                    return v.firstName?.toLowerCase().includes(term) || v.lastName?.toLowerCase().includes(term) || v.phone?.includes(term) || v.email?.toLowerCase().includes(term);
                  }).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).map(visitor => (
                    <tr key={visitor.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 text-center">
                        <input type="checkbox" checked={selectedVisitors.includes(visitor.id)} onChange={() => toggleVisitorSelection(visitor.id)} className="w-4 h-4 text-primary rounded" />
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-800">{visitor.firstName} {visitor.lastName}</td>
                      <td className="p-4 text-sm font-mono text-gray-600" dir="ltr">{visitor.phone}</td>
                      <td className="p-4 text-sm text-gray-600">{visitor.email || 'غير متوفر'}</td>
                      <td className="p-4 text-xs text-gray-500" dir="ltr">{formatDate(visitor.createdAt)}</td>
                      <td className="p-4">
                        <button
                          onClick={() => handleDeleteSingleVisitor({ source: 'موقع الويب', id: visitor.id, name: `${visitor.firstName || ''} ${visitor.lastName || ''}`, _raw: visitor })}
                          className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 p-2 rounded-lg transition shadow-sm"
                          title="حذف ونقل إلى سلة المهملات"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {visitors.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-500">لا يوجد زوار مسجلين عبر الموقع حتى الآن.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WhatsApp Visitors Tab - الزوار عبر الواتساب */}
        {activeTab === 'whatsapp_visitors' && (
          <div ref={tableSectionRef} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-indigo-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-indigo-100 bg-indigo-50/50 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-indigo-800 flex items-center gap-2">
                  <Globe size={20} className="text-indigo-600" /> عملاء الزوار (واتساب)
                </h2>
                <p className="text-xs text-indigo-600 mt-0.5">عملاء الموقع + من راسلنا مباشرة عبر الواتساب • مرتبطة بقائمة الانتظار</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input type="text" placeholder="بحث بالاسم أو الرقم..." value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-52 bg-white text-gray-800 placeholder-gray-400 border border-indigo-200 rounded-full py-1.5 pr-8 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                  />
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-400" size={14} />
                </div>
                {selectedVisitors.length > 0 && (
                  <button 
                    onClick={deleteSelectedVisitors}
                    className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-lg flex items-center text-sm font-bold transition shadow-sm"
                  >
                    <Trash2 size={16} className="mr-2" /> حذف {selectedVisitors.length} زائر
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-indigo-50/50 border-b border-indigo-100">
                    <th className="p-4 w-12 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedVisitors.length > 0} 
                        onChange={() => {
                          const combinedIds = [
                            ...visitors.map(v => v.id),
                            ...customers.filter(c => c.addedBy === 'WhatsApp Webhook').map(c => c.id)
                          ];
                          if (selectedVisitors.length > 0) setSelectedVisitors([]);
                          else setSelectedVisitors(combinedIds);
                        }} 
                        className="w-4 h-4 text-primary rounded" 
                      />
                    </th>
                    <th className="p-4 font-semibold text-indigo-700 text-sm">الاسم / رقم الهاتف</th>
                    <th className="p-4 font-semibold text-indigo-700 text-sm">المصدر</th>
                    <th className="p-4 font-semibold text-indigo-700 text-sm">الحالة في قائمة الانتظار</th>
                    <th 
                      className="p-4 font-semibold text-indigo-700 text-sm cursor-pointer hover:bg-indigo-100/50 transition select-none"
                      onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      title="انقر للتغيير بين الأحدث والأقدم"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>التاريخ والوقت</span>
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 border border-indigo-200">
                          {sortOrder === 'desc' ? '⬇️ الأحدث' : '⬆️ الأقدم'}
                        </span>
                      </div>
                    </th>
                    <th className="p-4 font-semibold text-indigo-700 text-sm">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const sortMultiplier = sortOrder === 'desc' ? 1 : -1;
                    const combined = [
                      ...visitors.map(v => ({ id: v.id, name: `${v.firstName || ''} ${v.lastName || ''}`.trim(), phone: v.phone, source: 'موقع الويب', createdAt: v.createdAt, status: 'website_visitor', _raw: v })),
                      ...customers.filter(c => c.addedBy === 'WhatsApp Webhook').map(c => ({ id: c.id, name: c.name || c.phoneNumber, phone: c.phoneNumber, source: 'واتساب مباشر', createdAt: c.createdAt, status: c.status, _raw: c }))
                    ].filter(v => {
                      const search = tableSearch.trim() || dashboardSearch.trim();
                      if (!search) return true;
                      const term = search.toLowerCase();
                      return v.name?.toLowerCase().includes(term) || v.phone?.includes(term);
                    }).sort((a, b) => {
                      const timeA = (a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0)) || 0;
                      const timeB = (b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0)) || 0;
                      return (timeB - timeA) * sortMultiplier;
                    });
                    if (combined.length === 0) return (
                      <tr><td colSpan="6" className="p-8 text-center text-gray-500">لا يوجد عملاء زوار حتى الآن.</td></tr>
                    );
                    const rows = [];
                    let lastDateStr = null;
                    combined.forEach((visitor, idx) => {
                      const dateObj = visitor.createdAt?.toDate ? visitor.createdAt.toDate() : null;
                      const dateStr = dateObj ? dateObj.toDateString() : null;
                      const dateLabel = dateObj ? dateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;
                      if (dateStr && dateStr !== lastDateStr) {
                        lastDateStr = dateStr;
                        rows.push(
                          <tr key={`sep-${dateStr}-${idx}`}>
                            <td colSpan="6" className="py-2 px-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-indigo-100"></div>
                                <span className="text-xs text-indigo-400 bg-indigo-50 px-3 py-1 rounded-full whitespace-nowrap font-medium">{dateLabel || dateStr}</span>
                                <div className="flex-1 h-px bg-indigo-100"></div>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      rows.push(
                        <tr key={visitor.id} className="hover:bg-indigo-50/30 transition border-b border-indigo-50">
                          <td className="p-4 text-center">
                            <input 
                              type="checkbox" 
                              checked={selectedVisitors.includes(visitor.id)} 
                              onChange={() => toggleVisitorSelection(visitor.id)} 
                              className="w-4 h-4 text-primary rounded" 
                            />
                          </td>
                          <td className="p-4">
                            <p className="text-sm font-bold text-gray-800">{visitor.name || 'غير معروف'}</p>
                            <p className="text-xs text-gray-500 font-mono" dir="ltr">{visitor.phone}</p>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold w-max ${visitor.source === 'واتساب مباشر' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {visitor.source}
                              </span>
                              {visitor._raw?.contactReason === 'support' || visitor._raw?.lastMessage?.includes('دعم') ? (
                                <span className="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full text-[11px] font-extrabold w-max">
                                  🎧 خدمة دعم العملاء
                                </span>
                              ) : visitor._raw?.contactReason === 'details' || visitor._raw?.lastMessage?.includes('تفاصيل') ? (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px] font-extrabold w-max">
                                  🎯 مهتم بالتفاصيل
                                </span>
                              ) : (
                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[11px] font-bold w-max">
                                  💬 تواصل عام
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            {visitor.status === 'unassigned' ? (
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">• في الانتظار</span>
                            ) : visitor.status === 'website_visitor' ? (
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-bold">مسجل فقط</span>
                            ) : (
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">مستلمة</span>
                            )}
                          </td>
                          <td className="p-4 text-xs text-gray-500" dir="ltr">{formatDate(visitor.createdAt)}</td>
                          <td className="p-4 flex items-center gap-2">
                            {visitor.status !== 'website_visitor' && (
                              <button 
                                onClick={() => navigate('/inbox', { state: { selectedCustomerId: visitor.id } })}
                                className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                              >
                                مراسلة <MessageSquare size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteSingleVisitor(visitor)}
                              className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 p-2 rounded-lg transition shadow-sm"
                              title="حذف ونقل إلى سلة المهملات"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recycle Bin Tab */}
        {activeTab === 'recycle_bin' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-red-500/20 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-red-500/20 bg-red-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h2 className="text-lg font-bold text-red-800 flex items-center">
                <Trash2 className="mr-2" size={20} /> سلة المهملات
              </h2>
              <div className="flex space-x-2 space-x-reverse">
                <button onClick={() => setRbFilter('all')} className={`px-3 py-1 rounded-full text-xs font-bold transition ${rbFilter === 'all' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>الكل</button>
                <button onClick={() => setRbFilter('employee')} className={`px-3 py-1 rounded-full text-xs font-bold transition ${rbFilter === 'employee' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>موظفين</button>
                <button onClick={() => setRbFilter('customer')} className={`px-3 py-1 rounded-full text-xs font-bold transition ${rbFilter === 'customer' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>عملاء</button>
                <button onClick={() => setRbFilter('visitor')} className={`px-3 py-1 rounded-full text-xs font-bold transition ${rbFilter === 'visitor' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>زوار</button>
                <button onClick={() => setRbFilter('message')} className={`px-3 py-1 rounded-full text-xs font-bold transition ${rbFilter === 'message' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>رسائل</button>
              </div>
            </div>
            
            {selectedRecycleItems.length > 0 && (
              <div className="bg-red-50 px-6 py-3 border-b border-red-200 flex items-center justify-between">
                <span className="text-sm font-bold text-red-800">
                  تم تحديد {selectedRecycleItems.length} عنصر
                </span>
                <div className="flex space-x-2 space-x-reverse">
                  <button onClick={restoreSelectedRecycleItems} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-green-700 transition shadow-sm">
                    استرجاع المحدد
                  </button>
                  <button onClick={deleteSelectedRecycleItemsForever} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-red-700 transition shadow-sm">
                    حذف المحدد نهائياً للأبد
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-red-50/30 border-b border-red-100">
                    <th className="p-4 w-12">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500 cursor-pointer"
                        onChange={toggleAllRecycleItems}
                        checked={selectedRecycleItems.length === recycleBin.filter(item => rbFilter === 'all' || item.type === rbFilter).length && recycleBin.filter(item => rbFilter === 'all' || item.type === rbFilter).length > 0}
                      />
                    </th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">النوع</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">بيانات العنصر</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">تاريخ الحذف</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm text-center">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {recycleBin.filter(item => {
                    const matchesType = rbFilter === 'all' || item.type === rbFilter;
                    if (!matchesType) return false;
                    if (!dashboardSearch.trim()) return true;
                    const term = dashboardSearch.toLowerCase();
                    return item.name?.toLowerCase().includes(term) || item.firstName?.toLowerCase().includes(term) || item.email?.toLowerCase().includes(term) || item.phone?.includes(term) || item.phoneNumber?.includes(term);
                  }).map(item => (
                    <tr key={item.id} className={`transition ${selectedRecycleItems.includes(item.id) ? 'bg-red-50' : 'hover:bg-red-50/50'}`}>
                      <td className="p-4">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500 cursor-pointer"
                          checked={selectedRecycleItems.includes(item.id)}
                          onChange={() => toggleRecycleSelection(item.id)}
                        />
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-700">
                        {item.type === 'employee' && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">موظف</span>}
                        {item.type === 'customer' && <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">عميل</span>}
                        {item.type === 'visitor' && <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs">زائر</span>}
                        {item.type === 'message' && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs">رسالة محذوفة</span>}
                      </td>
                      <td className="p-4 text-sm text-gray-800">
                        {item.type === 'employee' && (<span>{item.name} ({item.email})</span>)}
                        {item.type === 'customer' && (<span>{item.name} <span dir="ltr">({item.phoneNumber})</span></span>)}
                        {item.type === 'visitor' && (<span>{item.firstName} {item.lastName} <span dir="ltr">({item.phone})</span></span>)}
                        {item.type === 'message' && (<span className="text-gray-500 italic">"{item.text?.substring(0, 50)}..."</span>)}
                      </td>
                      <td className="p-4 text-xs text-gray-500" dir="ltr">{formatDate(item.deletedAt)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center space-x-2 space-x-reverse">
                          <button 
                            onClick={() => handleRestore(item)}
                            className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg transition text-xs font-bold"
                          >
                            استرجاع
                          </button>
                          <button 
                            onClick={() => handleDeleteForever(item.id)}
                            className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg transition text-xs font-bold"
                          >
                            حذف للأبد
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {recycleBin.filter(item => rbFilter === 'all' || item.type === rbFilter).length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-500">سلة المهملات فارغة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Add Employee */}
        {isAddEmployeeOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsAddEmployeeOpen(false)}>
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setIsAddEmployeeOpen(false)} 
                className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition"
              >
                <X size={24} />
              </button>
              
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <UserPlus className="ml-2 text-primary" size={24} /> 
                تسجيل موظف جديد
              </h2>

              {errorAdd && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
                  {errorAdd}
                </div>
              )}

              <form onSubmit={handleAddEmployee} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم الموظف</label>
                  <input 
                    type="text" 
                    required
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    placeholder="مثال: أحمد محمد"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كود الموظف</label>
                  <input 
                    type="text" 
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition font-mono text-left"
                    value={newEmpCode}
                    onChange={(e) => setNewEmpCode(e.target.value)}
                    placeholder="مثال: EMP-101"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">التدرج الوظيفي (Job Title)</label>
                  <select 
                    value={newEmpJobTitle}
                    onChange={(e) => setNewEmpJobTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition font-bold"
                  >
                    <option value="Agent">Agent (ايجنت)</option>
                    <option value="Leader">Leader (ليدر)</option>
                    <option value="Coordinator">منسق للإدارة (Coordinator)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم (للدخول)</label>
                  <input 
                    type="text" 
                    required
                    autoComplete="new-username"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition text-left"
                    value={newEmpUsername}
                    onChange={(e) => setNewEmpUsername(e.target.value)}
                    placeholder="مثال: ahmed"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور (6 أحرف أو أكثر)</label>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition text-left"
                    value={newEmpPassword}
                    onChange={(e) => setNewEmpPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loadingAdd}
                  className="w-full bg-primary hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition mt-4 disabled:opacity-50"
                >
                  {loadingAdd ? 'جاري التسجيل...' : 'تسجيل الموظف'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Employee Details */}
        {isEditEmployeeOpen && editEmp && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsEditEmployeeOpen(false)}>
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setIsEditEmployeeOpen(false)} 
                className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition"
              >
                <X size={24} />
              </button>
              
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <Shield className="ml-2 text-blue-600" size={24} /> 
                تعديل بيانات الموظف
              </h2>

              {errorEdit && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
                  {errorEdit}
                </div>
              )}

              <form onSubmit={handleEditEmployee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم الموظف</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    value={editEmpName}
                    onChange={(e) => setEditEmpName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كود الموظف</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-left font-mono"
                    value={editEmpCode}
                    onChange={(e) => setEditEmpCode(e.target.value)}
                    placeholder="مثال: EMP-101"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">التدرج الوظيفي (Job Title)</label>
                  <select 
                    value={editEmpJobTitle}
                    onChange={(e) => setEditEmpJobTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-bold"
                  >
                    <option value="Agent">Agent (ايجنت)</option>
                    <option value="Leader">Leader (ليدر)</option>
                    <option value="Coordinator">منسق للإدارة (Coordinator)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم (للدخول)</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-left"
                    value={editEmpUsername}
                    onChange={(e) => setEditEmpUsername(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة</label>
                  <input 
                    type="text" 
                    required
                    minLength={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-left font-mono"
                    value={editEmpPassword}
                    onChange={(e) => setEditEmpPassword(e.target.value)}
                    placeholder="اكتب الباسورد الجديد هنا"
                    dir="ltr"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loadingEdit}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition mt-4 disabled:opacity-50"
                >
                  {loadingEdit ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal 1: Import Leads (Excel, GSheet, Text/PDF Parser) */}
        {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsImportModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setIsImportModalOpen(false)} 
                className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition"
              >
                <X size={24} />
              </button>

              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FileSpreadsheet className="text-blue-600" size={26} />
                <span>📥 استيراد داتا عملاء جديدة</span>
              </h2>

              {/* Import Tabs */}
              <div className="flex border-b border-gray-200 mb-6 gap-2">
                <button 
                  onClick={() => setImportTab('file')}
                  className={`pb-2.5 px-4 font-bold text-sm transition border-b-2 flex items-center gap-2 ${importTab === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <FileSpreadsheet size={16} /> رفع ملف Excel / CSV
                </button>
                <button 
                  onClick={() => setImportTab('gsheet')}
                  className={`pb-2.5 px-4 font-bold text-sm transition border-b-2 flex items-center gap-2 ${importTab === 'gsheet' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <Share2 size={16} /> رابط Google Sheet
                </button>
                <button 
                  onClick={() => setImportTab('text')}
                  className={`pb-2.5 px-4 font-bold text-sm transition border-b-2 flex items-center gap-2 ${importTab === 'text' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <FileText size={16} /> استخراج من PDF / صور
                </button>
              </div>

              {/* Tab 1: File Upload */}
              {importTab === 'file' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-blue-300 bg-blue-50/50 p-8 rounded-xl text-center hover:bg-blue-50 transition cursor-pointer">
                    <Upload className="mx-auto text-blue-600 mb-2" size={36} />
                    <p className="text-sm font-bold text-gray-700">اختر ملف Excel (.xlsx أو .csv) من جهازك</p>
                    <p className="text-xs text-gray-400 mt-1">يتعرف تلقائياً على أعمدة: الاسم - رقم الهاتف - ملاحظات</p>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleFileUpload}
                      className="mt-3 block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Google Sheets */}
              {importTab === 'gsheet' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">رابط Google Sheet (يجب أن يكون عام / Public)</label>
                    <input 
                      type="url" 
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={gsheetUrl}
                      onChange={(e) => setGsheetUrl(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-green-500"
                      dir="ltr"
                    />
                  </div>
                  <button 
                    onClick={handleGsheetImport}
                    disabled={importLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {importLoading ? 'جاري التحميل...' : '🔗 جلب البيانات من Google Sheet'}
                  </button>
                </div>
              )}

              {/* Tab 3: Text & PDF Extractor */}
              {importTab === 'text' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">انقلي/الصقي النص من ملف PDF أو من سكرين شوتس الشيتات</label>
                    <textarea 
                      rows={5}
                      placeholder="انسخ النص المجمع من ملف الـ PDF أو الشيت والصقه هنا... سيستخرج النظام أرقام الجوال والأسماء تلقائياً."
                      value={rawImportText}
                      onChange={(e) => setRawImportText(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg text-xs outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <button 
                    onClick={handleTextExtract}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    🔍 استخراج الأرقام والأسماء الآن
                  </button>
                </div>
              )}

              {/* Preview extracted leads */}
              {importRows.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-green-700">معاينة البيانات الاستيرادية ({importRows.length} عميل جاهز للحفظ):</span>
                    <button 
                      onClick={() => setImportRows([])}
                      className="text-xs text-red-500 hover:underline"
                    >
                      إلغاء المعاينة
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-lg divide-y bg-gray-50">
                    {importRows.slice(0, 10).map((row, i) => (
                      <div key={i} className="p-2 text-xs flex justify-between items-center">
                        <span className="font-bold text-gray-800">{row.name}</span>
                        <span className="font-mono text-blue-600" dir="ltr">{row.phone}</span>
                      </div>
                    ))}
                    {importRows.length > 10 && (
                      <div className="p-2 text-center text-xs text-gray-400 font-bold">... و {importRows.length - 10} عميل آخرين</div>
                    )}
                  </div>
                  <button 
                    onClick={handleSaveImportedLeads}
                    disabled={importLoading}
                    className="w-full bg-primary hover:bg-green-600 text-white font-black py-3 px-4 rounded-xl transition mt-4 shadow-lg text-sm flex items-center justify-center gap-2"
                  >
                    {importLoading ? 'جاري التخزين...' : `✅ حفظ الـ ${importRows.length} عميل في قاعدة بيانات الـ CRM`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal 2: Auto & Manual Lead Distribution */}
        {isAssignModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsAssignModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setIsAssignModalOpen(false)} 
                className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition"
              >
                <X size={24} />
              </button>

              <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                <UserCheck2 className="text-purple-600" size={26} />
                <span>⚖️ توزيع وتقسيم العملاء على الموظفين</span>
              </h2>

              {/* Source Pool Selection */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-2">اختر فئة العملاء المراد توزيعهم:</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <button 
                    type="button"
                    onClick={() => setAssignSourcePool('all')}
                    className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between ${assignSourcePool === 'all' ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                  >
                    <span>🎯 جميع Leads CRM</span>
                    <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-[10px]">{leadsCrm.length}</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setAssignSourcePool('unassigned')}
                    className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between ${assignSourcePool === 'unassigned' ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                  >
                    <span>⏳ غير المعينين (في الانتظار)</span>
                    <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-[10px]">{leadsCrm.filter(c => c.status === 'unassigned' || !c.assignedTo).length}</span>
                  </button>

                  {selectedLeadsCrm.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => setAssignSourcePool('selected')}
                      className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between col-span-2 ${assignSourcePool === 'selected' ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                    >
                      <span>✅ العملاء المحددين يدويًا بالصح</span>
                      <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-[10px]">{selectedLeadsCrm.length}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Mode Selection */}
              {!isCoordinator ? (
                <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
                  <button 
                    onClick={() => setAssignMode('equal')}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition ${assignMode === 'equal' ? 'bg-purple-600 text-white shadow' : 'text-gray-600'}`}
                  >
                    🔄 توزيع تلقائي بالتساوي
                  </button>
                  <button 
                    onClick={() => setAssignMode('single')}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition ${assignMode === 'single' ? 'bg-purple-600 text-white shadow' : 'text-gray-600'}`}
                  >
                    👤 تخصيص لموظف معين
                  </button>
                </div>
              ) : (
                <div className="bg-purple-50 border border-purple-200 text-purple-900 px-4 py-2.5 rounded-xl mb-4 text-xs font-bold flex items-center justify-between shadow-sm">
                  <span>👤 تخصيص وتعيين العملاء لموظف معين:</span>
                  <span className="text-[10px] bg-purple-200 text-purple-800 px-2.5 py-0.5 rounded-full font-bold">📋 منسق للإدارة</span>
                </div>
              )}

              {(!isCoordinator && assignMode === 'equal') ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-gray-700">حدد الموظفين النشطين للتقسيم عليهم بالتساوي:</label>
                    <button 
                      type="button"
                      onClick={() => setAssignEmpUids(employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(e => e.uid))}
                      className="text-[11px] text-purple-600 font-bold hover:underline"
                    >
                      تحديد الكل
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto border rounded-xl p-3 space-y-2 bg-gray-50">
                    {employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(emp => (
                      <label key={emp.uid} className="flex items-center justify-between cursor-pointer text-xs font-bold text-gray-800 hover:bg-purple-50/50 p-1.5 rounded-lg transition">
                        <div className="flex items-center gap-2.5">
                          <input 
                            type="checkbox"
                            checked={assignEmpUids.includes(emp.uid)}
                            onChange={(e) => {
                              if (e.target.checked) setAssignEmpUids([...assignEmpUids, emp.uid]);
                              else setAssignEmpUids(assignEmpUids.filter(id => id !== emp.uid));
                            }}
                            className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                          />
                          <span>👤 {emp.name || emp.username || emp.email?.split('@')[0]}</span>
                        </div>
                        <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-mono">{emp.jobTitle || emp.role || 'Agent'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-700">اختر الموظف المستلم:</label>
                  <select 
                    value={singleAssignEmpUid}
                    onChange={(e) => setSingleAssignEmpUid(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-purple-500 bg-white cursor-pointer"
                  >
                    <option value="">-- اختر موظف --</option>
                    <option value="admin">👑 الإدارة</option>
                    {employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(emp => (
                      <option key={emp.uid} value={emp.uid}>
                        👤 {emp.name} ({emp.jobTitle === 'Leader' ? '👑 Leader' : 'Agent'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button 
                onClick={handleExecuteAssignment}
                disabled={assignLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl transition mt-5 shadow-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {assignLoading ? 'جاري التوزيع...' : '🚀 تنفيذ وتحديث التوزيع الآن'}
              </button>
            </div>
          </div>
        )}

        {/* Modal 3: Customer Report, Timeline Notes & Trial Date */}
        {isNotesModalOpen && selectedCustomerForNotes && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsNotesModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setIsNotesModalOpen(false)} 
                className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition"
              >
                <X size={24} />
              </button>

              <div className="flex items-center justify-between mb-3 pl-8">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="text-amber-600" size={24} />
                  <span>تقرير وملاحظات العميل</span>
                </h2>
                {isCoordinator && (
                  <span className="text-[11px] bg-teal-100 text-teal-800 font-bold px-2.5 py-0.5 rounded-full border border-teal-200">
                    👁️ قراءة فقط (منسق)
                  </span>
                )}
              </div>

              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 mb-3 space-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">اسم العميل:</label>
                  {isCoordinator ? (
                    <div className="w-full px-3 py-1.5 border border-amber-200 rounded-lg text-xs font-black text-gray-800 bg-white shadow-sm">
                      {modalCustomerName || selectedCustomerForNotes.name || 'عميل جديد'}
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      value={modalCustomerName}
                      onChange={(e) => setModalCustomerName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-amber-600 bg-white shadow-sm"
                      placeholder="اسم العميل..."
                    />
                  )}
                </div>
                <p className="text-xs text-gray-500 font-mono font-bold" dir="ltr">📱 {selectedCustomerForNotes.phoneNumber}</p>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {/* CRM Status Picker (Leads CRM Only) */}
                {selectedCustomerForNotes?.isLeadCrm && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">حالة العميل (CRM Status):</label>
                      {isCoordinator ? (
                        <div className="w-full p-2.5 border rounded-xl text-xs font-black text-gray-800 bg-gray-50">
                          {CRM_STATUS_MAP[selectedStatusForNotes]?.label || '⏳ في الانتظار'}
                        </div>
                      ) : (
                        <select 
                          value={selectedStatusForNotes}
                          onChange={(e) => setSelectedStatusForNotes(e.target.value)}
                          className="w-full p-2.5 border rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-amber-500 bg-white cursor-pointer"
                        >
                          <option value="unassigned">⏳ في الانتظار</option>
                          <option value="interested">🌟 مهتم</option>
                          <option value="not_interested">❌ غير مهتم</option>
                          <option value="no_answer">📵 لم يرد</option>
                          <option value="subscribed">🎉 تم الاشتراك</option>
                          <option value="started_trial">🚀 بدأ تجربة بالفعل</option>
                        </select>
                      )}
                    </div>

                    {/* Trial Start Date if Status is started_trial */}
                    {selectedStatusForNotes === 'started_trial' && (
                      <div className="bg-cyan-50 p-3 rounded-xl border border-cyan-200">
                        <label className="block text-xs font-bold text-cyan-800 mb-1 flex items-center gap-1">
                          <Calendar size={14} /> تاريخ بدء التجربة:
                        </label>
                        {isCoordinator ? (
                          <div className="w-full p-2 border border-cyan-200 rounded-lg text-xs font-black text-cyan-900 bg-white">
                            {trialDateForNotes || 'غير محدد'}
                          </div>
                        ) : (
                          <input 
                            type="date"
                            value={trialDateForNotes}
                            onChange={(e) => setTrialDateForNotes(e.target.value)}
                            className="w-full p-2 border border-cyan-300 rounded-lg text-xs font-bold bg-white outline-none cursor-pointer"
                          />
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Notes History Timeline */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">سجل الملاحظات والتقارير السابقة:</label>
                  <div className="max-h-40 overflow-y-auto border rounded-xl p-3 bg-gray-50 space-y-2">
                    {selectedCustomerForNotes.notesHistory && selectedCustomerForNotes.notesHistory.length > 0 ? (
                      selectedCustomerForNotes.notesHistory.map((note, i) => {
                        const isNoteByAdmin = !note.author || adminEmails.includes(note.author?.toLowerCase()) || note.author === 'admin' || note.author?.includes('gmail') || note.author?.includes('الإدارة') || note.author?.includes('الرئيسي');
                        const authorDisplay = isNoteByAdmin ? '👑 الإدارة' : (employees.find(e => e.email === note.author)?.name || note.author?.split('@')[0] || 'الموظف');

                        return (
                          <div key={note.id || i} className="bg-white p-2.5 rounded-lg border text-xs space-y-1 relative group hover:border-amber-300 transition shadow-sm">
                            <div className="flex justify-between items-center text-[10px] text-gray-400">
                              <span className="font-bold text-blue-600">👤 {authorDisplay}</span>
                              <div className="flex items-center gap-2">
                                {!isNoteByAdmin && note.createdAt && (
                                  <span dir="ltr">{new Date(note.createdAt).toLocaleString('ar-EG')}</span>
                                )}
                                {isAdmin && (
                                  <button 
                                    onClick={() => handleDeleteSingleNote(note, i)}
                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition cursor-pointer"
                                    title="مسح هذه الملاحظة نهائياً من التقرير (خاص بالأدمن)"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-800 font-medium whitespace-pre-wrap">{note.text}</p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-4">لا يوجد ملاحظات مسجلة بعد لهذا العميل.</p>
                    )}
                  </div>
                </div>

                {/* Assignment & Transfer Audit Log (Admin Only) */}
                {isAdmin && (
                  <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-200/80">
                    <label className="block text-xs font-black text-purple-900 mb-2 flex items-center gap-1.5">
                      <UserCheck size={15} className="text-purple-600" />
                      <span>🔄 سجل تحويلات العميل بين الموظفين (خاص بالإدارة):</span>
                    </label>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {selectedCustomerForNotes.assignmentHistory && selectedCustomerForNotes.assignmentHistory.length > 0 ? (
                        selectedCustomerForNotes.assignmentHistory.map((log, idx) => (
                          <div key={log.id || idx} className="bg-white p-2 rounded-lg border border-purple-100 shadow-sm text-[11px] flex flex-col gap-0.5">
                            <div className="flex items-center justify-between font-bold text-gray-800">
                              <span className="text-purple-800">{log.from} ➔ {log.to}</span>
                              <span className="text-[10px] text-gray-400 font-mono" dir="ltr">
                                {new Date(log.assignedAt).toLocaleString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-semibold flex justify-between items-center">
                              <span>بواسطة: {log.assignedBy}</span>
                              <span className="text-purple-600 font-black">تحويل #{idx + 1}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-gray-500 font-medium py-1.5 text-center bg-white/60 rounded-lg">
                          {selectedCustomerForNotes.assignedAt ? (
                            <span>تاريخ التنسيب الأول: <strong className="font-mono" dir="ltr">{formatDate(selectedCustomerForNotes.assignedAt)}</strong> (المسند إليه: {selectedCustomerForNotes.assignedTo || 'الموظف'})</span>
                          ) : (
                            <span>لم يتم تسجيل تحويلات سابقة لهذا العميل بعد.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Add New Note (Hidden for Coordinator) */}
                {!isCoordinator && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">إضافة ملاحظة / تقرير جديد:</label>
                    <textarea 
                      rows={3}
                      placeholder="اكتب تفاصيل المكالمة أو الاستفسار الملاحظ هنا..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {!isCoordinator ? (
                <button 
                  onClick={handleSaveCustomerNotesAndStatus}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl transition mt-4 shadow-lg text-sm cursor-pointer"
                >
                  💾 حفظ التغييرات والملاحظة
                </button>
              ) : (
                <button 
                  onClick={() => setIsNotesModalOpen(false)}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 px-4 rounded-xl transition mt-4 shadow-md text-xs cursor-pointer"
                >
                  إغلاق التقرير ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modal 4: Leads CRM Analysis (Performance Dashboard for Admin & Employee) */}
        {isLeadsAnalysisModalOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setIsLeadsAnalysisModalOpen(false)}>
            <div className="bg-slate-900 text-white rounded-3xl shadow-2xl w-full max-w-4xl p-6 relative max-h-[90vh] flex flex-col border border-purple-500/30 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-4 border-b border-purple-500/20 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl shadow-lg border border-purple-300/40">
                    <BarChart3 size={24} className="text-cyan-300" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <span>Leads CRM Analysis 📊</span>
                    </h2>
                    <p className="text-xs text-purple-300 font-medium">
                      {isAdmin ? 'تقرير كفاءة وأداء جميع الموظفين ونسبة تحويل العملاء' : 'تقرير تحليلي لكفاءة الأداء وإحصائيات العملاء الخاصة بك'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsLeadsAnalysisModalOpen(false)} 
                  className="bg-white/10 hover:bg-rose-600 text-white p-2 rounded-full transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                {!isAdmin ? (
                  /* --- EMPLOYEE INDIVIDUAL ANALYSIS --- */
                  (() => {
                    const empLeads = leadsCrm.filter(c => c.assignedToUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase());
                    const total = empLeads.length;
                    const subscribed = empLeads.filter(c => c.crmStatus === 'subscribed').length;
                    const trial = empLeads.filter(c => c.crmStatus === 'started_trial').length;
                    const interested = empLeads.filter(c => c.crmStatus === 'interested').length;
                    const noAnswer = empLeads.filter(c => c.crmStatus === 'no_answer').length;
                    const notInterested = empLeads.filter(c => c.crmStatus === 'not_interested').length;
                    const pending = empLeads.filter(c => !c.crmStatus || c.crmStatus === 'unassigned').length;

                    const successfulCount = subscribed + trial + interested;
                    const successRate = total > 0 ? Math.round((successfulCount / total) * 100) : 0;

                    return (
                      <div className="space-y-5">
                        {/* Overall Score Badge */}
                        <div className="bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 p-5 rounded-2xl border border-purple-500/40 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
                          <div>
                            <span className="text-xs text-purple-300 font-bold block mb-1">إجمالي العملاء المخصصين لك:</span>
                            <span className="text-3xl font-black text-white">{total} عميل</span>
                          </div>
                          <div className="text-center md:text-left bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20">
                            <span className="text-xs text-purple-200 font-bold block mb-1">معدل النجاح والتفاعل الإيجابي 📈</span>
                            <span className={`text-3xl font-black ${successRate >= 50 ? 'text-emerald-400' : successRate >= 25 ? 'text-amber-400' : 'text-rose-400'}`}>
                              {successRate}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-purple-200">
                            <span>مؤشر التفاعل والإنجاز</span>
                            <span>{successfulCount} من {total} عميل ناجح</span>
                          </div>
                          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-purple-500/30 flex">
                            <div style={{ width: `${total > 0 ? (subscribed / total) * 100 : 0}%` }} className="bg-purple-500 h-full" title="تم الاشتراك"></div>
                            <div style={{ width: `${total > 0 ? (trial / total) * 100 : 0}%` }} className="bg-cyan-400 h-full" title="بدأ تجربة"></div>
                            <div style={{ width: `${total > 0 ? (interested / total) * 100 : 0}%` }} className="bg-emerald-500 h-full" title="مهتم"></div>
                            <div style={{ width: `${total > 0 ? (noAnswer / total) * 100 : 0}%` }} className="bg-amber-500 h-full" title="لم يرد"></div>
                            <div style={{ width: `${total > 0 ? (notInterested / total) * 100 : 0}%` }} className="bg-rose-500 h-full" title="غير مهتم"></div>
                          </div>
                        </div>

                        {/* Status Grid Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="bg-purple-900/40 p-4 rounded-xl border border-purple-500/40">
                            <span className="text-xs text-purple-300 font-bold block mb-1">🎉 تم الاشتراك</span>
                            <span className="text-2xl font-black text-purple-300">{subscribed}</span>
                            <span className="text-[10px] text-purple-400 font-mono block mt-1">({total > 0 ? Math.round((subscribed/total)*100) : 0}%)</span>
                          </div>

                          <div className="bg-cyan-900/40 p-4 rounded-xl border border-cyan-500/40">
                            <span className="text-xs text-cyan-300 font-bold block mb-1">🚀 بدأ تجربة بالفعل</span>
                            <span className="text-2xl font-black text-cyan-300">{trial}</span>
                            <span className="text-[10px] text-cyan-400 font-mono block mt-1">({total > 0 ? Math.round((trial/total)*100) : 0}%)</span>
                          </div>

                          <div className="bg-emerald-900/40 p-4 rounded-xl border border-emerald-500/40">
                            <span className="text-xs text-emerald-300 font-bold block mb-1">🌟 مهتم</span>
                            <span className="text-2xl font-black text-emerald-300">{interested}</span>
                            <span className="text-[10px] text-emerald-400 font-mono block mt-1">({total > 0 ? Math.round((interested/total)*100) : 0}%)</span>
                          </div>

                          <div className="bg-amber-900/40 p-4 rounded-xl border border-amber-500/40">
                            <span className="text-xs text-amber-300 font-bold block mb-1">📵 لم يرد</span>
                            <span className="text-2xl font-black text-amber-300">{noAnswer}</span>
                            <span className="text-[10px] text-amber-400 font-mono block mt-1">({total > 0 ? Math.round((noAnswer/total)*100) : 0}%)</span>
                          </div>

                          <div className="bg-rose-900/40 p-4 rounded-xl border border-rose-500/40">
                            <span className="text-xs text-rose-300 font-bold block mb-1">❌ غير مهتم</span>
                            <span className="text-2xl font-black text-rose-300">{notInterested}</span>
                            <span className="text-[10px] text-rose-400 font-mono block mt-1">({total > 0 ? Math.round((notInterested/total)*100) : 0}%)</span>
                          </div>

                          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <span className="text-xs text-slate-300 font-bold block mb-1">⏳ في الانتظار</span>
                            <span className="text-2xl font-black text-slate-200">{pending}</span>
                            <span className="text-[10px] text-slate-400 font-mono block mt-1">({total > 0 ? Math.round((pending/total)*100) : 0}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* --- ADMIN ALL EMPLOYEES COMPREHENSIVE ANALYSIS --- */
                  (() => {
                    const allEmployeesData = employees.filter(emp => emp.role !== 'admin' && !adminEmails.includes(emp.email?.toLowerCase())).map(emp => {
                      const empLeads = leadsCrm.filter(c => c.assignedToUid === emp.uid || c.assignedTo?.toLowerCase() === emp.email?.toLowerCase());
                      const total = empLeads.length;
                      const subscribed = empLeads.filter(c => c.crmStatus === 'subscribed').length;
                      const trial = empLeads.filter(c => c.crmStatus === 'started_trial').length;
                      const interested = empLeads.filter(c => c.crmStatus === 'interested').length;
                      const noAnswer = empLeads.filter(c => c.crmStatus === 'no_answer').length;
                      const notInterested = empLeads.filter(c => c.crmStatus === 'not_interested').length;
                      const pending = empLeads.filter(c => !c.crmStatus || c.crmStatus === 'unassigned').length;

                      const successfulCount = subscribed + trial + interested;
                      const successRate = total > 0 ? Math.round((successfulCount / total) * 100) : 0;

                      return {
                        emp,
                        total,
                        subscribed,
                        trial,
                        interested,
                        noAnswer,
                        notInterested,
                        pending,
                        successfulCount,
                        successRate
                      };
                    });

                    // Sort employees by successRate & total leads
                    allEmployeesData.sort((a,b) => b.successRate - a.successRate || b.total - a.total);

                    const totalCompanyLeads = leadsCrm.length;
                    const totalCompanySuccessful = leadsCrm.filter(c => ['subscribed','started_trial','interested'].includes(c.crmStatus)).length;
                    const overallCompanyRate = totalCompanyLeads > 0 ? Math.round((totalCompanySuccessful / totalCompanyLeads) * 100) : 0;
                    const topEmp = allEmployeesData.find(e => e.total > 0);

                    return (
                      <div className="space-y-6">
                        {/* Company Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-4 rounded-2xl border border-purple-500/40">
                            <span className="text-xs text-purple-200 font-bold block mb-1">إجمالي داتا Leads CRM</span>
                            <span className="text-3xl font-black text-white">{totalCompanyLeads} عميل</span>
                          </div>

                          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-4 rounded-2xl border border-indigo-500/40">
                            <span className="text-xs text-indigo-200 font-bold block mb-1">معدل نجاح الفريق العام 📈</span>
                            <span className="text-3xl font-black text-emerald-400">{overallCompanyRate}%</span>
                          </div>

                          <div className="bg-gradient-to-r from-amber-950 to-slate-900 p-4 rounded-2xl border border-amber-500/40">
                            <span className="text-xs text-amber-300 font-bold block mb-1">الموظف الأفضل أداءً 🏆</span>
                            <span className="text-xl font-black text-amber-300 truncate block">
                              {topEmp ? `${topEmp.emp.name} (${topEmp.successRate}%)` : 'لا يوجد'}
                            </span>
                          </div>
                        </div>

                        {/* Employees Leaderboard Table */}
                        <div className="bg-slate-950 rounded-2xl border border-purple-500/20 overflow-hidden">
                          <div className="p-4 border-b border-purple-500/20 flex justify-between items-center bg-purple-950/40">
                            <h3 className="text-sm font-black text-purple-200">جدول تقييم وكفاءة الموظفين</h3>
                            <span className="text-xs text-purple-300 font-bold">{allEmployeesData.length} موظف</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-slate-900 text-purple-300 border-b border-slate-800">
                                <tr>
                                  <th className="p-3">الموظف</th>
                                  <th className="p-3 text-center">إجمالي العملاء</th>
                                  <th className="p-3 text-center">نسبة النجاح</th>
                                  <th className="p-3 text-center">🎉 اشتراك</th>
                                  <th className="p-3 text-center">🚀 تجربة</th>
                                  <th className="p-3 text-center">🌟 مهتم</th>
                                  <th className="p-3 text-center">📵 لم يرد</th>
                                  <th className="p-3 text-center">❌ غير مهتم</th>
                                  <th className="p-3 text-center">التقييم</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 text-slate-200">
                                {allEmployeesData.map(({ emp, total, subscribed, trial, interested, noAnswer, notInterested, successRate }, i) => (
                                  <tr key={emp.uid || i} className="hover:bg-purple-900/20 transition">
                                    <td className="p-3 font-bold flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-purple-900 text-purple-200 flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                                      <span>{emp.name || emp.username}</span>
                                    </td>
                                    <td className="p-3 text-center font-black">{total}</td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <span className={`font-black ${successRate >= 50 ? 'text-emerald-400' : successRate >= 25 ? 'text-amber-400' : 'text-rose-400'}`}>
                                          {successRate}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-center font-bold text-purple-400">{subscribed}</td>
                                    <td className="p-3 text-center font-bold text-cyan-400">{trial}</td>
                                    <td className="p-3 text-center font-bold text-emerald-400">{interested}</td>
                                    <td className="p-3 text-center font-bold text-amber-400">{noAnswer}</td>
                                    <td className="p-3 text-center font-bold text-rose-400">{notInterested}</td>
                                    <td className="p-3 text-center">
                                      {successRate >= 50 ? (
                                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-black">🏆 ممتاز</span>
                                      ) : successRate >= 30 ? (
                                        <span className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full text-[10px] font-black">👍 جيد جداً</span>
                                      ) : successRate >= 15 ? (
                                        <span className="bg-amber-950 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-black">⚖️ متوسط</span>
                                      ) : (
                                        <span className="bg-rose-950 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full text-[10px] font-black">⚠️ متابعة</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default function DashboardWithErrorBoundary() {
  return (
    <DashboardErrorBoundary>
      <Dashboard />
    </DashboardErrorBoundary>
  );
}
