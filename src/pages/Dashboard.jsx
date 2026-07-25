import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, Clock, ArrowRight, UserPlus, X, Trash2, Edit, Shield, Play, Pause, BarChart3, Globe, MessageSquare } from 'lucide-react';
import { db, collection, onSnapshot, setDoc, doc, secondaryAuth, createUserWithEmailAndPassword, deleteDoc, updateDoc, serverTimestamp } from '../firebase';
import { getAuth, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'customers' or 'employees'
  const [analyticsDetail, setAnalyticsDetail] = useState(null); // 'assigned', 'unread', 'zero' or null
  const [customerFilter, setCustomerFilter] = useState('all'); // 'all' or 'unassigned'
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [recycleBin, setRecycleBin] = useState([]);
  const [rbFilter, setRbFilter] = useState('all');
  
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedVisitors, setSelectedVisitors] = useState([]);

  // Add Employee Modal
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [newEmpUsername, setNewEmpUsername] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [errorAdd, setErrorAdd] = useState('');

  // Edit Employee Modal
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [editEmpPassword, setEditEmpPassword] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState('');

  const navigate = useNavigate();
  const auth = getAuth();
  
  // Protect route
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user || user.email?.toLowerCase() !== 'etegahanalysis@gmail.com') {
        navigate('/');
      }
    });
    return unsubscribe;
  }, [navigate, auth]);

  // Fetch Data
  useEffect(() => {
    const custUnsub = onSnapshot(collection(db, 'بيانات_تسجيل_العملاء'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setCustomers(data);
    });

    const empUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const visUnsub = onSnapshot(collection(db, 'visitor_customers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setVisitors(data);
    });

    const rbUnsub = onSnapshot(collection(db, 'recycle_bin'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.deletedAt?.toMillis() || 0) - (a.deletedAt?.toMillis() || 0));
      setRecycleBin(data);
    });

    return () => {
      custUnsub();
      empUnsub();
      visUnsub();
      rbUnsub();
    };
  }, []);

  const handleCardClick = (type, filter) => {
    if (activeTab === type && customerFilter === filter) {
      setActiveTab('analytics');
    } else {
      setActiveTab(type);
      setCustomerFilter(filter);
    }
  };

  const unassignedCount = customers.filter(c => c.status === 'unassigned').length;

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setLoadingAdd(true);
    setErrorAdd('');
    try {
      const emailToCreate = newEmpUsername.includes('@') ? newEmpUsername : `${newEmpUsername.trim()}@etegah.com`;
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToCreate, newEmpPassword);
      const user = userCredential.user;
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        username: newEmpUsername,
        password: newEmpPassword,
        name: newEmpName || newEmpUsername,
        role: 'employee',
        isActive: true,
        createdAt: new Date()
      });
      secondaryAuth.signOut();
      setIsAddEmployeeOpen(false);
      setNewEmpUsername('');
      setNewEmpPassword('');
      setNewEmpName('');
    } catch (err) {
      console.error(err);
      setErrorAdd('فشل إضافة الموظف. قد يكون اسم المستخدم مستخدم مسبقاً.');
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
      await signInWithEmailAndPassword(secondaryAuth, editEmp.email, editEmp.password);
      await updatePassword(secondaryAuth.currentUser, editEmpPassword);
      await setDoc(doc(db, 'users', editEmp.uid), { password: editEmpPassword }, { merge: true });
      secondaryAuth.signOut();
      setIsEditEmployeeOpen(false);
      setEditEmp(null);
      setEditEmpPassword('');
    } catch (err) {
      console.error(err);
      setErrorEdit('حدث خطأ. تأكد من أن حساب الموظف غير محذوف من لوحة Firebase الرئيسية.');
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
      if (visitor) {
        await setDoc(doc(db, 'recycle_bin', id), {
          ...visitor,
          originalCollection: 'visitor_customers',
          type: 'visitor',
          deletedAt: serverTimestamp()
        });
      }
      await deleteDoc(doc(db, 'visitor_customers', id));
    }
    setSelectedVisitors([]);
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
      await deleteDoc(doc(db, 'recycle_bin', id));
    }
  };

  const handleAssignCustomer = async (chatId, empUid) => {
    if (!empUid) return;
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
      className="min-h-screen flex flex-col font-sans relative overflow-x-hidden bg-slate-900" 
      dir="rtl"
      onClick={() => setActiveTab('analytics')}
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
        className="bg-white shadow-sm border-b border-gray-200 relative z-10 px-6 py-4 flex justify-between items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 className="text-2xl font-bold text-gray-800">📊 لوحة إدارة منصة اتجاه CRM</h1>
        <div className="flex items-center space-x-3 space-x-reverse">
          <button 
            onClick={() => setIsAddEmployeeOpen(true)}
            className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-green-600 transition shadow-sm font-bold"
          >
            <UserPlus size={18} className="mr-2" /> إضافة موظف
          </button>
          <button 
            onClick={() => navigate('/inbox')}
            className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
          >
            صندوق المحادثات <ArrowRight size={18} className="mr-2" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full relative z-10">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8" onClick={(e) => e.stopPropagation()}>
          <div 
            onClick={() => handleCardClick('customers', 'all')}
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
            onClick={() => handleCardClick('customers', 'unassigned')}
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
            onClick={() => handleCardClick('customers', 'manual')}
            className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] p-6 border ${activeTab === 'customers' && customerFilter === 'manual' ? 'border-purple-500 scale-105' : 'border-white/40 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
          >
            <div className="bg-purple-100/80 p-4 rounded-full ml-4 shadow-inner">
              <UserPlus className="text-purple-600" size={28} />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-bold mb-1">تسجيل يدوي</p>
              <h3 className="text-2xl font-black text-gray-800">{customers.filter(c => c.addedBy).length}</h3>
            </div>
          </div>

          <div 
            onClick={() => handleCardClick('employees', 'all')}
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

          <div 
            onClick={() => handleCardClick('visitors', 'all')}
            className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] p-6 border ${activeTab === 'visitors' ? 'border-indigo-500 scale-105' : 'border-white/40 hover:scale-105'} flex items-center cursor-pointer transition-all transform`}
          >
            <div className="bg-indigo-100/80 p-4 rounded-full ml-4 shadow-inner">
              <Globe className="text-indigo-600" size={28} />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-bold mb-1">العملاء الزوار</p>
              <h3 className="text-2xl font-black text-gray-800">{visitors.length}</h3>
            </div>
          </div>
          
          <div 
            onClick={() => handleCardClick('recycle_bin', 'all')}
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
        </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2" onClick={(e) => e.stopPropagation()}>
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
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/30 bg-white/50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">
                {customerFilter === 'manual' ? 'العملاء المضافين يدوياً' :
                 customerFilter === 'unassigned' ? 'قائمة عملاء في الانتظار' :
                 'إجمالي قائمة العملاء المسجلين بالنظام'}
              </h2>
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
                    <th className="p-4 font-semibold text-gray-600 text-sm">تاريخ الإرسال</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">الحالة</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">الموظف (تاريخ الاستلام)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50">
                  {customers.filter(c => customerFilter === 'all' || (customerFilter === 'unassigned' && c.status === 'unassigned') || (customerFilter === 'manual' && c.addedBy)).map(customer => {
                    const empName = employees.find(e => e.email === customer.assignedTo)?.name || customer.assignedTo?.split('@')[0];
                    return (
                      <tr key={customer.id} className="hover:bg-gray-50 transition">
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={selectedCustomers.includes(customer.id)} onChange={() => toggleCustomerSelection(customer.id)} className="w-4 h-4 text-primary rounded" />
                        </td>
                        <td className="p-4 text-sm font-bold text-gray-800" dir="ltr">{customer.phoneNumber}</td>
                        <td className="p-4 text-sm font-semibold text-gray-700">
                          {customer.name}
                          {customer.addedBy && <span className="block text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full w-max mt-1">مضاف يدوياً</span>}
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
                        <td className="p-4">
                          <button 
                            onClick={() => navigate('/inbox', { state: { selectedCustomerId: customer.id } })}
                            className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center whitespace-nowrap"
                          >
                            مراسلة <MessageSquare size={14} className="mr-1" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {customers.filter(c => customerFilter === 'all' || (customerFilter === 'unassigned' && c.status === 'unassigned') || (customerFilter === 'manual' && c.addedBy)).length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-500">لا يوجد عملاء مسجلين بعد.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/30 bg-white/50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">قائمة الموظفين وإدارة الصلاحيات</h2>
              {selectedEmployees.length > 0 && (
                <button 
                  onClick={deleteSelectedEmployees}
                  className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-lg flex items-center text-sm font-bold transition"
                >
                  <Trash2 size={16} className="mr-2" /> حذف {selectedEmployees.length} موظف
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 w-12 text-center">
                      <input type="checkbox" checked={selectedEmployees.length > 0 && selectedEmployees.length === employees.filter(e => e.role !== 'admin').length} onChange={toggleAllEmployees} className="w-4 h-4 text-primary rounded" />
                    </th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">اسم الموظف</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">بيانات الدخول (م/س)</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">أول دخول</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">آخر دخول</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm text-center">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map(emp => {
                    if (emp.role === 'admin') return null;
                    return (
                      <tr key={emp.id} className={`hover:bg-gray-50 transition ${emp.isActive === false ? 'opacity-60 bg-red-50/50' : ''}`}>
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={selectedEmployees.includes(emp.id)} onChange={() => toggleEmployeeSelection(emp.id)} className="w-4 h-4 text-primary rounded" />
                        </td>
                        <td className="p-4 text-sm font-bold text-gray-800">
                          <div className="flex items-center">
                            {emp.isActive === false && <span className="w-2 h-2 bg-red-500 rounded-full ml-2" title="موقوف"></span>}
                            {emp.isActive !== false && <span className="w-2 h-2 bg-green-500 rounded-full ml-2" title="نشط"></span>}
                            {emp.name}
                          </div>
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
                              onClick={() => { setEditEmp(emp); setIsEditEmployeeOpen(true); }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="تعديل الباسورد"
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              onClick={() => toggleEmployeeActive(emp)}
                              className={`p-2 rounded-lg transition shadow-sm border ${emp.isActive === false ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}
                              title={emp.isActive === false ? "السماح بالدخول (تفعيل)" : "إيقاف الموظف (طرد)"}
                            >
                              {emp.isActive === false ? <Play size={18} /> : <Pause size={18} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {employees.filter(e => e.role !== 'admin').length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-500">لا يوجد موظفين مسجلين بعد.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Visitors Tab */}
        {activeTab === 'visitors' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/30 bg-white/50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">قائمة العملاء الزوار</h2>
              {selectedVisitors.length > 0 && (
                <button 
                  onClick={deleteSelectedVisitors}
                  className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-lg flex items-center text-sm font-bold transition"
                >
                  <Trash2 size={16} className="mr-2" /> حذف {selectedVisitors.length} زائر
                </button>
              )}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visitors.map(visitor => (
                    <tr key={visitor.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 text-center">
                        <input type="checkbox" checked={selectedVisitors.includes(visitor.id)} onChange={() => toggleVisitorSelection(visitor.id)} className="w-4 h-4 text-primary rounded" />
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-800">{visitor.firstName} {visitor.lastName}</td>
                      <td className="p-4 text-sm font-mono text-gray-600" dir="ltr">{visitor.phone}</td>
                      <td className="p-4 text-sm text-gray-600">{visitor.email || 'غير متوفر'}</td>
                      <td className="p-4 text-xs text-gray-500" dir="ltr">{formatDate(visitor.createdAt)}</td>
                    </tr>
                  ))}
                  {visitors.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-500">لا يوجد زوار مسجلين.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recycle Bin Tab */}
        {activeTab === 'recycle_bin' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-red-500/20 overflow-hidden" onClick={e => e.stopPropagation()}>
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
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-red-50/30 border-b border-red-100">
                    <th className="p-4 font-semibold text-gray-600 text-sm">النوع</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">بيانات العنصر</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm">تاريخ الحذف</th>
                    <th className="p-4 font-semibold text-gray-600 text-sm text-center">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {recycleBin.filter(item => rbFilter === 'all' || item.type === rbFilter).map(item => (
                    <tr key={item.id} className="hover:bg-red-50/50 transition">
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
                      <td colSpan="4" className="p-8 text-center text-gray-500">سلة المهملات فارغة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Add Employee */}
        {isAddEmployeeOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
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

        {/* Modal: Edit Employee Password */}
        {isEditEmployeeOpen && editEmp && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
              <button 
                onClick={() => setIsEditEmployeeOpen(false)} 
                className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition"
              >
                <X size={24} />
              </button>
              
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <Shield className="ml-2 text-blue-600" size={24} /> 
                تعديل الباسورد: {editEmp.name}
              </h2>

              {errorEdit && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
                  {errorEdit}
                </div>
              )}

              <form onSubmit={handleEditEmployee} className="space-y-4">
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
