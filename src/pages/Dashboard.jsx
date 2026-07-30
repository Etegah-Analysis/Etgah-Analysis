import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, Clock, ArrowRight, UserPlus, X, Trash2, Edit, Shield, Play, Pause, BarChart3, Globe, MessageSquare, Search } from 'lucide-react';
import { db, collection, onSnapshot, setDoc, doc, secondaryAuth, createUserWithEmailAndPassword, deleteDoc, updateDoc, serverTimestamp } from '../firebase';
import { getAuth, signInWithEmailAndPassword, updatePassword, updateEmail } from 'firebase/auth';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'customers' or 'employees'
  const [analyticsDetail, setAnalyticsDetail] = useState(null); // 'assigned', 'unread', 'zero' or null
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [tableSearch, setTableSearch] = useState(''); // per-table search
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = أحدث أولاً, 'asc' = أقدم أولاً
  const tableSectionRef = useRef(null);

  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [recycleBin, setRecycleBin] = useState([]);
  const [rbFilter, setRbFilter] = useState('all');
  const [templateMessages, setTemplateMessages] = useState([]);
  
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedVisitors, setSelectedVisitors] = useState([]);
  const [selectedRecycleItems, setSelectedRecycleItems] = useState([]);
  const [selectedEmpFilter, setSelectedEmpFilter] = useState('all');

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

  const navigate = useNavigate();

  React.useEffect(() => {
    document.title = 'منصة اتجاه | خدمة العملاء';
  }, []);
  const auth = getAuth();
  
  // Protect route
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      const adminEmails = ['etegahanalysis@gmail.com', 'mohamed.gamal.work0@gmail.com'];
      if (!user || !adminEmails.includes(user.email?.toLowerCase())) {
        navigate('/');
      }
    });
    return unsubscribe;
  }, [navigate, auth]);

  const currentUser = auth.currentUser;

  // Fetch Data
  useEffect(() => {
    const custUnsub = onSnapshot(collection(db, 'بيانات_تسجيل_العملاء'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      data.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setCustomers(data);
    });

    const empUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      
      // إضافة حساب الإدارة يدوياً لضمان ظهوره دائماً كأدمن في القائمة المنسدلة للتعيين
      if (currentUser && !emps.find(e => e.uid === currentUser.uid)) {
        emps.unshift({
          uid: currentUser.uid,
          id: currentUser.uid,
          name: 'الإدارة (الرئيسي)',
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
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setVisitors(data);
    });

    const rbUnsub = onSnapshot(collection(db, 'recycle_bin'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      data.sort((a, b) => (b.deletedAt?.toMillis() || 0) - (a.deletedAt?.toMillis() || 0));
      setRecycleBin(data);
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
    if (e) e.stopPropagation();
    setSelectedEmpFilter('all');
    if (activeTab === type && customerFilter === filter) {
      setActiveTab('analytics');
    } else {
      setActiveTab(type);
      setCustomerFilter(filter);
      setTableSearch(''); // reset per-table search on tab change
      scrollToTable();
    }
  };

  const unassignedCount = customers.filter(c => c.status === 'unassigned').length;
  const whatsappVisitorsCount = visitors.length + customers.filter(c => c.addedBy === 'WhatsApp Webhook').length;

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
  const toggleAllCustomers = () => {
    if (selectedCustomers.length === customers.length && customers.length > 0) setSelectedCustomers([]);
    else setSelectedCustomers(customers.map(c => c.id));
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
      await updateDoc(doc(db, 'بيانات_تسجيل_العملاء', chatId), {
        status: 'unassigned', // يظل في الانتظار حتى يرد عليه الموظف الجديد
        assignedTo: emp.email,
        assignedToUid: emp.uid,
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unread: 1
      });
    } catch (error) {
      console.error("خطأ في إسناد المحادثة:", error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'غير متوفر';
    return new Date(timestamp.toMillis?.() || timestamp).toLocaleString('ar-EG');
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
        {/* Top bar on mobile / Title & mobile actions */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base sm:text-lg md:text-2xl font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
            <span>📊</span>
            <span>لوحة إدارة منصة اتجاه <span className="text-primary text-xs md:text-sm bg-primary/10 px-2 py-0.5 rounded-full font-black">CRM</span></span>
          </h1>
          
          {/* Mobile action buttons inline with title */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <button 
              onClick={() => setIsAddEmployeeOpen(true)}
              className="flex items-center bg-primary text-white p-2 rounded-lg hover:bg-green-600 transition shadow-sm font-bold text-xs"
              title="إضافة موظف"
            >
              <UserPlus size={16} />
            </button>
            <button 
              onClick={() => navigate('/inbox')}
              className="flex items-center bg-gray-800 text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-700 transition text-xs font-bold gap-1"
            >
              <span>المحادثات</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>



        {/* Desktop Action Buttons */}
        <div className="hidden md:flex items-center space-x-3 space-x-reverse shrink-0">
          <button 
            onClick={() => setIsAddEmployeeOpen(true)}
            className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-green-600 transition shadow-sm font-bold text-sm"
          >
            <UserPlus size={18} className="mr-2" /> إضافة موظف
          </button>
          <button 
            onClick={() => navigate('/inbox')}
            className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm font-bold"
          >
            صندوق المحادثات <ArrowRight size={18} className="mr-2" />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto w-full relative z-10">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8" onClick={(e) => handleCardClick(e, 'analytics', 'all')}>
          <div 
            onClick={(e) => handleCardClick(e, 'customers', 'all')}
            className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] p-6 border ${activeTab === 'customers' && customerFilter === 'all' ? 'border-blue-500 scale-105' : 'border-white/40 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
          >
            <div className="bg-blue-100/80 p-4 rounded-full ml-4 shadow-inner">
              <Users className="text-blue-600" size={28} />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-bold mb-1">إجمالي العملاء</p>
              <h3 className="text-2xl font-black text-gray-800">{customers.length}</h3>
            </div>
          </div>
          
          <div 
            onClick={(e) => handleCardClick(e, 'customers', 'unassigned')}
            className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] p-6 border ${activeTab === 'customers' && customerFilter === 'unassigned' ? 'border-red-500 scale-105' : 'border-white/40 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
          >
            <div className="bg-red-100/80 p-4 rounded-full ml-4 shadow-inner">
              <Clock className="text-red-600" size={28} />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-bold mb-1">عملاء في الانتظار</p>
              <h3 className="text-2xl font-black text-gray-800">{unassignedCount}</h3>
            </div>
          </div>

          <div 
            onClick={(e) => handleCardClick(e, 'customers', 'manual')}
            className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] p-6 border ${activeTab === 'customers' && customerFilter === 'manual' ? 'border-purple-500 scale-105' : 'border-white/40 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
          >
            <div className="bg-purple-100/80 p-4 rounded-full ml-4 shadow-inner">
              <UserPlus className="text-purple-600" size={28} />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-bold mb-1">تسجيل يدوي</p>
              <h3 className="text-2xl font-black text-gray-800">{customers.filter(c => c.addedBy && c.addedBy !== 'WhatsApp Webhook').length}</h3>
            </div>
          </div>

          <div 
            onClick={(e) => handleCardClick(e, 'employees', 'all')}
            className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] p-6 border ${activeTab === 'employees' ? 'border-green-500 scale-105' : 'border-white/40 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
          >
            <div className="bg-green-100/80 p-4 rounded-full ml-4 shadow-inner">
              <UserCheck className="text-green-600" size={28} />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-bold mb-1">إجمالي الموظفين</p>
              <h3 className="text-2xl font-black text-gray-800">{employees.filter(e => e.role !== 'admin').length}</h3>
            </div>
          </div>

          {/* Card: عملاء الزوار (واتساب + موقع) - WhatsApp Visitors */}
          <div 
            onClick={(e) => handleCardClick(e, 'whatsapp_visitors', 'all')}
            className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] p-6 border ${activeTab === 'whatsapp_visitors' ? 'border-indigo-500 scale-105' : 'border-white/40 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
          >
            <div className="bg-indigo-100/80 p-4 rounded-full ml-4 shadow-inner">
              <Globe className="text-indigo-600" size={28} />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-bold mb-1">عملاء الزوار</p>
              <h3 className="text-2xl font-black text-gray-800">{whatsappVisitorsCount}</h3>
            </div>
          </div>
          
          <div 
            onClick={(e) => handleCardClick(e, 'recycle_bin', 'all')}
            className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] p-6 border ${activeTab === 'recycle_bin' ? 'border-red-500 scale-105' : 'border-white/40 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
          >
            <div className="bg-red-100/80 p-4 rounded-full ml-4 shadow-inner">
              <Trash2 className="text-red-600" size={28} />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-bold mb-1">سلة المهملات</p>
              <h3 className="text-2xl font-black text-gray-800">{recycleBin.length}</h3>
            </div>
          </div>

          <div 
            onClick={(e) => handleCardClick(e, 'campaigns', 'all')}
            className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] p-6 border ${activeTab === 'campaigns' ? 'border-amber-500 scale-105' : 'border-white/40 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
          >
            <div className="bg-amber-100/80 p-4 rounded-full ml-4 shadow-inner">
              <BarChart3 className="text-amber-600" size={28} />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-bold mb-1">أداء الحملات</p>
              <h3 className="text-2xl font-black text-gray-800">{new Set(templateMessages.map(m => m.templateName || (m.text?.match(/\[قالب.*?:(.*?)\]/)?.[1]?.trim() || 'قالب غير معروف'))).size} قوالب</h3>
            </div>
          </div>
        </div>

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

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (() => {
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
                className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.1)] cursor-pointer hover:scale-[1.02] transition-transform flex items-center justify-between group"
              >
                <h3 className="font-bold text-xl text-blue-700 flex items-center m-0">
                  <UserCheck className="ml-3" size={26} /> الأكثر استلاماً للعملاء
                </h3>
                <span className="text-sm font-bold bg-blue-100 text-blue-800 px-4 py-2 rounded-full shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  عرض التفاصيل
                </span>
              </div>

              {/* Card 2 */}
              <div 
                onClick={() => setAnalyticsDetail('unread')}
                className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.1)] cursor-pointer hover:scale-[1.02] transition-transform flex items-center justify-between group"
              >
                <h3 className="font-bold text-xl text-red-700 flex items-center m-0">
                  <Clock className="ml-3" size={26} /> بطء في الاستجابة (لم يقرأ)
                </h3>
                <span className="text-sm font-bold bg-red-100 text-red-800 px-4 py-2 rounded-full shadow-sm group-hover:bg-red-600 group-hover:text-white transition-colors">
                  عرض التفاصيل
                </span>
              </div>

              {/* Card 3 */}
              <div 
                onClick={() => setAnalyticsDetail('zero')}
                className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.1)] md:col-span-2 cursor-pointer hover:scale-[1.02] transition-transform flex items-center justify-between group"
              >
                <h3 className="font-bold text-xl text-orange-700 flex items-center m-0">
                  <Users className="ml-3" size={26} /> موظفين لم يستلموا أي عميل بعد
                </h3>
                <span className="text-sm font-bold bg-orange-100 text-orange-800 px-4 py-2 rounded-full shadow-sm group-hover:bg-orange-600 group-hover:text-white transition-colors">
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
                          {[...employeeStats].sort((a,b) => b.totalAssigned - a.totalAssigned).map((emp, idx) => (
                            <div key={emp.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="flex items-center">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ml-3 ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-200 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>{idx + 1}</span>
                                <span className="font-bold text-lg text-gray-800">{emp.name}</span>
                              </div>
                              <span className="font-bold text-blue-600 bg-blue-100 px-4 py-1 rounded-full">{emp.totalAssigned} عميل</span>
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
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 w-12 text-center">
                      <input type="checkbox" checked={selectedCustomers.length === customers.length && customers.length > 0} onChange={toggleAllCustomers} className="w-4 h-4 text-primary rounded" />
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
                    <th className="p-4 font-semibold text-gray-600 text-sm">الحالة</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">الموظف (تاريخ الاستلام)</th>
                  </tr>
                </thead>
                <tbody>
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

                      const search = tableSearch.trim() || dashboardSearch.trim();
                      if (!search) return true;
                      const term = search.toLowerCase();
                      return c.name?.toLowerCase().includes(term) || c.phoneNumber?.includes(term);
                    });
                    if (filtered.length === 0) return (
                      <tr><td colSpan="7" className="p-8 text-center text-gray-500">لا يوجد عملاء مسجلين بعد.</td></tr>
                    );
                    
                    const sortMultiplier = sortOrder === 'desc' ? 1 : -1;
                    filtered.sort((a, b) => {
                      const timeA = (a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0)) || (a.updatedAt?.toMillis?.() || (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0)) || 0;
                      const timeB = (b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0)) || (b.updatedAt?.toMillis?.() || (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0)) || 0;
                      return (timeB - timeA) * sortMultiplier;
                    });

                    const rows = [];
                    let lastDateStr = null;
                    filtered.forEach((customer, idx) => {
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
                      const empName = employees.find(e => e.email === customer.assignedTo)?.name || customer.assignedTo?.split('@')[0];
                      rows.push(
                        <tr key={customer.id} className="hover:bg-gray-50 transition border-b border-gray-100/50">
                          <td className="p-4 text-center">
                            <input type="checkbox" checked={selectedCustomers.includes(customer.id)} onChange={() => toggleCustomerSelection(customer.id)} className="w-4 h-4 text-primary rounded" />
                          </td>
                          <td className="p-4 text-sm font-bold text-gray-800" dir="ltr">{customer.phoneNumber}</td>
                          <td className="p-4 text-sm font-semibold text-gray-700">
                            {customer.name}
                            {customer.addedBy && customer.addedBy !== 'WhatsApp Webhook' && <span className="block text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full w-max mt-1">مضاف يدوياً بواسطة: {employees.find(e => e.email === customer.addedBy)?.name || (customer.addedBy === 'admin' ? 'الإدارة' : customer.addedBy?.split('@')[0])}</span>}
                          </td>
                          <td className="p-4 text-xs text-gray-500" dir="ltr">{formatDate(customer.createdAt || customer.updatedAt)}</td>
                          <td className="p-4 text-sm">
                            {customer.status === 'unassigned' ? (
                              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">في الانتظار</span>
                            ) : (
                              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">مستلمة</span>
                            )}
                          </td>
                          <td className="p-4 text-sm text-gray-600 font-medium">
                            <select 
                              value={customer.assignedToUid || ""}
                              onChange={(e) => handleAssignCustomer(customer.id, e.target.value)}
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-800 w-full focus:outline-none focus:border-blue-500 bg-white/70 shadow-sm cursor-pointer mb-1"
                            >
                              <option value="" disabled>-- سحب أو تعيين --</option>
                              {employees.map(emp => (
                                <option key={emp.uid} value={emp.uid}>
                                  {emp.role === 'admin' ? `👑 الإدارة (${emp.name})` : emp.name}
                                </option>
                              ))}
                            </select>
                            {customer.assignedAt && <span className="block text-xs text-gray-400" dir="ltr">{formatDate(customer.assignedAt)}</span>}
                          </td>
                          <td className="p-4 flex items-center gap-2">
                            <button 
                              onClick={() => navigate('/inbox', { state: { selectedCustomerId: customer.id } })}
                              className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center whitespace-nowrap"
                            >
                              مراسلة <MessageSquare size={14} className="mr-1" />
                            </button>
                            <button
                              onClick={() => handleDeleteSingleCustomer(customer)}
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

              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم الموظف</label>
                  <input 
                    type="text" 
                    required
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
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم (للدخول)</label>
                  <input 
                    type="text" 
                    required
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

      </main>
    </div>
  );
};

export default Dashboard;
