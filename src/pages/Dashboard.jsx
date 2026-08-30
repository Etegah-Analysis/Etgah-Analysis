import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, Clock, ArrowRight, UserPlus, X, Trash2, Edit, Edit3, Shield, Play, Pause, BarChart3, Globe, MessageSquare, Search, FileSpreadsheet, Download, Upload, Share2, FileText, CheckCircle, CheckSquare, Calendar, MessageCircle, FilePlus, Tag, Filter, UserCheck2, MessageSquarePlus, LogOut, ArrowDownLeft, UserMinus, RefreshCw, ArrowUpDown, Award, CreditCard, Save, Copy, Mail, Paperclip, Send, Inbox, Star, Reply, Eye, Sparkles, PhoneCall, Phone } from 'lucide-react';
import { auth, db, collection, onSnapshot, setDoc, doc, secondaryAuth, createUserWithEmailAndPassword, deleteDoc, updateDoc, serverTimestamp, arrayUnion, getDoc, writeBatch, query, orderBy, addDoc, where } from '../firebase';
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

// Global smart helper to extract real customer names and strip call sentences, status notes, and numbers
const extractCleanCustomerName = (raw) => {
  if (!raw || typeof raw !== 'string') return 'عميل جديد';
  let text = String(raw).trim();
  if (!text || text === 'null' || text === 'undefined') return 'عميل جديد';

  // 1. Remove English keywords, CRM tags, column headers
  text = text.replace(/\b(Lost Lead|Hot Lead|Cold Lead|Contacted|None|Assigned To|Lead Status|First Name|Last Name|Primary Phone|Mobile Phone|Phone|Email|Notes|Description|vtiger|crm)\b/gi, ' ');
  
  // 2. Remove English usernames / codes / tokens (e.g. ahmed.abbas, didpxo)
  text = text.replace(/[a-zA-Z0-9_.-]*[a-zA-Z][a-zA-Z0-9_.-]*/g, ' ');
  
  // 3. Remove dates & full timestamps
  text = text.replace(/(?:\d{1,4}[-/.])?\d{1,2}[-/.]\d{2,4}/g, ' ');
  text = text.replace(/\b(202[0-9]|201[0-9]|203[0-9])\b/g, ' ');
  text = text.replace(/o-\d{2}-\d{2}/gi, ' ');

  // 4. Remove standalone numbers (e.g. 26, 22, 21, 999) and all digits
  text = text.replace(/\d+/g, ' ');

  // 5. Remove known call log notes / conversation sentences / nationality / age / status phrases
  const junkPhrases = [
    // Greetings & politeness
    /يعطيك\s+العافي[ةهيو]/g,
    /الله\s+يعطيك\s+العافي[ةهيو]/g,
    /جزاك\s+الله\s+خير/g,
    
    // Nationality / Language notes (Image 4)
    /مش\s+عربي/g,
    /غير\s+عربي/g,
    /مو\s+عربي/g,
    /لا\s+يتحدث\s+العربي[ةه]/g,
    /ما\s+يتكلم\s+عربي/g,
    /اجنبي/g,
    /أجنبي/g,
    /هندي/g,
    /باكستاني/g,
    /بنغالي/g,
    /فلبيني/g,
    /انجليزي/g,
    /إنجليزي/g,

    // Age / Social status notes (Image 5)
    /كبير[ةه]?\s+بالسن/g,
    /كبير[ةه]?\s+في\s+السن/g,
    /عجوز/g,
    /مسن[ةه]?/g,
    /صغير[ةه]?\s+بالسن/g,
    /صغير[ةه]?\s+في\s+السن/g,
    /قاصر/g,
    /طالب[ةه]?/g,

    // Financial / Budget notes
    /م?ع?ند[هو]?ش\s+فلوس/g,
    /م?ع?ند[هو]?ش\s+راس\s+مال/g,
    /ما\s+عنده\s+فلوس/g,
    /ما\s+عنده\s+راس\s+مال/g,
    /ما\s+عنده\s+سيول[ةه]/g,
    /ما\s+عنده\s+حساب/g,
    /طفران/g,
    /مفلس/g,
    /ما\s+يملك/g,
    /معنديش\s+فلوس/g,

    // Availability / Time notes
    /مش\s+فاضي[ةه]?/g,
    /مو\s+فاضي[ةه]?/g,
    /مشغول[ةه]?/g,
    /عنده\s+دوام/g,
    /في\s+الدوام/g,
    /في\s+اجتماع/g,
    /يسوق/g,
    /نايم/g,
    /دلوقتي/g,

    // Competitor / Other platform notes
    /شغال\s+مع\s+شرك[ةه]\s+تاني[ةه]/g,
    /شغال\s+في\s+شرك[ةه]\s+تاني[ةه]/g,
    /بيتداول\s+مع\s+شرك[ةه]\s+تاني[ةه]/g,
    /متداول\s+في\s+منص[ةه]\s+تاني[ةه]/g,
    /متداول\s+في\s+بنك/g,
    /مع\s+شرك[ةه]\s+اخرى/g,

    // Hesitation / Thinking
    /بيفكر/g,
    /هيفكر/g,
    /بفكر/g,
    /متردد/g,
    /بيستخير/g,
    /هيستخير/g,
    /يبي\s+يفكر/g,
    /يبي\s+يستشير/g,

    // Scam complaints / Abuse
    /نصابين/g,
    /نصاب/g,
    /بيقول\s+نصابين/g,
    /بيقول\s+نصب/g,
    /شتم/g,
    /سب/g,
    /قليل\s+الادب/g,

    // Trading specific phrases
    /موقف\s+تداولا?\s+من/g,
    /موقف\s+تداولا?/g,
    /مش\s+عارف\s+التداول/g,
    /مش\s+عارف/g,
    /مش\s+عاوز\s+تداول/g,
    /مش\s+عاوز/g,
    /مش\s+عايز\s+تداول/g,
    /مش\s+عايز/g,
    /مش\s+مهتم/g,
    /غير\s+مهتم/g,
    /مهتم\s+بالتداول/g,
    /مهتم/g,
    /لا\s+ما\s+بتداول/g,
    /مش\s+متداول/g,
    /مش\s+بيتداول/g,
    /ما\s+بتداول/g,
    /ما\s+يتداول/g,
    /لم\s+يتداول/g,
    /ما\s+يبي\s+يتداول/g,
    /ما\s+يبي/g,
    /مش\s+ناوي/g,
    /رافض\s+التداول/g,
    /رافض\s+الفكر[ةه]/g,
    /رافض[ةه]?/g,
    /قفل\s+لما\s+سمع/g,
    /سمعت?\s+تداول/g,
    /قفل\s+السكه/g,
    /قفلت?\s+السكه/g,
    /قفل\s+الخط/g,
    /قفلت?\s+الخط/g,
    /قفلت?\s+في\s+وشي/g,
    /قفلت?/g,
    /قفل/g,
    /وانا\s+بشرحله/g,
    /بشرحله/g,
    /شكرا\s+و?قفلت?/g,
    /شكراً\s+و?قفلت?/g,
    /شكرا/g,
    /شكراً/g,
    /رصد/g,
    /لا\s+يرد/g,
    /لم\s+يرد/g,
    /ما\s+يرد/g,
    /لم\s+يتم\s+الرد/g,
    /مارد/g,
    /مغلق/g,
    /غير\s+متاح/g,
    /الرقم\s+غير\s+صحيح/g,
    /رقم\s+غير\s+صحيح/g,
    /رقم\s+خطأ/g,
    /رقم\s+غلط/g,
    /النمر[ةه]\s+غلط/g,
    /مستخرج\s+من\s+نص/g,
    /عميل\s+جديد/g,
    /بالتداول/g,
    /التداول/g,
    /تداولا?/g,
    /الو/g,
    /ألو/g,
    /السكة/g,
    /السكه/g,
    /الخط/g
  ];

  for (const regex of junkPhrases) {
    text = text.replace(regex, ' ');
  }

  // 6. Remove symbols, punctuation, brackets
  text = text.replace(/[\[\]\(\)\{\}\<\>\-\_\:\;\,\.\|\*\#\@\+\=\\\/\?\!\~\"\'^%$]/g, ' ');

  // 7. Stop words to strip if isolated (including all individual single Arabic letters)
  const stopWords = new Set(['لا', 'ما', 'من', 'في', 'عن', 'على', 'إلى', 'الي', 'او', 'أو', 'ثم', 'و', 'لما', 'سمع', 'سمعت', 'هو', 'هي', 'أن', 'ان', 'مع', 'لو', 'كان', 'كل', 'بعد', 'قبل', 'وشي', 'وجهي', 'جدا', 'جداً', 'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي']);

  // 8. Normalize multiple spaces and split into words
  text = text.replace(/\s+/g, ' ').trim();
  if (!text || text.length < 2) {
    return 'عميل جديد';
  }

  const words = text.split(' ').filter(w => w.length > 0 && !stopWords.has(w) && w.length >= 2);
  
  if (words.length === 0) {
    return 'عميل جديد';
  }

  const result = words.join(' ').trim();
  if (result.length < 2) return 'عميل جديد';
  return result;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'leads_crm', 'customers' or 'employees'
  const [analyticsDetail, setAnalyticsDetail] = useState(null); // 'assigned', 'unread', 'zero' or null
  const [customerFilter, setCustomerFilter] = useState('all');
  const [crmStatusFilter, setCrmStatusFilter] = useState('unassigned');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [tableSearch, setTableSearch] = useState(''); // per-table search
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = أحدث أولاً, 'asc' = أقدم أولاً
  const tableSectionRef = useRef(null);

  const [customers, setCustomers] = useState([]);
  const [leadsCrm, setLeadsCrm] = useState([]);
  const [employeeLeads, setEmployeeLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [recycleBin, setRecycleBin] = useState([]);
  const [rbFilter, setRbFilter] = useState('all');
  const [templateMessages, setTemplateMessages] = useState([]);
  
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [selectedLeadsCrm, setSelectedLeadsCrm] = useState([]);
  const [selectedEmployeeLeads, setSelectedEmployeeLeads] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedVisitors, setSelectedVisitors] = useState([]);
  const [selectedRecycleItems, setSelectedRecycleItems] = useState([]);
  const [selectedEmpFilter, setSelectedEmpFilter] = useState('admin');

  // Employee Leads Tab Filters & Pagination State
  const [currentPageEmpLeads, setCurrentPageEmpLeads] = useState(1);
  const [empLeadsEmpFilter, setEmpLeadsEmpFilter] = useState('admin');
  const [empLeadsStatusFilter, setEmpLeadsStatusFilter] = useState('unassigned');
  const [empLeadsDateFrom, setEmpLeadsDateFrom] = useState('');
  const [empLeadsDateTo, setEmpLeadsDateTo] = useState('');
  const [empLeadsSortOrder, setEmpLeadsSortOrder] = useState('desc');

  // Lead Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState('file'); // 'file', 'gsheet', 'text', 'manual'
  const [importRows, setImportRows] = useState([]);
  const [gsheetUrl, setGsheetUrl] = useState('');
  const [rawImportText, setRawImportText] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

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
  const [currentPageTeamTracking, setCurrentPageTeamTracking] = useState(1);
  const [teamTrackingEmpFilter, setTeamTrackingEmpFilter] = useState('all');
  const [selectedTeamTrackingLeads, setSelectedTeamTrackingLeads] = useState([]);

  // Subscribed Clients Tab & Details Modal State
  const [currentPageSubscribed, setCurrentPageSubscribed] = useState(1);
  const [subscribedEmpFilter, setSubscribedEmpFilter] = useState('all');
  const [selectedSubscribedClients, setSelectedSubscribedClients] = useState([]);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [selectedSubCustomer, setSelectedSubCustomer] = useState(null);
  const [subStartDate, setSubStartDate] = useState('');
  const [subEndDate, setSubEndDate] = useState('');
  const [subServiceType, setSubServiceType] = useState('الباقة السنوية');
  const [subPaymentType, setSubPaymentType] = useState('full'); // 'full', 'percentage', 'partial'
  const [subPaidAmount, setSubPaidAmount] = useState('');
  const [subRemainingAmount, setSubRemainingAmount] = useState('');
  const [subReceiptProof, setSubReceiptProof] = useState('');
  const [subReceiptFileUrl, setSubReceiptFileUrl] = useState('');
  const [subNotes, setSubNotes] = useState('');
  const [subSaving, setSubSaving] = useState(false);

  useEffect(() => {
    setCurrentPageSubscribed(1);
  }, [subscribedEmpFilter, dateFromFilter, dateToFilter, tableSearch, leadsSortOrder]);

  useEffect(() => {
    setCurrentPageLeads(1);
  }, [selectedEmpFilter, crmStatusFilter, dateFromFilter, dateToFilter, tableSearch, leadsSortOrder]);

  useEffect(() => {
    setCurrentPageEmpLeads(1);
  }, [empLeadsEmpFilter, empLeadsStatusFilter, empLeadsDateFrom, empLeadsDateTo, tableSearch, empLeadsSortOrder]);

  useEffect(() => {
    setCurrentPageCustomers(1);
  }, [customerFilter, tableSearch, selectedEmpFilter, sortOrder]);

  useEffect(() => {
    setCurrentPageTeamTracking(1);
  }, [teamTrackingEmpFilter, tableSearch, leadsSortOrder]);

  // Notes & Status Modal State
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedCustomerForNotes, setSelectedCustomerForNotes] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedStatusForNotes, setSelectedStatusForNotes] = useState('interested');
  const [trialDateForNotes, setTrialDateForNotes] = useState('');
  const [isLeadsAnalysisModalOpen, setIsLeadsAnalysisModalOpen] = useState(false);
  const [isSystemTotalClientsModalOpen, setIsSystemTotalClientsModalOpen] = useState(false);
  const [isPendingClientsModalOpen, setIsPendingClientsModalOpen] = useState(false);

  // Call Performance Analytics States
  const [callLogs, setCallLogs] = useState([]);
  const [isCallsAnalysisModalOpen, setIsCallsAnalysisModalOpen] = useState(false);
  const [callsDateRangeFilter, setCallsDateRangeFilter] = useState('all'); // 'all', 'today', 'yesterday', 'week', 'month', 'custom'
  const [callsCustomDateFrom, setCallsCustomDateFrom] = useState('');
  const [callsCustomDateTo, setCallsCustomDateTo] = useState('');
  const [callsSelectedEmpFilter, setCallsSelectedEmpFilter] = useState('');
  const [callsSearchTerm, setCallsSearchTerm] = useState('');
  const [callsCurrentPage, setCallsCurrentPage] = useState(1);
  const [activeCallSession, setActiveCallSession] = useState(null); // { callDocId, phoneNumber, customerName, startedAt }
  const [activeCallTimer, setActiveCallTimer] = useState(0);

  // Internal Mail / Gmail System State
  const [internalEmails, setInternalEmails] = useState([]);
  const [isMailModalOpen, setIsMailModalOpen] = useState(false);
  const [mailActiveFolder, setMailActiveFolder] = useState('inbox'); // 'inbox', 'sent', 'starred', 'all_system'
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [mailRecipientUid, setMailRecipientUid] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailAttachments, setMailAttachments] = useState([]); // Array of { name, url, type, size }
  const [mailSearchTerm, setMailSearchTerm] = useState('');
  const [mailSending, setMailSending] = useState(false);

  // Admin emails definition
  const adminEmails = ['etegahanalysis@gmail.com', 'mohamed.gamal.work0@gmail.com'];

  // Helper to check if a value refers strictly to Admin
  const isAdminIdentifier = (val) => {
    if (!val) return false;
    const lower = String(val).toLowerCase().trim();
    if (lower === 'admin' || lower === 'الإدارة' || lower === 'ادارة' || lower === '👑 الإدارة' || lower === 'الرئيسي' || lower === 'حساب رئيسي') return true;
    if (adminEmails.includes(lower)) return true;
    if (lower === 'etegahanalysis' || lower.startsWith('etegahanalysis@') || lower.startsWith('mohamed.gamal.work0@')) return true;
    return false;
  };

  // Helper to sanitize display names so admin emails are never shown
  const sanitizeDisplayName = (nameOrEmail) => {
    if (!nameOrEmail) return 'الإدارة';
    if (isAdminIdentifier(nameOrEmail)) return 'الإدارة';
    const emp = employees.find(e => e.email?.toLowerCase() === String(nameOrEmail).toLowerCase() || e.uid === nameOrEmail);
    if (emp) return emp.name || emp.username;
    return nameOrEmail;
  };

  // Assignment Transfer Audit Log Helper
  const createAssignmentLog = (fromName, toName, customAssignedBy) => {
    const isFromAdmin = !fromName || isAdminIdentifier(fromName) || String(fromName).includes('الإدارة') || String(fromName).includes('admin');
    const isToAdmin = !toName || isAdminIdentifier(toName) || String(toName).includes('الإدارة') || String(toName).includes('admin');
    const cleanFrom = isFromAdmin ? '👑 الإدارة' : fromName;
    const cleanTo = isToAdmin ? '👑 الإدارة' : toName;

    return {
      id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 4),
      from: cleanFrom,
      to: cleanTo,
      assignedBy: customAssignedBy || '👑 الإدارة',
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
  const [newEmpLeaderUid, setNewEmpLeaderUid] = useState('');
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
  const [editEmpLeaderUid, setEditEmpLeaderUid] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState('');

  const openAddEmployeeModal = () => {
    setNewEmpName('');
    setNewEmpCode('');
    setNewEmpUsername('');
    setNewEmpPassword('');
    setNewEmpJobTitle('Agent');
    setNewEmpLeaderUid('');
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
  const isAdmin = currentUser && adminEmails.includes(currentUser.email?.toLowerCase());
  const currentEmpUser = employees.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
  const isCoordinator = !isAdmin && (currentEmpUser?.jobTitle === 'Coordinator' || currentEmpUser?.jobTitle === 'منسق للإدارة' || currentEmpUser?.role === 'coordinator');
  const isLeader = !isAdmin && (currentEmpUser?.jobTitle === 'Leader' || currentEmpUser?.jobTitle === 'ليدر' || currentEmpUser?.role === 'leader');
  const isAgent = !isAdmin && !isCoordinator && !isLeader;
  const myTeamMembers = employees.filter(e => e.leaderUid === currentUser?.uid);
  const isAllowedToManageLeads = isAdmin || isCoordinator || isLeader;

  // Master Emergency System Lock State (Controlled by Admin)
  const [isSystemLocked, setIsSystemLocked] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_settings', 'global_access'), (docSnap) => {
      if (docSnap.exists()) {
        setIsSystemLocked(docSnap.data().isSystemLocked === true);
      } else {
        setIsSystemLocked(false);
      }
    });
    return () => unsub();
  }, []);

  const handleToggleGlobalLock = async () => {
    if (!isAdmin) return;
    const willLock = !isSystemLocked;

    const confirmMsg = willLock
      ? '⚠️ تحذير: هل أنت متأكد من إغلاق الداشبورد والواتساب عن جميع الموظفين فوراً وطردهم من حساباتهم؟'
      : 'هل أنت متأكد من إعادة فتح النظام والسماح لجميع الموظفين بتسجيل الدخول مجدداً؟';

    if (!window.confirm(confirmMsg)) return;

    setIsTogglingLock(true);
    try {
      await setDoc(doc(db, 'system_settings', 'global_access'), {
        isSystemLocked: willLock,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || 'admin',
        ...(willLock ? { lockedAt: serverTimestamp() } : { unlockedAt: serverTimestamp() })
      }, { merge: true });

      if (willLock) {
        toast.error('تم إغلاق الداشبورد والواتساب عن جميع الموظفين وطردهم بنجاح 🔴', { duration: 5000 });
      } else {
        toast.success('تم فتح النظام بنجاح، يستطيع الموظفون تسجيل الدخول والعمل الآن 🟢', { duration: 5000 });
      }
    } catch (err) {
      console.error('Error toggling system lock:', err);
      toast.error('حدث خطأ أثناء تعديل حالة قفل النظام: ' + err.message);
    } finally {
      setIsTogglingLock(false);
    }
  };

  // Real-time listener for Call Logs
  useEffect(() => {
    const q = query(collection(db, 'call_logs'), orderBy('calledAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const logs = [];
      snapshot.forEach((docSnap) => {
        logs.push({ id: docSnap.id, ...docSnap.data() });
      });
      setCallLogs(logs);
    }, (err) => {
      console.error("Error listening to call_logs:", err);
    });
    return () => unsub();
  }, []);

  // Helper: Format Call Duration
  const formatCallDuration = (sec) => {
    if (!sec || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s} ثانية`;
    return `${m}:${s < 10 ? '0' : ''}${s} دقيقة`;
  };

  // Active Call Session Live Timer Effect
  useEffect(() => {
    let interval = null;
    if (activeCallSession) {
      interval = setInterval(() => {
        setActiveCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      setActiveCallTimer(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeCallSession]);

  // Direct Click-to-Call via MicroSIP Handler with Firestore Logging & Session Start
  const handleCallViaMicroSip = async (rawPhone, customer = {}) => {
    if (!rawPhone) {
      toast.error('رقم الهاتف غير متوفر للاتصال');
      return;
    }
    // Format strictly for MicroSIP: Local Saudi starting with 05 (remove + and 966 / 00966)
    let cleanPhone = String(rawPhone).replace(/\D/g, '');
    if (cleanPhone.startsWith('00966')) {
      cleanPhone = cleanPhone.slice(5);
    } else if (cleanPhone.startsWith('966')) {
      cleanPhone = cleanPhone.slice(3);
    }
    if (cleanPhone.startsWith('5')) {
      cleanPhone = '0' + cleanPhone;
    }

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
        const callerName = isAdmin ? '👑 الإدارة' : (currentEmpUser?.name || currentEmpUser?.username || currentUser.email?.split('@')[0] || 'موظف');
        const callerRole = isAdmin ? 'Admin' : (currentEmpUser?.jobTitle || currentEmpUser?.role || 'Agent');
        const docRef = await addDoc(collection(db, 'call_logs'), {
          phoneNumber: cleanPhone,
          customerId: customer?.id || '',
          customerName: customer?.name || customer?.firstName || 'عميل',
          customerSource: customer?.source || (customer?.isLeadCrm ? 'Leads CRM' : 'CRM'),
          employeeUid: currentUser.uid,
          employeeEmail: currentUser.email || '',
          employeeName: callerName,
          employeeJobTitle: callerRole,
          leaderUid: currentEmpUser?.leaderUid || '',
          leaderName: currentEmpUser?.leaderName || '',
          calledAt: serverTimestamp(),
          calledDateStr: new Date().toISOString().split('T')[0],
          timestampMillis: Date.now(),
          source: 'MicroSIP',
          status: 'answered', // 'answered', 'no_answer', 'busy'
          durationSeconds: 0,
          durationFormatted: '00:00'
        });

        // Launch Active Call Session Timer & Outcome Widget
        setActiveCallSession({
          callDocId: docRef.id,
          phoneNumber: cleanPhone,
          customerName: customer?.name || customer?.firstName || 'عميل',
          customerId: customer?.id || '',
          startedAt: Date.now()
        });
        setActiveCallTimer(0);
      }
    } catch (err) {
      console.error('Error logging call event:', err);
    }
  };

  // Finish Active Call Session & Save Outcome
  const handleFinishCallSession = async (outcomeStatus) => {
    if (!activeCallSession) return;
    const { callDocId } = activeCallSession;
    const finalSeconds = outcomeStatus === 'answered' ? Math.max(1, activeCallTimer) : 0;
    const durationFormatted = outcomeStatus === 'answered' 
      ? formatCallDuration(finalSeconds) 
      : outcomeStatus === 'no_answer' ? 'لم يرد 📵' : 'مشغول 🔴';

    try {
      if (callDocId) {
        await updateDoc(doc(db, 'call_logs', callDocId), {
          status: outcomeStatus,
          durationSeconds: finalSeconds,
          durationFormatted: durationFormatted,
          endedAt: serverTimestamp()
        });
      }
      if (outcomeStatus === 'answered') {
        toast.success(`تم إنهاء وتوثيق المكالمة بنجاح 🟢 (المدة: ${durationFormatted})`);
      } else if (outcomeStatus === 'no_answer') {
        toast.error(`تم تسجيل نتيجة المكالمة: لم يرد العميل 📵`);
      } else {
        toast(`تم تسجيل نتيجة المكالمة: مشغول 🔴`);
      }
    } catch (err) {
      console.error('Error updating call log outcome:', err);
    } finally {
      setActiveCallSession(null);
      setActiveCallTimer(0);
    }
  };

  // Quick Update Call Log Status / Duration from Table
  const handleUpdateCallLogStatus = async (logId, newStatus) => {
    try {
      const updateData = { status: newStatus };
      if (newStatus === 'no_answer') {
        updateData.durationSeconds = 0;
        updateData.durationFormatted = 'لم يرد 📵';
      } else if (newStatus === 'busy') {
        updateData.durationSeconds = 0;
        updateData.durationFormatted = 'مشغول 🔴';
      } else if (newStatus === 'answered') {
        updateData.durationSeconds = 60;
        updateData.durationFormatted = '1:00 دقيقة';
      }
      await updateDoc(doc(db, 'call_logs', logId), updateData);
      toast.success('تم تحديث حالة ونتيجة المكالمة بنجاح ✨');
    } catch (err) {
      console.error('Error updating call log:', err);
      toast.error('حدث خطأ أثناء تحديث حالة المكالمة');
    }
  };

  // Export Call Performance Logs to Excel (Admin Only)
  const handleExportCallLogsToExcel = (logsToExport) => {
    if (!isAdmin) {
      toast.error('تصدير التقارير إلى Excel متاح فقط للإدارة والأدمن 🔒');
      return;
    }
    if (!logsToExport || logsToExport.length === 0) {
      toast.error('لا توجد بيانات مكالمات لتصديرها');
      return;
    }
    const data = logsToExport.map((log, idx) => {
      const statusLabel = log.status === 'answered' ? 'تم الرد 🟢' : log.status === 'no_answer' ? 'لم يرد 📵' : log.status === 'busy' ? 'مشغول 🔴' : 'تم الرد 🟢';
      const durationLabel = log.durationFormatted || (log.durationSeconds ? formatCallDuration(log.durationSeconds) : (log.status === 'no_answer' ? 'لم يرد' : '—'));
      return {
        'م': idx + 1,
        'تاريخ ووقت الاتصال': log.calledAt?.toDate ? log.calledAt.toDate().toLocaleString('ar-EG') : (log.timestampMillis ? new Date(log.timestampMillis).toLocaleString('ar-EG') : '—'),
        'اسم الموظف': log.employeeName || '—',
        'وظيفة الموظف': log.employeeJobTitle || 'Agent',
        'اسم الليدر / الفريق': log.leaderName || '—',
        'اسم العميل': log.customerName || '—',
        'رقم هاتف العميل': log.phoneNumber || '—',
        'مصدر العميل': log.customerSource || '—',
        'حالة الرد': statusLabel,
        'مدة المكالمة': durationLabel,
        'طريقة الاتصال': log.source || 'MicroSIP'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل المكالمات");
    XLSX.writeFile(wb, `تقرير_أداء_المكالمات_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('تم تصدير تقرير المكالمات إلى Excel بنجاح 📊');
  };

  // Anti-Screenshot, Window Blur, and Anti-Select / Anti-Copy Protection for Employees
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      document.body.classList.remove('no-select');
      return; // Admin has full unrestricted access
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

    const empLeadsUnsub = onSnapshot(collection(db, 'employee_leads'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      data.sort((a, b) => {
        const timeA = getTimestampMillis(a.updatedAt) || getTimestampMillis(a.createdAt);
        const timeB = getTimestampMillis(b.updatedAt) || getTimestampMillis(b.createdAt);
        return timeB - timeA;
      });
      setEmployeeLeads(data);
    }, (error) => {
      console.error("Error fetching employee_leads:", error);
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

    // Fetch Template & Campaign Messages for Campaign Analytics
    const templatesUnsub = onSnapshot(collection(db, 'رسائل_الموظفين_للعملاء'), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        const msg = doc.data();
        if (msg.isTemplate || (msg.text && msg.text.includes('[قالب')) || msg.campaignSource || msg.source === 'crm_sheet' || msg.source === 'excel_import') {
          data.push({ id: doc.id, ...msg });
        }
      });
      setTemplateMessages(data);
    });

    // Fetch Internal Emails (Gmail System)
    const emailsUnsub = onSnapshot(collection(db, 'internal_emails'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      data.sort((a, b) => {
        const timeA = getTimestampMillis(a.createdAt);
        const timeB = getTimestampMillis(b.createdAt);
        return timeB - timeA;
      });
      setInternalEmails(data);
    }, (error) => {
      console.error('Error fetching internal_emails:', error);
    });

    return () => {
      custUnsub();
      leadsCrmUnsub();
      empLeadsUnsub();
      empUnsub();
      visUnsub();
      rbUnsub();
      templatesUnsub();
      emailsUnsub();
    };
  }, []);

  // Auto-sync manual WhatsApp customers into employee_leads and keep customers for Website WhatsApp
  useEffect(() => {
    if (!customers || customers.length === 0) return;
    const manualList = customers.filter(c => c.addedBy && c.addedBy !== 'WhatsApp Webhook');
    if (manualList.length === 0) return;

    const syncAndClean = async () => {
      for (const c of manualList) {
        try {
          const cleanPhone = (c.phoneNumber || '').replace(/[^0-9+]/g, '');
          if (!cleanPhone) continue;
          const empCleanId = cleanPhone.replace(/[^0-9]/g, '') || c.id;
          const empDocRef = doc(db, 'employee_leads', empCleanId);
          const empDocSnap = await getDoc(empDocRef);

          if (!empDocSnap.exists()) {
            const empUser = employees.find(e => e.uid === c.addedByUid || e.email?.toLowerCase() === c.addedBy?.toLowerCase() || (e.name && c.addedBy === e.name));
            const empName = c.addedBy || empUser?.name || 'موظف';
            const assigneeUser = employees.find(e => e.uid === c.assignedToUid || e.email?.toLowerCase() === c.assignedTo?.toLowerCase());

            await setDoc(empDocRef, {
              phoneNumber: cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`,
              name: c.name || 'عميل جديد (يدوي)',
              source: c.source || 'إضافة يدوية (WhatsApp)',
              addedBy: empName,
              addedByUid: c.addedByUid || empUser?.uid || '',
              assignedTo: c.assignedTo || assigneeUser?.email || empUser?.email || 'الإدارة',
              assignedToUid: c.assignedToUid || assigneeUser?.uid || empUser?.uid || 'admin',
              status: c.status || 'assigned',
              crmStatus: (c.crmStatus && c.crmStatus !== 'assigned') ? c.crmStatus : 'unassigned',
              notes: c.notes || '',
              notesHistory: c.notesHistory || [],
              createdAt: c.createdAt || serverTimestamp(),
              updatedAt: c.updatedAt || serverTimestamp(),
              unread: 0
            }, { merge: true });
          }

          // Delete from customers collection so customers collection contains purely Website WhatsApp leads
          await deleteDoc(doc(db, 'بيانات_تسجيل_العملاء', c.id));
        } catch (err) {
          console.error("Auto sync/cleanup error:", err);
        }
      }
    };

    syncAndClean();
  }, [customers, employees]);

  const scrollToTable = () => {
    setTimeout(() => {
      if (tableSectionRef.current) {
        tableSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCardClick = (e, type, filter = 'all') => {
    if (e && e.stopPropagation) e.stopPropagation();
    
    // Toggle close if clicking background or already active tab
    if (type === 'analytics' || (activeTab === type && customerFilter === filter)) {
      setActiveTab('analytics');
      return;
    }

    if (type === 'leads_crm') {
      setSelectedEmpFilter((isAdmin || isCoordinator) ? 'admin' : 'all');
      setCrmStatusFilter('unassigned');
    } else if (type === 'employee_leads') {
      setEmpLeadsEmpFilter((isAdmin || isCoordinator) ? 'admin' : 'all');
      setEmpLeadsStatusFilter('unassigned');
    } else if (type === 'subscribed_clients') {
      setSubscribedEmpFilter('all');
    } else if (type === 'customers') {
      setSelectedEmpFilter('all');
    } else {
      setSelectedEmpFilter('all');
    }

    setActiveTab(type);
    setCustomerFilter(filter);
    setTableSearch('');
    scrollToTable();
  };

  // --- INTERNAL EMAIL / GMAIL SYSTEM LOGIC & PERMISSIONS ---
  const myUid = isAdmin ? 'admin' : (currentUser?.uid || '');
  const myEmail = currentUser?.email?.toLowerCase() || '';

  // Calculate allowed recipients based on user role
  const getAllowedRecipients = () => {
    const list = [];
    if (isAdmin) {
      list.push({ uid: 'all', type: 'all', name: '📢 جميع الموظفين بالمنصة (All Staff)', role: 'all' });
      employees.filter(e => e.role !== 'admin' && e.uid !== currentUser?.uid).forEach(e => {
        list.push({ uid: e.uid, type: 'single', name: `👤 ${e.name} (${e.jobTitle || e.role})`, email: e.email, role: e.jobTitle || e.role });
      });
    } else if (isCoordinator) {
      list.push({ uid: 'all', type: 'all', name: '📢 جميع الموظفين بالمنصة (All Staff)', role: 'all' });
      list.push({ uid: 'admin', type: 'admin', name: '👑 الإدارة (Admin)', role: 'admin' });
      employees.filter(e => e.role !== 'admin' && e.uid !== currentUser?.uid).forEach(e => {
        list.push({ uid: e.uid, type: 'single', name: `👤 ${e.name} (${e.jobTitle || e.role})`, email: e.email, role: e.jobTitle || e.role });
      });
    } else if (isLeader) {
      list.push({ uid: 'admin', type: 'admin', name: '👑 الإدارة (Admin)', role: 'admin' });
      const coord = employees.find(e => e.jobTitle === 'Coordinator' || e.jobTitle === 'منسق للإدارة');
      if (coord) {
        list.push({ uid: coord.uid, type: 'coordinator', name: `📋 منسق الإدارة (${coord.name})`, email: coord.email, role: 'Coordinator' });
      }
      if (myTeamMembers.length > 0) {
        list.push({ uid: 'team', type: 'team', name: `👥 فريقي بالكامل (${myTeamMembers.length} موظف)`, role: 'team' });
        myTeamMembers.forEach(e => {
          list.push({ uid: e.uid, type: 'single', name: `👤 ${e.name} (عضو بالفريق)`, email: e.email, role: 'Agent' });
        });
      }
    } else {
      // Agent
      list.push({ uid: 'admin', type: 'admin', name: '👑 الإدارة (Admin)', role: 'admin' });
      const coord = employees.find(e => e.jobTitle === 'Coordinator' || e.jobTitle === 'منسق للإدارة');
      if (coord) {
        list.push({ uid: coord.uid, type: 'coordinator', name: `📋 منسق الإدارة (${coord.name})`, email: coord.email, role: 'Coordinator' });
      }
      const myLeaderUid = currentEmpUser?.leaderUid;
      if (myLeaderUid) {
        const leader = employees.find(e => e.uid === myLeaderUid);
        if (leader) {
          list.push({ uid: leader.uid, type: 'leader', name: `👑 الليدر المشرف (${leader.name})`, email: leader.email, role: 'Leader' });
        }
      }
    }
    return list;
  };

  // Helper to determine if an email is meant for the current user's inbox
  const isEmailForMe = (mail) => {
    if (!mail) return false;
    if (isAdmin) {
      return mail.recipientType === 'all' || mail.recipientType === 'admin' || mail.recipientUid === 'admin' || mail.recipientUid === currentUser?.uid || mail.recipientEmail?.toLowerCase() === myEmail;
    }
    if (isCoordinator) {
      return mail.recipientType === 'all' || mail.recipientType === 'coordinator' || mail.recipientUid === currentUser?.uid || mail.recipientEmail?.toLowerCase() === myEmail;
    }
    if (isLeader) {
      if (mail.recipientType === 'all' || mail.recipientUid === currentUser?.uid || mail.recipientEmail?.toLowerCase() === myEmail) return true;
      if (mail.recipientType === 'leader' && myTeamMembers.some(m => m.uid === mail.senderUid || m.email?.toLowerCase() === mail.senderEmail?.toLowerCase())) return true;
      return false;
    }
    // Agent
    if (mail.recipientType === 'all' || mail.recipientUid === currentUser?.uid || mail.recipientEmail?.toLowerCase() === myEmail) return true;
    if (mail.recipientType === 'team' && (mail.teamMemberUids?.includes(currentUser?.uid) || mail.teamLeaderUid === currentEmpUser?.leaderUid)) return true;
    return false;
  };

  // Unread emails count
  const unreadMailCount = internalEmails.filter(m => isEmailForMe(m) && !m.readBy?.includes(myUid) && !m.deletedBy?.includes(myUid)).length;

  // File / Image Attachment Upload for Mail
  const handleMailAttachmentUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`الملف (${file.name}) كبير جداً. الحد الأقصى 8MB`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setMailAttachments(prev => [
          ...prev,
          {
            name: file.name,
            url: uploadEvent.target.result,
            type: file.type.startsWith('image/') ? 'image' : 'file',
            size: (file.size / 1024).toFixed(1) + ' KB'
          }
        ]);
        toast.success(`تم إرفاق (${file.name}) 📎`);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAttachment = (idx) => {
    setMailAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // Send Internal Email Handler
  const handleSendInternalEmail = async (e) => {
    e.preventDefault();
    if (!mailRecipientUid) {
      toast.error('يرجى اختيار المستلم 👤');
      return;
    }
    if (!mailSubject.trim()) {
      toast.error('يرجى كتابة عنوان / موضوع الإيميل');
      return;
    }
    if (!mailBody.trim()) {
      toast.error('يرجى كتابة نص ومحتوى الرسالة');
      return;
    }

    const allowed = getAllowedRecipients();
    const recipient = allowed.find(r => r.uid === mailRecipientUid);
    if (!recipient) {
      toast.error('المستلم غير صالح أو غير مسموح لك بمراسلته');
      return;
    }

    setMailSending(true);
    try {
      const emailDoc = {
        senderUid: isAdmin ? 'admin' : (currentUser?.uid || ''),
        senderName: isAdmin ? '👑 الإدارة' : (currentEmpUser?.name || 'موظف'),
        senderEmail: currentUser?.email || '',
        senderRole: isAdmin ? 'admin' : isCoordinator ? 'coordinator' : isLeader ? 'leader' : 'agent',
        recipientType: recipient.type,
        recipientUid: recipient.uid,
        recipientName: recipient.name,
        recipientEmail: recipient.email || '',
        teamLeaderUid: (isLeader && recipient.type === 'team') ? currentUser?.uid : '',
        teamMemberUids: (isLeader && recipient.type === 'team') ? myTeamMembers.map(m => m.uid) : [],
        subject: mailSubject.trim(),
        body: mailBody.trim(),
        attachments: mailAttachments,
        createdAt: serverTimestamp(),
        readBy: [isAdmin ? 'admin' : currentUser?.uid],
        starredBy: [],
        deletedBy: []
      };

      await setDoc(doc(collection(db, 'internal_emails')), emailDoc);
      toast.success('تم إرسال الإيميل بنجاح 🚀');
      
      // Reset compose form
      setMailSubject('');
      setMailBody('');
      setMailAttachments([]);
      setMailRecipientUid('');
      setIsComposeOpen(false);
    } catch (err) {
      console.error("Error sending email:", err);
      toast.error('حدث خطأ أثناء إرسال الإيميل: ' + err.message);
    } finally {
      setMailSending(false);
    }
  };

  // Toggle Star on Email
  const handleToggleStarEmail = async (mail, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      const isStarred = mail.starredBy?.includes(myUid);
      const emailRef = doc(db, 'internal_emails', mail.id);
      if (isStarred) {
        await updateDoc(emailRef, {
          starredBy: (mail.starredBy || []).filter(u => u !== myUid)
        });
      } else {
        await updateDoc(emailRef, {
          starredBy: arrayUnion(myUid)
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Email (Admin Only)
  const handleDeleteEmail = async (mail, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!isAdmin) {
      toast.error('عذراً، حذف الإيميلات مقتصر على الإدارة فقط 🔒');
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا الإيميل نهائياً من السيستم؟')) return;
    try {
      const emailRef = doc(db, 'internal_emails', mail.id);
      await deleteDoc(emailRef);
      toast.success('تم حذف الإيميل بنجاح 🗑️');
      if (selectedEmail?.id === mail.id) {
        setSelectedEmail(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  // Open Email and Mark as Read
  const handleOpenEmailDetails = async (mail) => {
    setSelectedEmail(mail);
    if (!mail.readBy?.includes(myUid)) {
      try {
        await updateDoc(doc(db, 'internal_emails', mail.id), {
          readBy: arrayUnion(myUid)
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Helper to check if a lead in leads_crm is still sitting in the unassigned Admin inventory pool (not sent to any employee)
  const isLeadWithAdmin = (c) => {
    if (!c) return false;
    const uid = c.assignedToUid;
    const email = c.assignedTo;
    if (!uid || uid === 'admin' || uid === 'unassigned') return true;
    if (!email || email === 'الإدارة' || isAdminIdentifier(email)) return true;
    return false;
  };

  // Helper to check if a lead is distributed / sent to a real employee (Agent or Leader)
  const isLeadAssignedToEmployee = (c) => {
    return !isLeadWithAdmin(c);
  };

  // Helper to check if an assigned lead is still in pending / waiting (لم يتم تحويل حالته بعد)
  const isLeadPendingWithEmployee = (c) => {
    if (!isLeadAssignedToEmployee(c)) return false;
    const st = (c.crmStatus && c.crmStatus !== 'assigned') ? c.crmStatus : 'unassigned';
    return st === 'unassigned';
  };

  // Accurate pending counters (Only counts data sent/added to employees whose status has not been converted yet)
  const unassignedWhatsappCount = customers.filter(c => c.assignedToUid && c.assignedToUid !== 'admin' && !isAdminIdentifier(c.assignedTo) && (!c.crmStatus || c.crmStatus === 'unassigned')).length || customers.filter(c => !c.crmStatus || c.crmStatus === 'unassigned').length;
  const unassignedLeadsCrmCount = leadsCrm.filter(c => isLeadPendingWithEmployee(c)).length;
  const unassignedEmployeeLeadsCount = employeeLeads.filter(c => ((c.crmStatus && c.crmStatus !== 'assigned') ? c.crmStatus : 'unassigned') === 'unassigned').length;
  const totalPendingAll = unassignedWhatsappCount + unassignedLeadsCrmCount + unassignedEmployeeLeadsCount;
  const unassignedCount = unassignedWhatsappCount;
  const whatsappVisitorsCount = visitors.length + customers.filter(c => c.addedBy === 'WhatsApp Webhook').length;

  // --- SUBSCRIBED CLIENTS DATA POOL (العملاء المشتركين) ---
  const getIsSubscribed = (c) => {
    if (!c) return false;
    const st = (c.crmStatus && c.crmStatus !== 'assigned') ? c.crmStatus : 'unassigned';
    return st === 'subscribed';
  };

  // Subscribed clients mapped uniquely across leads_crm, employee_leads, and customers
  const allSubscribedClients = Array.from(
    new Map(
      [...leadsCrm, ...employeeLeads, ...customers]
        .filter(getIsSubscribed)
        .map(c => [c.phoneNumber || c.id, c])
    ).values()
  );

  const leaderSubscribedClients = Array.from(
    new Map(
      [...leadsCrm, ...employeeLeads, ...customers]
        .filter(c => getIsSubscribed(c) && (
          c.assignedToUid === currentUser?.uid || 
          c.addedByUid === currentUser?.uid || 
          c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase() ||
          myTeamMembers.some(m => m.uid === c.assignedToUid || m.uid === c.addedByUid || m.email?.toLowerCase() === c.assignedTo?.toLowerCase())
        ))
        .map(c => [c.phoneNumber || c.id, c])
    ).values()
  );

  const agentSubscribedClients = Array.from(
    new Map(
      [...leadsCrm, ...employeeLeads, ...customers]
        .filter(c => getIsSubscribed(c) && (
          c.assignedToUid === currentUser?.uid || 
          c.addedByUid === currentUser?.uid || 
          c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase()
        ))
        .map(c => [c.phoneNumber || c.id, c])
    ).values()
  );

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
    const textContent = rawImportText.trim();
    const lines = textContent.split('\n');
    const parsed = [];
    const seenPhones = new Set();

    lines.forEach(line => {
      const text = line.trim();
      if (!text) return;

      const phoneMatches = text.match(/(?:\+?\d{1,4}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g);
      if (phoneMatches) {
        phoneMatches.forEach(rawMatch => {
          const rawPhone = rawMatch.replace(/[\s\-\(\)]/g, '');
          if (rawPhone.length >= 8 && !seenPhones.has(rawPhone)) {
            seenPhones.add(rawPhone);
            const rawNamePart = text.replace(rawMatch, '').replace(/[,\t:;|\-\[\]]/g, '').trim();
            const cleanName = extractCleanCustomerName(rawNamePart);
            parsed.push({
              name: cleanName || 'عميل جديد',
              phone: rawPhone,
              email: '',
              notes: text !== rawMatch ? text : ''
            });
          }
        });
      }
    });

    setImportRows(parsed);
    if (parsed.length > 0) {
      toast.success(`تم استخراج ${parsed.length} عميل من النص بنجاح 🎯`);
    } else {
      toast.error('لم يتم العثور على أرقام هواتف صالحة في النص المدخل');
    }
  };

  const handleAddManualLeadToImport = (e) => {
    e?.preventDefault();
    if (!manualPhone.trim() && !manualName.trim()) {
      toast.error('يرجى إدخال رقم الهاتف أو اسم العميل على الأقل');
      return;
    }
    const cleanName = extractCleanCustomerName(manualName.trim());
    const newRow = {
      name: cleanName || 'عميل جديد',
      phone: manualPhone.trim(),
      email: '',
      notes: manualNotes.trim()
    };
    setImportRows(prev => [newRow, ...prev]);
    toast.success(`تمت إضافة (${newRow.name}) إلى قائمة المعاينة 📋`);
    setManualName('');
    setManualPhone('');
    setManualNotes('');
  };

  const handleQuickSaveDirectLead = async (e, targetTab = activeTab) => {
    e?.preventDefault();
    if (!manualPhone.trim() && !manualName.trim()) {
      toast.error('يرجى إدخال رقم الهاتف أو اسم العميل على الأقل');
      return;
    }
    const cleanName = extractCleanCustomerName(manualName.trim()) || 'عميل جديد';
    let cleanPhone = manualPhone.replace(/[^0-9+]/g, '');
    if (cleanPhone && !cleanPhone.startsWith('+')) {
      cleanPhone = `+${cleanPhone}`;
    }
    if (!cleanPhone) {
      toast.error('يرجى إدخال رقم هاتف صالح');
      return;
    }

    const docId = cleanPhone.replace(/[^0-9]/g, '');
    const isCurrentUserAdmin = isAdmin || adminEmails.includes(currentUser?.email?.toLowerCase());
    const empUser = employees.find(emp => emp.email?.toLowerCase() === currentUser?.email?.toLowerCase());
    const empName = isCurrentUserAdmin ? 'الإدارة' : (empUser?.name || currentUser?.email?.split('@')[0] || 'موظف');
    const targetColl = targetTab === 'leads_crm' ? 'leads_crm' : 'employee_leads';

    try {
      const docPayload = {
        name: cleanName,
        phoneNumber: cleanPhone,
        source: 'إضافة يدوية مباشرة',
        addedBy: empName,
        addedByUid: isCurrentUserAdmin ? 'admin' : (currentUser?.uid || ''),
        assignedTo: isCurrentUserAdmin ? 'الإدارة' : (currentUser?.email || 'الإدارة'),
        assignedToUid: isCurrentUserAdmin ? 'admin' : (currentUser?.uid || 'admin'),
        crmStatus: 'unassigned',
        status: 'assigned',
        notes: manualNotes.trim() || '',
        notesHistory: manualNotes.trim() ? [{
          id: Date.now().toString(),
          text: manualNotes.trim(),
          author: empName,
          createdAt: new Date().toISOString()
        }] : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unread: 0
      };

      await setDoc(doc(db, targetColl, docId), docPayload, { merge: true });
      toast.success(`تم حفظ وإضافة العميل (${cleanName}) بنجاح في ${targetColl === 'leads_crm' ? 'Leads CRM' : 'داتا مضافة بواسطة الموظف'} 🎯`);
      setManualName('');
      setManualPhone('');
      setManualNotes('');
      setIsQuickAddOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ العميل');
    }
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
      const isPersonal = !isAdmin && !isCoordinator;
      const empUser = employees.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
      const empName = isAdmin ? '👑 الإدارة' : (empUser?.name || currentUser?.email?.split('@')[0] || 'موظف');
      const empRole = isAdmin ? 'Admin' : (isCoordinator ? 'Coordinator' : (isLeader ? 'Leader' : 'Agent'));

      let savedCount = 0;
      for (const item of importRows) {
        let cleanPhone = item.phone.replace(/[^0-9+]/g, '');
        if (!cleanPhone.startsWith('+')) cleanPhone = `+${cleanPhone}`;

        const crmDocId = cleanPhone.replace(/[^0-9]/g, '');
        const crmRef = doc(db, 'employee_leads', crmDocId);
        const crmSnap = await getDoc(crmRef);

        const sourceLabel = importTab === 'gsheet' ? 'رابط Google Sheet' : importTab === 'text' ? 'نص / سكرين شوت' : importTab === 'manual' ? 'إضافة يدوية' : 'ملف Excel / CSV';

        if (!crmSnap.exists()) {
          const docData = {
            phoneNumber: cleanPhone,
            name: item.name || 'عميل جديد',
            email: item.email || '',
            notes: item.notes || '',
            source: sourceLabel,
            assignedSender: 'campaigns',
            addedBy: empName,
            addedByUid: currentUser?.uid || '',
            addedByRole: empRole,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            unread: 0
          };

          if (isPersonal) {
            // Automatically assigned to this Agent or Leader
            docData.assignedTo = currentUser.email;
            docData.assignedToUid = currentUser.uid;
            docData.assignedAt = serverTimestamp();
            docData.status = 'assigned';
            docData.crmStatus = 'unassigned';
            const logObj = createAssignmentLog('إضافة ذاتية', `👤 ${empName}`, `إضافة واستيراد داتا بواسطة (${empName})`);
            docData.assignmentHistory = [logObj];
          } else {
            // Admin or Coordinator
            docData.assignedTo = 'الإدارة';
            docData.assignedToUid = 'admin';
            docData.status = 'unassigned';
            docData.crmStatus = 'unassigned';
          }

          await setDoc(crmRef, docData);
          savedCount++;
        }
      }
      const skippedCount = importRows.length - savedCount;
      if (skippedCount > 0) {
        toast.success(`تم حفظ ${savedCount} عميل جديد في (داتا مضافة بواسطة الموظف) وتخطي ${skippedCount} مكرر`);
      } else {
        toast.success(`تم حفظ ${savedCount} عميل بنجاح في قسم (داتا مضافة بواسطة الموظف) 🚀`);
      }
      setIsImportModalOpen(false);
      setImportRows([]);
      setGsheetUrl('');
      setRawImportText('');
      setManualName('');
      setManualPhone('');
      setManualNotes('');
      setActiveTab('employee_leads');
      tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ العملاء في (داتا مضافة بواسطة الموظف)');
    } finally {
      setImportLoading(false);
    }
  };

  // --- LEAD DISTRIBUTION & ASSIGNMENT HANDLERS (Leads CRM) ---
  const handleExecuteAssignment = async () => {
    if (selectedLeadsCrm.length === 0) {
      toast.error('يرجى تحديد العملاء المراد توزيعهم بوضع علامة (✓) أولاً');
      return;
    }

    if (!singleAssignEmpUid) {
      toast.error('يرجى اختيار الموظف المستلم للتوزيع');
      return;
    }

    const targetLeads = leadsCrm.filter(c => selectedLeadsCrm.includes(c.id));
    if (targetLeads.length === 0) {
      toast.error('لم يتم العثور على بيانات العملاء المحددين للتوزيع');
      return;
    }

    const isTargetAdmin = singleAssignEmpUid === 'admin';
    const emp = isTargetAdmin ? null : employees.find(e => e.uid === singleAssignEmpUid);
    if (!isTargetAdmin && !emp) {
      toast.error('الموظف المختار غير موجود');
      return;
    }

    setAssignLoading(true);
    try {
      const assignerDisplay = isAdmin ? '👑 الإدارة' : isLeader ? `👑 ليدر الفريق (${currentEmpUser?.name || 'ليدر'})` : `📋 منسق للإدارة (${currentEmpUser?.name || 'منسق'})`;

      for (const lead of targetLeads) {
        const prevEmpName = employees.find(e => e.uid === lead.assignedToUid || e.email === lead.assignedTo)?.name || (lead.assignedTo === 'admin' || lead.assignedTo === 'الإدارة' ? '👑 الإدارة' : '👑 الإدارة');

        if (isTargetAdmin) {
          const logObj = createAssignmentLog(prevEmpName, '👑 الإدارة', assignerDisplay);
          await updateDoc(doc(db, 'leads_crm', lead.id), {
            assignedTo: 'الإدارة',
            assignedToUid: 'admin',
            assignedAt: serverTimestamp(),
            status: 'unassigned',
            crmStatus: 'unassigned',
            updatedAt: serverTimestamp(),
            assignmentHistory: arrayUnion(logObj)
          });
        } else {
          const targetEmpName = emp.role === 'admin' ? `👑 الإدارة (${emp.name})` : `👤 ${emp.name}`;
          const logObj = createAssignmentLog(prevEmpName, targetEmpName, assignerDisplay);

          await updateDoc(doc(db, 'leads_crm', lead.id), {
            assignedTo: emp.email,
            assignedToUid: emp.uid,
            assignedAt: serverTimestamp(),
            status: 'assigned',
            crmStatus: 'unassigned', // Initial state is pending/unassigned so it appears in employee pending tab and Card 5!
            updatedAt: serverTimestamp(),
            assignmentHistory: arrayUnion(logObj)
          });
        }
      }

      toast.success(isTargetAdmin ? `تم إرجاع ${targetLeads.length} عميل محدد إلى الإدارة بنجاح 👑` : `تم تعيين وتوزيع ${targetLeads.length} عميل محدد إلى الموظف ${emp.name} بنجاح 🚀`);
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

  // Pull Single Lead from Team Member to Leader's CRM
  const handlePullLead = async (lead) => {
    if (!lead) return;
    try {
      const currentEmp = employees.find(e => e.uid === lead.assignedToUid || e.email === lead.assignedTo);
      const empName = currentEmp ? `👤 ${currentEmp.name}` : (lead.assignedTo || 'الموظف');
      const assignerDisplay = `👑 ليدر الفريق (${currentEmpUser?.name || 'ليدر'})`;
      const logObj = createAssignmentLog(empName, `👑 ${currentEmpUser?.name || 'الليدر'}`, `سحب الداتا بواسطة الليدر (${currentEmpUser?.name || 'ليدر'})`);

      await updateDoc(doc(db, 'leads_crm', lead.id), {
        assignedTo: currentUser.email,
        assignedToUid: currentUser.uid,
        assignedAt: serverTimestamp(),
        status: 'assigned',
        updatedAt: serverTimestamp(),
        assignmentHistory: arrayUnion(logObj)
      });

      toast.success(`تم سحب العميل (${lead.name || lead.phoneNumber}) بنجاح إلى Leads CRM الخاص بك 📥`);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء سحب العميل');
    }
  };

  // Bulk Pull Leads from Team Members to Leader's CRM
  const handleBulkPullLeads = async () => {
    if (selectedTeamTrackingLeads.length === 0) return;
    try {
      const assignerDisplay = `👑 ليدر الفريق (${currentEmpUser?.name || 'ليدر'})`;
      for (const leadId of selectedTeamTrackingLeads) {
        const lead = leadsCrm.find(l => l.id === leadId);
        if (!lead) continue;
        const currentEmp = employees.find(e => e.uid === lead.assignedToUid || e.email === lead.assignedTo);
        const empName = currentEmp ? `👤 ${currentEmp.name}` : (lead.assignedTo || 'الموظف');
        const logObj = createAssignmentLog(empName, `👑 ${currentEmpUser?.name || 'الليدر'}`, `سحب الداتا بواسطة الليدر (${currentEmpUser?.name || 'ليدر'})`);

        await updateDoc(doc(db, 'leads_crm', lead.id), {
          assignedTo: currentUser.email,
          assignedToUid: currentUser.uid,
          assignedAt: serverTimestamp(),
          status: 'assigned',
          updatedAt: serverTimestamp(),
          assignmentHistory: arrayUnion(logObj)
        });
      }
      toast.success(`تم سحب ${selectedTeamTrackingLeads.length} عميل بنجاح إلى Leads CRM الخاص بك 📥`);
      setSelectedTeamTrackingLeads([]);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء سحب العملاء');
    }
  };

  const toggleTeamTrackingSelection = (id) => {
    setSelectedTeamTrackingLeads(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
  };

  const toggleAllTeamTracking = (paginatedItems) => {
    const paginatedIds = paginatedItems.map(c => c.id);
    const allSelected = paginatedIds.length > 0 && paginatedIds.every(id => selectedTeamTrackingLeads.includes(id));
    if (allSelected) {
      setSelectedTeamTrackingLeads(prev => prev.filter(id => !paginatedIds.includes(id)));
    } else {
      setSelectedTeamTrackingLeads(prev => [...new Set([...prev, ...paginatedIds])]);
    }
  };

  const handleDeleteSingleLeadCrm = async (lead) => {
    if (!isAdmin) {
      toast.error('صلاحية المسح والحذف محصورة بالإدارة العليا فقط 🔒');
      return;
    }
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
    if (!isAdmin) {
      toast.error('صلاحية المسح والحذف محصورة بالإدارة العليا فقط 🔒');
      return;
    }
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

  const determineCustomerCollection = (customerOrId) => {
    const id = typeof customerOrId === 'string' ? customerOrId : customerOrId?.id;
    if (employeeLeads.some(l => l.id === id) || (typeof customerOrId === 'object' && customerOrId?.isEmployeeLead)) {
      return 'employee_leads';
    }
    if (leadsCrm.some(l => l.id === id) || (typeof customerOrId === 'object' && customerOrId?.isLeadCrm)) {
      return 'leads_crm';
    }
    return 'بيانات_تسجيل_العملاء';
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

      const targetColl = determineCustomerCollection(customer);
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
      const targetColl = determineCustomerCollection(customerId);
      await updateDoc(doc(db, targetColl, customerId), {
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
      const targetColl = determineCustomerCollection(leadId);
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
    const isEmpLead = employeeLeads.some(l => l.id === customer.id) || customer.isEmployeeLead;
    setSelectedCustomerForNotes({ ...customer, isLeadCrm, isEmployeeLead: isEmpLead });
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

      const targetColl = determineCustomerCollection(selectedCustomerForNotes);
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
      const targetColl = determineCustomerCollection(selectedCustomerForNotes);
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

  // Selection & Clean Helpers for Employee Leads Tab
  const toggleEmployeeLeadSelection = (id) => {
    setSelectedEmployeeLeads(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
  };
  const toggleAllEmployeeLeads = (pageItems) => {
    const items = Array.isArray(pageItems) ? pageItems : employeeLeads;
    const itemIds = items.map(item => item.id);
    const isAllSelected = itemIds.length > 0 && itemIds.every(id => selectedEmployeeLeads.includes(id));
    if (isAllSelected) {
      setSelectedEmployeeLeads(selectedEmployeeLeads.filter(id => !itemIds.includes(id)));
    } else {
      setSelectedEmployeeLeads([...new Set([...selectedEmployeeLeads, ...itemIds])]);
    }
  };

  const handleCleanEmpLeadNames = async () => {
    if (!employeeLeads || employeeLeads.length === 0) {
      toast.error('لا يوجد عملاء لتنظيف أسمائهم حالياً');
      return;
    }
    if (!window.confirm(`سيتم فحص ${employeeLeads.length} سجل في (داتا مضافة بواسطة الموظف) وحذف أي نصوص زائدة أو تواريخ وإبقاء الاسم النظيف فقط. هل تريد المتابعة؟`)) return;
    
    const toastId = toast.loading(`جاري فحص وتنظيف ${employeeLeads.length} عميل...`);
    let fixed = 0;
    try {
      const toUpdate = [];
      for (const lead of employeeLeads) {
        const rawName = lead.name || '';
        const cleaned = extractCleanCustomerName(rawName);
        if (cleaned !== rawName) {
          toUpdate.push({ id: lead.id, cleanedName: cleaned });
        }
      }

      if (toUpdate.length === 0) {
        toast.success('جميع أسماء العملاء نظيفة بالفعل! ✨', { id: toastId });
        return;
      }

      const BATCH_SIZE = 400;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const chunk = toUpdate.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const item of chunk) {
          const leadRef = doc(db, 'employee_leads', item.id);
          batch.update(leadRef, { name: item.cleanedName, updatedAt: serverTimestamp() });
        }
        await batch.commit();
        fixed += chunk.length;
      }

      toast.success(`✅ تم تنظيف أسماء ${fixed} عميل بنجاح!`, { id: toastId, duration: 5000 });
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تنظيف الأسماء: ' + err.message, { id: toastId });
    }
  };

  const handleDeleteSelectedEmpLeads = async () => {
    if (!isAdmin) {
      toast.error('صلاحية المسح والحذف محصورة بالإدارة العليا فقط 🔒');
      return;
    }
    if (selectedEmployeeLeads.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedEmployeeLeads.length} عميل من (داتا مضافة بواسطة الموظف)؟`)) return;
    
    try {
      const batch = writeBatch(db);
      selectedEmployeeLeads.forEach(id => {
        batch.delete(doc(db, 'employee_leads', id));
      });
      await batch.commit();
      const count = selectedEmployeeLeads.length;
      setSelectedEmployeeLeads([]);
      toast.success(`تم حذف ${count} عميل بنجاح`);
    } catch (err) {
      console.error(err);
      toast.error('خطأ أثناء حذف العملاء');
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
      
      const leaderObj = newEmpJobTitle === 'Agent' && newEmpLeaderUid ? employees.find(l => l.uid === newEmpLeaderUid) : null;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        username: newEmpUsername,
        password: newEmpPassword,
        name: newEmpName || newEmpUsername,
        empCode: newEmpCode || '',
        jobTitle: newEmpJobTitle || 'Agent',
        leaderUid: leaderObj ? leaderObj.uid : '',
        leaderName: leaderObj ? (leaderObj.name || leaderObj.username) : '',
        leaderAssignedAt: leaderObj ? serverTimestamp() : null,
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
      setNewEmpLeaderUid('');
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
      const leaderObj = editEmpJobTitle === 'Agent' && editEmpLeaderUid ? employees.find(l => l.uid === editEmpLeaderUid) : null;
      const currentLeaderUid = editEmp.leaderUid || '';
      const newLeaderUid = leaderObj ? leaderObj.uid : '';
      const isLeaderChanged = currentLeaderUid !== newLeaderUid;

      const updateData = { 
        password: editEmpPassword,
        name: editEmpName,
        username: editEmpUsername,
        email: emailToCreate,
        empCode: editEmpCode || '',
        jobTitle: editEmpJobTitle || 'Agent',
        leaderUid: newLeaderUid,
        leaderName: leaderObj ? (leaderObj.name || leaderObj.username) : ''
      };

      if (isLeaderChanged) {
        updateData.leaderAssignedAt = newLeaderUid ? serverTimestamp() : null;
      }

      // 1. Update Firestore document directly (Always succeeds!)
      await setDoc(doc(db, 'users', editEmp.uid), updateData, { merge: true });

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
      setEditEmpLeaderUid('');
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
    if (!isAdmin) {
      toast.error('صلاحية المسح والحذف محصورة بالإدارة العليا فقط 🔒');
      return;
    }
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
    if (!isAdmin) {
      toast.error('صلاحية المسح والحذف محصورة بالإدارة العليا فقط 🔒');
      return;
    }
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
    const combinedIds = [
      ...visitors.map(v => v.id),
      ...customers.filter(c => c.addedBy === 'WhatsApp Webhook').map(c => c.id)
    ];
    if (selectedVisitors.length === combinedIds.length && combinedIds.length > 0) setSelectedVisitors([]);
    else setSelectedVisitors(combinedIds);
  };
  const deleteSelectedVisitors = async () => {
    if (!isAdmin) {
      toast.error('صلاحية المسح والحذف محصورة بالإدارة العليا فقط 🔒');
      return;
    }
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
    if (!isAdmin) {
      toast.error('صلاحية المسح والحذف محصورة بالإدارة العليا فقط 🔒');
      return;
    }
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
    if (!isAdmin) {
      toast.error('صلاحية المسح والحذف محصورة بالإدارة العليا فقط 🔒');
      return;
    }
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
    if (!isAdmin) {
      toast.error('صلاحية المسح والحذف محصورة بالإدارة العليا فقط 🔒');
      return;
    }
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
    if (!isAdmin) {
      toast.error('صلاحية استرجاع البيانات محصورة بالإدارة العليا فقط 🔒');
      return;
    }
    try {
      const { originalCollection, type, deletedAt, id, ...restData } = item;
      await setDoc(doc(db, originalCollection, item.id), restData);
      await deleteDoc(doc(db, 'recycle_bin', item.id));
    } catch (e) { console.error(e); }
  };

  const handleDeleteForever = async (id) => {
    if (!isAdmin) {
      toast.error('صلاحية الحذف النهائي للأبد محصورة بالإدارة العليا فقط 🔒');
      return;
    }
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
    if (!isAdmin) {
      toast.error('صلاحية الاسترجاع محصورة بالإدارة العليا فقط 🔒');
      return;
    }
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
    if (!isAdmin) {
      toast.error('صلاحية الحذف النهائي محصورة بالإدارة العليا فقط 🔒');
      return;
    }
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
      const customer = customers.find(c => c.id === chatId);
      const prevEmpName = employees.find(e => e.uid === customer?.assignedToUid || e.email === customer?.assignedTo)?.name || (customer?.assignedTo === 'admin' || customer?.assignedTo === 'الإدارة' ? '👑 الإدارة' : '👑 الإدارة');
      const assignerDisplay = isAdmin ? '👑 الإدارة' : isLeader ? `👑 ليدر الفريق (${currentEmpUser?.name || 'ليدر'})` : `📋 منسق للإدارة (${currentEmpUser?.name || 'منسق'})`;

      if (empUid === 'admin') {
        const logObj = createAssignmentLog(prevEmpName, '👑 الإدارة', assignerDisplay);
        await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', chatId), {
          status: 'unassigned',
          assignedTo: 'admin',
          assignedToUid: 'admin',
          assignedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          assignmentHistory: arrayUnion(logObj),
          unread: 1
        });
        toast.success('تم إرجاع العميل إلى الإدارة 👑');
      } else {
        const emp = employees.find(e => e.uid === empUid);
        if (!emp) return;
        const targetEmpName = emp.role === 'admin' ? `👑 الإدارة (${emp.name})` : `👤 ${emp.name}`;
        const logObj = createAssignmentLog(prevEmpName, targetEmpName, assignerDisplay);

        // 1. Update customer in 'بيانات_تسجيل_العملاء'
        await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', chatId), {
          status: 'assigned',
          assignedTo: emp.email,
          assignedToUid: emp.uid,
          assignedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          assignmentHistory: arrayUnion(logObj),
          unread: 1
        });

        // 2. Transfer customer directly to 'leads_crm' collection so it appears on Employee/Leader Leads CRM dashboard table!
        const cleanPhone = (customer?.phoneNumber || '').replace(/[^0-9+]/g, '');
        const crmDocId = cleanPhone ? cleanPhone.replace(/[^0-9]/g, '') : chatId;

        await setDoc(doc(db, 'leads_crm', crmDocId), {
          name: customer?.name || 'عميل محول من واتساب',
          phoneNumber: cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`,
          source: customer?.source || 'واتساب الموقع',
          assignedTo: emp.email,
          assignedToUid: emp.uid,
          crmStatus: 'unassigned', // Initial state in waiting
          status: 'assigned',
          assignedAt: serverTimestamp(),
          createdAt: customer?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
          notes: customer?.notes || '',
          notesHistory: customer?.notesHistory || [],
          assignmentHistory: arrayUnion(logObj)
        }, { merge: true });

        toast.success(`تم تحويل العميل إلى Leads CRM الخاص بـ ${emp.name} على الداش بورد 🎯`);
      }
    } catch (error) {
      console.error("خطأ في إسناد المحادثة:", error);
      toast.error('حدث خطأ أثناء تحويل العميل');
    }
  };

  const exportLeadsToExcel = () => {
    if (!isAdmin) {
      toast.error('تصدير البيانات إلى Excel متاح للإدارة فقط 🔒');
      return;
    }
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

  const exportEmployeeLeadsToExcel = () => {
    if (!isAdmin) {
      toast.error('تصدير البيانات إلى Excel متاح للإدارة فقط 🔒');
      return;
    }
    if (!employeeLeads || employeeLeads.length === 0) {
      toast.error('لا يوجد عملاء لتصديرهم في داتا مضافة بواسطة الموظف');
      return;
    }

    try {
      const excelData = employeeLeads.map((lead, idx) => {
        const emp = employees.find(e => e.uid === lead.assignedToUid || e.email?.toLowerCase() === lead.assignedTo?.toLowerCase());
        const empName = emp ? (emp.name || emp.username) : (lead.assignedTo === 'admin' || lead.assignedTo === 'الإدارة' ? '👑 الإدارة' : (lead.assignedTo || 'غير محدد'));
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
          'الموظف المسؤول': empName,
          'أضيف بواسطة': lead.addedBy || 'غير محدد',
          'المصدر': lead.source || 'إكسيل',
          'تاريخ الإضافة': formatDate(lead.createdAt || lead.updatedAt),
          'تاريخ بدء التجربة': lead.trialStartDate || 'غير محدد',
          'الملاحظات والتقارير': compiledNotes
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'داتا مضافة بواسطة الموظف');
      
      const fileName = `تصدير_داتا_مضافة_بواسطة_الموظف_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`تم تصدير ${employeeLeads.length} عميل إلى ملف إكسيل بنجاح 🟢`);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تصدير ملف الإكسيل');
    }
  };

  const openSubscriptionModal = (customer) => {
    setSelectedSubCustomer(customer);
    const details = customer.subscriptionDetails || {};
    setSubStartDate(details.startDate || new Date().toISOString().slice(0, 10));
    setSubEndDate(details.endDate || '');
    setSubServiceType(details.serviceType || 'الباقة السنوية');
    setSubPaymentType(details.paymentType || 'full');
    setSubPaidAmount(details.paidAmount || '');
    setSubRemainingAmount(details.remainingAmount || '');
    setSubReceiptProof(details.receiptProof || '');
    setSubReceiptFileUrl(details.receiptUrl || '');
    setSubNotes(details.notes || '');
    setIsSubscriptionModalOpen(true);
  };

  const handleReceiptFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setSubReceiptFileUrl(uploadEvent.target.result);
      toast.success('تم رفع صورة إشعار التحويل بنجاح 📄');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSubscriptionDetails = async (e) => {
    e?.preventDefault();
    if (!selectedSubCustomer) return;
    if (!subStartDate || !subEndDate) {
      toast.error('يرجى تحديد تاريخ بداية ونهاية الخدمة (حقول إجبارية) ⚠️');
      return;
    }
    if (!subReceiptProof.trim() && !subReceiptFileUrl) {
      toast.error('يرجى إدخال إشعار التحويل / كود العملية أو رفع الإشعار (إجباري) ⚠️');
      return;
    }

    setSubSaving(true);
    try {
      const subData = {
        startDate: subStartDate,
        endDate: subEndDate,
        serviceType: subServiceType || 'الباقة السنوية',
        paymentType: subPaymentType,
        paidAmount: subPaidAmount,
        remainingAmount: subPaymentType === 'partial' ? subRemainingAmount : '',
        receiptProof: subReceiptProof.trim(),
        receiptUrl: subReceiptFileUrl || '',
        notes: subNotes.trim(),
        savedBy: currentEmpUser?.name || currentUser?.email || 'الإدارة',
        savedByUid: currentUser?.uid || 'admin',
        savedAt: new Date().toISOString()
      };

      const targetId = selectedSubCustomer.id;
      const cleanPhone = (selectedSubCustomer.phoneNumber || '').replace(/[^0-9+]/g, '');
      const phoneDocId = cleanPhone ? cleanPhone.replace(/[^0-9]/g, '') : targetId;

      const promises = [
        updateDoc(doc(db, 'leads_crm', targetId), { subscriptionDetails: subData, crmStatus: 'subscribed', updatedAt: serverTimestamp() }).catch(() => {}),
        updateDoc(doc(db, 'leads_crm', phoneDocId), { subscriptionDetails: subData, crmStatus: 'subscribed', updatedAt: serverTimestamp() }).catch(() => {}),
        updateDoc(doc(db, 'employee_leads', targetId), { subscriptionDetails: subData, crmStatus: 'subscribed', updatedAt: serverTimestamp() }).catch(() => {}),
        updateDoc(doc(db, 'employee_leads', phoneDocId), { subscriptionDetails: subData, crmStatus: 'subscribed', updatedAt: serverTimestamp() }).catch(() => {}),
        updateDoc(doc(db, 'بيانات_تسجيل_العملاء', targetId), { subscriptionDetails: subData, crmStatus: 'subscribed', updatedAt: serverTimestamp() }).catch(() => {})
      ];

      await Promise.all(promises);

      toast.success('تم حفظ وتأكيد بيانات اشتراك العميل بنجاح 💳✨');
      setIsSubscriptionModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ بيانات الاشتراك');
    } finally {
      setSubSaving(false);
    }
  };

  const exportSubscribedClientsToExcel = () => {
    if (!isAdmin) {
      toast.error('تصدير البيانات إلى Excel متاح للإدارة فقط 🔒');
      return;
    }
    const scopeList = allSubscribedClients;

    if (scopeList.length === 0) {
      toast.error('لا يوجد عملاء مشتركين لتصديرهم');
      return;
    }

    try {
      const excelData = scopeList.map((client, idx) => {
        const emp = employees.find(e => e.uid === client.assignedToUid || e.email?.toLowerCase() === client.assignedTo?.toLowerCase());
        const empName = emp ? (emp.name || emp.username) : (client.assignedTo === 'admin' || client.assignedTo === 'الإدارة' ? '👑 الإدارة' : (client.assignedTo || 'غير محدد'));
        const sub = client.subscriptionDetails || {};

        let paymentLabel = 'غير محدد';
        if (sub.paymentType === 'full') paymentLabel = `كامل (${sub.paidAmount || '0'})`;
        else if (sub.paymentType === 'percentage') paymentLabel = `نسبة (${sub.paidAmount || '0'})`;
        else if (sub.paymentType === 'partial') paymentLabel = `جزء وباقي جزء (مدفوع: ${sub.paidAmount || '0'} - متبقي: ${sub.remainingAmount || '0'})`;

        return {
          '#': idx + 1,
          'اسم العميل': client.name || 'عميل مشترك',
          'رقم الهاتف': client.phoneNumber || '',
          'الموظف المسؤول': empName,
          'نوع الخدمة / الباقة': sub.serviceType || 'غير محدد',
          'تاريخ بداية الخدمة': sub.startDate || 'غير مسجل',
          'تاريخ نهاية الخدمة': sub.endDate || 'غير مسجل',
          'حالة الدفع والمبلغ': paymentLabel,
          'إشعار التحويل / كود العملية': sub.receiptProof || 'غير مسجل',
          'ملاحظات الاشتراك': sub.notes || '',
          'تاريخ تسجيل الاشتراك': sub.savedAt ? formatDate(sub.savedAt) : formatDate(client.updatedAt || client.createdAt)
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'العملاء المشتركين');
      
      const fileName = `العملاء_المشتركين_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`تم تصدير ${scopeList.length} مشترك إلى إكسيل بنجاح 🟢`);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تصدير ملف الإكسيل');
    }
  };

  // --- CRM SHEET WHATSAPP CAMPAIGN STATES & HANDLERS ---
  const CRM_CAMPAIGN_TEMPLATES = [
    {
      id: 'welcome_msg',
      name: 'رسالة الترحيب والتعريف بالخدمات 🤝 (الافتراضي)',
      text: `السلام عليكم 🤝 .. مع حضرتك منصه اتجاه التحليل الذكي 📉📈 .. نقدم خدمات دعم فني للسوق السعودي 🇸🇦 و السوق الامريكي 🇺🇸
لو حضرتك مهتم بالتفاصيل ارسل تم

نأسف للازعاج . نحن هنا لخدمتك وتحقيق عائد مضمون لك
--------------------------------------------
[🔘 مهتم | 🔘 غير مهتم]`
    },
    {
      id: 'followup_msg',
      name: 'رسالة المتابعة وخدمات التوصيات 📊',
      text: `أهلاً بك 🌟 .. منصة اتجاه للتحليل الذكي توفر لك توصيات وتحليلات حصرية لحظية لأقوى الأسهم والفرص الاستثمارية 📈.
يسعدنا تقديم تجربة مجانية مميزة لحسابك.

للرد والتفعيل يرجى إرسال كلمة (مهتم).`
    },
    {
      id: 'custom',
      name: '📝 رسالة ترويجية مخصصة',
      text: ''
    }
  ];

  const [isCrmCampaignModalOpen, setIsCrmCampaignModalOpen] = useState(false);
  const [crmCampaignBatchSize, setCrmCampaignBatchSize] = useState(5); // 1 to 10
  const [crmCampaignTemplateId, setCrmCampaignTemplateId] = useState('welcome_msg');
  const [crmCampaignCustomText, setCrmCampaignCustomText] = useState('');
  const [crmCampaignTargetPool, setCrmCampaignTargetPool] = useState('leads_crm'); // 'leads_crm' or 'employee_leads'
  const [crmCampaignSending, setCrmCampaignSending] = useState(false);
  const [crmCampaignProgress, setCrmCampaignProgress] = useState(0);
  const [crmCampaignCheckedLeadIds, setCrmCampaignCheckedLeadIds] = useState([]);
  const [campaignSourceFilter, setCampaignSourceFilter] = useState('all'); // 'all', 'crm_sheet', 'excel_import', 'direct'

  // 48 hours cooldown helper (2 days / يومين)
  const isLeadInCampaignCooldown = (lead) => {
    if (!lead) return false;
    const lastTime = getTimestampMillis(lead.lastCampaignSentAt) || getTimestampMillis(lead.lastCampaignDate) || (lead.lastCampaignSentMillis || 0);
    if (!lastTime) return false;
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    return (Date.now() - lastTime) < TWO_DAYS_MS;
  };

  const getRemainingCooldownHours = (lead) => {
    if (!lead) return 0;
    const lastTime = getTimestampMillis(lead.lastCampaignSentAt) || getTimestampMillis(lead.lastCampaignDate) || (lead.lastCampaignSentMillis || 0);
    if (!lastTime) return 0;
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    const diff = (lastTime + TWO_DAYS_MS) - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60));
  };

  const getCrmCampaignTargetLeads = (batchCount = crmCampaignBatchSize) => {
    const isEmpLeadsPool = crmCampaignTargetPool === 'employee_leads';
    const sourceList = isEmpLeadsPool ? employeeLeads : leadsCrm;
    const selectedIds = isEmpLeadsPool ? selectedEmployeeLeads : selectedLeadsCrm;

    let candidateLeads = [];
    if (selectedIds.length > 0) {
      candidateLeads = sourceList.filter(c => selectedIds.includes(c.id));
    } else {
      candidateLeads = sourceList.filter(c => {
        if (isAdmin) return true;
        if (isLeader) {
          return c.assignedToUid === currentUser?.uid || myTeamMembers.some(m => m.uid === c.assignedToUid || m.uid === c.addedByUid);
        }
        return c.assignedToUid === currentUser?.uid || c.addedByUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase();
      });
    }

    const validLeads = candidateLeads.filter(c => c.phoneNumber && String(c.phoneNumber).replace(/[^0-9]/g, '').length >= 8);
    const availableLeads = validLeads.filter(c => !isLeadInCampaignCooldown(c));
    const cooldownLeads = validLeads.filter(c => isLeadInCampaignCooldown(c));
    const combined = [...availableLeads, ...cooldownLeads];
    const count = Math.min(10, Math.max(1, batchCount));
    return combined.slice(0, count);
  };

  const openCrmCampaignModal = (poolType = 'leads_crm') => {
    if (isCoordinator) {
      toast.error('صلاحية إرسال الحملات غير مفعلة لحساب المنسق 🔒');
      return;
    }
    setCrmCampaignTargetPool(poolType);
    setCrmCampaignProgress(0);
    const isEmpLeadsPool = poolType === 'employee_leads';
    const sourceList = isEmpLeadsPool ? employeeLeads : leadsCrm;
    const selectedIds = isEmpLeadsPool ? selectedEmployeeLeads : selectedLeadsCrm;
    let candidateLeads = [];
    if (selectedIds.length > 0) {
      candidateLeads = sourceList.filter(c => selectedIds.includes(c.id));
    } else {
      candidateLeads = sourceList.filter(c => {
        if (isAdmin) return true;
        if (isLeader) return c.assignedToUid === currentUser?.uid || myTeamMembers.some(m => m.uid === c.assignedToUid || m.uid === c.addedByUid);
        return c.assignedToUid === currentUser?.uid || c.addedByUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase();
      });
    }
    const validLeads = candidateLeads.filter(c => c.phoneNumber && String(c.phoneNumber).replace(/[^0-9]/g, '').length >= 8);
    const availableLeads = validLeads.filter(c => !isLeadInCampaignCooldown(c));
    const cooldownLeads = validLeads.filter(c => isLeadInCampaignCooldown(c));
    const targets = [...availableLeads, ...cooldownLeads].slice(0, crmCampaignBatchSize);
    const eligibleIds = targets.filter(c => !isLeadInCampaignCooldown(c)).map(c => c.id);
    setCrmCampaignCheckedLeadIds(eligibleIds);
    setIsCrmCampaignModalOpen(true);
  };

  const handleBatchSizeChange = (size) => {
    setCrmCampaignBatchSize(size);
    const targets = getCrmCampaignTargetLeads(size);
    const eligibleIds = targets.filter(c => !isLeadInCampaignCooldown(c)).map(c => c.id);
    setCrmCampaignCheckedLeadIds(eligibleIds);
  };

  const toggleCampaignLeadCheck = (leadId, inCooldown) => {
    if (inCooldown) {
      toast.error('هذا الرقم تم إرسال حملة له مؤخراً ولا يمكن إرسال حملة له إلا بعد مرور يومين (48 ساعة) ⏳');
      return;
    }
    setCrmCampaignCheckedLeadIds(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const toggleAllCampaignLeads = (targets) => {
    const eligibleTargets = targets.filter(c => !isLeadInCampaignCooldown(c));
    if (crmCampaignCheckedLeadIds.length === eligibleTargets.length && eligibleTargets.length > 0) {
      setCrmCampaignCheckedLeadIds([]);
    } else {
      setCrmCampaignCheckedLeadIds(eligibleTargets.map(c => c.id));
    }
  };

  const handleSendCrmCampaign = async () => {
    const targets = getCrmCampaignTargetLeads(crmCampaignBatchSize);
    const selectedTargets = targets.filter(c => crmCampaignCheckedLeadIds.includes(c.id));

    if (!selectedTargets || selectedTargets.length === 0) {
      toast.error('يرجى تحديد عميل واحد على الأقل بعلامة (✓) لإرسال الحملة');
      return;
    }

    const cooldownFiltered = selectedTargets.filter(c => isLeadInCampaignCooldown(c));
    if (cooldownFiltered.length > 0) {
      toast.error(`تعذر الإرسال لـ ${cooldownFiltered.length} عميل لأنهم استلموا حملة خلال آخر 48 ساعة.`);
      return;
    }

    const templateObj = CRM_CAMPAIGN_TEMPLATES.find(t => t.id === crmCampaignTemplateId);
    const msgText = crmCampaignTemplateId === 'custom' ? crmCampaignCustomText.trim() : (templateObj?.text || '');

    if (!msgText) {
      toast.error('يرجى كتابة نص الرسالة الإعلانية أو اختيار قالب');
      return;
    }

    setCrmCampaignSending(true);
    setCrmCampaignProgress(0);

    let successCount = 0;
    let failCount = 0;
    const senderName = isAdmin ? '👑 الإدارة' : (currentEmpUser?.name || currentUser?.email?.split('@')[0] || 'موظف');

    for (let i = 0; i < selectedTargets.length; i++) {
      const lead = selectedTargets[i];
      let cleanPhone = String(lead.phoneNumber || '').replace(/[^0-9+]/g, '');
      if (!cleanPhone.startsWith('+')) {
        if (cleanPhone.startsWith('0')) cleanPhone = '+20' + cleanPhone.substring(1);
        else if (cleanPhone.startsWith('5')) cleanPhone = '+966' + cleanPhone;
        else if (!cleanPhone.startsWith('20') && !cleanPhone.startsWith('966')) cleanPhone = '+' + cleanPhone;
      }

      const clientName = lead.name || 'عميل جديد';
      const crmDocId = cleanPhone.replace(/[^0-9]/g, '');

      try {
        let metaMsgId = null;
        try {
          if (crmCampaignTemplateId !== 'custom') {
            const res = await fetch('/api/sendTemplate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: cleanPhone,
                templateName: crmCampaignTemplateId,
                languageCode: 'ar_EG'
              })
            });
            const resData = await res.json();
            if (res.ok && resData.success) {
              metaMsgId = resData.metaMessageId || null;
            }
          } else {
            const res = await fetch('/api/sendMessage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: cleanPhone,
                text: msgText
              })
            });
            const resData = await res.json();
            if (res.ok && resData.success) {
              metaMsgId = resData.metaMessageId || null;
            }
          }
        } catch (apiErr) {
          console.error("API send error:", apiErr);
        }

        // Ensure chat appears on WhatsApp Inbox page for this employee
        await setDoc(doc(db, 'بيانات_تسجيل_العملاء', crmDocId), {
          phoneNumber: cleanPhone,
          name: clientName,
          assignedTo: currentUser?.email || 'admin',
          assignedToUid: currentUser?.uid || 'admin',
          source: 'crm_sheet',
          campaignSource: 'crm_sheet',
          assignedSender: 'campaigns',
          status: 'assigned',
          lastMessage: msgText,
          updatedAt: serverTimestamp(),
          createdAt: lead.createdAt || serverTimestamp(),
          lastCampaignSentAt: serverTimestamp(),
          lastCampaignSentMillis: Date.now(),
          lastCampaignDate: new Date().toISOString(),
          unread: 0
        }, { merge: true });

        // Record message in 'رسائل_الموظفين_للعملاء' for Campaign Analytics
        await addDoc(collection(db, 'رسائل_الموظفين_للعملاء'), {
          conversationId: crmDocId,
          text: msgText,
          templateName: templateObj?.name || (crmCampaignTemplateId === 'custom' ? 'رسالة ترويجية مخصصة' : crmCampaignTemplateId),
          isTemplate: true,
          campaignSource: 'crm_sheet',
          source: 'crm_sheet',
          sender: 'agent',
          senderName: senderName,
          senderEmail: currentUser?.email || 'unknown',
          senderUid: currentUser?.uid || 'unknown',
          recipientPhone: cleanPhone,
          status: 'delivered',
          timestamp: serverTimestamp(),
          metaMessageId: metaMsgId
        });

        // Add history note and 2-day cooldown timestamps to lead
        const noteLog = {
          id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 4),
          author: senderName,
          text: `[حملة واتساب CRM]: تم إرسال رسالة الحملة بنجاح (${templateObj?.name || 'رسالة مخصصة'})`,
          date: new Date().toISOString()
        };

        const targetCol = crmCampaignTargetPool === 'employee_leads' ? 'employee_leads' : 'leads_crm';
        await updateDoc(doc(db, targetCol, lead.id), {
          notesHistory: arrayUnion(noteLog),
          lastContactedAt: serverTimestamp(),
          lastCampaignSentAt: serverTimestamp(),
          lastCampaignSentMillis: Date.now(),
          lastCampaignDate: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });

        successCount++;
      } catch (err) {
        console.error("Error processing lead:", lead, err);
        failCount++;
      }

      setCrmCampaignProgress(i + 1);
    }

    setCrmCampaignSending(false);
    setIsCrmCampaignModalOpen(false);

    if (successCount > 0) {
      toast.success(`تم إرسال الحملة الإعلانية بنجاح لـ (${successCount}) عميل 🚀 (محمية من التكرار لمدة يومين)`, { duration: 6000 });
    }
    if (failCount > 0) {
      toast.error(`تعذر إرسال (${failCount}) أرقام.`);
    }
  };

  // --- CALL PERFORMANCE ANALYTICS COMPUTATIONS ---
  const roleFilteredCallLogs = callLogs.filter(log => {
    if (isAdmin || isCoordinator) return true;
    if (isLeader) {
      return log.employeeUid === currentUser?.uid || log.leaderUid === currentUser?.uid || myTeamMembers.some(m => m.uid === log.employeeUid);
    }
    return log.employeeUid === currentUser?.uid;
  });

  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayCallLogsCount = roleFilteredCallLogs.filter(log => {
    if (log.calledDateStr === todayDateStr) return true;
    const time = getTimestampMillis(log.calledAt) || log.timestampMillis;
    if (time) {
      const logDate = new Date(time).toISOString().split('T')[0];
      return logDate === todayDateStr;
    }
    return false;
  }).length;

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
        className="bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200 relative z-10 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col md:flex-row justify-between items-center gap-2.5 sm:gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar on mobile / Brand + User info */}
        <div className="flex items-center justify-between w-full md:w-auto gap-2">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-2">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-purple-500 rounded-full blur-[3px] opacity-80 animate-pulse"></div>
              <img 
                src="/logo.jpg" 
                alt="Logo 3D" 
                className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-emerald-300 shadow-md" 
              />
            </div>
            <h1 className="text-sm sm:text-base md:text-xl font-black text-gray-800 flex items-center gap-1.5 whitespace-nowrap">
              <span>Etegah</span>
              <span className={`text-[11px] sm:text-xs px-2 py-0.5 rounded-full font-black shadow-sm border ${
                isAdmin 
                  ? 'text-primary bg-primary/10 border-emerald-300' 
                  : 'text-purple-700 bg-purple-100 border-purple-300'
              }`}>
                CRM
              </span>
            </h1>
          </div>

          {/* User Badge - Visible & Clean on Mobile & Desktop */}
          <div className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 shadow-sm shrink-0">
            <div className="relative group shrink-0 hidden sm:block">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full blur-[2px] opacity-70"></div>
              <img src="/logo.jpg" alt="Logo" className="relative w-4 h-4 rounded-full object-cover border border-amber-300" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-gray-700 truncate max-w-[85px] sm:max-w-[120px]" dir="ltr">
              {employees.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase())?.name || currentUser?.email?.split('@')[0]}
            </span>
            <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
              {isAdmin ? '👑 أدمن' : (() => {
                const emp = employees.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
                const r = emp?.jobTitle || emp?.role || 'Agent';
                if (r === 'Coordinator' || r === 'منسق للإدارة' || r === 'منسق إدارة') return '📋 منسق';
                return r === 'Leader' || r === 'ليدر' ? '👑 Leader' : `👤 ${r}`;
              })()}
            </span>
          </div>
        </div>

        {/* Action Buttons Row - Flex wraps gracefully on all mobile screens */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-1.5 sm:gap-2 w-full md:w-auto shrink-0">
          {/* بريد اتجاه الداخلي */}
          <button 
            onClick={() => {
              setIsMailModalOpen(true);
              setMailActiveFolder('inbox');
            }}
            className="relative flex items-center bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-2.5 sm:px-3 py-1.5 rounded-xl transition text-xs font-bold gap-1 shadow-sm cursor-pointer active:scale-95 border border-white/20 shrink-0"
            title="فتح بريد اتجاه الداخلي (Gmail)"
          >
            <Mail size={15} />
            <span className="whitespace-nowrap">بريد اتجاه</span>
            {unreadMailCount > 0 && (
              <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-md animate-pulse">
                {unreadMailCount}
              </span>
            )}
          </button>

          {/* إضافة موظف (للأدمن فقط) */}
          {isAdmin && (
            <button 
              onClick={openAddEmployeeModal}
              className="flex items-center bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-2.5 sm:px-3 py-1.5 rounded-xl transition shadow-sm font-bold text-xs gap-1 cursor-pointer active:scale-95 shrink-0"
              title="إضافة موظف جديد"
            >
              <UserPlus size={15} />
              <span className="whitespace-nowrap">إضافة موظف</span>
            </button>
          )}

          {/* WhatsApp Chat Button */}
          <button 
            onClick={() => navigate('/inbox')}
            className="flex items-center bg-slate-900 hover:bg-black text-white px-2.5 sm:px-3.5 py-1.5 rounded-xl transition text-xs font-bold gap-1 shadow-sm cursor-pointer active:scale-95 border border-gray-700 shrink-0"
            title="الانتقال إلى محادثات واتساب"
          >
            <span className="whitespace-nowrap">WhatsApp Chat</span>
            <ArrowRight size={14} className="transform rotate-180 md:rotate-0" />
          </button>

          {/* تسجيل الخروج */}
          <button 
            onClick={handleLogout}
            className="flex items-center bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-2.5 sm:px-3 py-1.5 rounded-xl transition text-xs font-bold gap-1 cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="تسجيل الخروج من الحساب"
          >
            <LogOut size={15} />
            <span className="whitespace-nowrap">خروج</span>
          </button>
        </div>
      </header>

      <main className="p-3 sm:p-6 max-w-7xl mx-auto w-full relative z-10">
        {/* Anti-Screenshot & Window Blur Frosted Shield + Security Watermark on Blur / Screenshot */}
        {!isAdmin && currentUser && (() => {
          const currentEmp = employees.find(e => e.uid === currentUser?.uid || e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
          const empName = currentEmp?.name || currentUser?.email?.split('@')[0] || 'Employee';
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
                  <h3 className="text-xl font-black text-white mb-2">شاشة بيانات محمية</h3>
                  <p className="text-xs text-purple-200/90 mb-4 font-bold leading-relaxed">
                    تم تعتيم وحجب الشاشة وتوثيق هويتك تلقائياً لحماية خصوصية بيانات العملاء أثناء استخدام أدوات التقاط الشاشة.
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

        {/* Stats Cards */}
        {isAdmin ? (
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

            {/* Card 2: Employee Added Data */}
            <div 
              onClick={(e) => handleCardClick(e, 'employee_leads', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'employee_leads' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
              title="انقر لعرض وتتبع الداتا المضافة بواسطة الموظفين"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Upload className="text-purple-300" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">📁 داتا مضافة بواسطة الموظف</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{employeeLeads.length.toLocaleString()}</h3>
              </div>
            </div>

            {/* Card 3: Subscribed Clients (العملاء المشتركين) */}
            <div 
              onClick={(e) => handleCardClick(e, 'subscribed_clients', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'subscribed_clients' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
              title="انقر لعرض ومتابعة العملاء المشتركين وتفاصيل باقاتهم وإشعارات التحويل"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Award className="text-purple-300" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">🎉 العملاء المشتركين</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{allSubscribedClients.length.toLocaleString()}</h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  (اشتراكات مؤكدة)
                </span>
              </div>
            </div>

            {/* Card 4: Leads CRM Analysis */}
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
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">
                  {(leadsCrm.filter(c => isLeadAssignedToEmployee(c)).length + employeeLeads.length).toLocaleString()} <span className="text-xs text-purple-300 font-normal">عميل</span>
                </h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  ({leadsCrm.filter(c => isLeadAssignedToEmployee(c)).length} موزع + {employeeLeads.length} مضاف)
                </span>
              </div>
            </div>

            {/* Card: Call Performance Analytics (تحليل أداء المكالمات) */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsCallsAnalysisModalOpen(true);
              }}
              className="bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border border-purple-400/40 hover:border-cyan-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
              title="انقر لعرض تقرير وتحليل أداء مكالمات الموظفين اليومية والتراكمية"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <PhoneCall className="text-cyan-300 animate-pulse" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">📞 تحليل أداء المكالمات</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">
                  {todayCallLogsCount.toLocaleString()} <span className="text-xs text-purple-300 font-normal">اليوم</span> / {roleFilteredCallLogs.length.toLocaleString()} <span className="text-xs text-purple-300 font-normal">تراكمي</span>
                </h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  (إجمالي مكالمات السيستم)
                </span>
              </div>
            </div>

            {/* Card 4: Total Customers */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsSystemTotalClientsModalOpen(true);
              }}
              className="bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border border-purple-400/30 hover:border-purple-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
              title="انقر لعرض تفاصيل وخريطة توزيع إجمالي العملاء على السيستم"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Users className="text-blue-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">🌐 إجمالي عدد العملاء على السيستم</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{(leadsCrm.length + customers.length + employeeLeads.length + whatsappVisitorsCount).toLocaleString()}</h3>
              </div>
            </div>
            
            {/* Card 5: Pending Customers (All Sources) */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsPendingClientsModalOpen(true);
              }}
              className="bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border border-purple-400/30 hover:border-purple-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
              title="انقر لعرض تفاصيل وخريطة عملاء الانتظار (واتساب + Leads CRM + داتا الموظف)"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Clock className="text-red-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">⏳ عملاء الانتظار (شامل)</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{totalPendingAll.toLocaleString()}</h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  (واتساب + CRM + داتا الموظف)
                </span>
              </div>
            </div>

            {/* Card 6: Website WhatsApp Leads */}
            <div 
              onClick={(e) => handleCardClick(e, 'customers', 'website')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'customers' && customerFilter === 'website' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
              title="عملاء ورسائل الواتساب الواردة من الموقع الإلكتروني"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Globe className="text-emerald-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">عملاء واتساب الموقع (Website)</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{customers.filter(c => c.addedBy === 'WhatsApp Webhook' || c.source === 'website' || c.source === 'webhook' || !c.addedBy).length.toLocaleString()}</h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  (رسائل وتسجيلات الموقع)
                </span>
              </div>
            </div>

            {/* Card 7: Employees Count */}
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

            {/* Card 8: Visitors */}
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
            
            {/* Card 9: Recycle Bin */}
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

            {/* Card 10: Campaigns */}
            <div 
              onClick={(e) => handleCardClick(e, 'campaigns', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'campaigns' ? 'border-amber-400 scale-105 shadow-[0_8px_25px_rgba(245,158,11,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <BarChart3 className="text-amber-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">أداء الحملات 📢</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">
                  {new Set(templateMessages.map(m => m.templateName || (m.text?.match(/\[قالب.*?:(.*?)\]/)?.[1]?.trim() || 'قالب غير معروف'))).size.toLocaleString()} قوالب
                </h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  ({templateMessages.filter(m => m.campaignSource === 'crm_sheet' || m.source === 'crm_sheet').length} شيت CRM • {templateMessages.filter(m => m.campaignSource === 'excel_import' || m.source === 'excel_import' || (!m.campaignSource && !m.source)).length} إكسيل واتساب)
                </span>
              </div>
            </div>
          </div>
        ) : isCoordinator ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5 mb-6 md:mb-8">
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

            {/* Card 2: Employee Added Data */}
            <div 
              onClick={(e) => handleCardClick(e, 'employee_leads', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'employee_leads' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
              title="انقر لعرض وتتبع الداتا المضافة بواسطة الموظفين"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Upload className="text-purple-300" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">📁 داتا مضافة بواسطة الموظف</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{employeeLeads.length.toLocaleString()}</h3>
              </div>
            </div>

            {/* Card 3: Subscribed Clients (العملاء المشتركين) */}
            <div 
              onClick={(e) => handleCardClick(e, 'subscribed_clients', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'subscribed_clients' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
              title="انقر لعرض ومتابعة العملاء المشتركين وتفاصيل باقاتهم وإشعارات التحويل"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Award className="text-purple-300" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">🎉 العملاء المشتركين</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{allSubscribedClients.length.toLocaleString()}</h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  (اشتراكات مؤكدة)
                </span>
              </div>
            </div>

            {/* Card 4: Leads CRM Analysis */}
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
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">
                  {(leadsCrm.filter(c => isLeadAssignedToEmployee(c)).length + employeeLeads.length).toLocaleString()} <span className="text-xs text-purple-300 font-normal">عميل</span>
                </h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  ({leadsCrm.filter(c => isLeadAssignedToEmployee(c)).length} موزع + {employeeLeads.length} مضاف)
                </span>
              </div>
            </div>

            {/* Coordinator Card 5: Campaign Performance (أداء الحملات) - Same analysis as Admin */}
            <div 
              onClick={(e) => handleCardClick(e, 'campaigns', 'all')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'campaigns' ? 'border-amber-400 scale-105 shadow-[0_8px_25px_rgba(245,158,11,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
              title="انقر لعرض تقرير وتحليل أداء حملات الواتساب الشاملة"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <BarChart3 className="text-amber-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">أداء الحملات 📢</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">
                  {new Set(templateMessages.map(m => m.templateName || (m.text?.match(/\[قالب.*?:(.*?)\]/)?.[1]?.trim() || 'قالب غير معروف'))).size.toLocaleString()} قوالب
                </h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  ({templateMessages.filter(m => m.campaignSource === 'crm_sheet' || m.source === 'crm_sheet').length} شيت CRM • {templateMessages.filter(m => m.campaignSource === 'excel_import' || m.source === 'excel_import' || (!m.campaignSource && !m.source)).length} إكسيل واتساب)
                </span>
              </div>
            </div>

            {/* Coordinator Card 6: Call Performance Analytics */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsCallsAnalysisModalOpen(true);
              }}
              className="bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border border-purple-400/40 hover:border-cyan-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
              title="انقر لعرض تقرير وتحليل أداء مكالمات الموظفين اليومية والتراكمية"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <PhoneCall className="text-cyan-300 animate-pulse" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">📞 تحليل أداء المكالمات</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">
                  {todayCallLogsCount.toLocaleString()} <span className="text-xs text-purple-300 font-normal">اليوم</span> / {roleFilteredCallLogs.length.toLocaleString()} <span className="text-xs text-purple-300 font-normal">تراكمي</span>
                </h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  (تحليل شامل للإدارة والمنسق)
                </span>
              </div>
            </div>

            {/* Coordinator Card 7: Total Customer Database */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsSystemTotalClientsModalOpen(true);
              }}
              className="bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border border-purple-400/30 hover:border-purple-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
              title="انقر لعرض تفاصيل وخريطة توزيع إجمالي العملاء على السيستم"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Users className="text-blue-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">🌐 إجمالي عدد العملاء على السيستم</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{(leadsCrm.length + customers.length + employeeLeads.length + whatsappVisitorsCount).toLocaleString()}</h3>
              </div>
            </div>
            
            {/* Coordinator Card 8: Pending Customers (All Sources) */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsPendingClientsModalOpen(true);
              }}
              className="bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border border-purple-400/30 hover:border-purple-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
              title="انقر لعرض تفاصيل وخريطة عملاء الانتظار (واتساب + Leads CRM + داتا الموظف)"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Clock className="text-red-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">⏳ عملاء الانتظار (شامل)</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{totalPendingAll.toLocaleString()}</h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  (واتساب + CRM + داتا الموظف)
                </span>
              </div>
            </div>

            {/* Coordinator Card 9: Website WhatsApp Leads */}
            <div 
              onClick={(e) => handleCardClick(e, 'customers', 'website')}
              className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-3.5 sm:p-5 md:p-6 border ${activeTab === 'customers' && customerFilter === 'website' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/30 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
              title="عملاء ورسائل الواتساب الواردة من الموقع الإلكتروني"
            >
              <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-full ml-3.5 shadow-inner border border-white/20">
                <Globe className="text-emerald-400" size={28} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-200 font-extrabold mb-1">عملاء واتساب الموقع (Website)</p>
                <h3 className="text-xl sm:text-2xl font-black text-cyan-300">{customers.filter(c => c.addedBy === 'WhatsApp Webhook' || c.source === 'website' || c.source === 'webhook' || !c.addedBy).length.toLocaleString()}</h3>
                <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                  (رسائل وتسجيلات الموقع)
                </span>
              </div>
            </div>
          </div>
        ) : isLeader ? (
          /* Leader Dashboard Cards View (8 Cards) */
          (() => {
            const leaderTeamEmails = [currentUser?.email?.toLowerCase(), ...myTeamMembers.map(m => m.email?.toLowerCase())].filter(Boolean);
            const leaderTeamTemplateMsgs = templateMessages.filter(m => leaderTeamEmails.includes(m.senderEmail?.toLowerCase()) || m.senderUid === currentUser?.uid || myTeamMembers.some(tm => tm.uid === m.senderUid));
            
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Leader Card 1: Leads CRM (Personal Leads) */}
                <div 
                  onClick={(e) => handleCardClick(e, 'leads_crm', 'all')}
                  className={`bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border ${activeTab === 'leads_crm' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/40 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
                  title="انقر لعرض جدول Leads CRM الخاص بك"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <FileSpreadsheet className="text-purple-300" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200 font-extrabold mb-1">🎯 Leads CRM (داتاي)</p>
                    <h3 className="text-2xl font-black text-cyan-300">
                      {leadsCrm.filter(c => c.assignedToUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase()).length.toLocaleString()} عميل
                    </h3>
                  </div>
                </div>

                {/* Leader Card 2: Employee Added Data */}
                <div 
                  onClick={(e) => handleCardClick(e, 'employee_leads', 'all')}
                  className={`bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border ${activeTab === 'employee_leads' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/40 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
                  title="انقر لعرض الداتا المضافة وإضافة داتا جديدة"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <Upload className="text-purple-300" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200 font-extrabold mb-1">📁 داتا مضافة بواسطة الموظف</p>
                    <h3 className="text-2xl font-black text-cyan-300">
                      {employeeLeads.filter(c => c.assignedToUid === currentUser?.uid || c.addedByUid === currentUser?.uid || myTeamMembers.some(m => m.uid === c.assignedToUid || m.uid === c.addedByUid)).length.toLocaleString()} عميل
                    </h3>
                  </div>
                </div>

                {/* Leader Card 3: Subscribed Clients */}
                <div 
                  onClick={(e) => handleCardClick(e, 'subscribed_clients', 'all')}
                  className={`bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border ${activeTab === 'subscribed_clients' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/40 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
                  title="انقر لعرض ومتابعة العملاء المشتركين بالفريق"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <Award className="text-purple-300" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200 font-extrabold mb-1">🎉 العملاء المشتركين</p>
                    <h3 className="text-2xl font-black text-cyan-300">{leaderSubscribedClients.length.toLocaleString()}</h3>
                    <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                      (مشتركي الفريق)
                    </span>
                  </div>
                </div>

                {/* Leader Card 4: Website WhatsApp Leads */}
                <div 
                  onClick={(e) => handleCardClick(e, 'customers', 'website')}
                  className={`bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border ${activeTab === 'customers' && customerFilter === 'website' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/40 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
                  title="انقر لعرض عملاء واتساب الموقع الإلكتروني"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <Globe className="text-emerald-400" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200 font-extrabold mb-1">عملاء واتساب الموقع (Website)</p>
                    <h3 className="text-2xl font-black text-cyan-300">
                      {customers.filter(c => (c.addedBy === 'WhatsApp Webhook' || c.source === 'website' || !c.addedBy) && (c.assignedToUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase() || myTeamMembers.some(m => m.uid === c.assignedToUid))).length.toLocaleString()}
                    </h3>
                  </div>
                </div>

                {/* Leader Card 5: Team Members & Total Team Leads */}
                <div 
                  onClick={(e) => handleCardClick(e, 'team_leads_tracking', 'all')}
                  className={`bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(147,51,234,0.35)] p-5 border ${activeTab === 'team_leads_tracking' ? 'border-amber-400 scale-105 shadow-[0_8px_25px_rgba(245,158,11,0.5)]' : 'border-purple-400/40 hover:border-amber-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
                  title="انقر لمتابعة عملاء فريقك وسحب الداتا"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <Users className="text-amber-400" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-amber-200 font-extrabold mb-1">👥 أعضاء فريقي</p>
                    <h3 className="text-2xl font-black text-amber-300">
                      {myTeamMembers.length} موظف
                    </h3>
                    <span className="text-[11px] text-purple-300 font-bold block mt-0.5">
                      ({leadsCrm.filter(c => myTeamMembers.some(m => m.uid === c.assignedToUid || m.email?.toLowerCase() === c.assignedTo?.toLowerCase())).length.toLocaleString()} عميل بالتيم)
                    </span>
                  </div>
                </div>

                {/* Leader Card 6: Leads CRM Analysis */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLeadsAnalysisModalOpen(true);
                  }}
                  className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border border-purple-400/40 hover:border-purple-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
                  title="انقر لعرض تقرير تحليلات أداء ونسبة نجاح فريقك"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <BarChart3 className="text-cyan-300" size={28} />
                  </div>
                  <div>
                    <p className="text-sm text-purple-200 font-extrabold mb-1">📊 Leads CRM Analysis</p>
                    <h3 className="text-xl font-black text-cyan-300">
                      {(leadsCrm.filter(c => c.assignedToUid === currentUser?.uid || myTeamMembers.some(m => m.uid === c.assignedToUid)).length + employeeLeads.filter(c => c.assignedToUid === currentUser?.uid || myTeamMembers.some(m => m.uid === c.assignedToUid || m.uid === c.addedByUid)).length).toLocaleString()} <span className="text-xs text-purple-300 font-normal">عميل</span>
                    </h3>
                    <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                      (داتا تقييم الفريق)
                    </span>
                  </div>
                </div>

                {/* Leader Card 7: Campaign Performance (أداء الحملات) */}
                <div 
                  onClick={(e) => handleCardClick(e, 'campaigns', 'all')}
                  className={`bg-gradient-to-br from-indigo-900/90 via-purple-950/90 to-slate-900/90 backdrop-blur-xl rounded-2xl shadow-[0_6px_20px_rgba(112,26,117,0.35)] p-5 border ${activeTab === 'campaigns' ? 'border-amber-400 scale-105 shadow-[0_8px_25px_rgba(245,158,11,0.5)]' : 'border-purple-400/40 hover:border-amber-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
                  title="انقر لعرض تقرير وتحليل أداء حملات الواتساب لفريقك"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <BarChart3 className="text-amber-400" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-amber-200 font-extrabold mb-1">أداء الحملات 📢</p>
                    <h3 className="text-2xl font-black text-amber-300">
                      {new Set(leaderTeamTemplateMsgs.map(m => m.templateName || (m.text?.match(/\[قالب.*?:(.*?)\]/)?.[1]?.trim() || 'قالب غير معروف'))).size.toLocaleString()} قوالب
                    </h3>
                    <span className="text-[10px] text-purple-300 font-bold block mt-0.5" dir="rtl">
                      ({leaderTeamTemplateMsgs.filter(m => m.campaignSource === 'crm_sheet' || m.source === 'crm_sheet').length} شيت CRM • {leaderTeamTemplateMsgs.filter(m => m.campaignSource === 'excel_import' || m.source === 'excel_import' || (!m.campaignSource && !m.source)).length} إكسيل)
                    </span>
                  </div>
                </div>

                {/* Leader Card 8: Call Performance Analytics */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCallsAnalysisModalOpen(true);
                  }}
                  className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border border-purple-400/40 hover:border-cyan-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
                  title="انقر لعرض تقرير وتحليل أداء مكالماتك ومكالمات فريقك"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <PhoneCall className="text-cyan-300 animate-pulse" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200 font-extrabold mb-1">📞 تحليل أداء المكالمات</p>
                    <h3 className="text-xl font-black text-cyan-300">
                      {todayCallLogsCount.toLocaleString()} <span className="text-xs text-purple-300 font-normal">اليوم</span> / {roleFilteredCallLogs.length.toLocaleString()} <span className="text-xs text-purple-300 font-normal">تراكمي</span>
                    </h3>
                    <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                      (مكالمات الفريق)
                    </span>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          /* Regular Employee (Agent) Cards View (7 Cards) */
          (() => {
            const agentTemplateMsgs = templateMessages.filter(m => m.senderEmail?.toLowerCase() === currentUser?.email?.toLowerCase() || m.senderUid === currentUser?.uid);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Agent Card 1: Leads CRM */}
                <div 
                  onClick={(e) => handleCardClick(e, 'leads_crm', 'all')}
                  className={`bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border ${activeTab === 'leads_crm' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/40 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
                  title="انقر لعرض وتحديث جدول Leads CRM الخاص بك"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <FileSpreadsheet className="text-purple-300" size={28} />
                  </div>
                  <div>
                    <p className="text-sm text-purple-200 font-extrabold mb-1">🎯 Leads CRM (داتاي)</p>
                    <h3 className="text-2xl font-black text-cyan-300">
                      {leadsCrm.filter(c => c.assignedToUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase()).length.toLocaleString()} عميل
                    </h3>
                  </div>
                </div>

                {/* Agent Card 2: Employee Added Data */}
                <div 
                  onClick={(e) => handleCardClick(e, 'employee_leads', 'all')}
                  className={`bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border ${activeTab === 'employee_leads' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/40 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
                  title="انقر لعرض الداتا المضافة وإضافة داتا جديدة"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <Upload className="text-purple-300" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200 font-extrabold mb-1">📁 داتا مضافة بواسطة الموظف</p>
                    <h3 className="text-2xl font-black text-cyan-300">
                      {employeeLeads.filter(c => c.assignedToUid === currentUser?.uid || c.addedByUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase()).length.toLocaleString()} عميل
                    </h3>
                  </div>
                </div>

                {/* Agent Card 3: Subscribed Clients */}
                <div 
                  onClick={(e) => handleCardClick(e, 'subscribed_clients', 'all')}
                  className={`bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border ${activeTab === 'subscribed_clients' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/40 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
                  title="انقر لعرض ومتابعة العملاء المشتركين وتفاصيل باقاتهم"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <Award className="text-purple-300" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200 font-extrabold mb-1">🎉 العملاء المشتركين</p>
                    <h3 className="text-2xl font-black text-cyan-300">{agentSubscribedClients.length.toLocaleString()}</h3>
                    <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                      (مشتركي الخاصين)
                    </span>
                  </div>
                </div>

                {/* Agent Card 4: Website WhatsApp Leads */}
                <div 
                  onClick={(e) => handleCardClick(e, 'customers', 'website')}
                  className={`bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border ${activeTab === 'customers' && customerFilter === 'website' ? 'border-purple-400 scale-105 shadow-[0_8px_25px_rgba(168,85,247,0.5)]' : 'border-purple-400/40 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
                  title="انقر لعرض عملاء واتساب الموقع الإلكتروني"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <Globe className="text-emerald-400" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200 font-extrabold mb-1">عملاء واتساب الموقع (Website)</p>
                    <h3 className="text-2xl font-black text-cyan-300">
                      {customers.filter(c => (c.addedBy === 'WhatsApp Webhook' || c.source === 'website' || !c.addedBy) && (c.assignedToUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase())).length.toLocaleString()}
                    </h3>
                  </div>
                </div>

                {/* Agent Card 5: Leads CRM Analysis */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLeadsAnalysisModalOpen(true);
                  }}
                  className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border border-purple-400/40 hover:border-purple-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
                  title="انقر لعرض تحليل الأداء ونسبة النجاح الخاصة بك"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <BarChart3 className="text-cyan-300" size={28} />
                  </div>
                  <div>
                    <p className="text-sm text-purple-200 font-extrabold mb-1">📊 Leads CRM Analysis</p>
                    <h3 className="text-2xl font-black text-cyan-300">
                      {(leadsCrm.filter(c => c.assignedToUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase()).length + employeeLeads.filter(c => c.assignedToUid === currentUser?.uid || c.addedByUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase()).length).toLocaleString()} <span className="text-xs text-purple-300 font-normal">عميل</span>
                    </h3>
                    <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                      (داتا التقييم الخاصة بي)
                    </span>
                  </div>
                </div>

                {/* Agent Card 6: Campaign Performance (أداء الحملات) */}
                <div 
                  onClick={(e) => handleCardClick(e, 'campaigns', 'all')}
                  className={`bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border ${activeTab === 'campaigns' ? 'border-amber-400 scale-105 shadow-[0_8px_25px_rgba(245,158,11,0.5)]' : 'border-purple-400/40 hover:border-purple-300 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
                  title="انقر لعرض تقرير وتحليل أداء حملات الواتساب الخاصة بك"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <BarChart3 className="text-amber-400" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200 font-extrabold mb-1">أداء الحملات 📢</p>
                    <h3 className="text-2xl font-black text-cyan-300">
                      {new Set(agentTemplateMsgs.map(m => m.templateName || (m.text?.match(/\[قالب.*?:(.*?)\]/)?.[1]?.trim() || 'قالب غير معروف'))).size.toLocaleString()} قوالب
                    </h3>
                    <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                      ({agentTemplateMsgs.filter(m => m.campaignSource === 'crm_sheet' || m.source === 'crm_sheet').length} شيت CRM • {agentTemplateMsgs.filter(m => m.campaignSource === 'excel_import' || m.source === 'excel_import' || (!m.campaignSource && !m.source)).length} إكسيل)
                    </span>
                  </div>
                </div>

                {/* Agent Card 7: Call Performance Analytics */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCallsAnalysisModalOpen(true);
                  }}
                  className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl shadow-[0_6px_20px_rgba(79,70,229,0.35)] p-5 border border-purple-400/40 hover:border-cyan-300 hover:scale-105 flex items-center cursor-pointer transition-all transform"
                  title="انقر لعرض تقرير وتحليل أداء مكالماتك اليومية والتراكمية"
                >
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-full ml-4 shadow-inner border border-white/20">
                    <PhoneCall className="text-cyan-300 animate-pulse" size={28} />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200 font-extrabold mb-1">📞 تحليل أداء المكالمات</p>
                    <h3 className="text-xl font-black text-cyan-300">
                      {todayCallLogsCount.toLocaleString()} <span className="text-xs text-purple-300 font-normal">اليوم</span> / {roleFilteredCallLogs.length.toLocaleString()} <span className="text-xs text-purple-300 font-normal">تراكمي</span>
                    </h3>
                    <span className="text-[10px] text-purple-300/90 font-medium block mt-0.5" dir="rtl">
                      (مكالماتي الخاصة)
                    </span>
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* Campaigns Analytics Tab (Role-scoped) */}
        {activeTab === 'campaigns' && (() => {
          // Scope template messages by user role
          const roleScopedMessages = (() => {
            if (isAdmin || isCoordinator) return templateMessages;
            if (isLeader) {
              const leaderTeamEmails = [currentUser?.email?.toLowerCase(), ...myTeamMembers.map(m => m.email?.toLowerCase())].filter(Boolean);
              return templateMessages.filter(m => leaderTeamEmails.includes(m.senderEmail?.toLowerCase()) || m.senderUid === currentUser?.uid || myTeamMembers.some(tm => tm.uid === m.senderUid));
            }
            return templateMessages.filter(m => m.senderEmail?.toLowerCase() === currentUser?.email?.toLowerCase() || m.senderUid === currentUser?.uid);
          })();

          // Calculate source metrics
          const crmSheetMsgs = roleScopedMessages.filter(m => m.campaignSource === 'crm_sheet' || m.source === 'crm_sheet');
          const excelMsgs = roleScopedMessages.filter(m => m.campaignSource === 'excel_import' || m.source === 'excel_import');
          const directMsgs = roleScopedMessages.filter(m => !m.campaignSource && !m.source && (m.isTemplate || m.text?.includes('[قالب')));

          // Filter by active source tab
          const filteredMessages = roleScopedMessages.filter(msg => {
            const src = msg.campaignSource || msg.source || 'direct';
            if (campaignSourceFilter === 'all') return true;
            if (campaignSourceFilter === 'crm_sheet') return src === 'crm_sheet';
            if (campaignSourceFilter === 'excel_import') return src === 'excel_import';
            if (campaignSourceFilter === 'direct') return src !== 'crm_sheet' && src !== 'excel_import';
            return true;
          });

          // Group template messages by template name, employee, and source
          const groupedCampaigns = {};
          
          filteredMessages.forEach(msg => {
            const templateName = msg.templateName || (msg.text?.match(/\[قالب.*?:(.*?)\]/)?.[1]?.trim() || 'رسالة ترويجية');
            const empEmail = msg.senderEmail || 'مجهول';
            const src = msg.campaignSource || msg.source || 'direct';
            const chatId = msg.conversationId || msg.recipientPhone || msg.to || 'unknown';
            
            const key = `${templateName}_${empEmail}_${src}`;
            if (!groupedCampaigns[key]) {
              groupedCampaigns[key] = {
                templateName,
                empEmail,
                source: src,
                sent: 0,
                delivered: 0,
                read: 0,
                chatMap: {}
              };
            }
            
            groupedCampaigns[key].sent++;
            if (msg.status === 'delivered' || msg.status === 'read' || msg.status === 'sent') groupedCampaigns[key].delivered++;
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

          const totalSentAll = templateMessages.length;
          const totalDeliveredAll = templateMessages.filter(m => m.status === 'delivered' || m.status === 'read' || m.status === 'sent').length;
          const totalReadAll = templateMessages.filter(m => m.status === 'read').length;
          const avgOpenRateAll = totalDeliveredAll > 0 ? Math.round((totalReadAll / totalDeliveredAll) * 100) : 0;

          return (
            <div 
              ref={tableSectionRef}
              className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/60 overflow-hidden mt-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header & KPI Summary */}
              <div className="px-6 py-5 border-b border-gray-200/80 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-black text-purple-950 flex items-center gap-2">
                      <BarChart3 className="text-purple-600" size={24} />
                      <span>📢 تحليلات وإحصائيات أداء الحملات التسويقية</span>
                    </h2>
                    <p className="text-xs text-purple-800/80 font-semibold mt-0.5">
                      مقارنة أداء حملات شيت CRM مقابل حملات إكسيل الواتساب والقوالب الفردية
                    </p>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1.5 flex-wrap bg-white/80 p-1 rounded-xl border border-purple-200 shadow-sm">
                    {[
                      { key: 'all', label: 'الكل 📊', count: totalSentAll },
                      { key: 'crm_sheet', label: '🎯 حملات شيت CRM', count: crmSheetMsgs.length },
                      { key: 'excel_import', label: '📁 حملات إكسيل الواتساب', count: excelMsgs.length },
                      { key: 'direct', label: '💬 قوالب المحادثات', count: directMsgs.length },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setCampaignSourceFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          campaignSourceFilter === tab.key
                            ? 'bg-purple-700 text-white shadow-md'
                            : 'text-gray-600 hover:bg-purple-100/60'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                          campaignSourceFilter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4 Summary KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/80 border border-purple-200/80 p-3 rounded-xl shadow-xs">
                    <span className="text-[11px] font-bold text-gray-500 block">📊 إجمالي الإرسال</span>
                    <span className="text-lg font-black text-purple-900">{totalSentAll.toLocaleString()} رسالة</span>
                  </div>
                  <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl shadow-xs">
                    <span className="text-[11px] font-bold text-emerald-700 block">🎯 حملات شيت CRM</span>
                    <span className="text-lg font-black text-emerald-900">{crmSheetMsgs.length.toLocaleString()} رسالة</span>
                  </div>
                  <div className="bg-blue-50/80 border border-blue-200 p-3 rounded-xl shadow-xs">
                    <span className="text-[11px] font-bold text-blue-700 block">📁 حملات إكسيل الواتساب</span>
                    <span className="text-lg font-black text-blue-900">{excelMsgs.length.toLocaleString()} رسالة</span>
                  </div>
                  <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl shadow-xs">
                    <span className="text-[11px] font-bold text-amber-700 block">📈 نسبة الفتح والتسليم</span>
                    <span className="text-lg font-black text-amber-900">%{avgOpenRateAll} فتح ({totalDeliveredAll} مسلّم)</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 text-xs">
                      <th className="p-3.5 font-bold">اسم القالب / الرسالة</th>
                      <th className="p-3.5 font-bold text-center">نوع الحملة ومصدرها</th>
                      <th className="p-3.5 font-bold">الموظف المُرسل</th>
                      <th className="p-3.5 font-bold text-center">إجمالي الإرسال</th>
                      <th className="p-3.5 font-bold text-blue-700 text-center bg-blue-50/50">مرة واحدة 📩</th>
                      <th className="p-3.5 font-bold text-purple-700 text-center bg-purple-50/50">مرتين 📩📩</th>
                      <th className="p-3.5 font-bold text-amber-700 text-center bg-amber-50/50">3+ مرات 📩🔥</th>
                      <th className="p-3.5 font-bold text-emerald-700 text-center">تم التسليم (✔️✔️)</th>
                      <th className="p-3.5 font-bold text-cyan-700 text-center">تم الفتح (✔️✔️)</th>
                      <th className="p-3.5 font-bold text-gray-700 text-center">معدل الفتح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {campaignsList.map((campaign, idx) => {
                      const empName = employees.find(e => e.email === campaign.empEmail)?.name || campaign.empEmail.split('@')[0];
                      const openRate = campaign.delivered > 0 ? Math.round((campaign.read / campaign.delivered) * 100) : 0;
                      return (
                        <tr key={idx} className="hover:bg-purple-50/30 transition">
                          <td className="p-3.5 text-xs font-black text-gray-900">{campaign.templateName}</td>
                          <td className="p-3.5 text-center">
                            {campaign.source === 'crm_sheet' ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full text-[11px] font-black shadow-xs">
                                🎯 شيت CRM
                              </span>
                            ) : campaign.source === 'excel_import' ? (
                              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-1 rounded-full text-[11px] font-black shadow-xs">
                                📁 إكسيل واتساب
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-1 rounded-full text-[11px] font-black shadow-xs">
                                💬 محادثة مباشرة
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-xs font-bold text-blue-700">{empName}</td>
                          <td className="p-3.5 text-xs font-black text-gray-800 text-center">{campaign.sent}</td>
                          <td className="p-3.5 text-xs font-bold text-blue-700 text-center bg-blue-50/30">{campaign.sentOnce}</td>
                          <td className="p-3.5 text-xs font-bold text-purple-700 text-center bg-purple-50/30">{campaign.sentTwice}</td>
                          <td className="p-3.5 text-xs font-bold text-amber-700 text-center bg-amber-50/30">{campaign.sentMore}</td>
                          <td className="p-3.5 text-xs font-bold text-emerald-700 text-center">{campaign.delivered}</td>
                          <td className="p-3.5 text-xs font-bold text-cyan-700 text-center">{campaign.read}</td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black shadow-xs ${
                              openRate >= 50 ? 'bg-emerald-100 text-emerald-800' : openRate >= 20 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              %{openRate}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {campaignsList.length === 0 && (
                      <tr>
                        <td colSpan="10" className="p-8 text-center text-gray-500 font-bold">
                          لا توجد سجلات حملات مطابقة في هذا التبويب حالياً.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Team Leads Tracking Tab (Dedicated for Leader) */}
        {isLeader && activeTab === 'team_leads_tracking' && (() => {
          // Filter leads belonging to leader's team members
          const teamLeadsPool = leadsCrm.filter(c => {
            const isUnderMyTeam = myTeamMembers.some(m => m.uid === c.assignedToUid || m.email?.toLowerCase() === c.assignedTo?.toLowerCase());
            if (!isUnderMyTeam) return false;

            if (teamTrackingEmpFilter !== 'all') {
              const targetEmp = myTeamMembers.find(e => e.uid === teamTrackingEmpFilter);
              const matchesUid = c.assignedToUid === teamTrackingEmpFilter;
              const matchesEmail = targetEmp && c.assignedTo?.toLowerCase() === targetEmp.email?.toLowerCase();
              if (!matchesUid && !matchesEmail) return false;
            }

            if (crmStatusFilter !== 'all') {
              if (c.crmStatus !== crmStatusFilter) return false;
            }

            if (tableSearch.trim()) {
              const term = tableSearch.trim().toLowerCase();
              const matchPhone = c.phoneNumber?.includes(term);
              const matchName = c.name?.toLowerCase().includes(term);
              const matchNotes = c.notes?.toLowerCase().includes(term);
              if (!matchPhone && !matchName && !matchNotes) return false;
            }

            return true;
          });

          // Sort leads
          teamLeadsPool.sort((a, b) => {
            const dateA = a.assignedAt?.toDate ? a.assignedAt.toDate() : (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0));
            const dateB = b.assignedAt?.toDate ? b.assignedAt.toDate() : (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0));
            return leadsSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
          });

          const totalPages = Math.max(1, Math.ceil(teamLeadsPool.length / ITEMS_PER_PAGE));
          const currentPage = Math.min(currentPageTeamTracking, totalPages);
          const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
          const paginatedTeamLeads = teamLeadsPool.slice(startIndex, startIndex + ITEMS_PER_PAGE);

          const isPageAllSelected = paginatedTeamLeads.length > 0 && paginatedTeamLeads.every(c => selectedTeamTrackingLeads.includes(c.id));

          return (
            <div ref={tableSectionRef} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden mb-8" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/30 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-400/40">
                    <Users className="text-amber-400" size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                      <span>🔄 متابعة عملاء التيم (Team Leads Tracking)</span>
                      <span className="bg-amber-500/30 text-amber-300 border border-amber-400/40 text-xs px-2.5 py-0.5 rounded-full font-bold">
                        {teamLeadsPool.length.toLocaleString()} عميل
                      </span>
                    </h2>
                    <p className="text-xs text-purple-200 font-medium">
                      مراقبة العملاء الموزعين على أفراد فريقك وسحب الداتا في أي وقت لتتحول إلى Leads CRM الخاص بك
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedTeamTrackingLeads.length > 0 && (
                    <button 
                      onClick={handleBulkPullLeads}
                      className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer animate-pulse"
                      title="سحب جميع العملاء المحددين وإعادتهم إلى Leads CRM الخاص بك"
                    >
                      <ArrowDownLeft size={16} />
                      <span>📥 سحب ({selectedTeamTrackingLeads.length}) عميل إلى داتاي</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Bar */}
              <div className="px-6 py-3.5 bg-slate-900/90 border-b border-purple-500/20 flex flex-wrap justify-between items-center gap-3">
                {/* Employee Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-purple-200">🔍 فلترة بحسب عضو الفريق:</span>
                  <select 
                    value={teamTrackingEmpFilter} 
                    onChange={(e) => setTeamTrackingEmpFilter(e.target.value)}
                    className="bg-slate-800 text-white border border-purple-500/40 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="all">👥 جميع أعضاء الفريق ({myTeamMembers.length} موظف)</option>
                    {myTeamMembers.map(emp => {
                      const count = leadsCrm.filter(c => c.assignedToUid === emp.uid || c.assignedTo?.toLowerCase() === emp.email?.toLowerCase()).length;
                      return (
                        <option key={emp.uid} value={emp.uid}>
                          👤 {emp.name} ({count} عميل)
                        </option>
                      );
                    })}
                  </select>

                  {/* Status Filter */}
                  <select 
                    value={crmStatusFilter} 
                    onChange={(e) => setCrmStatusFilter(e.target.value)}
                    className="bg-slate-800 text-white border border-purple-500/40 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="all">🏷️ جميع حالات المتابعة</option>
                    <option value="started_trial">🚀 بدأ تجربة</option>
                    <option value="subscribed">🎉 تم الاشتراك</option>
                    <option value="interested">🌟 مهتم</option>
                    <option value="no_answer">📵 لم يرد</option>
                    <option value="not_interested">❌ غير مهتم</option>
                  </select>
                </div>

                {/* Search Box & Sort */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="بحث بالرقم أو الاسم..." 
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="bg-slate-800 text-white border border-purple-500/40 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-400 w-48 sm:w-60"
                    />
                    <Search size={14} className="absolute left-2.5 top-2.5 text-purple-400" />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-purple-200 border-b border-purple-500/30">
                    <tr>
                      <th className="p-3.5 text-center w-12">
                        <input 
                          type="checkbox" 
                          checked={isPageAllSelected}
                          onChange={() => toggleAllTeamTracking(paginatedTeamLeads)}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-3.5">الرقم</th>
                      <th className="p-3.5">اسم العميل</th>
                      <th className="p-3.5">عضو الفريق الحالي</th>
                      <th className="p-3.5 text-center">تاريخ الإسناد</th>
                      <th className="p-3.5 text-center">حالة المتابعة</th>
                      <th className="p-3.5 text-center">التقرير والملاحظات</th>
                      <th className="p-3.5 text-center">إجراء السحب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white/90 text-gray-800">
                    {paginatedTeamLeads.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-gray-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Users size={36} className="text-gray-300" />
                            <p className="font-bold text-sm">لا يوجد عملاء مخصصين لأعضاء فريقك حالياً تحت هذا الفلتر.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedTeamLeads.map((customer) => {
                        const assignedEmp = employees.find(e => e.uid === customer.assignedToUid || e.email?.toLowerCase() === customer.assignedTo?.toLowerCase());
                        const isSelected = selectedTeamTrackingLeads.includes(customer.id);

                        return (
                          <tr key={customer.id} className={`hover:bg-purple-50/60 transition ${isSelected ? 'bg-purple-100/70' : ''}`}>
                            <td className="p-3.5 text-center">
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => toggleTeamTrackingSelection(customer.id)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-3.5 font-mono font-bold text-purple-900" dir="ltr">
                              {customer.phoneNumber}
                            </td>
                            <td className="p-3.5 font-bold text-gray-900">
                              {customer.name || 'عميل جديد'}
                            </td>
                            <td className="p-3.5">
                              <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold px-2.5 py-1 rounded-full text-xs shadow-sm">
                                <span>👤</span>
                                <span>{assignedEmp?.name || customer.assignedTo || 'عضو بالفريق'}</span>
                              </span>
                            </td>
                            <td className="p-3.5 text-center text-gray-500 text-[11px] font-mono">
                              {customer.assignedAt?.toDate ? customer.assignedAt.toDate().toLocaleDateString('ar-EG') : (customer.createdAt?.toDate ? customer.createdAt.toDate().toLocaleDateString('ar-EG') : '—')}
                            </td>
                            <td className="p-3.5 text-center">
                              {(() => {
                                const st = customer.crmStatus;
                                if (st === 'started_trial') return <span className="bg-cyan-100 text-cyan-800 font-bold px-2.5 py-1 rounded-full text-[11px] border border-cyan-300">🚀 بدأ تجربة</span>;
                                if (st === 'subscribed') return <span className="bg-purple-100 text-purple-800 font-bold px-2.5 py-1 rounded-full text-[11px] border border-purple-300">🎉 تم الاشتراك</span>;
                                if (st === 'interested') return <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[11px] border border-emerald-300">🌟 مهتم</span>;
                                if (st === 'no_answer') return <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[11px] border border-amber-300">📵 لم يرد</span>;
                                if (st === 'not_interested') return <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-full text-[11px] border border-rose-300">❌ غير مهتم</span>;
                                return <span className="bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded-full text-[11px]">في الانتظار</span>;
                              })()}
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button 
                                  onClick={() => openNotesModal(customer)}
                                  className="bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                                  title="Comment"
                                >
                                  <FileText size={13} />
                                  <span>Comment {customer.notes ? '📝' : ''}</span>
                                </button>
                                <button 
                                  onClick={() => handleTransferToWhatsapp(customer)}
                                  className="bg-gradient-to-tr from-emerald-600 via-green-500 to-emerald-400 hover:from-emerald-500 hover:to-green-400 text-white px-2.5 py-1.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-[0_3px_10px_rgba(16,185,129,0.4)] hover:shadow-[0_4px_14px_rgba(16,185,129,0.6)] active:scale-95 cursor-pointer border border-emerald-300/40 whitespace-nowrap"
                                  title="مراسلة عبر واتساب"
                                >
                                  <MessageCircle size={15} className="drop-shadow-sm fill-white/20" />
                                  <span className="text-[11px] font-black">WhatsApp</span>
                                </button>
                              </div>
                            </td>
                            <td className="p-3.5 text-center">
                              <button 
                                onClick={() => handlePullLead(customer)}
                                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 mx-auto shadow-md active:scale-95 cursor-pointer"
                                title="سحب هذا العميل من الموظف وإعادته فوراً إلى Leads CRM الخاص بك"
                              >
                                <ArrowDownLeft size={14} />
                                <span>سحب الداتا 📥</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs">
                  <span className="text-gray-600 font-bold">
                    الصفحة {currentPage} من {totalPages} (إجمالي {teamLeadsPool.length} عميل)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setCurrentPageTeamTracking(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                    >
                      السابق
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5 && currentPage > 3) {
                        pageNum = currentPage - 3 + i;
                        if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                      }
                      return (
                        <button 
                          key={pageNum}
                          onClick={() => setCurrentPageTeamTracking(pageNum)}
                          className={`w-8 h-8 rounded-lg font-bold transition ${currentPage === pageNum ? 'bg-purple-700 text-white' : 'bg-white border border-gray-300 hover:bg-gray-100 text-gray-700'}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button 
                      onClick={() => setCurrentPageTeamTracking(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                    >
                      التالي
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Dedicated Leads CRM Tab */}
        {activeTab === 'leads_crm' && (
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
                <button 
                  onClick={() => setIsQuickAddOpen(prev => !prev)}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="إضافة عميل يدوي سريعاً بالاسم ورقم الهاتف"
                >
                  <UserPlus size={14} /> ➕ إضافة عميل يدوي
                </button>

                {!isCoordinator && (
                  <button 
                    onClick={() => openCrmCampaignModal('leads_crm')}
                    className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer border border-emerald-400/30"
                    title="إرسال رسائل وحملات واتساب ترويجية لعملاء الشيت الحاليين (من 1 إلى 10 عملاء)"
                  >
                    <MessageSquare size={14} className="text-emerald-200" />
                    <span>📢 إرسال حملة واتساب (CRM)</span>
                  </button>
                )}

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
                      if (selectedLeadsCrm.length === 0) {
                        toast.error('يرجى تحديد العملاء المراد توزيعهم بوضع علامة (✓) أولاً');
                        return;
                      }
                      setIsAssignModalOpen(true);
                    }}
                    className={`${selectedLeadsCrm.length > 0 ? 'bg-purple-600 hover:bg-purple-700 shadow-md animate-pulse ring-2 ring-purple-300' : 'bg-purple-900/70 hover:bg-purple-800 text-purple-200'} text-white px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer`}
                  >
                    <UserCheck2 size={14} /> ⚖️ توزيع العملاء المحددين {selectedLeadsCrm.length > 0 ? `(${selectedLeadsCrm.length})` : ''}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Add Direct Form (Rendered Directly Outside) */}
            {isQuickAddOpen && (
              <div className="px-6 py-4 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-amber-50/90 border-b border-amber-200 shadow-inner">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <UserPlus size={15} className="text-amber-600" />
                    <span>➕ إضافة عميل يدوي سريع:</span>
                  </span>
                  <button 
                    onClick={() => setIsQuickAddOpen(false)}
                    className="text-gray-400 hover:text-red-500 text-xs font-bold transition"
                  >
                    ✕ إغلاق
                  </button>
                </div>
                <form onSubmit={(e) => handleQuickSaveDirectLead(e, 'leads_crm')} className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">اسم العميل:</label>
                      <input 
                        type="text" 
                        placeholder="مثال: أحمد محمد"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-amber-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">رقم الهاتف (مع أو بدون كود الدولة):</label>
                      <input 
                        type="tel" 
                        placeholder="مثال: 01012345678 أو 966501234567"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-mono outline-none focus:border-amber-500 bg-white"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">ملاحظات العميل (اختياري):</label>
                      <input 
                        type="text" 
                        placeholder="مثال: مهتم بالباقة السنوية / تواصل لاحقاً"
                        value={manualNotes}
                        onChange={(e) => setManualNotes(e.target.value)}
                        className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs outline-none focus:border-amber-500 bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button 
                      type="submit"
                      className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold py-1.5 px-6 rounded-lg transition flex items-center gap-1.5 shadow-sm text-xs cursor-pointer"
                    >
                      <span>+ إضافة وحفظ العميل فوراً ↵</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Filter Bar */}
            {(() => {
              const scopeLeadsForCount = (!isAdmin && !isCoordinator) 
                ? leadsCrm.filter(c => c.assignedToUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase() || c.addedByUid === currentUser?.uid)
                : (selectedEmpFilter === 'admin' 
                    ? leadsCrm.filter(c => isLeadWithAdmin(c))
                    : (selectedEmpFilter === 'all' 
                        ? leadsCrm.filter(c => isLeadAssignedToEmployee(c))
                        : leadsCrm.filter(c => c.assignedToUid === selectedEmpFilter || c.addedByUid === selectedEmpFilter || c.assignedTo?.toLowerCase() === employees.find(e => e.uid === selectedEmpFilter)?.email?.toLowerCase() || (employees.find(e => e.uid === selectedEmpFilter)?.name && c.addedBy === employees.find(e => e.uid === selectedEmpFilter)?.name))
                      )
                  );

              const getCrmStatusCount = (statusKey) => {
                if (statusKey === 'all') return scopeLeadsForCount.length;
                return scopeLeadsForCount.filter(c => {
                  const st = (c.crmStatus && c.crmStatus !== 'assigned') ? c.crmStatus : 'unassigned';
                  return st === statusKey;
                }).length;
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
                          <option value="admin" className="bg-purple-950 text-white">👑 الإدارة ({leadsCrm.filter(c => isLeadWithAdmin(c)).length.toLocaleString()})</option>
                          <option value="all" className="bg-purple-950 text-white">👥 جميع الموظفين ({leadsCrm.filter(c => isLeadAssignedToEmployee(c)).length.toLocaleString()})</option>
                          {employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(emp => {
                            const count = leadsCrm.filter(c => c.assignedToUid === emp.uid || c.addedByUid === emp.uid || c.assignedTo?.toLowerCase() === emp.email?.toLowerCase() || (emp.name && c.addedBy === emp.name)).length;
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
              let filtered = leadsCrm.filter(c => {
                // Employee view restriction
                if (!isAdmin && !isCoordinator) {
                  if (c.assignedToUid !== currentUser?.uid && c.assignedTo?.toLowerCase() !== currentUser?.email?.toLowerCase() && c.addedByUid !== currentUser?.uid) {
                    return false;
                  }
                } else if (selectedEmpFilter === 'admin' || selectedEmpFilter === 'unassigned') {
                  if (!isLeadWithAdmin(c)) return false;
                } else if (selectedEmpFilter === 'all') {
                  if (!isLeadAssignedToEmployee(c)) return false;
                } else if (selectedEmpFilter) {
                  const emp = employees.find(e => e.uid === selectedEmpFilter);
                  const matchesAssigned = c.assignedToUid === selectedEmpFilter || c.assignedTo?.toLowerCase() === emp?.email?.toLowerCase();
                  const matchesAdded = c.addedByUid === selectedEmpFilter || (emp?.name && c.addedBy === emp.name);
                  if (!matchesAssigned && !matchesAdded) return false;
                }

                if (crmStatusFilter && crmStatusFilter !== 'all') {
                  const currentStatus = (c.crmStatus && c.crmStatus !== 'assigned') ? c.crmStatus : 'unassigned';
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
                          {(isAdmin || isCoordinator || isLeader) && (
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
                            {(isAdmin || isCoordinator || isLeader) && (
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
                                {!isCoordinator && customer.phoneNumber && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleCallViaMicroSip(customer.phoneNumber); }}
                                    className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_3px_10px_rgba(37,99,235,0.4)] hover:shadow-[0_5px_15px_rgba(37,99,235,0.6)] active:scale-95 border border-blue-300/40 rounded-lg px-2 py-1 text-[11px] font-black flex items-center gap-1 cursor-pointer transform hover:-translate-y-0.5 transition-all shrink-0"
                                    title="اتصال مباشر عبر MicroSIP 📞"
                                  >
                                    <PhoneCall size={12} className="animate-pulse" />
                                    <span>اتصال</span>
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
                              {(() => {
                                const isAdderAdmin = !customer.addedBy || isAdminIdentifier(customer.addedBy);
                                const adderName = isAdderAdmin ? 'الإدارة' : sanitizeDisplayName(customer.addedBy);
                                return (
                                  <div className="flex flex-wrap items-center gap-1 mt-1">
                                    {!isAdderAdmin && customer.source && (
                                      <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold border border-purple-200">
                                        📦 {customer.source}
                                      </span>
                                    )}
                                    <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold border border-emerald-200" title={`تمت الإضافة بواسطة: ${adderName}`}>
                                      👤 مضاف بواسطة: {adderName}
                                    </span>
                                    {customer.notesHistory && customer.notesHistory.length > 0 && (
                                      <span className="text-[10px] text-blue-600 font-bold">📝 {customer.notesHistory.length} ملاحظات</span>
                                    )}
                                  </div>
                                );
                              })()}
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
                              {(isAdmin || isCoordinator || isLeader) ? (
                                <select 
                                  value={isLeadWithAdmin(customer) ? "admin" : customer.assignedToUid}
                                  onChange={async (e) => {
                                    const uid = e.target.value;
                                    const prevEmpName = employees.find(e => e.uid === customer.assignedToUid || e.email === customer.assignedTo)?.name || '👑 الإدارة';
                                    const assignerDisplay = isAdmin ? '👑 الإدارة' : isLeader ? `👑 ليدر الفريق (${currentEmpUser?.name || 'ليدر'})` : `📋 منسق للإدارة (${currentEmpUser?.name || 'منسق'})`;
                                    
                                    if (uid === 'admin') {
                                      const logObj = createAssignmentLog(prevEmpName, '👑 الإدارة', assignerDisplay);
                                      try {
                                        await updateDoc(doc(db, 'leads_crm', customer.id), {
                                          assignedToUid: 'admin',
                                          assignedTo: 'الإدارة',
                                          assignedAt: serverTimestamp(),
                                          status: 'unassigned',
                                          crmStatus: 'unassigned',
                                          updatedAt: serverTimestamp(),
                                          assignmentHistory: arrayUnion(logObj)
                                        });
                                        toast.success('تم إرجاع العميل إلى الإدارة 👑');
                                      } catch (err) { toast.error('حدث خطأ أثناء التعيين'); }
                                    } else {
                                      const emp = employees.find(x => x.uid === uid);
                                      const logObj = createAssignmentLog(prevEmpName, `👤 ${emp?.name}`, assignerDisplay);
                                      try {
                                        await updateDoc(doc(db, 'leads_crm', customer.id), {
                                          assignedToUid: uid,
                                          assignedTo: emp?.email || '',
                                          assignedAt: serverTimestamp(),
                                          status: 'assigned',
                                          crmStatus: 'unassigned', // Ensure pending state for employee
                                          updatedAt: serverTimestamp(),
                                          assignmentHistory: arrayUnion(logObj)
                                        });
                                        toast.success(`تم تعيين العميل إلى ${emp?.name}`);
                                      } catch (err) { toast.error('حدث خطأ أثناء التعيين'); }
                                    }
                                  }}
                                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-800 w-full focus:outline-none focus:border-purple-500 bg-white/70 shadow-sm cursor-pointer mb-1"
                                >
                                  {isLeader ? (
                                    <>
                                      <option value={currentUser?.uid}>👤 نفسي (الليدر: {currentEmpUser?.name || 'أنا'})</option>
                                      {myTeamMembers.map(emp => (
                                        <option key={emp.uid} value={emp.uid}>
                                          👤 {emp.name} (عضو فريقي)
                                        </option>
                                      ))}
                                    </>
                                  ) : (
                                    <>
                                      <option value="admin">👑 الإدارة (الإدارة)</option>
                                      {employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(emp => (
                                        <option key={emp.uid} value={emp.uid}>
                                          👤 {emp.name} ({emp.jobTitle === 'Leader' ? '👑 Leader' : 'Agent'}{emp.leaderName ? ` - فريق ${emp.leaderName}` : ''})
                                        </option>
                                      ))}
                                    </>
                                  )}
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
                                className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center whitespace-nowrap shadow-sm cursor-pointer"
                                title="Comment"
                              >
                                <FileText size={14} className="ml-1" /> Comment
                              </button>
                              {!isCoordinator && (isAdmin || customer.assignedToUid === currentUser?.uid || customer.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase() || (isLeader && myTeamMembers.some(m => m.uid === customer.assignedToUid))) && (
                                <button 
                                  onClick={() => handleTransferToWhatsapp(customer)}
                                  className="bg-gradient-to-tr from-emerald-600 via-green-500 to-emerald-400 hover:from-emerald-500 hover:to-green-400 text-white px-2.5 py-1.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-[0_3px_10px_rgba(16,185,129,0.4)] hover:shadow-[0_4px_14px_rgba(16,185,129,0.6)] active:scale-95 cursor-pointer border border-emerald-300/40 whitespace-nowrap"
                                  title="مراسلة عبر واتساب"
                                >
                                  <MessageCircle size={15} className="drop-shadow-sm fill-white/20" />
                                  <span className="text-[11px] font-black">WhatsApp</span>
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteSingleLeadCrm(customer)}
                                  className="bg-red-50 text-red-600 hover:bg-red-100 p-2 rounded-lg transition shadow-sm cursor-pointer"
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

        {/* Dedicated Employee Added Leads CRM Tab */}
        {activeTab === 'employee_leads' && (
          <div ref={tableSectionRef} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/30 bg-purple-50/50 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                  <Upload className="text-purple-600" size={24} />
                  <span>📁 داتا مضافة بواسطة الموظف</span>
                </h2>
                <span className="bg-purple-200 text-purple-800 text-xs font-black px-3 py-1 rounded-full shadow-sm">
                  {isAdmin || isCoordinator ? `إجمالي ${employeeLeads.length.toLocaleString()} عميل` : `داتاي المرفوعة (${employeeLeads.filter(c => c.assignedToUid === currentUser?.uid || c.addedByUid === currentUser?.uid || (isLeader && myTeamMembers.some(m => m.uid === c.assignedToUid || m.uid === c.addedByUid))).length.toLocaleString()} عميل)`}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button 
                  onClick={() => setIsQuickAddOpen(prev => !prev)}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="إضافة عميل يدوي سريعاً بالاسم ورقم الهاتف"
                >
                  <UserPlus size={14} /> ➕ إضافة عميل يدوي
                </button>

                {!isCoordinator && (
                  <button 
                    onClick={() => openCrmCampaignModal('employee_leads')}
                    className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer border border-emerald-400/30"
                    title="إرسال رسائل وحملات واتساب ترويجية لعملاء الداتا المضافة (من 1 إلى 10 عملاء)"
                  >
                    <MessageSquare size={14} className="text-emerald-200" />
                    <span>📢 إرسال حملة واتساب (CRM)</span>
                  </button>
                )}

                <button 
                  onClick={() => setIsImportModalOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <FileSpreadsheet size={14} /> 📥 إضافة واستيراد داتا جديدة
                </button>
                {isAdmin && (
                  <>
                    <button 
                      onClick={exportEmployeeLeadsToExcel}
                      className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                      title="تصدير هذه الداتا إلى إكسيل"
                    >
                      <Download size={14} /> 📊 تصدير إكسيل
                    </button>
                    <button 
                      onClick={handleCleanEmpLeadNames}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                      title="تنظيف أسماء العملاء وحذف النصوص الزائدة"
                    >
                      🧹 تنظيف الأسماء
                    </button>
                  </>
                )}
                {isAdmin && selectedEmployeeLeads.length > 0 && (
                  <button 
                    onClick={handleDeleteSelectedEmpLeads}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Trash2 size={14} /> مسح المحدد ({selectedEmployeeLeads.length})
                  </button>
                )}
              </div>
            </div>

            {/* Quick Add Direct Form (Rendered Directly Outside) */}
            {isQuickAddOpen && (
              <div className="px-6 py-4 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-amber-50/90 border-b border-amber-200 shadow-inner">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <UserPlus size={15} className="text-amber-600" />
                    <span>➕ إضافة عميل يدوي سريع:</span>
                  </span>
                  <button 
                    onClick={() => setIsQuickAddOpen(false)}
                    className="text-gray-400 hover:text-red-500 text-xs font-bold transition"
                  >
                    ✕ إغلاق
                  </button>
                </div>
                <form onSubmit={(e) => handleQuickSaveDirectLead(e, 'employee_leads')} className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">اسم العميل:</label>
                      <input 
                        type="text" 
                        placeholder="مثال: أحمد محمد"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-amber-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">رقم الهاتف (مع أو بدون كود الدولة):</label>
                      <input 
                        type="tel" 
                        placeholder="مثال: 01012345678 أو 966501234567"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-mono outline-none focus:border-amber-500 bg-white"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">ملاحظات العميل (اختياري):</label>
                      <input 
                        type="text" 
                        placeholder="مثال: مهتم بالباقة السنوية / تواصل لاحقاً"
                        value={manualNotes}
                        onChange={(e) => setManualNotes(e.target.value)}
                        className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs outline-none focus:border-amber-500 bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button 
                      type="submit"
                      className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold py-1.5 px-6 rounded-lg transition flex items-center gap-1.5 shadow-sm text-xs cursor-pointer"
                    >
                      <span>+ إضافة وحفظ العميل فوراً ↵</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Filter & Status Bar */}
            {(() => {
              const scopeEmpLeads = (!isAdmin && !isCoordinator) 
                ? (isLeader
                    ? (empLeadsEmpFilter === 'all'
                        ? employeeLeads.filter(c => c.assignedToUid === currentUser?.uid || c.addedByUid === currentUser?.uid || myTeamMembers.some(m => m.uid === c.assignedToUid || m.uid === c.addedByUid))
                        : employeeLeads.filter(c => c.assignedToUid === empLeadsEmpFilter || c.addedByUid === empLeadsEmpFilter || c.assignedTo?.toLowerCase() === employees.find(e => e.uid === empLeadsEmpFilter)?.email?.toLowerCase() || (employees.find(e => e.uid === empLeadsEmpFilter)?.name && c.addedBy === employees.find(e => e.uid === empLeadsEmpFilter)?.name))
                      )
                    : employeeLeads.filter(c => c.assignedToUid === currentUser?.uid || c.addedByUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase())
                  )
                : (empLeadsEmpFilter === 'admin' 
                    ? employeeLeads.filter(c => isLeadWithAdmin(c))
                    : (empLeadsEmpFilter === 'all' 
                        ? employeeLeads.filter(c => isLeadAssignedToEmployee(c))
                        : employeeLeads.filter(c => c.assignedToUid === empLeadsEmpFilter || c.addedByUid === empLeadsEmpFilter || c.assignedTo?.toLowerCase() === employees.find(e => e.uid === empLeadsEmpFilter)?.email?.toLowerCase() || (employees.find(e => e.uid === empLeadsEmpFilter)?.name && c.addedBy === employees.find(e => e.uid === empLeadsEmpFilter)?.name))
                      )
                  );

              const getEmpLeadStatusCount = (statusKey) => {
                if (statusKey === 'all') return scopeEmpLeads.length;
                return scopeEmpLeads.filter(c => {
                  const st = (c.crmStatus && c.crmStatus !== 'assigned') ? c.crmStatus : 'unassigned';
                  return st === statusKey;
                }).length;
              };

              return (
                <div className="px-6 py-3.5 bg-purple-50/30 border-b flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[200px]">
                    {/* Employee Filter Dropdown for Admin, Coordinator, Leader */}
                    {(isAdmin || isCoordinator || isLeader) && (
                      <div className="relative">
                        <select
                          value={empLeadsEmpFilter}
                          onChange={(e) => setEmpLeadsEmpFilter(e.target.value)}
                          className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white rounded-full py-2 px-4 pl-8 text-xs font-black focus:outline-none shadow-[0_4px_14px_rgba(147,51,234,0.35)] border border-purple-400/40 hover:border-purple-300 transition-all cursor-pointer appearance-none"
                        >
                          {(isAdmin || isCoordinator) && (
                            <option value="admin" className="bg-slate-950 text-white">👑 الإدارة ({employeeLeads.filter(c => isLeadWithAdmin(c)).length.toLocaleString()})</option>
                          )}
                          <option value="all" className="bg-slate-950 text-white">
                            {isLeader ? `👥 جميع داتا فريقي (${employeeLeads.filter(c => c.assignedToUid === currentUser?.uid || c.addedByUid === currentUser?.uid || myTeamMembers.some(m => m.uid === c.assignedToUid || m.uid === c.addedByUid)).length.toLocaleString()})` : `👥 جميع الموظفين (${employeeLeads.filter(c => isLeadAssignedToEmployee(c)).length.toLocaleString()})`}
                          </option>
                          {(isLeader ? myTeamMembers : employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator')).map(emp => {
                            const count = employeeLeads.filter(c => c.assignedToUid === emp.uid || c.addedByUid === emp.uid || c.assignedTo?.toLowerCase() === emp.email?.toLowerCase() || (emp.name && c.addedBy === emp.name)).length;
                            return (
                              <option key={emp.uid} value={emp.uid} className="bg-slate-950 text-white">
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

                    {/* Status Tabs */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { key: 'unassigned', label: '⏳ في الانتظار', bg: 'bg-gray-100 text-gray-700' },
                        { key: 'interested', label: '🌟 مهتم', bg: 'bg-emerald-100 text-emerald-800' },
                        { key: 'not_interested', label: '❌ غير مهتم', bg: 'bg-rose-100 text-rose-800' },
                        { key: 'no_answer', label: '📵 لم يرد', bg: 'bg-amber-100 text-amber-800' },
                        { key: 'subscribed', label: '🎉 تم الاشتراك', bg: 'bg-purple-100 text-purple-800' },
                        { key: 'started_trial', label: '🚀 بدأ تجربة', bg: 'bg-cyan-100 text-cyan-800' },
                      ].map(tab => {
                        const count = getEmpLeadStatusCount(tab.key);
                        const isSelected = empLeadsStatusFilter === tab.key;
                        return (
                          <button
                            key={tab.key}
                            onClick={() => setEmpLeadsStatusFilter(tab.key)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                              isSelected ? 'bg-purple-700 text-white shadow-sm ring-2 ring-purple-400' : `${tab.bg} hover:opacity-80`
                            }`}
                          >
                            <span>{tab.label}</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-black/10'}`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Search, Date & Sort Controls */}
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <div className="flex items-center gap-1 bg-white border border-purple-200 rounded-xl px-2 py-1 shadow-sm text-xs">
                      <span className="text-[11px] text-gray-500 font-bold">من:</span>
                      <input 
                        type="date" 
                        value={empLeadsDateFrom} 
                        onChange={(e) => setEmpLeadsDateFrom(e.target.value)}
                        className="text-xs outline-none bg-transparent text-gray-700" 
                      />
                      <span className="text-[11px] text-gray-500 font-bold">إلى:</span>
                      <input 
                        type="date" 
                        value={empLeadsDateTo} 
                        onChange={(e) => setEmpLeadsDateTo(e.target.value)}
                        className="text-xs outline-none bg-transparent text-gray-700" 
                      />
                      {(empLeadsDateFrom || empLeadsDateTo) && (
                        <button 
                          onClick={() => { setEmpLeadsDateFrom(''); setEmpLeadsDateTo(''); }}
                          className="text-[10px] text-red-500 hover:underline font-bold mr-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setEmpLeadsSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className="bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                      title={empLeadsSortOrder === 'desc' ? 'الترتيب: الأحدث أولاً (انقر للتبديل)' : 'الترتيب: الأقدم أولاً (انقر للتبديل)'}
                    >
                      <ArrowUpDown size={13} className="text-purple-600" />
                      <span>{empLeadsSortOrder === 'desc' ? 'الأحدث ⬇' : 'الأقدم ⬆'}</span>
                    </button>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="ابحث بالاسم أو الهاتف..."
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        className="w-48 sm:w-56 px-3 py-1.5 pr-8 bg-white border border-purple-200 rounded-xl text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-sm"
                      />
                      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      {tableSearch && (
                        <button onClick={() => setTableSearch('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Table Content */}
            {(() => {
              let filtered = employeeLeads.filter(c => {
                // Role restriction
                if (!isAdmin && !isCoordinator) {
                  if (isLeader) {
                    if (empLeadsEmpFilter === 'all') {
                      const matchesSelf = c.assignedToUid === currentUser?.uid || c.addedByUid === currentUser?.uid;
                      const matchesTeam = myTeamMembers.some(m => m.uid === c.assignedToUid || m.uid === c.addedByUid);
                      if (!matchesSelf && !matchesTeam) return false;
                    } else {
                      const emp = employees.find(e => e.uid === empLeadsEmpFilter);
                      const matchesAssigned = c.assignedToUid === empLeadsEmpFilter || c.assignedTo?.toLowerCase() === emp?.email?.toLowerCase();
                      const matchesAdded = c.addedByUid === empLeadsEmpFilter || (emp?.name && c.addedBy === emp.name);
                      if (!matchesAssigned && !matchesAdded) return false;
                    }
                  } else {
                    if (c.assignedToUid !== currentUser?.uid && c.assignedTo?.toLowerCase() !== currentUser?.email?.toLowerCase() && c.addedByUid !== currentUser?.uid) {
                      return false;
                    }
                  }
                } else if (empLeadsEmpFilter === 'admin' || empLeadsEmpFilter === 'unassigned') {
                  if (!isLeadWithAdmin(c)) return false;
                } else if (empLeadsEmpFilter === 'all') {
                  if (!isLeadAssignedToEmployee(c)) return false;
                } else if (empLeadsEmpFilter) {
                  const emp = employees.find(e => e.uid === empLeadsEmpFilter);
                  const matchesAssigned = c.assignedToUid === empLeadsEmpFilter || c.assignedTo?.toLowerCase() === emp?.email?.toLowerCase();
                  const matchesAdded = c.addedByUid === empLeadsEmpFilter || (emp?.name && c.addedBy === emp.name);
                  if (!matchesAssigned && !matchesAdded) return false;
                }

                if (empLeadsStatusFilter && empLeadsStatusFilter !== 'all') {
                  const currentStatus = (c.crmStatus && c.crmStatus !== 'assigned') ? c.crmStatus : 'unassigned';
                  if (currentStatus !== empLeadsStatusFilter) return false;
                }

                // Date Filter
                if (empLeadsDateFrom) {
                  const fromTime = new Date(empLeadsDateFrom).setHours(0, 0, 0, 0);
                  const itemTime = getTimestampMillis(c.createdAt) || getTimestampMillis(c.updatedAt);
                  if (itemTime > 0 && itemTime < fromTime) return false;
                }
                if (empLeadsDateTo) {
                const toTime = new Date(empLeadsDateTo).setHours(23, 59, 59, 999);
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
                return empLeadsSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
              });

              const totalPagesEmpLeads = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
              const validPageEmpLeads = Math.min(currentPageEmpLeads, totalPagesEmpLeads);
              const startIndexEmpLeads = (validPageEmpLeads - 1) * ITEMS_PER_PAGE;
              const paginatedEmpLeads = filtered.slice(startIndexEmpLeads, startIndexEmpLeads + ITEMS_PER_PAGE);

              const isPageSelected = paginatedEmpLeads.length > 0 && paginatedEmpLeads.every(c => selectedEmployeeLeads.includes(c.id));

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
                                onChange={() => toggleAllEmployeeLeads(paginatedEmpLeads)} 
                                className="w-4 h-4 text-purple-600 rounded cursor-pointer accent-purple-600" 
                              />
                            </th>
                          )}
                          <th className="p-4 font-bold text-purple-950 text-sm">رقم الهاتف</th>
                          <th className="p-4 font-bold text-purple-950 text-sm">اسم العميل وتفاصيل الإضافة</th>
                          <th className="p-4 font-bold text-purple-950 text-sm">تاريخ الإضافة</th>
                          <th className="p-4 font-bold text-purple-950 text-sm">حالة المتابعة (CRM)</th>
                          <th className="p-4 font-bold text-purple-950 text-sm">الموظف المسؤول</th>
                          <th className="p-4 font-bold text-purple-950 text-sm text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedEmpLeads.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="p-10 text-center text-gray-500 font-bold">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Upload size={36} className="text-gray-300" />
                                <p>لا توجد بيانات مطابقة في قسم (داتا مضافة بواسطة الموظف).</p>
                                <button
                                  onClick={() => setIsImportModalOpen(true)}
                                  className="mt-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm cursor-pointer"
                                >
                                  + إضافة / استيراد داتا الآن
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          paginatedEmpLeads.map((customer) => {
                            const currentCrmStatus = customer.crmStatus || 'unassigned';
                            const statusInfo = CRM_STATUS_MAP[currentCrmStatus] || CRM_STATUS_MAP.unassigned;

                            return (
                              <tr key={customer.id} className="hover:bg-purple-50/30 transition border-b border-gray-100/50">
                                {isAdmin && (
                                  <td className="p-4 text-center">
                                    <input 
                                      type="checkbox" 
                                      checked={selectedEmployeeLeads.includes(customer.id)} 
                                      onChange={() => toggleEmployeeLeadSelection(customer.id)} 
                                      className="w-4 h-4 text-purple-600 rounded cursor-pointer accent-purple-600" 
                                    />
                                  </td>
                                )}
                                <td className="p-4 text-sm font-bold text-gray-800" dir="ltr">
                                  <div className="flex items-center gap-2">
                                    <span>{customer.phoneNumber}</span>
                                    {!isCoordinator && customer.phoneNumber && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCallViaMicroSip(customer.phoneNumber); }}
                                        className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_3px_10px_rgba(37,99,235,0.4)] hover:shadow-[0_5px_15px_rgba(37,99,235,0.6)] active:scale-95 border border-blue-300/40 rounded-lg px-2 py-1 text-[11px] font-black flex items-center gap-1 cursor-pointer transform hover:-translate-y-0.5 transition-all shrink-0"
                                        title="اتصال مباشر عبر MicroSIP 📞"
                                      >
                                        <PhoneCall size={12} className="animate-pulse" />
                                        <span>اتصال</span>
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
                                        className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded transition text-xs font-bold shadow-sm cursor-pointer"
                                        title="حفظ الاسم"
                                      >
                                        ✓
                                      </button>
                                      <button 
                                        onClick={() => setEditingLeadId(null)} 
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded transition text-xs font-bold cursor-pointer"
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
                                  {(() => {
                                    const isAdderAdmin = !customer.addedBy || isAdminIdentifier(customer.addedBy);
                                    const adderName = isAdderAdmin ? 'الإدارة' : sanitizeDisplayName(customer.addedBy);
                                    return (
                                      <div className="flex flex-wrap items-center gap-1 mt-1">
                                        {!isAdderAdmin && customer.source && (
                                          <span className="text-[10px] bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded font-bold border border-purple-200">
                                            📦 {customer.source}
                                          </span>
                                        )}
                                        <span className="text-[10px] bg-indigo-50 text-indigo-900 px-1.5 py-0.5 rounded font-bold border border-indigo-200" title={`تمت الإضافة بواسطة: ${adderName}`}>
                                          👤 مضاف بواسطة: {adderName}
                                        </span>
                                        {customer.notesHistory && customer.notesHistory.length > 0 && (
                                          <span className="text-[10px] text-blue-600 font-bold">📝 {customer.notesHistory.length} ملاحظات</span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="p-4 text-xs text-gray-500" dir="ltr">{formatDate(customer.createdAt || customer.updatedAt)}</td>
                                <td className="p-4 text-sm">
                                  <div className="flex flex-col gap-1">
                                    <select 
                                      value={currentCrmStatus}
                                      onChange={async (e) => {
                                        const newStatus = e.target.value;
                                        try {
                                          await updateDoc(doc(db, 'employee_leads', customer.id), { crmStatus: newStatus, updatedAt: serverTimestamp() });
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
                                  {(isAdmin || isCoordinator || isLeader) ? (
                                    <select 
                                      value={isLeadWithAdmin(customer) ? "admin" : customer.assignedToUid}
                                      onChange={async (e) => {
                                        const uid = e.target.value;
                                        const prevEmpName = employees.find(e => e.uid === customer.assignedToUid || e.email === customer.assignedTo)?.name || (customer.assignedTo === 'admin' || customer.assignedTo === 'الإدارة' ? '👑 الإدارة' : '👑 الإدارة');
                                        const assignerDisplay = isAdmin ? '👑 الإدارة' : isLeader ? `👑 ليدر الفريق (${currentEmpUser?.name || 'ليدر'})` : `📋 منسق للإدارة (${currentEmpUser?.name || 'منسق'})`;
                                        
                                        if (uid === 'admin') {
                                          const logObj = createAssignmentLog(prevEmpName, '👑 الإدارة', assignerDisplay);
                                          try {
                                            await updateDoc(doc(db, 'employee_leads', customer.id), {
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
                                          const logObj = createAssignmentLog(prevEmpName, `👤 ${emp?.name}`, assignerDisplay);
                                          try {
                                            await updateDoc(doc(db, 'employee_leads', customer.id), {
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
                                      {isLeader ? (
                                        <>
                                          <option value={currentUser?.uid}>👤 نفسي (الليدر: {currentEmpUser?.name || 'أنا'})</option>
                                          {myTeamMembers.map(emp => (
                                            <option key={emp.uid} value={emp.uid}>
                                              👤 {emp.name || emp.username}
                                            </option>
                                          ))}
                                        </>
                                      ) : (
                                        <>
                                          <option value="admin">👑 الإدارة (غير مخصص)</option>
                                          {employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(emp => (
                                            <option key={emp.uid} value={emp.uid}>
                                              👤 {emp.name || emp.username} ({emp.jobTitle === 'Leader' ? 'ليدر 👑' : 'ايجنت'})
                                            </option>
                                          ))}
                                        </>
                                      )}
                                    </select>
                                  ) : (
                                    <div className="font-bold text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded inline-block">
                                      👤 {customer.assignedTo === currentUser?.email ? (currentEmpUser?.name || 'أنا') : (customer.assignedTo || 'حسابي')}
                                    </div>
                                  )}
                                </td>
                                <td className="p-4 text-sm text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button 
                                      onClick={() => handleOpenNotesModal(customer, false)}
                                      className="bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                                      title="Comment"
                                    >
                                      <FileText size={13} />
                                      <span>Comment {customer.notesHistory?.length ? `(${customer.notesHistory.length})` : ''}</span>
                                    </button>
                                    {!isCoordinator && (isAdmin || customer.assignedToUid === currentUser?.uid || customer.addedByUid === currentUser?.uid || customer.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase() || (isLeader && myTeamMembers.some(m => m.uid === customer.assignedToUid || m.uid === customer.addedByUid))) && (
                                      <button 
                                        onClick={() => handleTransferToWhatsapp(customer)}
                                        className="bg-gradient-to-tr from-emerald-600 via-green-500 to-emerald-400 hover:from-emerald-500 hover:to-green-400 text-white px-2.5 py-1.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-[0_3px_10px_rgba(16,185,129,0.4)] hover:shadow-[0_4px_14px_rgba(16,185,129,0.6)] active:scale-95 cursor-pointer border border-emerald-300/40 whitespace-nowrap"
                                        title="مراسلة عبر واتساب"
                                      >
                                        <MessageCircle size={15} className="drop-shadow-sm fill-white/20" />
                                        <span className="text-[11px] font-black">WhatsApp</span>
                                      </button>
                                    )}
                                    {isAdmin && (
                                      <button 
                                        onClick={async () => {
                                          if (window.confirm('هل تريد حذف هذا العميل من داتا الموظف نهائياً؟')) {
                                            await deleteDoc(doc(db, 'employee_leads', customer.id));
                                            toast.success('تم حذف العميل');
                                          }
                                        }}
                                        className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                                        title="حذف العميل"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Bar */}
                  {filtered.length > 0 && (
                    <div className="px-6 py-4 border-t border-purple-100 bg-purple-50/40 flex flex-wrap justify-between items-center gap-3">
                      <div className="text-xs font-bold text-purple-900">
                        عرض <span className="text-purple-700 font-black">{startIndexEmpLeads + 1}</span> إلى <span className="text-purple-700 font-black">{Math.min(startIndexEmpLeads + ITEMS_PER_PAGE, filtered.length)}</span> من إجمالي <span className="text-purple-700 font-black">{filtered.length}</span> عميل
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Custom Page Jump Input */}
                        <div className="flex items-center gap-1 bg-white border border-purple-200 rounded-xl px-2 py-1 shadow-sm">
                          <span className="text-[11px] text-purple-900 font-bold">صفحة:</span>
                          <input 
                            type="number"
                            min="1"
                            max={totalPagesEmpLeads}
                            defaultValue=""
                            placeholder={String(validPageEmpLeads)}
                            className="w-14 text-center text-xs font-black border border-purple-200 rounded-lg py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500 text-purple-950 bg-purple-50/50"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = parseInt(e.target.value, 10);
                                if (val >= 1 && val <= totalPagesEmpLeads) {
                                  setCurrentPageEmpLeads(val);
                                  tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                                } else {
                                  toast.error(`يرجى كتابة رقم صفحة بين 1 و ${totalPagesEmpLeads}`);
                                }
                              }
                            }}
                          />
                          <span className="text-[11px] text-purple-400 font-bold">/ {totalPagesEmpLeads}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              const inputEl = e.currentTarget.parentElement.querySelector('input');
                              const val = parseInt(inputEl?.value, 10);
                              if (val >= 1 && val <= totalPagesEmpLeads) {
                                setCurrentPageEmpLeads(val);
                                tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                              } else {
                                toast.error(`يرجى كتابة رقم صفحة بين 1 و ${totalPagesEmpLeads}`);
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
                            setCurrentPageEmpLeads(prev => Math.max(prev - 1, 1));
                            tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          disabled={validPageEmpLeads === 1}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-white border border-purple-200 text-purple-900 shadow-sm hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          ◀ السابق
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPagesEmpLeads }, (_, i) => i + 1)
                            .filter(page => page === 1 || page === totalPagesEmpLeads || Math.abs(page - validPageEmpLeads) <= 2)
                            .map((page, idx, arr) => {
                              const showDots = idx > 0 && page - arr[idx - 1] > 1;
                              return (
                                <React.Fragment key={page}>
                                  {showDots && <span className="text-xs text-purple-400 font-bold px-1">...</span>}
                                  <button
                                    onClick={() => {
                                      setCurrentPageEmpLeads(page);
                                      tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className={`w-7 h-7 rounded-lg text-xs font-black transition flex items-center justify-center cursor-pointer ${
                                      validPageEmpLeads === page
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
                            setCurrentPageEmpLeads(prev => Math.min(prev + 1, totalPagesEmpLeads));
                            tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          disabled={validPageEmpLeads === totalPagesEmpLeads}
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

        {/* Dedicated Subscribed Clients Tab (العملاء المشتركين) */}
        {activeTab === 'subscribed_clients' && (
          <div ref={tableSectionRef} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-emerald-500/30 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-emerald-500/20 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-black text-emerald-950 flex items-center gap-2">
                  <Award className="text-emerald-600" size={26} />
                  <span>🎉 العملاء المشتركين (إدارة وتفاصيل الاشتراكات)</span>
                </h2>
                <span className="bg-emerald-200 text-emerald-900 text-xs font-black px-3 py-1 rounded-full shadow-sm">
                  {isAdmin || isCoordinator ? `إجمالي ${allSubscribedClients.length.toLocaleString()} مشترك` : isLeader ? `مشتركي الفريق (${leaderSubscribedClients.length.toLocaleString()} مشترك)` : `مشتركي الخاصين (${agentSubscribedClients.length.toLocaleString()} مشترك)`}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isAdmin && (
                  <button 
                    onClick={exportSubscribedClientsToExcel}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="تصدير بيانات واشتراكات العملاء إلى إكسيل"
                  >
                    <Download size={14} /> 📊 تصدير المشتركين إكسيل
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            {(() => {
              const scopeSubscribed = (!isAdmin && !isCoordinator)
                ? (isLeader
                    ? (subscribedEmpFilter === 'all'
                        ? leaderSubscribedClients
                        : leaderSubscribedClients.filter(c => c.assignedToUid === subscribedEmpFilter || c.addedByUid === subscribedEmpFilter || c.assignedTo?.toLowerCase() === employees.find(e => e.uid === subscribedEmpFilter)?.email?.toLowerCase()))
                    : agentSubscribedClients)
                : (subscribedEmpFilter === 'all'
                    ? allSubscribedClients
                    : (subscribedEmpFilter === 'admin'
                        ? allSubscribedClients.filter(c => isLeadWithAdmin(c))
                        : allSubscribedClients.filter(c => c.assignedToUid === subscribedEmpFilter || c.addedByUid === subscribedEmpFilter || c.assignedTo?.toLowerCase() === employees.find(e => e.uid === subscribedEmpFilter)?.email?.toLowerCase())));

              return (
                <div className="px-6 py-3.5 bg-gradient-to-r from-emerald-50/60 via-teal-50/30 to-white border-b border-emerald-100 flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[200px]">
                    {/* Employee Filter */}
                    {(isAdmin || isCoordinator || isLeader) && (
                      <div className="relative">
                        <select
                          value={subscribedEmpFilter}
                          onChange={(e) => setSubscribedEmpFilter(e.target.value)}
                          className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-full py-2 px-4 pl-8 text-xs font-black focus:outline-none shadow-md border border-emerald-400/40 cursor-pointer appearance-none"
                        >
                          <option value="all" className="bg-slate-900 text-white">👥 جميع الموظفين ({scopeSubscribed.length})</option>
                          {isLeader ? (
                            <>
                              <option value={currentUser?.uid} className="bg-slate-900 text-white">👤 نفسي ({currentEmpUser?.name || 'الليدر'})</option>
                              {myTeamMembers.map(emp => {
                                const count = leaderSubscribedClients.filter(c => c.assignedToUid === emp.uid || c.addedByUid === emp.uid || c.assignedTo?.toLowerCase() === emp.email?.toLowerCase()).length;
                                return (
                                  <option key={emp.uid} value={emp.uid} className="bg-slate-900 text-white">
                                    👤 {emp.name} ({count} مشترك)
                                  </option>
                                );
                              })}
                            </>
                          ) : (
                            employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator').map(emp => {
                              const count = allSubscribedClients.filter(c => c.assignedToUid === emp.uid || c.addedByUid === emp.uid || c.assignedTo?.toLowerCase() === emp.email?.toLowerCase()).length;
                              return (
                                <option key={emp.uid} value={emp.uid} className="bg-slate-900 text-white">
                                  👤 {emp.name || emp.username} ({count} مشترك)
                                </option>
                              );
                            })
                          )}
                        </select>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-300 text-[10px] font-bold">
                          ▼
                        </div>
                      </div>
                    )}

                    {/* Modern Date Filter */}
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-full px-3 py-1 text-xs font-black shadow-md border border-emerald-400/40">
                      <span className="flex items-center gap-1 text-emerald-200 font-black text-[11px] shrink-0">
                        📅 التاريخ:
                      </span>
                      <div className="relative flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-lg px-2 py-0.5 border border-white/20 min-w-[105px] justify-between cursor-pointer">
                        <span className="text-[10px] text-emerald-200 font-bold shrink-0">من</span>
                        {!dateFromFilter && <span className="text-[11px] text-emerald-300 font-mono font-bold">--/--/----</span>}
                        <input 
                          type="date" 
                          value={dateFromFilter}
                          onChange={(e) => setDateFromFilter(e.target.value)}
                          className={`bg-transparent text-[11px] text-white font-mono outline-none cursor-pointer font-bold border-none ${!dateFromFilter ? 'opacity-0 absolute inset-0 w-full h-full' : 'w-[95px]'}`}
                        />
                      </div>
                      <div className="relative flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-lg px-2 py-0.5 border border-white/20 min-w-[105px] justify-between cursor-pointer">
                        <span className="text-[10px] text-emerald-200 font-bold shrink-0">إلى</span>
                        {!dateToFilter && <span className="text-[11px] text-emerald-300 font-mono font-bold">--/--/----</span>}
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
                          className="text-emerald-300 hover:text-white text-xs px-1"
                          title="إعادة ضبط التاريخ"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search Input */}
                  <div className="relative min-w-[220px]">
                    <input 
                      type="text" 
                      placeholder="🔍 بحث بالاسم أو رقم الهاتف..."
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-emerald-200 rounded-full text-xs font-bold text-gray-800 outline-none focus:border-emerald-500 shadow-sm"
                    />
                    {tableSearch && (
                      <button 
                        onClick={() => setTableSearch('')}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Table Content */}
            {(() => {
              let filtered = (!isAdmin && !isCoordinator)
                ? (isLeader
                    ? (subscribedEmpFilter === 'all'
                        ? leaderSubscribedClients
                        : leaderSubscribedClients.filter(c => c.assignedToUid === subscribedEmpFilter || c.addedByUid === subscribedEmpFilter || c.assignedTo?.toLowerCase() === employees.find(e => e.uid === subscribedEmpFilter)?.email?.toLowerCase()))
                    : agentSubscribedClients)
                : (subscribedEmpFilter === 'all'
                    ? allSubscribedClients
                    : (subscribedEmpFilter === 'admin'
                        ? allSubscribedClients.filter(c => isLeadWithAdmin(c))
                        : allSubscribedClients.filter(c => c.assignedToUid === subscribedEmpFilter || c.addedByUid === subscribedEmpFilter || c.assignedTo?.toLowerCase() === employees.find(e => e.uid === subscribedEmpFilter)?.email?.toLowerCase())));

              if (tableSearch.trim()) {
                const q = tableSearch.trim().toLowerCase();
                filtered = filtered.filter(c => (c.name && c.name.toLowerCase().includes(q)) || (c.phoneNumber && c.phoneNumber.includes(q)) || (c.notes && c.notes.toLowerCase().includes(q)) || (c.subscriptionDetails?.serviceType && c.subscriptionDetails.serviceType.toLowerCase().includes(q)));
              }

              if (dateFromFilter) {
                filtered = filtered.filter(c => {
                  const d = c.subscriptionDetails?.startDate || (c.createdAt?.toDate ? c.createdAt.toDate().toISOString().slice(0, 10) : typeof c.createdAt === 'string' ? c.createdAt.slice(0, 10) : '');
                  return d >= dateFromFilter;
                });
              }
              if (dateToFilter) {
                filtered = filtered.filter(c => {
                  const d = c.subscriptionDetails?.startDate || (c.createdAt?.toDate ? c.createdAt.toDate().toISOString().slice(0, 10) : typeof c.createdAt === 'string' ? c.createdAt.slice(0, 10) : '');
                  return d <= dateToFilter;
                });
              }

              const totalPagesSub = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
              const validPageSub = Math.min(Math.max(1, currentPageSubscribed), totalPagesSub);
              const startIndexSub = (validPageSub - 1) * ITEMS_PER_PAGE;
              const paginatedSub = filtered.slice(startIndexSub, startIndexSub + ITEMS_PER_PAGE);

              return (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-emerald-900/90 text-white text-xs border-b border-emerald-800">
                          <th className="p-3.5 text-center">رقم الهاتف</th>
                          <th className="p-3.5">اسم العميل</th>
                          <th className="p-3.5 text-center">الموظف المسؤول</th>
                          <th className="p-3.5 text-center">نوع الخدمة / الباقة</th>
                          <th className="p-3.5 text-center">فترة الاشتراك</th>
                          <th className="p-3.5 text-center">حالة الدفع والمبلغ</th>
                          <th className="p-3.5 text-center">الإجراءات وتفاصيل الاشتراك</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {paginatedSub.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="p-10 text-center text-gray-500 font-bold">
                              لا يوجد عملاء مشتركين يطابقون شروط البحث الحالية 🎉
                            </td>
                          </tr>
                        ) : (
                          paginatedSub.map((customer, idx) => {
                            const sub = customer.subscriptionDetails || {};
                            const hasCompleteSub = sub.startDate && sub.receiptProof;
                            const emp = employees.find(e => e.uid === customer.assignedToUid || e.email?.toLowerCase() === customer.assignedTo?.toLowerCase());
                            const empName = emp ? (emp.name || emp.username) : (customer.assignedTo === 'admin' || customer.assignedTo === 'الإدارة' ? '👑 الإدارة' : (customer.assignedTo || 'غير محدد'));

                            return (
                              <tr key={customer.id || idx} className="hover:bg-emerald-50/40 transition">
                                <td className="p-3.5 text-center font-mono font-bold text-gray-900" dir="ltr">
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    <span>{customer.phoneNumber || '—'}</span>
                                    {customer.phoneNumber && !isCoordinator && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCallViaMicroSip(customer.phoneNumber); }}
                                        className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_3px_10px_rgba(37,99,235,0.4)] hover:shadow-[0_5px_15px_rgba(37,99,235,0.6)] active:scale-95 border border-blue-300/40 rounded-lg px-2 py-0.5 text-[11px] font-black flex items-center gap-1 cursor-pointer transform hover:-translate-y-0.5 transition-all shrink-0"
                                        title="اتصال مباشر عبر MicroSIP 📞"
                                      >
                                        <PhoneCall size={12} className="animate-pulse" />
                                        <span>اتصال</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3.5 font-bold text-gray-800">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-black">
                                      {startIndexSub + idx + 1}
                                    </span>
                                    <span className="font-extrabold text-emerald-950">{customer.name || 'عميل مشترك'}</span>
                                  </div>
                                </td>
                                <td className="p-3.5 text-center font-bold text-purple-900">
                                  {(isAdmin || isCoordinator || isLeader) ? (
                                    <select 
                                      value={isLeadWithAdmin(customer) ? "admin" : customer.assignedToUid}
                                      onChange={async (e) => {
                                        const uid = e.target.value;
                                        const prevEmpName = employees.find(x => x.uid === customer.assignedToUid || x.email === customer.assignedTo)?.name || '👑 الإدارة';
                                        const assignerDisplay = isAdmin ? '👑 الإدارة' : isLeader ? `👑 ليدر الفريق (${currentEmpUser?.name || 'ليدر'})` : `📋 منسق للإدارة (${currentEmpUser?.name || 'منسق'})`;
                                        
                                        if (uid === 'admin') {
                                          const logObj = createAssignmentLog(prevEmpName, '👑 الإدارة', assignerDisplay);
                                          await updateDoc(doc(db, 'leads_crm', customer.id), { assignedToUid: 'admin', assignedTo: 'الإدارة', assignmentHistory: arrayUnion(logObj) }).catch(() => {});
                                          await updateDoc(doc(db, 'employee_leads', customer.id), { assignedToUid: 'admin', assignedTo: 'الإدارة', assignmentHistory: arrayUnion(logObj) }).catch(() => {});
                                          toast.success('تم تعيين العميل إلى الإدارة 👑');
                                        } else {
                                          const targetEmp = employees.find(x => x.uid === uid);
                                          const logObj = createAssignmentLog(prevEmpName, `👤 ${targetEmp?.name}`, assignerDisplay);
                                          await updateDoc(doc(db, 'leads_crm', customer.id), { assignedToUid: uid, assignedTo: targetEmp?.email || '', assignmentHistory: arrayUnion(logObj) }).catch(() => {});
                                          await updateDoc(doc(db, 'employee_leads', customer.id), { assignedToUid: uid, assignedTo: targetEmp?.email || '', assignmentHistory: arrayUnion(logObj) }).catch(() => {});
                                          toast.success(`تم إسناد العميل إلى ${targetEmp?.name}`);
                                        }
                                      }}
                                      className="border border-emerald-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500 bg-white shadow-xs cursor-pointer"
                                    >
                                      {isLeader ? (
                                        <>
                                          <option value={currentUser?.uid}>👤 نفسي ({currentEmpUser?.name || 'الليدر'})</option>
                                          {myTeamMembers.map(empItem => (
                                            <option key={empItem.uid} value={empItem.uid}>👤 {empItem.name}</option>
                                          ))}
                                        </>
                                      ) : (
                                        <>
                                          <option value="admin">👑 الإدارة</option>
                                          {employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator').map(empItem => (
                                            <option key={empItem.uid} value={empItem.uid}>👤 {empItem.name}</option>
                                          ))}
                                        </>
                                      )}
                                    </select>
                                  ) : (
                                    <span>👤 {empName}</span>
                                  )}
                                </td>
                                <td className="p-3.5 text-center">
                                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-black px-2.5 py-1 rounded-full text-[11px]">
                                    {sub.serviceType || 'الباقة السنوية'}
                                  </span>
                                </td>
                                <td className="p-3.5 text-center font-mono text-[11px]">
                                  {sub.startDate && sub.endDate ? (
                                    <div className="text-gray-700 font-bold">
                                      <span>{sub.startDate}</span>
                                      <span className="mx-1 text-emerald-600">➔</span>
                                      <span>{sub.endDate}</span>
                                    </div>
                                  ) : (
                                    <span className="text-rose-500 font-bold">غير مسجل ⚠️</span>
                                  )}
                                </td>
                                <td className="p-3.5 text-center">
                                  {sub.paymentType ? (
                                    <span className="bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 rounded font-bold text-[11px]">
                                      {sub.paymentType === 'full' ? `كامل (${sub.paidAmount || '0'})` : sub.paymentType === 'percentage' ? `نسبة (${sub.paidAmount || '0'})` : `جزء (${sub.paidAmount || '0'} / باقي: ${sub.remainingAmount || '0'})`}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs font-medium">غير محدد</span>
                                  )}
                                </td>
                                <td className="p-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    {/* Glassmorphic Subscription Details Button */}
                                    <button 
                                      onClick={() => openSubscriptionModal(customer)}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 ${
                                        hasCompleteSub 
                                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 border border-emerald-500/50 backdrop-blur-md'
                                          : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-800 border border-rose-500/50 backdrop-blur-md animate-pulse'
                                      }`}
                                      title={hasCompleteSub ? "عرض وتعديل بيانات واشتراك العميل" : "يرجى ملء بيانات الاشتراك وإشعار التحويل"}
                                    >
                                      <CreditCard size={14} className={hasCompleteSub ? "text-emerald-700" : "text-rose-600"} />
                                      <span>{hasCompleteSub ? 'بيانات الاشتراك (مسجلة ✓)' : 'بيانات الاشتراك (ناقصة ⚠️)'}</span>
                                    </button>

                                    {/* Comment Button */}
                                    <button 
                                      onClick={() => handleOpenNotesModal(customer)}
                                      className="bg-amber-100/90 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold px-2.5 py-1.5 rounded-xl text-xs transition flex items-center gap-1 shadow-xs cursor-pointer"
                                      title="عرض وإضافة ملاحظات وتقارير العميل"
                                    >
                                      <FileText size={12} className="text-amber-700" />
                                      <span>Comment</span>
                                      {customer.notesHistory?.length > 0 && (
                                        <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[9px] font-black flex items-center justify-center">
                                          {customer.notesHistory.length}
                                        </span>
                                      )}
                                    </button>

                                    {/* WhatsApp 3D Action Button */}
                                    {hasWhatsappPermission && customer.phoneNumber && (
                                      <button 
                                        onClick={() => handleOpenWhatsAppChat(customer)}
                                        className="relative group overflow-hidden bg-gradient-to-r from-[#25D366] via-[#1EBE5D] to-[#128C7E] text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-[0_4px_12px_rgba(37,211,102,0.35)] hover:shadow-[0_6px_18px_rgba(37,211,102,0.5)] border border-emerald-300/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                        title="فتح المحادثة الفورية عبر واتساب"
                                      >
                                        <img 
                                          src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
                                          alt="WhatsApp" 
                                          className="w-4 h-4 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
                                        />
                                        <span>WhatsApp</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Subscribed Pagination */}
                  {filtered.length > ITEMS_PER_PAGE && (
                    <div className="px-6 py-4 border-t border-emerald-100 bg-emerald-50/40 flex flex-wrap justify-between items-center gap-3">
                      <div className="text-xs font-bold text-emerald-950">
                        عرض <span className="text-emerald-700 font-black">{startIndexSub + 1}</span> إلى <span className="text-emerald-700 font-black">{Math.min(startIndexSub + ITEMS_PER_PAGE, filtered.length)}</span> من إجمالي <span className="text-emerald-700 font-black">{filtered.length}</span> مشترك
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setCurrentPageSubscribed(prev => Math.max(prev - 1, 1));
                            tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          disabled={validPageSub === 1}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-white border border-emerald-200 text-emerald-950 shadow-sm hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          ◀ السابق
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPagesSub }, (_, i) => i + 1)
                            .filter(page => page === 1 || page === totalPagesSub || Math.abs(page - validPageSub) <= 2)
                            .map((page) => (
                              <button
                                key={page}
                                onClick={() => {
                                  setCurrentPageSubscribed(page);
                                  tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className={`w-7 h-7 rounded-lg text-xs font-black transition flex items-center justify-center cursor-pointer ${
                                  validPageSub === page
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'bg-white text-emerald-950 border border-emerald-200 hover:bg-emerald-50'
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                        </div>

                        <button
                          onClick={() => {
                            setCurrentPageSubscribed(prev => Math.min(prev + 1, totalPagesSub));
                            tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          disabled={validPageSub === totalPagesSub}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-white border border-emerald-200 text-emerald-950 shadow-sm hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
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

              {isAdmin && selectedCustomers.length > 0 && (
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
                  } else if (selectedEmpFilter === 'admin') {
                    if (c.assignedToUid && c.assignedToUid !== 'admin' && !isAdminIdentifier(c.assignedTo)) return false;
                  } else {
                    const emp = employees.find(e => e.uid === selectedEmpFilter);
                    if (c.assignedToUid !== selectedEmpFilter && c.assignedTo !== emp?.email) return false;
                  }
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
                      <div className="flex items-center gap-2">
                        <span>{customer.phoneNumber}</span>
                        {!isCoordinator && customer.phoneNumber && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCallViaMicroSip(customer.phoneNumber); }}
                            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_3px_10px_rgba(37,99,235,0.4)] hover:shadow-[0_5px_15px_rgba(37,99,235,0.6)] active:scale-95 border border-blue-300/40 rounded-lg px-2 py-1 text-[11px] font-black flex items-center gap-1 cursor-pointer transform hover:-translate-y-0.5 transition-all shrink-0"
                            title="اتصال مباشر عبر MicroSIP 📞"
                          >
                            <PhoneCall size={12} className="animate-pulse" />
                            <span>اتصال</span>
                          </button>
                        )}
                      </div>
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
                      {(isAdmin || isCoordinator || isLeader) ? (
                        <select 
                          value={customer.assignedToUid || ""}
                          onChange={(e) => handleAssignCustomer(customer.id, e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-800 w-full focus:outline-none focus:border-blue-500 bg-white/70 shadow-sm cursor-pointer mb-1"
                        >
                          <option value="" disabled>-- سحب أو تعيين --</option>
                          {isLeader ? (
                            <>
                              <option value={currentUser?.uid}>👤 نفسي (الليدر: {currentEmpUser?.name || 'أنا'})</option>
                              {myTeamMembers.map(emp => (
                                <option key={emp.uid} value={emp.uid}>
                                  👤 {emp.name} (عضو فريقي)
                                </option>
                              ))}
                            </>
                          ) : (
                            <>
                              <option value="admin">👑 الإدارة (الإدارة)</option>
                              {employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(emp => (
                                <option key={emp.uid} value={emp.uid}>
                                  👤 {emp.name} ({emp.jobTitle === 'Leader' ? '👑 Leader' : 'Agent'}{emp.leaderName ? ` - فريق ${emp.leaderName}` : ''})
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      ) : (
                        <span className="inline-block text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-bold">
                          👤 مخصص لك
                        </span>
                      )}
                      {customer.assignedAt && <span className="block text-xs text-gray-400" dir="ltr">{formatDate(customer.assignedAt)}</span>}
                    </td>
                    <td className="p-4 flex items-center gap-1.5 justify-center">
                      <button 
                        onClick={() => handleOpenNotesModal(customer)}
                        className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center whitespace-nowrap shadow-sm cursor-pointer"
                        title="Comment"
                      >
                        <FileText size={14} className="ml-1" /> Comment
                      </button>
                      {!isCoordinator && (isAdmin || customer.assignedToUid === currentUser?.uid || customer.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase()) && (
                        <button 
                          onClick={() => navigate('/inbox', { state: { selectedCustomerId: customer.id } })}
                          className="bg-gradient-to-tr from-emerald-600 via-green-500 to-emerald-400 hover:from-emerald-500 hover:to-green-400 text-white px-2.5 py-1.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-[0_3px_10px_rgba(16,185,129,0.4)] hover:shadow-[0_4px_14px_rgba(16,185,129,0.6)] active:scale-95 cursor-pointer border border-emerald-300/40 whitespace-nowrap"
                          title="مراسلة عبر واتساب"
                        >
                          <MessageCircle size={15} className="drop-shadow-sm fill-white/20" />
                          <span className="text-[11px] font-black">WhatsApp</span>
                        </button>
                      )}
                      {isAdmin && (
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
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-gray-800">قائمة الموظفين وإدارة الصلاحيات</h2>

                {/* Admin Master Emergency System Lock Button */}
                {isAdmin && (
                  <button
                    onClick={handleToggleGlobalLock}
                    disabled={isTogglingLock}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer border ${
                      isSystemLocked
                        ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse'
                        : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-emerald-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                    }`}
                    title={isSystemLocked ? "النظام مغلق حالياً على الموظفين - انقر لإعادة الفتح" : "النظام مفتوح حالياً - انقر لإغلاقه وطردهم فوراً"}
                  >
                    <span className="text-sm">
                      {isSystemLocked ? '🔒' : '🔓'}
                    </span>
                    <span>
                      {isSystemLocked
                        ? '🔴 النظام مغلق على الموظفين (انقر للفتح)'
                        : '🟢 إغلاق النظام عن جميع الموظفين'}
                    </span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <input type="text" placeholder="ابحث باسم الموظف..." value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-52 bg-gray-100 text-gray-800 placeholder-gray-400 border border-gray-200 rounded-full py-1.5 pr-8 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                  />
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                </div>
                {isAdmin && selectedEmployees.length > 0 && (
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
                    <th className="p-4 font-semibold text-gray-600 text-sm">الفريق / المشرف</th>
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
                    const teamMembersCount = employees.filter(e => e.leaderUid === emp.uid).length;
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
                        <td className="p-4 text-xs">
                          {emp.jobTitle === 'Leader' ? (
                            <span className="bg-amber-50 text-amber-900 border border-amber-300 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 w-fit shadow-xs">
                              <span>🌟</span>
                              <span>ليدر ({teamMembersCount} موظف)</span>
                            </span>
                          ) : emp.leaderUid ? (
                            <div className="flex flex-col gap-1">
                              <span className="bg-purple-50 text-purple-900 border border-purple-200 font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 w-fit">
                                <span>👑</span>
                                <span>{employees.find(l => l.uid === emp.leaderUid)?.name || emp.leaderName || 'فريق الليدر'}</span>
                              </span>
                              {emp.leaderAssignedAt && (
                                <span className="text-[10px] text-purple-700 font-mono flex items-center gap-1" title="تاريخ ووقت التعيين تحت هذا الليدر">
                                  <span>⏱️</span>
                                  <span dir="ltr">{formatDate(emp.leaderAssignedAt)}</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-gray-400 font-medium text-[11px]">مباشر للإدارة</span>
                              {emp.leaderAssignedAt && (
                                <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1" title="تاريخ التحويل إلى الإدارة">
                                  <span>⏱️</span>
                                  <span dir="ltr">{formatDate(emp.leaderAssignedAt)}</span>
                                </span>
                              )}
                            </div>
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
                                setEditEmpLeaderUid(emp.leaderUid || '');
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
                {isAdmin && selectedVisitors.length > 0 && (
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
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteSingleVisitor({ source: 'موقع الويب', id: visitor.id, name: `${visitor.firstName || ''} ${visitor.lastName || ''}`, _raw: visitor })}
                            className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 p-2 rounded-lg transition shadow-sm"
                            title="حذف ونقل إلى سلة المهملات"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
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
                {isAdmin && selectedVisitors.length > 0 && (
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
                    {isAdmin && (
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
                    )}
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
                          {isAdmin && (
                            <td className="p-4 text-center">
                              <input 
                                type="checkbox" 
                                checked={selectedVisitors.includes(visitor.id)} 
                                onChange={() => toggleVisitorSelection(visitor.id)} 
                                className="w-4 h-4 text-primary rounded" 
                              />
                            </td>
                          )}
                          <td className="p-4">
                            <p className="text-sm font-bold text-gray-800">{visitor.name || 'غير معروف'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-gray-500 font-mono" dir="ltr">{visitor.phone}</p>
                              {!isCoordinator && visitor.phone && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCallViaMicroSip(visitor.phone); }}
                                  className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_3px_10px_rgba(37,99,235,0.4)] hover:shadow-[0_5px_15px_rgba(37,99,235,0.6)] active:scale-95 border border-blue-300/40 rounded-lg px-2 py-0.5 text-[11px] font-black flex items-center gap-1 cursor-pointer transform hover:-translate-y-0.5 transition-all shrink-0"
                                  title="اتصال مباشر عبر MicroSIP 📞"
                                >
                                  <PhoneCall size={12} className="animate-pulse" />
                                  <span>اتصال</span>
                                </button>
                              )}
                            </div>
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
                                className="bg-gradient-to-tr from-emerald-600 via-green-500 to-emerald-400 hover:from-emerald-500 hover:to-green-400 text-white px-2.5 py-1.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-[0_3px_10px_rgba(16,185,129,0.4)] hover:shadow-[0_4px_14px_rgba(16,185,129,0.6)] active:scale-95 cursor-pointer border border-emerald-300/40 whitespace-nowrap"
                                title="مراسلة عبر واتساب"
                              >
                                <MessageCircle size={14} className="drop-shadow-sm fill-white/20" />
                                <span className="text-[11px] font-black">WhatsApp</span>
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteSingleVisitor(visitor)}
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
                {newEmpJobTitle === 'Agent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المشرف / الليدر التابع له (Direct Leader)</label>
                    <select 
                      value={newEmpLeaderUid}
                      onChange={(e) => setNewEmpLeaderUid(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition font-bold text-xs"
                    >
                      <option value="">-- بدون ليدر (مباشر للإدارة) --</option>
                      {employees.filter(e => (e.jobTitle === 'Leader' || e.jobTitle === 'ليدر' || e.role === 'leader') && e.role !== 'admin').map(ldr => (
                        <option key={ldr.uid} value={ldr.uid}>
                          👑 {ldr.name} ({ldr.username || ldr.empCode || 'ليدر'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                {editEmpJobTitle === 'Agent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المشرف / الليدر التابع له (Direct Leader)</label>
                    <select 
                      value={editEmpLeaderUid}
                      onChange={(e) => setEditEmpLeaderUid(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-bold text-xs"
                    >
                      <option value="">-- بدون ليدر (مباشر للإدارة) --</option>
                      {employees.filter(e => (e.jobTitle === 'Leader' || e.jobTitle === 'ليدر' || e.role === 'leader') && e.role !== 'admin' && e.uid !== editEmp.uid).map(ldr => (
                        <option key={ldr.uid} value={ldr.uid}>
                          👑 {ldr.name} ({ldr.username || ldr.empCode || 'ليدر'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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

        {/* Modal 1: Import Leads (Excel, GSheet, Text/Screenshot, Manual) */}
        {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsImportModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setIsImportModalOpen(false)} 
                className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition"
              >
                <X size={24} />
              </button>

              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Upload className="text-emerald-600" size={26} />
                  <span>📁 إضافة واستيراد داتا مضافة بواسطة الموظف</span>
                </h2>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  {!isAdmin && !isCoordinator ? (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                      👤 سيتم حفظ البيانات في قسم (داتا مضافة بواسطة الموظف) وتظهر في كارتك الخاص لتتمكن من متابعتها ومراسلتها فوراً
                    </span>
                  ) : (
                    <span className="text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block">
                      👑 يتم حفظ البيانات في قسم (داتا مضافة بواسطة الموظف) مع إمكانية تتبع وفلترة كل موظف
                    </span>
                  )}
                </p>
              </div>

              {/* Import Tabs */}
              <div className="flex border-b border-gray-200 mb-6 gap-2 overflow-x-auto pb-1">
                <button 
                  onClick={() => setImportTab('file')}
                  className={`pb-2 px-3.5 font-bold text-xs sm:text-sm transition border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${importTab === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <FileSpreadsheet size={16} /> رفع ملف Excel / CSV
                </button>
                <button 
                  onClick={() => setImportTab('gsheet')}
                  className={`pb-2 px-3.5 font-bold text-xs sm:text-sm transition border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${importTab === 'gsheet' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <Share2 size={16} /> رابط Google Sheet
                </button>
                <button 
                  onClick={() => setImportTab('text')}
                  className={`pb-2 px-3.5 font-bold text-xs sm:text-sm transition border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${importTab === 'text' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <FileText size={16} /> استخراج من صور / نص
                </button>
                <button 
                  onClick={() => setImportTab('manual')}
                  className={`pb-2 px-3.5 font-bold text-xs sm:text-sm transition border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${importTab === 'manual' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <UserPlus size={16} /> إضافة يدوية مباشرة
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
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    {importLoading ? 'جاري التحميل...' : '🔗 جلب البيانات من Google Sheet'}
                  </button>
                </div>
              )}

              {/* Tab 3: Text & PDF / Screenshot Extractor */}
              {importTab === 'text' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">الصق النص المنسوخ من شيت أو سكرين شوت أو محادثة</label>
                    <textarea 
                      rows={5}
                      placeholder="انسخ النص أو الأرقام من أي شيت أو سكرين شوت أو محادثة والصقه هنا... سيستخرج النظام أرقام الجوال والأسماء تلقائياً بدقة."
                      value={rawImportText}
                      onChange={(e) => setRawImportText(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg text-xs outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <button 
                    onClick={handleTextExtract}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    🔍 استخراج الأرقام والأسماء تلقائياً الآن
                  </button>
                </div>
              )}

              {/* Tab 4: Manual Direct Lead Entry */}
              {importTab === 'manual' && (
                <form onSubmit={handleAddManualLeadToImport} className="space-y-3 bg-amber-50/40 p-4 rounded-xl border border-amber-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">اسم العميل</label>
                      <input 
                        type="text" 
                        placeholder="مثال: أحمد محمد"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-amber-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">رقم الهاتف (مع أو بدون كود الدولة)</label>
                      <input 
                        type="tel" 
                        placeholder="مثال: 01012345678 أو 966501234567"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-mono outline-none focus:border-amber-500 bg-white"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات العميل (اختياري)</label>
                    <input 
                      type="text" 
                      placeholder="مثال: مهتم بالباقة السنوية / تواصل لاحقاً"
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-amber-500 bg-white"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold py-2 px-4 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm text-xs cursor-pointer"
                  >
                    <span>+ إضافة العميل إلى قائمة المعاينة ↵</span>
                  </button>
                </form>
              )}

              {/* Preview extracted leads */}
              {importRows.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-green-700">معاينة البيانات ({importRows.length} عميل جاهز للحفظ):</span>
                    <button 
                      onClick={() => setImportRows([])}
                      className="text-xs text-red-500 hover:underline cursor-pointer"
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
                    className="w-full bg-primary hover:bg-green-600 text-white font-black py-3 px-4 rounded-xl transition mt-4 shadow-lg text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {importLoading ? 'جاري التخزين...' : `✅ حفظ الـ ${importRows.length} عميل في قسم (داتا مضافة بواسطة الموظف)`}
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

              <h2 className="text-lg font-black text-gray-800 mb-3 flex items-center gap-2 border-b pb-3">
                <UserCheck2 className="text-purple-600" size={24} />
                <span>⚖️ توزيع العملاء المحددين</span>
              </h2>

              {/* Selected Count Banner */}
              <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white p-4 rounded-xl mb-4 shadow-md flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <CheckSquare size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-xs text-purple-200 block font-bold">عدد العملاء المحددين للتوزيع:</span>
                    <span className="text-lg font-black text-cyan-300">{selectedLeadsCrm.length} عميل محدد</span>
                  </div>
                </div>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-1 rounded-full font-bold">
                  جاهز للتوزيع
                </span>
              </div>

              {/* Target Employee Selection */}
              <div className="space-y-2 mb-5">
                <label className="block text-xs font-bold text-gray-700">
                  {isLeader ? 'اختر الموظف المستلم من فريقك:' : 'اختر الموظف المسؤول المستلم:'}
                </label>
                <select 
                  value={singleAssignEmpUid}
                  onChange={(e) => setSingleAssignEmpUid(e.target.value)}
                  className="w-full p-3 border border-purple-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-purple-500 bg-purple-50/40 cursor-pointer shadow-inner"
                >
                  <option value="">-- اختر الموظف المستلم --</option>
                  {isLeader ? (
                    <>
                      <option value={currentUser?.uid}>👤 نفسي (الليدر: {currentEmpUser?.name || 'أنا'})</option>
                      {myTeamMembers.map(emp => (
                        <option key={emp.uid} value={emp.uid}>
                          👤 {emp.name} (عضو فريقي)
                        </option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value="admin">👑 الإدارة (إرجاع كداتا غير موزعة)</option>
                      {employees.filter(e => e.role !== 'admin' && e.jobTitle !== 'Coordinator' && e.role !== 'coordinator').map(emp => (
                        <option key={emp.uid} value={emp.uid}>
                          👤 {emp.name} ({emp.jobTitle === 'Leader' ? '👑 Leader' : 'Agent'}{emp.leaderName ? ` - فريق ${emp.leaderName}` : ''})
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  💡 سيتم تحويل العملاء المحددين إلى الموظف المختار وتحديث حالتهم لتبدأ المتابعة في قائمة الانتظار.
                </p>
              </div>

              <button 
                onClick={handleExecuteAssignment}
                disabled={assignLoading || selectedLeadsCrm.length === 0 || !singleAssignEmpUid}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black py-3 px-4 rounded-xl transition shadow-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {assignLoading ? 'جاري التحويل والتحديث...' : `🚀 تنفيذ وتحديث التوزيع الآن (${selectedLeadsCrm.length} عميل)`}
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

              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <FileText className="text-amber-600" size={24} />
                <span>تقرير وملاحظات العميل</span>
              </h2>

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
                        const isNoteByAdmin = !note.author || isAdminIdentifier(note.author);
                        const authorDisplay = isNoteByAdmin ? '👑 الإدارة' : sanitizeDisplayName(note.author);

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

        {/* Modal 4: Leads CRM Analysis (Performance Dashboard for Admin, Leader & Employee) */}
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
                      {isLeader && <span className="text-xs bg-purple-500/30 text-purple-200 border border-purple-400/40 px-2.5 py-0.5 rounded-full font-bold">فريق العمل</span>}
                    </h2>
                    <p className="text-xs text-purple-300 font-medium">
                      {isAdmin 
                        ? 'تقرير كفاءة وأداء جميع الموظفين والليدرز ونسبة تحويل العملاء' 
                        : isCoordinator 
                        ? 'تقرير كفاءة وأداء جميع الموظفين ونسبة تحويل العملاء (منسق)'
                        : isLeader 
                        ? `تقرير كفاءة وأداء أعضاء فريقك (${myTeamMembers.length} موظف) ونسبة التحويل`
                        : 'تقرير تحليلي لكفاءة الأداء وإحصائيات العملاء الخاصة بك'}
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
                {/* Information Guide Banner */}
                <div className="bg-purple-950/60 border border-purple-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-purple-200 shadow-inner">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💡</span>
                    <span>
                      <strong>طريقة احتساب التحليلات:</strong> نسبة النجاح تُحسب بناءً على تحويل العملاء من حالة (في الانتظار) إلى حالات التفاعل الإيجابي (🌟 مهتم / 🚀 بدأ تجربة / 🎉 تم الاشتراك). بمجرد قيام الموظف بتغيير حالة العميل يتم تحديث النسب فورياً.
                    </span>
                  </div>
                </div>

                {isAgent ? (
                  /* --- 1. AGENT INDIVIDUAL ANALYSIS --- */
                  (() => {
                    const getStatus = (c) => (c.crmStatus && c.crmStatus !== 'assigned') ? c.crmStatus : 'unassigned';

                    // Combine assigned Leads CRM + Employee Added Leads for this agent
                    const empCrmLeads = leadsCrm.filter(c => c.assignedToUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase());
                    const empAddedLeads = employeeLeads.filter(c => c.assignedToUid === currentUser?.uid || c.addedByUid === currentUser?.uid || c.assignedTo?.toLowerCase() === currentUser?.email?.toLowerCase());
                    const empLeads = [...empCrmLeads, ...empAddedLeads];

                    const total = empLeads.length;
                    const subscribed = empLeads.filter(c => getStatus(c) === 'subscribed').length;
                    const trial = empLeads.filter(c => getStatus(c) === 'started_trial').length;
                    const interested = empLeads.filter(c => getStatus(c) === 'interested').length;
                    const noAnswer = empLeads.filter(c => getStatus(c) === 'no_answer').length;
                    const notInterested = empLeads.filter(c => getStatus(c) === 'not_interested').length;
                    const pending = empLeads.filter(c => getStatus(c) === 'unassigned').length;

                    const successfulCount = subscribed + trial + interested;
                    const contactedCount = total - pending;
                    const successRate = total > 0 ? Math.round((successfulCount / total) * 100) : 0;
                    const interactionRate = total > 0 ? Math.round((contactedCount / total) * 100) : 0;

                    return (
                      <div className="space-y-5">
                        {/* Overall Score Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 p-4 rounded-2xl border border-purple-500/40 shadow-xl">
                            <span className="text-xs text-purple-300 font-bold block mb-1">إجمالي داتا المتابعة (موزع + مضاف):</span>
                            <span className="text-2xl font-black text-white">{total} عميل</span>
                            <span className="text-[11px] text-purple-400 font-medium block mt-0.5" dir="rtl">
                              ({empCrmLeads.length.toLocaleString()} موزع + {empAddedLeads.length.toLocaleString()} مضاف)
                            </span>
                          </div>

                          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-4 rounded-2xl border border-indigo-500/40 shadow-xl text-center sm:text-right">
                            <span className="text-xs text-indigo-200 font-bold block mb-1">معدل النجاح والتفاعل الإيجابي 📈</span>
                            <span className={`text-3xl font-black ${successRate >= 50 ? 'text-emerald-400' : successRate >= 25 ? 'text-amber-400' : 'text-rose-400'}`}>
                              {successRate}%
                            </span>
                            <span className="text-[11px] text-purple-300 font-medium block mt-0.5" dir="rtl">
                              ({successfulCount} ناجح من {total})
                            </span>
                          </div>

                          <div className="bg-gradient-to-r from-teal-950 to-slate-900 p-4 rounded-2xl border border-teal-500/40 shadow-xl text-center sm:text-right">
                            <span className="text-xs text-teal-200 font-bold block mb-1">معدل المتابعة والتواصل 📞</span>
                            <span className="text-3xl font-black text-teal-300">
                              {interactionRate}%
                            </span>
                            <span className="text-[11px] text-teal-400 font-medium block mt-0.5" dir="rtl">
                              ({contactedCount} تم التواصل معهم)
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-purple-200">
                            <span>مؤشر التفاعل والإنجاز</span>
                            <span>{successfulCount} من {total} عميل ناجح ({successRate}%)</span>
                          </div>
                          <div className="h-3.5 w-full bg-slate-800 rounded-full overflow-hidden border border-purple-500/30 flex">
                            <div style={{ width: `${total > 0 ? (subscribed / total) * 100 : 0}%` }} className="bg-purple-500 h-full" title={`تم الاشتراك: ${subscribed}`}></div>
                            <div style={{ width: `${total > 0 ? (trial / total) * 100 : 0}%` }} className="bg-cyan-400 h-full" title={`بدأ تجربة: ${trial}`}></div>
                            <div style={{ width: `${total > 0 ? (interested / total) * 100 : 0}%` }} className="bg-emerald-500 h-full" title={`مهتم: ${interested}`}></div>
                            <div style={{ width: `${total > 0 ? (noAnswer / total) * 100 : 0}%` }} className="bg-amber-500 h-full" title={`لم يرد: ${noAnswer}`}></div>
                            <div style={{ width: `${total > 0 ? (notInterested / total) * 100 : 0}%` }} className="bg-rose-500 h-full" title={`غير مهتم: ${notInterested}`}></div>
                          </div>
                        </div>

                        {/* Status Grid Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="bg-purple-900/40 p-4 rounded-xl border border-purple-500/40">
                            <span className="text-xs text-purple-300 font-bold block mb-1">🎉 تم الاشتراك</span>
                            <span className="text-2xl font-black text-purple-300">{subscribed}</span>
                            <span className="text-[10px] text-purple-400 font-mono block mt-1">({total > 0 ? ((subscribed/total)*100).toFixed(1) : 0}%)</span>
                          </div>

                          <div className="bg-cyan-900/40 p-4 rounded-xl border border-cyan-500/40">
                            <span className="text-xs text-cyan-300 font-bold block mb-1">🚀 بدأ تجربة بالفعل</span>
                            <span className="text-2xl font-black text-cyan-300">{trial}</span>
                            <span className="text-[10px] text-cyan-400 font-mono block mt-1">({total > 0 ? ((trial/total)*100).toFixed(1) : 0}%)</span>
                          </div>

                          <div className="bg-emerald-900/40 p-4 rounded-xl border border-emerald-500/40">
                            <span className="text-xs text-emerald-300 font-bold block mb-1">🌟 مهتم</span>
                            <span className="text-2xl font-black text-emerald-300">{interested}</span>
                            <span className="text-[10px] text-emerald-400 font-mono block mt-1">({total > 0 ? ((interested/total)*100).toFixed(1) : 0}%)</span>
                          </div>

                          <div className="bg-amber-900/40 p-4 rounded-xl border border-amber-500/40">
                            <span className="text-xs text-amber-300 font-bold block mb-1">📵 لم يرد</span>
                            <span className="text-2xl font-black text-amber-300">{noAnswer}</span>
                            <span className="text-[10px] text-amber-400 font-mono block mt-1">({total > 0 ? ((noAnswer/total)*100).toFixed(1) : 0}%)</span>
                          </div>

                          <div className="bg-rose-900/40 p-4 rounded-xl border border-rose-500/40">
                            <span className="text-xs text-rose-300 font-bold block mb-1">❌ غير مهتم</span>
                            <span className="text-2xl font-black text-rose-300">{notInterested}</span>
                            <span className="text-[10px] text-rose-400 font-mono block mt-1">({total > 0 ? ((notInterested/total)*100).toFixed(1) : 0}%)</span>
                          </div>

                          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <span className="text-xs text-slate-300 font-bold block mb-1">⏳ في الانتظار</span>
                            <span className="text-2xl font-black text-slate-200">{pending}</span>
                            <span className="text-[10px] text-slate-400 font-mono block mt-1">({total > 0 ? ((pending/total)*100).toFixed(1) : 0}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : isLeader ? (
                  /* --- 2. LEADER TEAM PERFORMANCE ANALYSIS --- */
                  (() => {
                    const getStatus = (c) => (c.crmStatus && c.crmStatus !== 'assigned') ? c.crmStatus : 'unassigned';
                    const teamUids = [currentUser?.uid, ...myTeamMembers.map(e => e.uid)];
                    const teamEmails = [currentUser?.email?.toLowerCase(), ...myTeamMembers.map(e => e.email?.toLowerCase())];
                    
                    const teamCrmLeads = leadsCrm.filter(c => teamUids.includes(c.assignedToUid) || teamEmails.includes(c.assignedTo?.toLowerCase()));
                    const teamEmpAddedLeads = employeeLeads.filter(c => teamUids.includes(c.assignedToUid) || teamUids.includes(c.addedByUid) || teamEmails.includes(c.assignedTo?.toLowerCase()) || (myTeamMembers.some(m => m.name && c.addedBy === m.name)));
                    const teamLeads = [...teamCrmLeads, ...teamEmpAddedLeads];
                    
                    const teamEmployeesData = [currentEmpUser, ...myTeamMembers].filter(Boolean).map(emp => {
                      const empCrm = leadsCrm.filter(c => c.assignedToUid === emp.uid || c.assignedTo?.toLowerCase() === emp.email?.toLowerCase());
                      const empAdded = employeeLeads.filter(c => c.assignedToUid === emp.uid || c.addedByUid === emp.uid || c.assignedTo?.toLowerCase() === emp.email?.toLowerCase() || (emp.name && c.addedBy === emp.name));
                      const empLeads = [...empCrm, ...empAdded];

                      const total = empLeads.length;
                      const subscribed = empLeads.filter(c => getStatus(c) === 'subscribed').length;
                      const trial = empLeads.filter(c => getStatus(c) === 'started_trial').length;
                      const interested = empLeads.filter(c => getStatus(c) === 'interested').length;
                      const noAnswer = empLeads.filter(c => getStatus(c) === 'no_answer').length;
                      const notInterested = empLeads.filter(c => getStatus(c) === 'not_interested').length;
                      const pending = empLeads.filter(c => getStatus(c) === 'unassigned').length;

                      const successfulCount = subscribed + trial + interested;
                      const contactedCount = total - pending;
                      const successRate = total > 0 ? Math.round((successfulCount / total) * 100) : 0;
                      const interactionRate = total > 0 ? Math.round((contactedCount / total) * 100) : 0;

                      return {
                        emp,
                        total,
                        crmCount: empCrm.length,
                        addedCount: empAdded.length,
                        subscribed,
                        trial,
                        interested,
                        noAnswer,
                        notInterested,
                        pending,
                        successfulCount,
                        contactedCount,
                        successRate,
                        interactionRate
                      };
                    });

                    // Sort team members by success rate & total
                    teamEmployeesData.sort((a,b) => b.successRate - a.successRate || b.total - a.total);

                    const totalTeamLeads = teamLeads.length;
                    const totalTeamSuccessful = teamLeads.filter(c => ['subscribed','started_trial','interested'].includes(getStatus(c))).length;
                    const totalTeamContacted = teamLeads.filter(c => getStatus(c) !== 'unassigned').length;
                    const overallTeamRate = totalTeamLeads > 0 ? Math.round((totalTeamSuccessful / totalTeamLeads) * 100) : 0;
                    const overallTeamContactRate = totalTeamLeads > 0 ? Math.round((totalTeamContacted / totalTeamLeads) * 100) : 0;
                    const topTeamMember = teamEmployeesData.find(e => e.total > 0);

                    return (
                      <div className="space-y-6">
                        {/* Team Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-4 rounded-2xl border border-purple-500/40">
                            <span className="text-xs text-purple-200 font-bold block mb-1">إجمالي داتا فريقك</span>
                            <span className="text-2xl font-black text-white">{totalTeamLeads.toLocaleString()} عميل</span>
                            <span className="text-[10px] text-purple-300 font-medium block mt-0.5" dir="rtl">
                              ({teamCrmLeads.length.toLocaleString()} موزع + {teamEmpAddedLeads.length.toLocaleString()} مضاف)
                            </span>
                          </div>

                          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-4 rounded-2xl border border-indigo-500/40">
                            <span className="text-xs text-indigo-200 font-bold block mb-1">معدل نجاح الفريق 📈</span>
                            <span className="text-2xl font-black text-emerald-400">{overallTeamRate}%</span>
                            <span className="text-[10px] text-purple-300 font-medium block mt-0.5" dir="rtl">
                              ({totalTeamSuccessful.toLocaleString()} ناجح من {totalTeamLeads.toLocaleString()})
                            </span>
                          </div>

                          <div className="bg-gradient-to-r from-teal-950 to-slate-900 p-4 rounded-2xl border border-teal-500/40">
                            <span className="text-xs text-teal-200 font-bold block mb-1">معدل متابعة الفريق 📞</span>
                            <span className="text-2xl font-black text-teal-300">{overallTeamContactRate}%</span>
                            <span className="text-[10px] text-teal-400 font-medium block mt-0.5" dir="rtl">
                              ({totalTeamContacted.toLocaleString()} تم التواصل)
                            </span>
                          </div>

                          <div className="bg-gradient-to-r from-amber-950 to-slate-900 p-4 rounded-2xl border border-amber-500/40">
                            <span className="text-xs text-amber-300 font-bold block mb-1">الموظف الأفضل أداءً 🏆</span>
                            <span className="text-lg font-black text-amber-300 truncate block">
                              {topTeamMember ? `${topTeamMember.emp.name} (${topTeamMember.successRate}%)` : 'لا يوجد'}
                            </span>
                          </div>
                        </div>

                        {/* Team Leaderboard Table */}
                        <div className="bg-slate-950 rounded-2xl border border-purple-500/20 overflow-hidden">
                          <div className="p-4 border-b border-purple-500/20 flex justify-between items-center bg-purple-950/40">
                            <h3 className="text-sm font-black text-purple-200">جدول أداء وكفاءة أعضاء فريقك</h3>
                            <span className="text-xs text-purple-300 font-bold">{teamEmployeesData.length} عضو</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-slate-900 text-purple-300 border-b border-slate-800">
                                <tr>
                                  <th className="p-3">عضو الفريق</th>
                                  <th className="p-3 text-center">إجمالي العملاء</th>
                                  <th className="p-3 text-center">نسبة النجاح</th>
                                  <th className="p-3 text-center">التواصل</th>
                                  <th className="p-3 text-center">🎉 اشتراك</th>
                                  <th className="p-3 text-center">🚀 تجربة</th>
                                  <th className="p-3 text-center">🌟 مهتم</th>
                                  <th className="p-3 text-center">📵 لم يرد</th>
                                  <th className="p-3 text-center">❌ غير مهتم</th>
                                  <th className="p-3 text-center">التقييم</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 text-slate-200">
                                {teamEmployeesData.map(({ emp, total, crmCount, addedCount, subscribed, trial, interested, noAnswer, notInterested, successRate, interactionRate }, i) => (
                                  <tr key={emp.uid || i} className="hover:bg-purple-900/20 transition">
                                    <td className="p-3 font-bold flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-purple-900 text-purple-200 flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                                      <span>{emp.name || emp.username}</span>
                                      {emp.uid === currentUser?.uid && (
                                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-1.5 py-0.2 rounded">أنت (الليدر)</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center font-black">
                                      <span>{total}</span>
                                      <span className="text-[10px] text-purple-400 block font-normal" dir="rtl">({crmCount} موزع + {addedCount} مضاف)</span>
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={`font-black ${successRate >= 50 ? 'text-emerald-400' : successRate >= 25 ? 'text-amber-400' : 'text-rose-400'}`}>
                                        {successRate}%
                                      </span>
                                    </td>
                                    <td className="p-3 text-center font-bold text-teal-300">{interactionRate}%</td>
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
                ) : (
                  /* --- 3. ADMIN / COORDINATOR ALL EMPLOYEES COMPREHENSIVE ANALYSIS + ADMIN LEADERS BREAKDOWN --- */
                  (() => {
                    const getStatus = (c) => (c.crmStatus && c.crmStatus !== 'assigned') ? c.crmStatus : 'unassigned';

                    // Distributed Leads from leads_crm (assigned to active employees)
                    const distributedCrmLeads = leadsCrm.filter(c => isLeadAssignedToEmployee(c));
                    
                    // Total Active Distributed & Employee-Added Leads
                    const totalDistributedLeads = distributedCrmLeads.length;
                    const totalEmpAddedLeads = employeeLeads.length;
                    const totalCompanyActiveLeads = totalDistributedLeads + totalEmpAddedLeads;

                    const allCompanyActiveLeads = [...distributedCrmLeads, ...employeeLeads];
                    const totalCompanySuccessful = allCompanyActiveLeads.filter(c => ['subscribed','started_trial','interested'].includes(getStatus(c))).length;
                    const totalCompanyContacted = allCompanyActiveLeads.filter(c => getStatus(c) !== 'unassigned').length;
                    const overallCompanyRate = totalCompanyActiveLeads > 0 ? Math.round((totalCompanySuccessful / totalCompanyActiveLeads) * 100) : 0;
                    const overallCompanyContactRate = totalCompanyActiveLeads > 0 ? Math.round((totalCompanyContacted / totalCompanyActiveLeads) * 100) : 0;

                    const allEmployeesData = employees.filter(emp => 
                      emp.role !== 'admin' && 
                      !adminEmails.includes(emp.email?.toLowerCase()) && 
                      emp.jobTitle !== 'Coordinator' && 
                      emp.jobTitle !== 'منسق للإدارة' && 
                      emp.role !== 'coordinator'
                    ).map(emp => {
                      const empCrm = leadsCrm.filter(c => c.assignedToUid === emp.uid || c.assignedTo?.toLowerCase() === emp.email?.toLowerCase());
                      const empAdded = employeeLeads.filter(c => c.assignedToUid === emp.uid || c.addedByUid === emp.uid || c.assignedTo?.toLowerCase() === emp.email?.toLowerCase() || (emp.name && c.addedBy === emp.name));
                      const empLeads = [...empCrm, ...empAdded];

                      const total = empLeads.length;
                      const subscribed = empLeads.filter(c => getStatus(c) === 'subscribed').length;
                      const trial = empLeads.filter(c => getStatus(c) === 'started_trial').length;
                      const interested = empLeads.filter(c => getStatus(c) === 'interested').length;
                      const noAnswer = empLeads.filter(c => getStatus(c) === 'no_answer').length;
                      const notInterested = empLeads.filter(c => getStatus(c) === 'not_interested').length;
                      const pending = empLeads.filter(c => getStatus(c) === 'unassigned').length;

                      const successfulCount = subscribed + trial + interested;
                      const contactedCount = total - pending;
                      const successRate = total > 0 ? Math.round((successfulCount / total) * 100) : 0;
                      const interactionRate = total > 0 ? Math.round((contactedCount / total) * 100) : 0;

                      return {
                        emp,
                        total,
                        crmCount: empCrm.length,
                        addedCount: empAdded.length,
                        subscribed,
                        trial,
                        interested,
                        noAnswer,
                        notInterested,
                        pending,
                        successfulCount,
                        contactedCount,
                        successRate,
                        interactionRate
                      };
                    });

                    // Sort employees by successRate & total leads
                    allEmployeesData.sort((a,b) => b.successRate - a.successRate || b.total - a.total);
                    const topEmp = allEmployeesData.find(e => e.total > 0);

                    // Leaders & Teams Performance Breakdown (for Admin)
                    const leadersList = employees.filter(e => (e.jobTitle === 'Leader' || e.jobTitle === 'ليدر' || e.role === 'leader') && e.role !== 'admin');
                    const leadersTeamData = leadersList.map(leader => {
                      const teamMembers = employees.filter(e => e.leaderUid === leader.uid);
                      const teamUids = [leader.uid, ...teamMembers.map(e => e.uid)];
                      const teamEmails = [leader.email?.toLowerCase(), ...teamMembers.map(e => e.email?.toLowerCase())];

                      const teamCrm = leadsCrm.filter(c => teamUids.includes(c.assignedToUid) || (c.assignedTo && teamEmails.includes(c.assignedTo?.toLowerCase())));
                      const teamAdded = employeeLeads.filter(c => teamUids.includes(c.assignedToUid) || teamUids.includes(c.addedByUid) || (c.assignedTo && teamEmails.includes(c.assignedTo?.toLowerCase())) || (teamMembers.some(tm => tm.name && c.addedBy === tm.name)) || (leader.name && c.addedBy === leader.name));
                      const teamLeads = [...teamCrm, ...teamAdded];

                      const total = teamLeads.length;
                      const subscribed = teamLeads.filter(c => getStatus(c) === 'subscribed').length;
                      const trial = teamLeads.filter(c => getStatus(c) === 'started_trial').length;
                      const interested = teamLeads.filter(c => getStatus(c) === 'interested').length;
                      const noAnswer = teamLeads.filter(c => getStatus(c) === 'no_answer').length;
                      const notInterested = teamLeads.filter(c => getStatus(c) === 'not_interested').length;
                      const pending = teamLeads.filter(c => getStatus(c) === 'unassigned').length;

                      const successfulCount = subscribed + trial + interested;
                      const contactedCount = total - pending;
                      const successRate = total > 0 ? Math.round((successfulCount / total) * 100) : 0;
                      const interactionRate = total > 0 ? Math.round((contactedCount / total) * 100) : 0;

                      return {
                        leader,
                        teamMembersCount: teamMembers.length,
                        total,
                        crmCount: teamCrm.length,
                        addedCount: teamAdded.length,
                        subscribed,
                        trial,
                        interested,
                        noAnswer,
                        notInterested,
                        successfulCount,
                        contactedCount,
                        successRate,
                        interactionRate
                      };
                    });
                    leadersTeamData.sort((a, b) => b.successRate - a.successRate || b.total - a.total);

                    return (
                      <div className="space-y-6">
                        {/* Company Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-4 rounded-2xl border border-purple-500/40">
                            <span className="text-xs text-purple-200 font-bold block mb-1">إجمالي الداتا للتقييم</span>
                            <span className="text-2xl font-black text-white">{totalCompanyActiveLeads.toLocaleString()} عميل</span>
                            <span className="text-[10px] text-purple-300 font-medium block mt-0.5" dir="rtl">
                              ({totalDistributedLeads.toLocaleString()} موزع + {totalEmpAddedLeads.toLocaleString()} مضاف)
                            </span>
                          </div>

                          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-4 rounded-2xl border border-indigo-500/40">
                            <span className="text-xs text-indigo-200 font-bold block mb-1">معدل نجاح الفريق العام 📈</span>
                            <span className="text-2xl font-black text-emerald-400">{overallCompanyRate}%</span>
                            <span className="text-[10px] text-purple-300 font-medium block mt-0.5" dir="rtl">
                              ({totalCompanySuccessful.toLocaleString()} ناجح من {totalCompanyActiveLeads.toLocaleString()})
                            </span>
                          </div>

                          <div className="bg-gradient-to-r from-teal-950 to-slate-900 p-4 rounded-2xl border border-teal-500/40">
                            <span className="text-xs text-teal-200 font-bold block mb-1">معدل التواصل العام 📞</span>
                            <span className="text-2xl font-black text-teal-300">{overallCompanyContactRate}%</span>
                            <span className="text-[10px] text-teal-400 font-medium block mt-0.5" dir="rtl">
                              ({totalCompanyContacted.toLocaleString()} تم التواصل)
                            </span>
                          </div>

                          <div className="bg-gradient-to-r from-amber-950 to-slate-900 p-4 rounded-2xl border border-amber-500/40">
                            <span className="text-xs text-amber-300 font-bold block mb-1">الموظف الأفضل أداءً 🏆</span>
                            <span className="text-lg font-black text-amber-300 truncate block">
                              {topEmp ? `${topEmp.emp.name} (${topEmp.successRate}%)` : 'لا يوجد'}
                            </span>
                            {topEmp && (
                              <span className="text-[10px] text-amber-200 font-medium block mt-0.5" dir="rtl">
                                ({topEmp.successfulCount} ناجح من {topEmp.total})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Admin & Coordinator Leaders & Teams Breakdown */}
                        {(isAdmin || isCoordinator) && leadersTeamData.length > 0 && (
                          <div className="bg-slate-950 rounded-2xl border border-amber-500/30 overflow-hidden shadow-xl">
                            <div className="p-4 border-b border-amber-500/20 flex justify-between items-center bg-amber-950/30">
                              <h3 className="text-sm font-black text-amber-200 flex items-center gap-2">
                                <span>👑 تقرير أداء فرق العمل والليدرز</span>
                              </h3>
                              <span className="text-xs text-amber-300 font-bold">{leadersTeamData.length} ليدر</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-right text-xs">
                                <thead className="bg-slate-900 text-amber-300 border-b border-slate-800">
                                  <tr>
                                    <th className="p-3">الليدر / المشرف</th>
                                    <th className="p-3 text-center">أعضاء الفريق</th>
                                    <th className="p-3 text-center">إجمالي الداتا</th>
                                    <th className="p-3 text-center">نسبة النجاح</th>
                                    <th className="p-3 text-center">التواصل</th>
                                    <th className="p-3 text-center">🎉 اشتراك</th>
                                    <th className="p-3 text-center">🚀 تجربة</th>
                                    <th className="p-3 text-center">🌟 مهتم</th>
                                    <th className="p-3 text-center">📵 لم يرد</th>
                                    <th className="p-3 text-center">❌ غير مهتم</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-slate-200">
                                  {leadersTeamData.map(({ leader, teamMembersCount, total, crmCount, addedCount, subscribed, trial, interested, noAnswer, notInterested, successRate, interactionRate }, idx) => (
                                    <tr key={leader.uid || idx} className="hover:bg-amber-950/20 transition">
                                      <td className="p-3 font-bold flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-amber-900 text-amber-200 flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                                        <span>{leader.name || leader.username}</span>
                                      </td>
                                      <td className="p-3 text-center font-bold text-amber-400">{teamMembersCount} موظف</td>
                                      <td className="p-3 text-center font-black">
                                        <span>{total}</span>
                                        <span className="text-[10px] text-amber-400/80 block font-normal" dir="rtl">({crmCount} موزع + {addedCount} مضاف)</span>
                                      </td>
                                      <td className="p-3 text-center">
                                        <span className={`font-black ${successRate >= 50 ? 'text-emerald-400' : successRate >= 25 ? 'text-amber-400' : 'text-rose-400'}`}>
                                          {successRate}%
                                        </span>
                                      </td>
                                      <td className="p-3 text-center font-bold text-teal-300">{interactionRate}%</td>
                                      <td className="p-3 text-center font-bold text-purple-400">{subscribed}</td>
                                      <td className="p-3 text-center font-bold text-cyan-400">{trial}</td>
                                      <td className="p-3 text-center font-bold text-emerald-400">{interested}</td>
                                      <td className="p-3 text-center font-bold text-amber-400">{noAnswer}</td>
                                      <td className="p-3 text-center font-bold text-rose-400">{notInterested}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

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
                                  <th className="p-3 text-center">الفريق / الليدر</th>
                                  <th className="p-3 text-center">إجمالي العملاء</th>
                                  <th className="p-3 text-center">نسبة النجاح</th>
                                  <th className="p-3 text-center">التواصل</th>
                                  <th className="p-3 text-center">🎉 اشتراك</th>
                                  <th className="p-3 text-center">🚀 تجربة</th>
                                  <th className="p-3 text-center">🌟 مهتم</th>
                                  <th className="p-3 text-center">📵 لم يرد</th>
                                  <th className="p-3 text-center">❌ غير مهتم</th>
                                  <th className="p-3 text-center">التقييم</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 text-slate-200">
                                {allEmployeesData.map(({ emp, total, crmCount, addedCount, subscribed, trial, interested, noAnswer, notInterested, successRate, interactionRate }, i) => (
                                  <tr key={emp.uid || i} className="hover:bg-purple-900/20 transition">
                                    <td className="p-3 font-bold flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-purple-900 text-purple-200 flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                                      <span>{emp.name || emp.username}</span>
                                    </td>
                                    <td className="p-3 text-center text-xs text-purple-300">
                                      {emp.jobTitle === 'Leader' ? (
                                        <span className="bg-amber-900/60 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">👑 Leader</span>
                                      ) : emp.leaderUid ? (
                                        <span className="text-purple-300 font-medium">👑 {employees.find(l => l.uid === emp.leaderUid)?.name || emp.leaderName || 'ليدر'}</span>
                                      ) : (
                                        <span className="text-slate-500 text-[10px]">مباشر للإدارة</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center font-black">
                                      <span>{total}</span>
                                      <span className="text-[10px] text-purple-400 block font-normal" dir="rtl">({crmCount} موزع + {addedCount} مضاف)</span>
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <span className={`font-black ${successRate >= 50 ? 'text-emerald-400' : successRate >= 25 ? 'text-amber-400' : 'text-rose-400'}`}>
                                          {successRate}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-center font-bold text-teal-300">{interactionRate}%</td>
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

        {/* Modal: Call Performance Analytics (تقرير وتحليل أداء المكالمات الشامل اليومي والتراكمي) */}
        {isCallsAnalysisModalOpen && (() => {
          // 1. Role Scoped Call Logs
          const roleLogs = callLogs.filter(log => {
            if (isAdmin || isCoordinator) return true;
            if (isLeader) {
              return log.employeeUid === currentUser?.uid || log.leaderUid === currentUser?.uid || myTeamMembers.some(m => m.uid === log.employeeUid);
            }
            return log.employeeUid === currentUser?.uid;
          });

          // 2. Date & Employee Filtered Logs
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
          const endOfYesterday = startOfToday;
          const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
          const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();

          const filteredLogs = roleLogs.filter(log => {
            if (callsSelectedEmpFilter && log.employeeUid !== callsSelectedEmpFilter) {
              return false;
            }

            const logTime = getTimestampMillis(log.calledAt) || log.timestampMillis || 0;

            if (callsDateRangeFilter === 'today') {
              if (logTime < startOfToday) return false;
            } else if (callsDateRangeFilter === 'yesterday') {
              if (logTime < startOfYesterday || logTime >= endOfYesterday) return false;
            } else if (callsDateRangeFilter === 'week') {
              if (logTime < startOfWeek) return false;
            } else if (callsDateRangeFilter === 'month') {
              if (logTime < startOfMonth) return false;
            } else if (callsDateRangeFilter === 'custom') {
              if (callsCustomDateFrom) {
                const fromTime = new Date(callsCustomDateFrom).setHours(0, 0, 0, 0);
                if (logTime < fromTime) return false;
              }
              if (callsCustomDateTo) {
                const toTime = new Date(callsCustomDateTo).setHours(23, 59, 59, 999);
                if (logTime > toTime) return false;
              }
            }

            if (callsSearchTerm.trim()) {
              const term = callsSearchTerm.toLowerCase().trim();
              const matchPhone = log.phoneNumber?.toLowerCase().includes(term);
              const matchCust = log.customerName?.toLowerCase().includes(term);
              const matchEmp = log.employeeName?.toLowerCase().includes(term);
              if (!matchPhone && !matchCust && !matchEmp) return false;
            }

            return true;
          });

          // Metrics & Outcomes Calculation
          const totalCallsInPeriod = filteredLogs.length;
          const answeredCallsCount = filteredLogs.filter(l => l.status === 'answered' || (!l.status && (l.durationSeconds > 0 || l.durationFormatted?.includes('دقيقة') || l.durationFormatted?.includes('ثانية')))).length;
          const noAnswerCallsCount = filteredLogs.filter(l => l.status === 'no_answer').length;
          const busyCallsCount = filteredLogs.filter(l => l.status === 'busy').length;
          
          const totalDurationSeconds = filteredLogs.reduce((sum, l) => sum + (l.durationSeconds || 0), 0);
          const totalMinutes = (totalDurationSeconds / 60).toFixed(1);
          const avgDurationSeconds = answeredCallsCount > 0 ? Math.round(totalDurationSeconds / answeredCallsCount) : 0;
          const answerRate = totalCallsInPeriod > 0 ? Math.round((answeredCallsCount / totalCallsInPeriod) * 100) : 0;

          const todayCalls = roleLogs.filter(log => {
            const logTime = getTimestampMillis(log.calledAt) || log.timestampMillis || 0;
            return logTime >= startOfToday;
          }).length;
          const uniqueCallers = new Set(filteredLogs.map(l => l.employeeUid).filter(Boolean)).size;

          // Per-Employee Analytics Breakdown (Excluding Admin and Coordinators like Waleed as they don't make calls)
          const eligibleEmployees = (isAdmin || isCoordinator)
            ? employees.filter(e => 
                e.role !== 'admin' && 
                !adminEmails.includes(e.email?.toLowerCase()) &&
                e.jobTitle !== 'Coordinator' &&
                e.jobTitle !== 'منسق للإدارة' &&
                e.role !== 'coordinator' &&
                !e.name?.toLowerCase().includes('waleed') &&
                !e.email?.toLowerCase().includes('waleed@')
              )
            : isLeader
            ? [currentEmpUser, ...myTeamMembers].filter(e => 
                e && 
                e.jobTitle !== 'Coordinator' && 
                e.jobTitle !== 'منسق للإدارة' && 
                e.role !== 'coordinator' &&
                !e.name?.toLowerCase().includes('waleed')
              )
            : [currentEmpUser].filter(e => 
                e && 
                e.jobTitle !== 'Coordinator' && 
                e.jobTitle !== 'منسق للإدارة' && 
                e.role !== 'coordinator' &&
                !e.name?.toLowerCase().includes('waleed')
              );

          const empBreakdown = eligibleEmployees.map(emp => {
            const empAllLogs = roleLogs.filter(l => l.employeeUid === emp.uid || l.employeeEmail?.toLowerCase() === emp.email?.toLowerCase());
            const empFilteredLogs = filteredLogs.filter(l => l.employeeUid === emp.uid || l.employeeEmail?.toLowerCase() === emp.email?.toLowerCase());
            const empTodayLogs = empAllLogs.filter(l => {
              const t = getTimestampMillis(l.calledAt) || l.timestampMillis || 0;
              return t >= startOfToday;
            });
            const empAnswered = empFilteredLogs.filter(l => l.status === 'answered' || (!l.status && l.durationSeconds > 0)).length;
            const empNoAnswer = empFilteredLogs.filter(l => l.status === 'no_answer').length;
            const empDurationSec = empFilteredLogs.reduce((sum, l) => sum + (l.durationSeconds || 0), 0);
            const empAnswerRate = empFilteredLogs.length > 0 ? Math.round((empAnswered / empFilteredLogs.length) * 100) : 0;
            const lastCall = empAllLogs.length > 0 ? (getTimestampMillis(empAllLogs[0].calledAt) || empAllLogs[0].timestampMillis) : null;

            return {
              emp,
              todayCount: empTodayLogs.length,
              periodCount: empFilteredLogs.length,
              totalCount: empAllLogs.length,
              answeredCount: empAnswered,
              noAnswerCount: empNoAnswer,
              durationSec: empDurationSec,
              durationFormatted: formatCallDuration(empDurationSec),
              answerRate: empAnswerRate,
              lastCall,
              percentage: totalCallsInPeriod > 0 ? Math.round((empFilteredLogs.length / totalCallsInPeriod) * 100) : 0
            };
          }).sort((a, b) => b.periodCount - a.periodCount || b.totalCount - a.totalCount);

          const topCaller = empBreakdown.find(e => e.periodCount > 0);

          // Pagination for Call History
          const CALLS_PER_PAGE = 15;
          const totalCallsPages = Math.ceil(filteredLogs.length / CALLS_PER_PAGE) || 1;
          const validCallsPage = Math.min(callsCurrentPage, totalCallsPages);
          const startIndexCalls = (validCallsPage - 1) * CALLS_PER_PAGE;
          const paginatedLogs = filteredLogs.slice(startIndexCalls, startIndexCalls + CALLS_PER_PAGE);

          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4" onClick={() => setIsCallsAnalysisModalOpen(false)}>
              <div className="bg-slate-900 text-white rounded-3xl shadow-2xl w-full max-w-5xl p-4 sm:p-6 relative max-h-[92vh] flex flex-col border border-purple-500/30 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                
                {/* Modal Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-purple-500/20 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 rounded-2xl shadow-lg border border-cyan-300/40">
                      <PhoneCall size={24} className="text-white animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                        <span>تقرير وتحليل أداء المكالمات 📞</span>
                        <span className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 px-2.5 py-0.5 rounded-full font-bold">
                          {isAdmin ? 'تحليل المنصة الشامل' : isCoordinator ? 'منسق الإدارة' : isLeader ? 'تحليل فريق العمل' : 'مكالماتي الشخصية'}
                        </span>
                      </h2>
                      <p className="text-xs text-purple-300 font-medium mt-0.5">
                        {isAdmin || isCoordinator 
                          ? 'تتبع دقيق ومفصل لمعدل المكالمات (تم الرد / لم يرد)، زمن المكالمات بالدقائق والثواني الصادرة من برنامج MicroSIP' 
                          : isLeader 
                          ? `تتبع ومتابعة أداء مكالماتك ومكالمات فريقك (${myTeamMembers.length} موظف)` 
                          : 'سجل وتحليل مكالماتك ومعدل الرد وزمن المكالمات الصادرة'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isAdmin && (
                      <button 
                        onClick={() => handleExportCallLogsToExcel(filteredLogs)}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                        title="تصدير المكالمات المعروضة إلى ملف Excel"
                      >
                        <Download size={14} />
                        <span>تصدير Excel</span>
                      </button>
                    )}
                    <button 
                      onClick={() => setIsCallsAnalysisModalOpen(false)} 
                      className="bg-white/10 hover:bg-rose-600 text-white p-2 rounded-full transition cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="bg-slate-950/70 p-3 sm:p-4 rounded-2xl border border-purple-500/20 mb-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Quick Date Filters */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { key: 'all', label: 'الكل (تراكمي)' },
                        { key: 'today', label: 'اليوم 📅' },
                        { key: 'yesterday', label: 'أمس' },
                        { key: 'week', label: 'آخر 7 أيام' },
                        { key: 'month', label: 'آخر 30 يوم' },
                        { key: 'custom', label: 'فترة مخصصة 🗓️' }
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => {
                            setCallsDateRangeFilter(f.key);
                            setCallsCurrentPage(1);
                          }}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                            callsDateRangeFilter === f.key
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border border-purple-400/50'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {/* Employee Selector (for Admin, Coordinator, Leader) */}
                    {(isAdmin || isCoordinator || isLeader) && (
                      <div className="flex items-center gap-1.5 min-w-[200px]">
                        <select
                          value={callsSelectedEmpFilter}
                          onChange={(e) => {
                            setCallsSelectedEmpFilter(e.target.value);
                            setCallsCurrentPage(1);
                          }}
                          className="bg-slate-800 text-cyan-300 border border-purple-500/40 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-cyan-400 cursor-pointer w-full"
                        >
                          <option value="">👤 جميع الموظفين (All Staff)</option>
                          {eligibleEmployees.map(emp => (
                            <option key={emp.uid} value={emp.uid} className="bg-slate-900 text-white">
                              👤 {emp.name} ({emp.jobTitle === 'Leader' ? '👑 Leader' : 'Agent'})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Custom Date Range Picker (Fixed Arabic format cleanly) */}
                  {callsDateRangeFilter === 'custom' && (
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold">من:</span>
                        <div className="relative flex items-center gap-1 bg-slate-800 border border-purple-500/40 rounded-xl px-2.5 py-1 text-xs min-w-[120px] justify-between cursor-pointer">
                          {!callsCustomDateFrom && <span className="text-[11px] text-purple-300 font-mono font-bold">--/--/----</span>}
                          <input
                            type="date"
                            value={callsCustomDateFrom}
                            onChange={(e) => { setCallsCustomDateFrom(e.target.value); setCallsCurrentPage(1); }}
                            className={`bg-transparent text-[11px] text-white font-mono outline-none cursor-pointer font-bold border-none ${!callsCustomDateFrom ? 'opacity-0 absolute inset-0 w-full h-full' : 'w-[100px]'}`}
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold">إلى:</span>
                        <div className="relative flex items-center gap-1 bg-slate-800 border border-purple-500/40 rounded-xl px-2.5 py-1 text-xs min-w-[120px] justify-between cursor-pointer">
                          {!callsCustomDateTo && <span className="text-[11px] text-purple-300 font-mono font-bold">--/--/----</span>}
                          <input
                            type="date"
                            value={callsCustomDateTo}
                            onChange={(e) => { setCallsCustomDateTo(e.target.value); setCallsCurrentPage(1); }}
                            className={`bg-transparent text-[11px] text-white font-mono outline-none cursor-pointer font-bold border-none ${!callsCustomDateTo ? 'opacity-0 absolute inset-0 w-full h-full' : 'w-[100px]'}`}
                            dir="ltr"
                          />
                        </div>
                      </div>
                      {(callsCustomDateFrom || callsCustomDateTo) && (
                        <button
                          onClick={() => { setCallsCustomDateFrom(''); setCallsCustomDateTo(''); setCallsCurrentPage(1); }}
                          className="text-rose-400 hover:text-rose-300 font-bold text-xs"
                        >
                          مسح التاريخ ✕
                        </button>
                      )}
                    </div>
                  )}

                  {/* Search Bar */}
                  <div className="relative">
                    <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="بحث باسم الموظف أو اسم العميل أو رقم الهاتف..."
                      value={callsSearchTerm}
                      onChange={(e) => { setCallsSearchTerm(e.target.value); setCallsCurrentPage(1); }}
                      className="w-full bg-slate-900/90 border border-purple-500/30 rounded-xl pr-9 pl-4 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-bold"
                    />
                  </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-5">
                  {/* KPI Summary Cards with Answered, No-Answer & Duration Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 p-3.5 sm:p-4 rounded-2xl border border-purple-500/40 shadow-lg">
                      <span className="text-[11px] sm:text-xs text-purple-200 font-bold block mb-1">📞 إجمالي المكالمات</span>
                      <span className="text-xl sm:text-2xl font-black text-cyan-300">{totalCallsInPeriod.toLocaleString()}</span>
                      <span className="text-[10px] text-purple-300/90 font-bold block mt-0.5" dir="rtl">
                        (نسبة الرد: <strong className="text-emerald-400">{answerRate}%</strong>)
                      </span>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-3.5 sm:p-4 rounded-2xl border border-emerald-500/40 shadow-lg">
                      <span className="text-[11px] sm:text-xs text-emerald-200 font-bold block mb-1">🟢 تم الرد (Answered)</span>
                      <span className="text-xl sm:text-2xl font-black text-emerald-400">{answeredCallsCount.toLocaleString()}</span>
                      <span className="text-[10px] text-emerald-300/90 font-bold block mt-0.5" dir="rtl">
                        (متوسط المدة: {formatCallDuration(avgDurationSeconds)})
                      </span>
                    </div>

                    <div className="bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 p-3.5 sm:p-4 rounded-2xl border border-amber-500/40 shadow-lg">
                      <span className="text-[11px] sm:text-xs text-amber-200 font-bold block mb-1">📵 لم يرد (No Answer)</span>
                      <span className="text-xl sm:text-2xl font-black text-amber-400">{noAnswerCallsCount.toLocaleString()}</span>
                      <span className="text-[10px] text-amber-300/90 font-bold block mt-0.5" dir="rtl">
                        (مشغول/إلغاء: {busyCallsCount})
                      </span>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-900 p-3.5 sm:p-4 rounded-2xl border border-blue-500/40 shadow-lg">
                      <span className="text-[11px] sm:text-xs text-blue-200 font-bold block mb-1">⏱️ إجمالي زمن المكالمات</span>
                      <span className="text-xl sm:text-2xl font-black text-blue-300">{totalMinutes} دقيقة</span>
                      <span className="text-[10px] text-blue-300/90 font-bold block mt-0.5" dir="rtl">
                        ({totalDurationSeconds.toLocaleString()} ثانية مكالمات حية)
                      </span>
                    </div>
                  </div>

                  {/* Leaderboard Table (for Admin, Coordinator, Leader) */}
                  {(isAdmin || isCoordinator || isLeader) && empBreakdown.length > 0 && (
                    <div className="bg-slate-950 rounded-2xl border border-purple-500/20 overflow-hidden">
                      <div className="p-3.5 sm:p-4 border-b border-purple-500/20 flex justify-between items-center bg-purple-950/40">
                        <h3 className="text-xs sm:text-sm font-black text-purple-200 flex items-center gap-1.5">
                          <span>🏆 تحليل ومقارنة أداء اتصالات الموظفين</span>
                          {topCaller && <span className="text-[11px] text-amber-300 font-normal">الأعلى اتصالاً: <strong>{topCaller.emp.name}</strong> ({topCaller.periodCount} مكالمة)</span>}
                        </h3>
                        <span className="text-[11px] text-purple-300 font-bold">{empBreakdown.length} موظف</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-900 text-purple-300 border-b border-slate-800">
                            <tr>
                              <th className="p-3">الموظف</th>
                              <th className="p-3">الوظيفة / الفريق</th>
                              <th className="p-3 text-center text-emerald-400 font-black">مكالمات اليوم 📅</th>
                              <th className="p-3 text-center text-cyan-300 font-black">مكالمات الفترة ⏱️</th>
                              <th className="p-3 text-center text-emerald-400 font-black">🟢 تم الرد</th>
                              <th className="p-3 text-center text-amber-400 font-black">📵 لم يرد</th>
                              <th className="p-3 text-center text-blue-300 font-black">⏱️ إجمالي الدقائق</th>
                              <th className="p-3 text-center text-teal-300 font-black">نسبة الرد %</th>
                              <th className="p-3 text-center">آخر اتصال</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-slate-200">
                            {empBreakdown.map(({ emp, todayCount, periodCount, totalCount, answeredCount, noAnswerCount, durationSec, durationFormatted, answerRate, lastCall }, i) => (
                              <tr key={emp.uid || i} className="hover:bg-purple-900/20 transition">
                                <td className="p-3 font-bold flex items-center gap-2">
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-amber-400 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-purple-900 text-purple-200'}`}>
                                    {i + 1}
                                  </span>
                                  <span className="text-white font-black">{emp.name}</span>
                                  {i === 0 && periodCount > 0 && <span className="text-amber-400 text-xs" title="الموظف الأول في الاتصال">👑</span>}
                                </td>
                                <td className="p-3">
                                  <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                                    {emp.jobTitle === 'Leader' ? '👑 Leader' : 'Agent'}
                                    {emp.leaderName ? ` • فريق ${emp.leaderName}` : ''}
                                  </span>
                                </td>
                                <td className="p-3 text-center font-black text-emerald-400 text-sm">{todayCount}</td>
                                <td className="p-3 text-center font-black text-cyan-300 text-sm">{periodCount}</td>
                                <td className="p-3 text-center font-black text-emerald-400">{answeredCount}</td>
                                <td className="p-3 text-center font-black text-amber-400">{noAnswerCount}</td>
                                <td className="p-3 text-center font-mono font-bold text-blue-300">
                                  {durationFormatted}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`font-black text-xs ${answerRate >= 50 ? 'text-emerald-400' : answerRate >= 25 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {answerRate}%
                                  </span>
                                </td>
                                <td className="p-3 text-center text-[11px] text-slate-400 font-mono" dir="ltr">
                                  {lastCall ? new Date(lastCall).toLocaleString('ar-EG', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Detailed Call Timeline Log */}
                  <div className="bg-slate-950 rounded-2xl border border-purple-500/20 overflow-hidden">
                    <div className="p-3.5 sm:p-4 border-b border-purple-500/20 flex justify-between items-center bg-purple-950/40">
                      <h3 className="text-xs sm:text-sm font-black text-purple-200 flex items-center gap-1.5">
                        <Clock size={16} className="text-cyan-300" />
                        <span>سجل المكالمات الصادرة وتوثيق الرد والمدة ({filteredLogs.length} مكالمة)</span>
                      </h3>
                      <span className="text-[11px] text-slate-400 font-bold">صفحة {validCallsPage} من {totalCallsPages}</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-900 text-purple-300 border-b border-slate-800">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">وقت وتاريخ الاتصال</th>
                            <th className="p-3">الموظف المتصل</th>
                            <th className="p-3">اسم العميل</th>
                            <th className="p-3 text-center">رقم الهاتف</th>
                            <th className="p-3 text-center">نتيجة المكالمة</th>
                            <th className="p-3 text-center">مدة المكالمة</th>
                            <th className="p-3 text-center">المصدر</th>
                            <th className="p-3 text-center">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-200">
                          {paginatedLogs.length === 0 ? (
                            <tr>
                              <td colSpan="9" className="p-8 text-center text-slate-400 font-bold">
                                لا توجد مكالمات مسجلة مطابقة للبحث أو التصفية الحالية 📵
                              </td>
                            </tr>
                          ) : (
                            paginatedLogs.map((log, idx) => {
                              const callTime = log.calledAt?.toDate ? log.calledAt.toDate() : (log.timestampMillis ? new Date(log.timestampMillis) : null);
                              const isAnswered = log.status === 'answered' || (!log.status && (log.durationSeconds > 0 || log.durationFormatted?.includes('دقيقة') || log.durationFormatted?.includes('ثانية')));
                              const isNoAnswer = log.status === 'no_answer';
                              const isBusy = log.status === 'busy';

                              return (
                                <tr key={log.id || idx} className="hover:bg-purple-900/20 transition">
                                  <td className="p-3 text-slate-500 font-bold text-[10px]">
                                    {startIndexCalls + idx + 1}
                                  </td>
                                  <td className="p-3 font-mono text-[11px] text-slate-300" dir="ltr">
                                    {callTime ? callTime.toLocaleString('ar-EG') : '—'}
                                  </td>
                                  <td className="p-3 font-bold text-cyan-300">
                                    <span>👤 {log.employeeName || 'موظف'}</span>
                                    {log.employeeJobTitle && (
                                      <span className="block text-[10px] text-purple-400 font-normal">({log.employeeJobTitle})</span>
                                    )}
                                  </td>
                                  <td className="p-3 font-bold text-white">
                                    {log.customerName || 'عميل'}
                                  </td>
                                  <td className="p-3 text-center font-mono font-bold text-slate-200" dir="ltr">
                                    {log.phoneNumber}
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        onClick={() => handleUpdateCallLogStatus(log.id, 'answered')}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${isAnswered ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                        title="تحديد: تم الرد"
                                      >
                                        🟢 رد
                                      </button>
                                      <button
                                        onClick={() => handleUpdateCallLogStatus(log.id, 'no_answer')}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${isNoAnswer ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                        title="تحديد: لم يرد"
                                      >
                                        📵 لم يرد
                                      </button>
                                      <button
                                        onClick={() => handleUpdateCallLogStatus(log.id, 'busy')}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${isBusy ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                        title="تحديد: مشغول"
                                      >
                                        🔴 مشغول
                                      </button>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center font-mono font-bold text-cyan-300">
                                    {log.durationFormatted || (log.durationSeconds ? formatCallDuration(log.durationSeconds) : isNoAnswer ? 'لم يرد 📵' : '—')}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className="bg-purple-900/40 text-purple-200 border border-purple-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                      {log.customerSource || log.source || 'MicroSIP'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    {!isCoordinator && log.phoneNumber && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCallViaMicroSip(log.phoneNumber, { name: log.customerName, id: log.customerId });
                                        }}
                                        className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white px-2.5 py-1 rounded-lg text-[11px] font-black shadow-sm active:scale-95 transition inline-flex items-center gap-1 cursor-pointer"
                                        title="إعادة الاتصال بالعميل عبر MicroSIP"
                                      >
                                        <PhoneCall size={11} className="animate-pulse" />
                                        <span>إعادة اتصال</span>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalCallsPages > 1 && (
                      <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex justify-between items-center">
                        <button
                          disabled={validCallsPage <= 1}
                          onClick={() => setCallsCurrentPage(p => Math.max(1, p - 1))}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${validCallsPage <= 1 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'}`}
                        >
                          السابق
                        </button>
                        <span className="text-xs text-purple-300 font-bold">
                          صفحة {validCallsPage} من {totalCallsPages}
                        </span>
                        <button
                          disabled={validCallsPage >= totalCallsPages}
                          onClick={() => setCallsCurrentPage(p => Math.min(totalCallsPages, p + 1))}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${validCallsPage >= totalCallsPages ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'}`}
                        >
                          التالي
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal: Send CRM Sheet WhatsApp Campaign (1 to 10 leads) */}
        {isCrmCampaignModalOpen && (() => {
          const currentTargets = getCrmCampaignTargetLeads(crmCampaignBatchSize);
          const eligibleTargets = currentTargets.filter(c => !isLeadInCampaignCooldown(c));
          const selectedTargets = currentTargets.filter(c => crmCampaignCheckedLeadIds.includes(c.id));
          const templateObj = CRM_CAMPAIGN_TEMPLATES.find(t => t.id === crmCampaignTemplateId);
          const currentMsgPreview = crmCampaignTemplateId === 'custom' ? crmCampaignCustomText : (templateObj?.text || '');

          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => !crmCampaignSending && setIsCrmCampaignModalOpen(false)}>
              <div className="bg-slate-900 text-white rounded-3xl shadow-2xl w-full max-w-3xl p-6 relative max-h-[90vh] flex flex-col border border-emerald-500/40 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                
                {/* Modal Header */}
                <div className="flex justify-between items-center pb-4 border-b border-emerald-500/20 mb-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 rounded-2xl shadow-lg border border-emerald-300/40">
                      <MessageSquare size={24} className="text-emerald-200" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                        <span>📢 إرسال حملة واتساب لشيت العملاء (CRM Campaign)</span>
                      </h2>
                      <p className="text-xs text-emerald-300 font-semibold mt-0.5">
                        إرسال رسائل ترويجية مباشرة لأرقام العملاء (من 1 إلى 10 عملاء) وترحيلهم فوراً لشات الواتساب (محمية من التكرار لمدة يومين)
                      </p>
                    </div>
                  </div>
                  <button 
                    disabled={crmCampaignSending}
                    onClick={() => setIsCrmCampaignModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 flex items-center justify-center transition cursor-pointer disabled:opacity-30"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                  
                  {/* Step 1: Batch Size Selector (1 to 10 Numbers) */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/20 shadow-inner">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                        <span>1️⃣ اختر عدد العملاء لإرسال الحملة (من 1 إلى 10 أرقام):</span>
                      </span>
                      <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-black border border-emerald-400/40">
                        المحدد للإرسال: {selectedTargets.length} من {currentTargets.length} عميل
                      </span>
                    </div>

                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <button
                          key={num}
                          type="button"
                          disabled={crmCampaignSending}
                          onClick={() => handleBatchSizeChange(num)}
                          className={`py-2 rounded-xl text-xs font-black transition flex flex-col items-center justify-center cursor-pointer ${
                            crmCampaignBatchSize === num
                              ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 shadow-lg scale-105 ring-2 ring-emerald-300'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          <span className="text-sm">{num}</span>
                          <span className="text-[9px] opacity-80">{num === 1 ? 'رقم' : 'أرقام'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: Selected Leads Preview List with Checkboxes and Cooldown Badges */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-inner">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-300">
                          2️⃣ تحديد العملاء المستهدفين ({currentTargets.length}):
                        </span>
                        {eligibleTargets.length > 0 && (
                          <button
                            type="button"
                            disabled={crmCampaignSending}
                            onClick={() => toggleAllCampaignLeads(currentTargets)}
                            className="text-[11px] bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold px-2.5 py-0.5 rounded-lg border border-slate-700 transition cursor-pointer"
                          >
                            {crmCampaignCheckedLeadIds.length === eligibleTargets.length ? 'إلغاء تحديد الكل' : 'تحديد الكل (✓)'}
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] text-purple-300 font-bold">
                        {crmCampaignTargetPool === 'employee_leads' ? '📂 داتا الموظف' : '🎯 Leads CRM'}
                      </span>
                    </div>

                    {currentTargets.length === 0 ? (
                      <div className="p-4 bg-slate-900 rounded-xl text-center text-xs text-rose-300 font-bold border border-rose-500/20">
                        ⚠️ لا توجد أرقام هواتف صالحة متاحة في الشيت حالياً.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {currentTargets.map((lead, idx) => {
                          const inCooldown = isLeadInCampaignCooldown(lead);
                          const remHours = inCooldown ? getRemainingCooldownHours(lead) : 0;
                          const isChecked = crmCampaignCheckedLeadIds.includes(lead.id) && !inCooldown;

                          return (
                            <div 
                              key={lead.id || idx} 
                              onClick={() => !crmCampaignSending && toggleCampaignLeadCheck(lead.id, inCooldown)}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs transition cursor-pointer ${
                                inCooldown 
                                  ? 'bg-slate-900/40 border-slate-800 opacity-60 cursor-not-allowed' 
                                  : isChecked
                                  ? 'bg-emerald-950/60 border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30'
                                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  disabled={inCooldown || crmCampaignSending}
                                  checked={isChecked}
                                  onChange={() => {}} // Handled by parent div onClick
                                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer pointer-events-none"
                                />
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${isChecked ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                                  {idx + 1}
                                </span>
                                <span className="font-black text-white">{lead.name || 'عميل'}</span>
                              </div>

                              <div className="flex items-center gap-2.5 flex-wrap justify-end">
                                <span className="font-mono text-emerald-400 font-bold" dir="ltr">{lead.phoneNumber}</span>
                                {inCooldown ? (
                                  <span className="bg-amber-950/80 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-bold">
                                    ⏳ مرسل مؤخراً (متاح بعد {remHours} ساعة)
                                  </span>
                                ) : (
                                  <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px]">
                                    {lead.crmStatus === 'interested' ? '🌟 مهتم' : lead.crmStatus === 'no_answer' ? '📵 لم يرد' : '⏳ في الانتظار'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Step 3: Template or Custom Message Selector */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/20 shadow-inner">
                    <span className="text-xs font-black text-emerald-300 block mb-2.5">
                      3️⃣ اختيار القالب التسويقي أو كتابة رسالة مخصصة:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                      {CRM_CAMPAIGN_TEMPLATES.map(tmpl => (
                        <button
                          key={tmpl.id}
                          type="button"
                          disabled={crmCampaignSending}
                          onClick={() => setCrmCampaignTemplateId(tmpl.id)}
                          className={`p-2.5 rounded-xl text-right text-xs font-bold transition border cursor-pointer ${
                            crmCampaignTemplateId === tmpl.id
                              ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 shadow-sm ring-1 ring-emerald-400/50'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="radio" 
                              checked={crmCampaignTemplateId === tmpl.id} 
                              onChange={() => {}} 
                              className="accent-emerald-500 pointer-events-none"
                            />
                            <span>{tmpl.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {crmCampaignTemplateId === 'custom' ? (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">اكتب نص الرسالة الإعلانية المخصصة:</label>
                        <textarea
                          rows={4}
                          disabled={crmCampaignSending}
                          value={crmCampaignCustomText}
                          onChange={(e) => setCrmCampaignCustomText(e.target.value)}
                          placeholder="السلام عليكم .. نقدم لحضرتك أقوى الفرص والتوصيات الاستثمارية..."
                          className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 leading-relaxed font-sans"
                        />
                      </div>
                    ) : (
                      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">معاينة نص الرسالة التي ستصل للعميل:</span>
                        <p className="text-xs text-emerald-200 font-sans leading-relaxed whitespace-pre-line bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                          {currentMsgPreview}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Live Sending Progress Indicator */}
                  {crmCampaignSending && (
                    <div className="bg-emerald-950/80 border border-emerald-500/40 p-4 rounded-2xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-black text-emerald-300 animate-pulse">
                          🚀 جاري إرسال الحملة الإعلانية وتوثيق المحادثات...
                        </span>
                        <span className="text-xs font-mono font-black text-emerald-300">
                          {crmCampaignProgress} / {selectedTargets.length}
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${(crmCampaignProgress / Math.max(1, selectedTargets.length)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Modal Footer Actions */}
                <div className="pt-4 border-t border-slate-800 flex justify-between items-center gap-3 shrink-0 mt-2">
                  <span className="text-[11px] text-slate-400 font-semibold">
                    💡 ستظهر جميع المحادثات المرسلة في صفحة الواتساب الخاصة بك فوراً
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={crmCampaignSending}
                      onClick={() => setIsCrmCampaignModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer disabled:opacity-40"
                    >
                      إلغاء
                    </button>

                    <button
                      type="button"
                      disabled={crmCampaignSending || selectedTargets.length === 0 || !currentMsgPreview?.trim()}
                      onClick={handleSendCrmCampaign}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition flex items-center gap-2 shadow-lg shadow-emerald-900/40 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send size={15} />
                      <span>{crmCampaignSending ? 'جاري الإرسال...' : `🚀 إرسال الحملة لـ (${selectedTargets.length}) عميل`}</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* Modal 5: System Total Clients Distribution & Breakdown */}
        {isSystemTotalClientsModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setIsSystemTotalClientsModalOpen(false)}>
            <div className="bg-slate-900 text-white rounded-3xl shadow-2xl w-full max-w-4xl p-6 relative max-h-[90vh] flex flex-col border border-purple-500/30 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-4 border-b border-purple-500/20 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl shadow-lg border border-blue-300/40">
                    <Globe size={24} className="text-cyan-300" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <span>خريطة وتوزيع عملاء السيستم 🌐</span>
                    </h2>
                    <p className="text-xs text-purple-300 font-medium">
                      تفصيل وتوزيع إجمالي العملاء على الكروت وأقسام المنصة وفرق العمل
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSystemTotalClientsModalOpen(false)} 
                  className="bg-white/10 hover:bg-rose-600 text-white p-2 rounded-full transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                {/* Total Big Badge */}
                <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 p-5 rounded-2xl border border-blue-500/40 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
                  <div>
                    <span className="text-xs text-blue-300 font-bold block mb-1">إجمالي عدد العملاء على السيستم بالكامل:</span>
                    <span className="text-3xl sm:text-4xl font-black text-cyan-300">
                      {(leadsCrm.length + customers.length + employeeLeads.length + whatsappVisitorsCount).toLocaleString()} عميل
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="bg-purple-900/60 border border-purple-400/40 text-purple-200 text-xs px-3 py-1.5 rounded-xl font-bold">
                      🎯 Leads CRM: {leadsCrm.length.toLocaleString()}
                    </span>
                    <span className="bg-indigo-900/60 border border-indigo-400/40 text-indigo-200 text-xs px-3 py-1.5 rounded-xl font-bold">
                      📁 مضافة بالموظف: {employeeLeads.length.toLocaleString()}
                    </span>
                    <span className="bg-emerald-900/60 border border-emerald-400/40 text-emerald-200 text-xs px-3 py-1.5 rounded-xl font-bold">
                      💬 واتساب: {customers.length.toLocaleString()}
                    </span>
                    <span className="bg-cyan-900/60 border border-cyan-400/40 text-cyan-200 text-xs px-3 py-1.5 rounded-xl font-bold">
                      🌐 زوار: {whatsappVisitorsCount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Section Breakdown Grid */}
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-purple-200">📊 أماكن توزيع العملاء في الكروت والأقسام:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    
                    {/* Card 1: Leads CRM */}
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-purple-500/30 hover:border-purple-400 transition flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-purple-900/60 rounded-xl text-purple-300">
                            <FileSpreadsheet size={20} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-white">🎯 Leads CRM (الداتا المركزية)</h4>
                            <p className="text-[11px] text-purple-300">الداتا المستوردة والرئيسية للشركة</p>
                          </div>
                        </div>
                        <span className="text-xl font-black text-cyan-300">{leadsCrm.length.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-purple-300/80 bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/20 mb-3" dir="rtl">
                        <div className="flex justify-between py-0.5">
                          <span>👤 موزعة على الموظفين:</span>
                          <span className="font-bold text-emerald-400">{leadsCrm.filter(c => isLeadAssignedToEmployee(c)).length.toLocaleString()} عميل</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span>👑 في انتظار التوزيع بالإدارة:</span>
                          <span className="font-bold text-amber-400">{leadsCrm.filter(c => isLeadWithAdmin(c)).length.toLocaleString()} عميل</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsSystemTotalClientsModalOpen(false);
                          setActiveTab('leads_crm');
                          tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        الانتقال إلى جدول Leads CRM ➔
                      </button>
                    </div>

                    {/* Card 2: Employee Leads */}
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-indigo-500/30 hover:border-indigo-400 transition flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-indigo-900/60 rounded-xl text-indigo-300">
                            <Upload size={20} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-white">📁 داتا مضافة بواسطة الموظف</h4>
                            <p className="text-[11px] text-indigo-300">داتا رفعها الإيجنتس والليدرز</p>
                          </div>
                        </div>
                        <span className="text-xl font-black text-cyan-300">{employeeLeads.length.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-indigo-300/80 bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-500/20 mb-3" dir="rtl">
                        <div className="flex justify-between py-0.5">
                          <span>👥 عدد الموظفين الذين أضافوا داتا:</span>
                          <span className="font-bold text-indigo-200">{new Set(employeeLeads.map(c => c.addedBy || c.addedByUid)).size} موظف</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span>🎉 عملاء تم تحويلهم بنجاح:</span>
                          <span className="font-bold text-emerald-400">{employeeLeads.filter(c => ['subscribed','started_trial','interested'].includes(c.crmStatus)).length.toLocaleString()} عميل</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsSystemTotalClientsModalOpen(false);
                          setActiveTab('employee_leads');
                          tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        الانتقال إلى داتا الموظفين ➔
                      </button>
                    </div>

                    {/* Card 3: Manual Add WhatsApp */}
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-purple-500/30 hover:border-purple-400 transition flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-purple-900/60 rounded-xl text-purple-300">
                            <UserPlus size={20} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-white">💬 داتا مضافة يدوياً WhatsApp</h4>
                            <p className="text-[11px] text-purple-300">عملاء مضافين يدوياً من الشات والمحادثات</p>
                          </div>
                        </div>
                        <span className="text-xl font-black text-cyan-300">
                          {customers.filter(c => c.addedBy && c.addedBy !== 'WhatsApp Webhook').length.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-purple-300/80 bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/20 mb-3" dir="rtl">
                        <div className="flex justify-between py-0.5">
                          <span>⏳ عملاء في الانتظار:</span>
                          <span className="font-bold text-amber-400">{customers.filter(c => c.addedBy && c.addedBy !== 'WhatsApp Webhook' && (!c.assignedToUid || c.assignedToUid === 'admin')).length.toLocaleString()} عميل</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span>👤 مخصصين لمتابعة الموظفين:</span>
                          <span className="font-bold text-emerald-400">{customers.filter(c => c.addedBy && c.addedBy !== 'WhatsApp Webhook' && c.assignedToUid && c.assignedToUid !== 'admin').length.toLocaleString()} عميل</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsSystemTotalClientsModalOpen(false);
                          handleCardClick(null, 'customers', 'manual');
                        }}
                        className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        الانتقال إلى المضافين يدوياً ➔
                      </button>
                    </div>

                    {/* Card 4: WhatsApp Direct & Bot */}
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-emerald-500/30 hover:border-emerald-400 transition flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-emerald-900/60 rounded-xl text-emerald-300">
                            <Users size={20} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-white">🤖 عملاء محادثات الواتساب التلقائي</h4>
                            <p className="text-[11px] text-emerald-300">عملاء الشات المباشر وردود البوت</p>
                          </div>
                        </div>
                        <span className="text-xl font-black text-cyan-300">
                          {customers.filter(c => !c.addedBy || c.addedBy === 'WhatsApp Webhook').length.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-emerald-300/80 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20 mb-3" dir="rtl">
                        <div className="flex justify-between py-0.5">
                          <span>💬 إجمالي محادثات الواتساب:</span>
                          <span className="font-bold text-emerald-200">{customers.length.toLocaleString()} محادثة</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span>🌐 زوار الموقع النشطين:</span>
                          <span className="font-bold text-cyan-400">{whatsappVisitorsCount.toLocaleString()} زائر</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsSystemTotalClientsModalOpen(false);
                          handleCardClick(null, 'customers', 'all');
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        الانتقال إلى عملاء الواتساب ➔
                      </button>
                    </div>

                  </div>
                </div>

                {/* Team Distribution Breakdown (Admin View) */}
                {isAdmin && (
                  <div className="bg-slate-950 rounded-2xl border border-amber-500/20 overflow-hidden shadow-lg">
                    <div className="p-4 border-b border-amber-500/20 bg-amber-950/30 flex justify-between items-center">
                      <h3 className="text-sm font-black text-amber-200">👑 توزيع الداتا عبر الليدرز وفرق العمل</h3>
                      <span className="text-xs text-amber-300 font-bold">{employees.filter(e => (e.jobTitle === 'Leader' || e.jobTitle === 'ليدر' || e.role === 'leader') && e.role !== 'admin').length} ليدر</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-900 text-amber-300 border-b border-slate-800">
                          <tr>
                            <th className="p-3">الليدر</th>
                            <th className="p-3 text-center">أعضاء الفريق</th>
                            <th className="p-3 text-center">🎯 Leads CRM</th>
                            <th className="p-3 text-center">📁 داتا الموظف</th>
                            <th className="p-3 text-center">💬 واتساب مخصص</th>
                            <th className="p-3 text-center">المجموع الكلي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-200">
                          {employees.filter(e => (e.jobTitle === 'Leader' || e.jobTitle === 'ليدر' || e.role === 'leader') && e.role !== 'admin').map((leader, idx) => {
                            const teamMembers = employees.filter(e => e.leaderUid === leader.uid);
                            const teamUids = [leader.uid, ...teamMembers.map(e => e.uid)];
                            const teamEmails = [leader.email?.toLowerCase(), ...teamMembers.map(e => e.email?.toLowerCase())];

                            const crmCount = leadsCrm.filter(c => teamUids.includes(c.assignedToUid) || (c.assignedTo && teamEmails.includes(c.assignedTo?.toLowerCase()))).length;
                            const empCount = employeeLeads.filter(c => teamUids.includes(c.assignedToUid) || teamUids.includes(c.addedByUid) || (c.assignedTo && teamEmails.includes(c.assignedTo?.toLowerCase()))).length;
                            const whatsappCount = customers.filter(c => teamUids.includes(c.assignedToUid) || (c.assignedTo && teamEmails.includes(c.assignedTo?.toLowerCase()))).length;
                            const totalTeamAll = crmCount + empCount + whatsappCount;

                            return (
                              <tr key={leader.uid || idx} className="hover:bg-amber-950/20 transition">
                                <td className="p-3 font-bold flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-amber-900 text-amber-200 flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                                  <span>{leader.name || leader.username}</span>
                                </td>
                                <td className="p-3 text-center font-bold text-amber-400">{teamMembers.length} موظف</td>
                                <td className="p-3 text-center font-bold text-purple-400">{crmCount.toLocaleString()}</td>
                                <td className="p-3 text-center font-bold text-indigo-400">{empCount.toLocaleString()}</td>
                                <td className="p-3 text-center font-bold text-emerald-400">{whatsappCount.toLocaleString()}</td>
                                <td className="p-3 text-center font-black text-cyan-300 text-sm">{totalTeamAll.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* Modal 6: Pending Clients Breakdown & Distribution */}
        {isPendingClientsModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setIsPendingClientsModalOpen(false)}>
            <div className="bg-slate-900 text-white rounded-3xl shadow-2xl w-full max-w-4xl p-6 relative max-h-[90vh] flex flex-col border border-rose-500/30 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-4 border-b border-rose-500/20 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-tr from-rose-600 to-indigo-600 rounded-2xl shadow-lg border border-rose-300/40">
                    <Clock size={24} className="text-cyan-300" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <span>خريطة وتوزيع عملاء الانتظار ⏳</span>
                    </h2>
                    <p className="text-xs text-purple-300 font-medium">
                      تفصيل العملاء المرسلة للموظفين ولم يتم تحويل حالتهم بعد في (الواتساب + Leads CRM + داتا الموظف)
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPendingClientsModalOpen(false)} 
                  className="bg-white/10 hover:bg-rose-600 text-white p-2 rounded-full transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                {/* Total Big Badge */}
                <div className="bg-gradient-to-r from-rose-950 via-purple-950 to-slate-900 p-5 rounded-2xl border border-rose-500/40 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
                  <div>
                    <span className="text-xs text-rose-300 font-bold block mb-1">إجمالي عملاء الانتظار الموزعين على الموظفين (لم يتم تحويل حالتهم بعد):</span>
                    <span className="text-3xl sm:text-4xl font-black text-cyan-300">
                      {totalPendingAll.toLocaleString()} عميل
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="bg-purple-900/60 border border-purple-400/40 text-purple-200 text-xs px-3 py-1.5 rounded-xl font-bold">
                      🎯 انتظار Leads CRM: {unassignedLeadsCrmCount.toLocaleString()}
                    </span>
                    <span className="bg-indigo-900/60 border border-indigo-400/40 text-indigo-200 text-xs px-3 py-1.5 rounded-xl font-bold">
                      📁 انتظار داتا الموظف: {unassignedEmployeeLeadsCount.toLocaleString()}
                    </span>
                    <span className="bg-emerald-900/60 border border-emerald-400/40 text-emerald-200 text-xs px-3 py-1.5 rounded-xl font-bold">
                      💬 انتظار الواتساب: {unassignedWhatsappCount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Section Breakdown Grid */}
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-purple-200">🔍 اختر القسم المطلوب للانتقال الفوري إلى عملاء الانتظار:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    
                    {/* Card 1: Leads CRM Pending */}
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-purple-500/30 hover:border-purple-400 transition flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-purple-900/60 rounded-xl text-purple-300">
                            <FileSpreadsheet size={20} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-white">🎯 انتظار Leads CRM (الموزعة)</h4>
                            <p className="text-[11px] text-purple-300">عملاء مرسلة للموظف ولم يحول حالتهم</p>
                          </div>
                        </div>
                        <span className="text-xl font-black text-cyan-300">{unassignedLeadsCrmCount.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-purple-300/80 bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/20 mb-3">
                        عملاء تم توزيعهم وإرسالهم للموظفين من Leads CRM وما زالوا في الانتظار بدون تحديث حالتهم.
                      </p>
                      <button
                        onClick={() => {
                          setIsPendingClientsModalOpen(false);
                          setActiveTab('leads_crm');
                          setCrmStatusFilter('unassigned');
                          tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        الانتقال لانتظار Leads CRM ➔
                      </button>
                    </div>

                    {/* Card 2: Employee Leads Pending */}
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-indigo-500/30 hover:border-indigo-400 transition flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-indigo-900/60 rounded-xl text-indigo-300">
                            <Upload size={20} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-white">📁 انتظار داتا الموظف</h4>
                            <p className="text-[11px] text-indigo-300">داتا رفعها الموظف ولم يحول حالتها</p>
                          </div>
                        </div>
                        <span className="text-xl font-black text-cyan-300">{unassignedEmployeeLeadsCount.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-indigo-300/80 bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-500/20 mb-3">
                        عملاء مضافين في داتا الموظفين ولم يقم الموظف بتغيير وتحديث حالتهم عن حالة الانتظار.
                      </p>
                      <button
                        onClick={() => {
                          setIsPendingClientsModalOpen(false);
                          setActiveTab('employee_leads');
                          setEmpLeadsStatusFilter('unassigned');
                          tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        الانتقال لانتظار داتا الموظف ➔
                      </button>
                    </div>

                    {/* Card 3: WhatsApp Pending */}
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-emerald-500/30 hover:border-emerald-400 transition flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-emerald-900/60 rounded-xl text-emerald-300">
                            <Clock size={20} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-white">💬 انتظار الواتساب</h4>
                            <p className="text-[11px] text-emerald-300">عملاء واتساب في انتظار المتابعة</p>
                          </div>
                        </div>
                        <span className="text-xl font-black text-cyan-300">{unassignedWhatsappCount.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-emerald-300/80 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20 mb-3">
                        عملاء ومحادثات واتساب في الانتظار للمتابعة والتحديث.
                      </p>
                      <button
                        onClick={() => {
                          setIsPendingClientsModalOpen(false);
                          handleCardClick(null, 'customers', 'unassigned');
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        الانتقال لانتظار الواتساب ➔
                      </button>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Modal: Client Subscription Details (بيانات اشتراك العميل) */}
        {isSubscriptionModalOpen && selectedSubCustomer && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setIsSubscriptionModalOpen(false)}>
            <div className="bg-slate-900 text-white rounded-3xl shadow-2xl w-full max-w-xl p-6 relative max-h-[90vh] flex flex-col border border-emerald-500/40 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-4 border-b border-emerald-500/20 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-600 rounded-2xl shadow-lg border border-emerald-300/40">
                    <CreditCard size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                      <span>💳 بيانات وتفاصيل اشتراك العميل</span>
                    </h2>
                    <p className="text-xs text-emerald-300 font-bold mt-0.5">
                      {selectedSubCustomer.name || 'عميل مشترك'} • <span dir="ltr" className="font-mono text-cyan-300">{selectedSubCustomer.phoneNumber || ''}</span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSubscriptionModalOpen(false)} 
                  className="bg-white/10 hover:bg-rose-600 text-white p-2 rounded-full transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleSaveSubscriptionDetails} className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Required Alert Banner */}
                <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-2xl p-3 text-xs text-emerald-200 shadow-inner flex items-center gap-2">
                  <span className="text-base">📌</span>
                  <span>
                    يرجى تعبئة بيانات الباقة وإشعار التحويل. علامة (<span className="text-rose-400 font-bold">*</span>) تعني حقل إجباري.
                  </span>
                </div>

                {/* 1. Service Dates (Start & End) - Required */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/20">
                  <div>
                    <label className="block text-xs font-bold text-emerald-200 mb-1.5 flex items-center gap-1">
                      <span>📅 تاريخ بداية الخدمة</span>
                      <span className="text-rose-400 font-black">*</span>
                    </label>
                    <input 
                      type="date"
                      required
                      value={subStartDate}
                      onChange={(e) => setSubStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-emerald-500/40 rounded-xl text-xs font-bold text-white outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-200 mb-1.5 flex items-center gap-1">
                      <span>📅 تاريخ نهاية الخدمة</span>
                      <span className="text-rose-400 font-black">*</span>
                    </label>
                    <input 
                      type="date"
                      required
                      value={subEndDate}
                      onChange={(e) => setSubEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-emerald-500/40 rounded-xl text-xs font-bold text-white outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {/* 2. Service Type & Payment Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5">نوع الخدمة / الباقة</label>
                    <select
                      value={subServiceType}
                      onChange={(e) => setSubServiceType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      <option value="الباقة الشهرية">الباقة الشهرية (1 شهر)</option>
                      <option value="الباقة ربع السنوية (3 شهور)">الباقة ربع السنوية (3 شهور)</option>
                      <option value="الباقة النصف سنوية (6 شهور)">الباقة النصف سنوية (6 شهور)</option>
                      <option value="الباقة السنوية">الباقة السنوية (12 شهر)</option>
                      <option value="باقة VIP">باقة VIP خاصة</option>
                      <option value="توصيات الأسهم والعملات">توصيات الأسهم والعملات</option>
                      <option value="كورس تدريبي خاص">كورس تدريبي خاص</option>
                      <option value="استشارة خاصة">استشارة خاصة</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5">نوع الدفع</label>
                    <select
                      value={subPaymentType}
                      onChange={(e) => setSubPaymentType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      <option value="full">كامل (Full Payment)</option>
                      <option value="percentage">نسبة (Percentage)</option>
                      <option value="partial">جزء وباقي جزء (Installment / Partial)</option>
                    </select>
                  </div>
                </div>

                {/* 3. Amounts (Paid & Remaining) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5">المبلغ المدفوع</label>
                    <input 
                      type="text"
                      placeholder="مثال: 500$ أو 2000 ريال"
                      value={subPaidAmount}
                      onChange={(e) => setSubPaidAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-emerald-400"
                    />
                  </div>

                  {subPaymentType === 'partial' && (
                    <div>
                      <label className="block text-xs font-bold text-amber-300 mb-1.5">المبلغ المتبقي</label>
                      <input 
                        type="text"
                        placeholder="مثال: 300$ أو 1000 ريال"
                        value={subRemainingAmount}
                        onChange={(e) => setSubRemainingAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-xl text-xs font-bold text-amber-200 outline-none focus:border-amber-400"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Transfer Receipt / Proof - Required */}
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-emerald-500/30 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-emerald-200 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>🧾 إشعار التحويل / كود العملية (بالإنجليزي)</span>
                        <span className="text-rose-400 font-black">*</span>
                      </span>
                      <span className="text-[10px] text-gray-400 font-normal">كتابة أو نسخ ولصق</span>
                    </label>
                    <input 
                      type="text"
                      dir="ltr"
                      required={!subReceiptFileUrl}
                      placeholder="e.g. TXN-94820194 / AlRajhi Ref: 48201948"
                      value={subReceiptProof}
                      onChange={(e) => setSubReceiptProof(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-emerald-500/40 rounded-xl text-xs font-mono font-bold text-cyan-300 outline-none focus:border-emerald-400 text-left"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>📁 أو رفع صورة إشعار التحويل:</span>
                      {subReceiptFileUrl && <span className="text-emerald-400 font-bold text-[10px]">✓ تم إرفاق صورة</span>}
                    </label>
                    <input 
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleReceiptFileUpload}
                      className="block w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                    />
                    {subReceiptFileUrl && (
                      <div className="mt-2.5 p-2 bg-slate-900 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                        <span className="text-xs text-emerald-300 font-bold truncate">معاينة صورة الإشعار المرفق</span>
                        <a 
                          href={subReceiptFileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-cyan-300 text-xs font-bold underline hover:text-cyan-200"
                        >
                          عرض بالحجم الكامل ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Notes (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">ملاحظات الاشتراك (اختياري)</label>
                  <textarea 
                    rows={2}
                    placeholder="أي تفاصيل أو شروط خاصة بالاشتراك..."
                    value={subNotes}
                    onChange={(e) => setSubNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-medium text-white outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Submit & Cancel Buttons */}
                <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSubscriptionModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    disabled={subSaving}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-2 px-6 rounded-xl transition flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    <Save size={15} />
                    <span>{subSaving ? 'جاري الحفظ...' : 'حفظ وتأكيد بيانات الاشتراك 💾'}</span>
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* Internal Mail System Modal (بريد اتجاه الداخلي - Gmail System) */}
        {isMailModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setIsMailModalOpen(false)}>
            <div className="bg-slate-900 text-white rounded-3xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col border border-purple-500/30 overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
              
              {/* Mail Header */}
              <div className="px-5 py-3.5 border-b border-purple-500/20 bg-slate-950 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 rounded-xl shadow-md border border-white/20">
                    <Mail size={22} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>✉️ بريد اتجاه الداخلي</span>
                      <span className="text-[10px] font-bold bg-purple-900/80 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded-full">
                        {isAdmin ? '👑 حساب الإدارة' : isCoordinator ? '📋 منسق الإدارة' : isLeader ? '👑 ليدر فريق' : '👤 موظف'}
                      </span>
                    </h2>
                    <p className="text-[11px] text-purple-300/80 font-medium">
                      نظام المراسلات والإيميلات الداخلية المشفرة لفريق اتجاه
                    </p>
                  </div>
                </div>

                {/* Mail Search Bar */}
                <div className="flex-1 max-w-md mx-2">
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder={isAdmin ? "بحث في كافة الإيميلات بالموضوع، المحتوى، أو اسم الموظف..." : "بحث في الإيميلات..."}
                      value={mailSearchTerm}
                      onChange={(e) => setMailSearchTerm(e.target.value)}
                      className="w-full bg-slate-900 text-white placeholder-purple-300/50 border border-purple-500/40 rounded-full py-1.5 pl-8 pr-9 text-xs font-bold focus:outline-none focus:border-cyan-400 shadow-inner"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400" size={14} />
                    {mailSearchTerm && (
                      <button 
                        onClick={() => setMailSearchTerm('')}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-black"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <button 
                  onClick={() => setIsMailModalOpen(false)}
                  className="bg-white/10 hover:bg-rose-600 text-white p-2 rounded-full transition cursor-pointer"
                  title="إغلاق البريد"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mail Main Layout (Sidebar + Content Area) */}
              <div className="flex-1 flex overflow-hidden">
                
                {/* Left Sidebar / Folders */}
                <div className="w-56 sm:w-64 bg-slate-950/70 border-l border-purple-500/20 p-3 sm:p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
                  <div className="space-y-2">
                    {/* Compose Button */}
                    <button 
                      onClick={() => setIsComposeOpen(true)}
                      className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2.5 px-4 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer mb-4 border border-white/20"
                    >
                      <Send size={15} />
                      <span>✏️ إنشاء رسالة جديدة</span>
                    </button>

                    {/* Folder 1: Inbox */}
                    <button 
                      onClick={() => {
                        setMailActiveFolder('inbox');
                        setSelectedEmail(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${mailActiveFolder === 'inbox' && !selectedEmail ? 'bg-purple-600/30 text-cyan-300 border border-purple-500/40 shadow-sm' : 'text-slate-300 hover:bg-slate-800/60'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Inbox size={16} className="text-purple-400" />
                        <span>📥 البريد الوارد</span>
                      </div>
                      {unreadMailCount > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                          {unreadMailCount}
                        </span>
                      )}
                    </button>

                    {/* Folder 2: Sent */}
                    <button 
                      onClick={() => {
                        setMailActiveFolder('sent');
                        setSelectedEmail(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${mailActiveFolder === 'sent' && !selectedEmail ? 'bg-purple-600/30 text-cyan-300 border border-purple-500/40 shadow-sm' : 'text-slate-300 hover:bg-slate-800/60'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Send size={16} className="text-indigo-400" />
                        <span>📤 البريد المرسل</span>
                      </div>
                      <span className="text-slate-500 text-[11px] font-mono">
                        {internalEmails.filter(m => (m.senderUid === myUid || m.senderEmail?.toLowerCase() === myEmail) && !m.deletedBy?.includes(myUid)).length}
                      </span>
                    </button>

                    {/* Folder 3: Starred */}
                    <button 
                      onClick={() => {
                        setMailActiveFolder('starred');
                        setSelectedEmail(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${mailActiveFolder === 'starred' && !selectedEmail ? 'bg-purple-600/30 text-cyan-300 border border-purple-500/40 shadow-sm' : 'text-slate-300 hover:bg-slate-800/60'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Star size={16} className="text-amber-400 fill-amber-400/30" />
                        <span>⭐ الرسائل المميزة</span>
                      </div>
                      <span className="text-slate-500 text-[11px] font-mono">
                        {internalEmails.filter(m => m.starredBy?.includes(myUid) && !m.deletedBy?.includes(myUid)).length}
                      </span>
                    </button>

                    {/* Folder 4: Admin Global Archive (Admin Only) */}
                    {isAdmin && (
                      <div className="pt-2 border-t border-purple-500/20 mt-2">
                        <button 
                          onClick={() => {
                            setMailActiveFolder('all_system');
                            setSelectedEmail(null);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${mailActiveFolder === 'all_system' && !selectedEmail ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' : 'text-amber-300/80 hover:bg-amber-950/40'}`}
                        >
                          <div className="flex items-center gap-2">
                            <Globe size={16} className="text-amber-400" />
                            <span>🌐 كافة إيميلات ومراسلات النظام</span>
                          </div>
                          <span className="bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                            {internalEmails.length}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sidebar Footer Info */}
                  <div className="p-2 bg-slate-900/60 rounded-xl border border-purple-500/10 text-[10px] text-purple-300/70 text-center">
                    <span>Etegah Secure Internal Mail v1.0</span>
                  </div>
                </div>

                {/* Right Panel: Email List OR Single Email Viewer */}
                <div className="flex-1 bg-slate-900 flex flex-col overflow-hidden">
                  
                  {/* Single Email Detailed View */}
                  {selectedEmail ? (
                    <div className="flex-1 flex flex-col p-5 overflow-y-auto">
                      {/* Top Action Bar */}
                      <div className="flex justify-between items-center pb-4 border-b border-purple-500/20 mb-4 gap-2">
                        <button 
                          onClick={() => setSelectedEmail(null)}
                          className="bg-slate-800 hover:bg-slate-700 text-purple-200 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <span>⬅️ العودة للقائمة</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => handleToggleStarEmail(selectedEmail, e)}
                            className={`p-2 rounded-xl transition cursor-pointer ${selectedEmail.starredBy?.includes(myUid) ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400 hover:text-amber-300'}`}
                            title="تمييز بنجمة"
                          >
                            <Star size={16} className={selectedEmail.starredBy?.includes(myUid) ? 'fill-amber-300' : ''} />
                          </button>

                          <button 
                            onClick={() => {
                              // Pre-fill reply
                              const replyRecipientUid = selectedEmail.senderUid === myUid ? selectedEmail.recipientUid : selectedEmail.senderUid;
                              setMailRecipientUid(replyRecipientUid || 'admin');
                              setMailSubject(`Re: ${selectedEmail.subject}`);
                              setMailBody(`\n\n--- رد على رسالة (${selectedEmail.senderName}) ---\n` + selectedEmail.body);
                              setIsComposeOpen(true);
                            }}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Reply size={15} />
                            <span>↩️ رد</span>
                          </button>

                          {isAdmin && (
                            <button 
                              onClick={(e) => handleDeleteEmail(selectedEmail, e)}
                              className="bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white p-2 rounded-xl transition cursor-pointer border border-rose-500/30"
                              title="حذف الرسالة نهائياً (للإدارة فقط)"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Email Header */}
                      <div className="mb-4 bg-slate-950/60 p-4 rounded-2xl border border-purple-500/20">
                        <h1 className="text-lg sm:text-xl font-black text-white mb-2 leading-snug">
                          {selectedEmail.subject}
                        </h1>

                        <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-cyan-300">من: {selectedEmail.senderName}</span>
                            <span className="text-purple-300/70 font-mono text-[11px]">({selectedEmail.senderEmail})</span>
                            <span className="bg-purple-900 text-purple-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              {selectedEmail.senderRole}
                            </span>
                          </div>

                          <span className="text-gray-400 text-[11px] font-mono" dir="ltr">
                            {formatDate(selectedEmail.createdAt)}
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-purple-300/80">
                          <span>إلى: </span>
                          <span className="font-bold text-white">{selectedEmail.recipientName}</span>
                        </div>
                      </div>

                      {/* Email Body Content */}
                      <div className="flex-1 bg-slate-950/40 p-5 rounded-2xl border border-purple-500/10 mb-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-100 font-sans select-text">
                        {selectedEmail.body}
                      </div>

                      {/* Attachments Section */}
                      {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                        <div className="bg-slate-950/80 p-4 rounded-2xl border border-purple-500/30 space-y-3">
                          <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                            <Paperclip size={15} />
                            <span>المرفقات ({selectedEmail.attachments.length}):</span>
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {selectedEmail.attachments.map((file, idx) => (
                              <div key={idx} className="bg-slate-900 p-3 rounded-xl border border-purple-500/20 flex flex-col justify-between gap-2 hover:border-purple-400 transition">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="text-lg">{file.type === 'image' ? '🖼️' : '📄'}</span>
                                  <div className="overflow-hidden">
                                    <p className="text-xs font-bold text-white truncate" title={file.name}>{file.name}</p>
                                    <span className="text-[10px] text-gray-400 font-mono">{file.size}</span>
                                  </div>
                                </div>

                                {file.type === 'image' && file.url && (
                                  <img 
                                    src={file.url} 
                                    alt={file.name} 
                                    className="w-full h-24 object-cover rounded-lg border border-purple-500/20 cursor-pointer hover:opacity-90"
                                    onClick={() => window.open(file.url, '_blank')}
                                  />
                                )}

                                <a 
                                  href={file.url} 
                                  download={file.name}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="w-full bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white py-1.5 px-3 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 text-center"
                                >
                                  <Download size={13} />
                                  <span>تنزيل / معاينة المرفق</span>
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Email List View */
                    <div className="flex-1 flex flex-col overflow-y-auto">
                      {(() => {
                        let filteredMails = [];
                        if (mailActiveFolder === 'inbox') {
                          filteredMails = internalEmails.filter(m => isEmailForMe(m) && !m.deletedBy?.includes(myUid));
                        } else if (mailActiveFolder === 'sent') {
                          filteredMails = internalEmails.filter(m => (m.senderUid === myUid || m.senderEmail?.toLowerCase() === myEmail) && !m.deletedBy?.includes(myUid));
                        } else if (mailActiveFolder === 'starred') {
                          filteredMails = internalEmails.filter(m => m.starredBy?.includes(myUid) && !m.deletedBy?.includes(myUid));
                        } else if (mailActiveFolder === 'all_system' && isAdmin) {
                          filteredMails = internalEmails;
                        }

                        // Search filter
                        if (mailSearchTerm.trim()) {
                          const term = mailSearchTerm.trim().toLowerCase();
                          filteredMails = filteredMails.filter(m => 
                            m.subject?.toLowerCase().includes(term) ||
                            m.body?.toLowerCase().includes(term) ||
                            m.senderName?.toLowerCase().includes(term) ||
                            m.senderEmail?.toLowerCase().includes(term) ||
                            m.recipientName?.toLowerCase().includes(term)
                          );
                        }

                        if (filteredMails.length === 0) {
                          return (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                              <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-3 text-3xl">
                                ✉️
                              </div>
                              <h3 className="text-base font-bold text-white mb-1">لا توجد رسائل في هذا المجلد</h3>
                              <p className="text-xs text-purple-300/70 max-w-sm">
                                {mailSearchTerm ? 'لا توجد نتائج مطابقة لبحثك' : 'صندوق البريد خالي حالياً.'}
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="divide-y divide-purple-500/10">
                            {filteredMails.map((mail) => {
                              const isUnread = !mail.readBy?.includes(myUid);
                              const isStarred = mail.starredBy?.includes(myUid);

                              return (
                                <div 
                                  key={mail.id}
                                  onClick={() => handleOpenEmailDetails(mail)}
                                  className={`p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-purple-950/30 transition cursor-pointer ${isUnread ? 'bg-purple-950/40 font-bold border-r-4 border-cyan-400' : 'text-slate-300'}`}
                                >
                                  {/* Star & Sender */}
                                  <div className="flex items-center gap-3 min-w-[160px] sm:min-w-[200px] shrink-0">
                                    <button 
                                      onClick={(e) => handleToggleStarEmail(mail, e)}
                                      className="text-slate-500 hover:text-amber-400 transition"
                                      title="تمييز بنجمة"
                                    >
                                      <Star size={16} className={isStarred ? 'text-amber-400 fill-amber-400' : ''} />
                                    </button>

                                    <div>
                                      <span className={`text-xs block truncate ${isUnread ? 'text-white font-black' : 'text-slate-300'}`}>
                                        {mailActiveFolder === 'sent' ? `إلى: ${mail.recipientName}` : mail.senderName}
                                      </span>
                                      {isAdmin && mailActiveFolder === 'all_system' && (
                                        <span className="text-[10px] text-amber-400 font-normal block truncate">
                                          من: {mail.senderName} ➔ إلى: {mail.recipientName}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Subject & Snippet */}
                                  <div className="flex-1 flex items-center gap-2 overflow-hidden">
                                    <span className={`text-xs truncate ${isUnread ? 'text-cyan-300 font-black' : 'text-slate-200'}`}>
                                      {mail.subject}
                                    </span>
                                    <span className="text-slate-500 text-xs truncate hidden sm:inline">
                                      — {mail.body?.replace(/\n/g, ' ')}
                                    </span>
                                    {mail.attachments && mail.attachments.length > 0 && (
                                      <span className="bg-purple-900/60 text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0" title="يحتوي على مرفقات">
                                        <Paperclip size={11} />
                                        <span>{mail.attachments.length}</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Date & Actions */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[11px] font-mono text-slate-400" dir="ltr">
                                      {mail.createdAt ? formatDate(mail.createdAt).split(' ')[0] : 'الآن'}
                                    </span>
                                    {isAdmin && (
                                      <button 
                                        onClick={(e) => handleDeleteEmail(mail, e)}
                                        className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition"
                                        title="حذف الرسالة (للإدارة فقط)"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        )}

        {/* Compose Email Modal Drawer (Gmail-style Compose) */}
        {isComposeOpen && (
          <div className="fixed inset-x-3 bottom-3 sm:inset-auto sm:bottom-6 sm:left-6 z-50 bg-slate-900 text-white rounded-3xl border border-purple-500/50 shadow-[0_10px_40px_rgba(0,0,0,0.6)] w-full sm:w-[540px] flex flex-col overflow-hidden max-h-[85vh]">
            {/* Header */}
            <div className="px-5 py-3 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 flex justify-between items-center">
              <span className="text-xs font-black text-white flex items-center gap-2">
                <Send size={15} />
                <span>✏️ إنشاء رسالة جديدة (إيميل داخلي)</span>
              </span>
              <button 
                onClick={() => setIsComposeOpen(false)}
                className="text-white/80 hover:text-white text-xs font-black"
              >
                ✕
              </button>
            </div>

            {/* Compose Form */}
            <form onSubmit={handleSendInternalEmail} className="p-4 space-y-3 flex-1 flex flex-col overflow-y-auto">
              {/* Recipient Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-purple-200 mb-1">إلى (المستلم):</label>
                <select 
                  required
                  value={mailRecipientUid}
                  onChange={(e) => setMailRecipientUid(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-purple-500/40 rounded-xl text-xs font-bold text-white outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="">-- اختر المستلم المسموح لك بمراسلته --</option>
                  {getAllowedRecipients().map((r) => (
                    <option key={r.uid} value={r.uid} className="bg-slate-900 text-white font-bold">
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[11px] font-bold text-purple-200 mb-1">موضوع الرسالة:</label>
                <input 
                  type="text"
                  required
                  placeholder="عنوان الموضوع..."
                  value={mailSubject}
                  onChange={(e) => setMailSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-purple-500/40 rounded-xl text-xs font-bold text-white outline-none focus:border-cyan-400"
                />
              </div>

              {/* Body */}
              <div className="flex-1 flex flex-col">
                <label className="block text-[11px] font-bold text-purple-200 mb-1">نص الرسالة والمحتوى:</label>
                <textarea 
                  required
                  rows={6}
                  placeholder="اكتب رسالتك وتفاصيلها هنا..."
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                  className="w-full flex-1 px-3 py-2 bg-slate-950 border border-purple-500/40 rounded-xl text-xs font-medium text-white outline-none focus:border-cyan-400 resize-none leading-relaxed"
                />
              </div>

              {/* Attachments Preview Chips */}
              {mailAttachments.length > 0 && (
                <div className="p-2 bg-slate-950 rounded-xl border border-purple-500/20 space-y-1.5">
                  <span className="text-[11px] font-bold text-cyan-300 block">الملفات المرفقة ({mailAttachments.length}):</span>
                  <div className="flex flex-wrap gap-2">
                    {mailAttachments.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-purple-900/60 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg border border-purple-400/30">
                        <span>📎 {f.name} ({f.size})</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveAttachment(i)} 
                          className="text-rose-400 hover:text-rose-200 font-black ml-1"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex justify-between items-center pt-2 border-t border-purple-500/20">
                <label className="bg-slate-800 hover:bg-slate-700 text-purple-200 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-purple-500/30">
                  <Paperclip size={14} />
                  <span>📎 إرفاق ملفات أو صور</span>
                  <input 
                    type="file" 
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xlsx,.txt"
                    onChange={handleMailAttachmentUpload}
                    className="hidden"
                  />
                </label>

                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setMailSubject('');
                      setMailBody('');
                      setMailAttachments([]);
                      setIsComposeOpen(false);
                    }}
                    className="text-slate-400 hover:text-rose-400 text-xs font-bold px-3 py-2"
                  >
                    تجاهل
                  </button>

                  <button 
                    type="submit" 
                    disabled={mailSending}
                    className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-black px-5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <Send size={14} />
                    <span>{mailSending ? 'جاري الإرسال...' : 'إرسال 🚀'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Floating Active Live Call Session Widget with Running Timer & Outcome Selector */}
        {activeCallSession && (
          <div className="fixed bottom-6 left-6 z-50 bg-slate-900/95 text-white p-4 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.7)] border-2 border-cyan-400 backdrop-blur-xl max-w-sm w-full animate-pulse-short">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center animate-pulse">
                  <PhoneCall size={18} className="text-cyan-300" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">{activeCallSession.customerName}</h4>
                  <span className="text-[11px] font-mono text-cyan-300 font-bold" dir="ltr">{activeCallSession.phoneNumber}</span>
                </div>
              </div>
              <div className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-xl font-mono font-black text-sm shadow-inner">
                ⏱️ {Math.floor(activeCallTimer / 60).toString().padStart(2, '0')}:{(activeCallTimer % 60).toString().padStart(2, '0')}
              </div>
            </div>
            
            <p className="text-[10px] text-purple-200 mb-2.5 font-bold text-center">حدد نتيجة المكالمة لتوثيقها وحساب مدتها في الداشبورد فوراً:</p>
            
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleFinishCallSession('answered')}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2 px-2 rounded-xl text-[11px] transition shadow-md active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                title="تم الرد وحساب مدة المكالمة الحالية"
              >
                <span>🟢 تم الرد</span>
              </button>
              <button
                type="button"
                onClick={() => handleFinishCallSession('no_answer')}
                className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-black py-2 px-2 rounded-xl text-[11px] transition shadow-md active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                title="لم يرد العميل على المكالمة"
              >
                <span>📵 لم يرد</span>
              </button>
              <button
                type="button"
                onClick={() => handleFinishCallSession('busy')}
                className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black py-2 px-2 rounded-xl text-[11px] transition shadow-md active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                title="الرقم مشغول أو تعذر الاتصال"
              >
                <span>🔴 مشغول</span>
              </button>
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
