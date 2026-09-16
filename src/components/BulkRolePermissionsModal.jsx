import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ShieldCheck, AlertCircle, Check, Info, RefreshCw, 
  Search, CheckCircle2, XCircle, Save, Sparkles, Sliders,
  Eye, EyeOff, Lock, Shield, Layers, HelpCircle, CheckSquare, Square,
  Settings, Users, UserCheck, Crown, PhoneCall, HeartHandshake, Zap, Globe
} from 'lucide-react';
import { db, doc, updateDoc, setDoc, writeBatch } from '../firebase';
import { toast } from 'react-hot-toast';
import { 
  CARDS_PERMISSIONS_CONFIG, 
  SYSTEM_PERMISSIONS, 
  getEmployeeRoleKey, 
  getDefaultPermissionsForRole, 
  getEmployeeResolvedPermissions 
} from '../config/permissionsConfig';

export default function BulkRolePermissionsModal({ isOpen, onClose, employees = [], onSaveSuccess }) {
  if (!isOpen) return null;

  const [selectedRole, setSelectedRole] = useState('leader'); // 'leader', 'agent', 'coordinator', 'customer_service', 'all'
  const [permissions, setPermissions] = useState({});
  const [selectedCardFilter, setSelectedCardFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Target matching employees based on selectedRole
  const matchingEmployees = employees.filter(emp => {
    if (emp.role === 'admin' || (emp.jobTitle || '').toLowerCase() === 'admin') return false; // Exclude admins
    if (selectedRole === 'all') return true;
    const empRole = getEmployeeRoleKey(emp);
    return empRole === selectedRole;
  });

  // Re-initialize permissions when selectedRole changes
  useEffect(() => {
    const defaultRoleKey = selectedRole === 'all' ? 'agent' : selectedRole;
    const defaults = getDefaultPermissionsForRole(defaultRoleKey);

    // Check if matching employees have a common override pattern or pick defaults
    if (matchingEmployees.length > 0) {
      // Pick first matching employee's permissions as initial template
      const firstResolved = getEmployeeResolvedPermissions(matchingEmployees[0]);
      setPermissions(firstResolved);
    } else {
      setPermissions(defaults);
    }
  }, [selectedRole]);

  // Toggle single permission (master or sub)
  const handleToggle = (permId) => {
    const permObj = SYSTEM_PERMISSIONS.find(p => p.id === permId);
    if (selectedRole === 'leader' && permObj?.cardId === 'recycle_bin' && permId === 'canEmptyRecycleBin') {
      toast.error('غير مصرح بتفريغ سلة المهملات لليدر لحماية بيانات المنصة ⛔');
      return;
    }
    setPermissions(prev => ({
      ...prev,
      [permId]: !prev[permId]
    }));
  };

  // Toggle master card visibility
  const handleToggleMaster = (card) => {
    const currentVal = !!permissions[card.masterKey];
    const newVal = !currentVal;

    setPermissions(prev => {
      const updated = { ...prev, [card.masterKey]: newVal };
      if (newVal) {
        const anySubActive = card.subPermissions.some(sub => prev[sub.id]);
        if (!anySubActive) {
          card.subPermissions.forEach(sub => {
            updated[sub.id] = true;
          });
        }
      }
      return updated;
    });
  };

  // Select all permissions for selected role
  const handleSelectAll = () => {
    const allOn = {};
    SYSTEM_PERMISSIONS.forEach(p => {
      if (selectedRole === 'leader' && p.id === 'canEmptyRecycleBin') {
        allOn[p.id] = false;
      } else {
        allOn[p.id] = true;
      }
    });
    setPermissions(allOn);
    toast.success('تم تحديد وتفعيل كافة الصلاحيات لهذه الفئة ✨');
  };

  // Deselect all permissions for selected role
  const handleDeselectAll = () => {
    const allOff = {};
    SYSTEM_PERMISSIONS.forEach(p => {
      allOff[p.id] = false;
    });
    setPermissions(allOff);
    toast.success('تم إغلاق كافة الصلاحيات لهذه الفئة ⛔');
  };

  // Reset to role defaults
  const handleResetDefaults = () => {
    const roleKey = selectedRole === 'all' ? 'agent' : selectedRole;
    const defaults = getDefaultPermissionsForRole(roleKey);
    setPermissions(defaults);
    toast.success('تم إعادة الصلاحيات للقيم الافتراضية للمسمى الوظيفي 🔄');
  };

  // Batch Save to Firestore
  const handleBulkSave = async () => {
    if (matchingEmployees.length === 0) {
      toast.error('لا يوجد موظفون ينطبق عليهم هذا المسمى الوظيفي حالياً');
      return;
    }

    try {
      setIsSaving(true);
      const roleLabel = selectedRole === 'leader' ? 'Team Leaders' :
                        selectedRole === 'agent' ? 'Sales / Agents' :
                        selectedRole === 'coordinator' ? 'Coordinators' :
                        selectedRole === 'customer_service' ? 'Customer Service' : 'جميع الموظفين';

      toast.loading(`جاري تحديث وتطبيق الصلاحيات لـ ${matchingEmployees.length} موظف (${roleLabel})...`, { id: 'bulk-perm-toast' });

      const updatedIds = [];
      const CHUNK_SIZE = 400;
      const updateData = {
        customPermissions: permissions,
        permissionsUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      for (let i = 0; i < matchingEmployees.length; i += CHUNK_SIZE) {
        const chunk = matchingEmployees.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach(emp => {
          const primaryId = emp.id || emp.uid;
          if (primaryId) {
            updatedIds.push(primaryId);
            if (emp.uid) updatedIds.push(emp.uid);
            
            const docRef = doc(db, 'users', primaryId);
            batch.set(docRef, updateData, { merge: true });

            if (emp.uid && emp.uid !== primaryId) {
              const altDocRef = doc(db, 'users', emp.uid);
              batch.set(altDocRef, updateData, { merge: true });
            }
          }
        });

        await batch.commit();
      }

      toast.success(`تم تحديث وتطبيق الصلاحيات لـ ${matchingEmployees.length} موظف (${roleLabel}) بنجاح! 🚀`, { id: 'bulk-perm-toast' });

      if (onSaveSuccess) {
        onSaveSuccess(permissions, selectedRole, updatedIds);
      }

      onClose();
    } catch (err) {
      console.error('Error saving bulk role permissions:', err);
      toast.error('حدث خطأ أثناء حفظ الصلاحيات الجماعية: ' + err.message, { id: 'bulk-perm-toast' });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter cards based on tab selection & search query
  const filteredCards = CARDS_PERMISSIONS_CONFIG.filter(card => {
    if (selectedCardFilter !== 'all' && card.id !== selectedCardFilter) return false;
    if (!searchQuery.trim()) return true;

    const query = searchQuery.trim().toLowerCase();
    const titleMatch = card.title.toLowerCase().includes(query);
    const descMatch = card.description.toLowerCase().includes(query);
    const subMatch = card.subPermissions.some(s => s.title.toLowerCase().includes(query) || s.description.toLowerCase().includes(query));

    return titleMatch || descMatch || subMatch;
  });

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-5xl bg-slate-900 border border-amber-500/30 rounded-2xl sm:rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.2)] overflow-hidden text-slate-100 flex flex-col max-h-[90vh] my-auto"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 border-b border-amber-500/20 bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl text-slate-950 shadow-lg shadow-amber-500/20 border border-amber-300/40">
              <Settings size={26} className="animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-amber-300 tracking-tight">
                  ترس التحكم الإداري بالجماعي وحسب اللقب
                </h3>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  تحكم شامل ⚡
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-medium">
                تفعيل أو إغلاق الصلاحيات لجميع الليدرز أو الموظفين بمسمى وظيفي محدد دفعة واحدة دون الحاجة للدخول لكل موظف.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="إغلاق النافذة"
          >
            <X size={20} />
          </button>
        </div>

        {/* ROLE SELECTION TABS & MATCHING EMPLOYEES BAR */}
        <div className="px-5 py-4 border-b border-purple-500/20 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-amber-300 px-1">اختر المسمى الوظيفي المستهدف:</span>
            
            <button
              type="button"
              onClick={() => setSelectedRole('leader')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer border ${
                selectedRole === 'leader'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-300 shadow-md scale-105'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Crown size={14} /> 👑 Team Leaders
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('agent')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer border ${
                selectedRole === 'agent'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-md scale-105'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <UserCheck size={14} /> 👤 Agents / Sales
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('coordinator')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer border ${
                selectedRole === 'coordinator'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-blue-400 shadow-md scale-105'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Users size={14} /> 📋 Coordinators
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('customer_service')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer border ${
                selectedRole === 'customer_service'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-teal-400 shadow-md scale-105'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <HeartHandshake size={14} /> 📞 Customer Service
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer border ${
                selectedRole === 'all'
                  ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-400 shadow-md scale-105'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Globe size={14} /> 🌐 جميع الموظفين
            </button>
          </div>

          <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-xl">
            <Users size={15} className="text-amber-300" />
            <span className="text-xs font-bold text-amber-200">
              المستهدفون الآن: <strong className="text-amber-400 font-black text-sm px-1">{matchingEmployees.length}</strong> موظف
            </span>
          </div>
        </div>

        {/* CONTROLS & SEARCH TOOLBAR */}
        <div className="px-5 py-3 border-b border-purple-500/20 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <CheckSquare size={13} /> تفعيل كافة الصلاحيات
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-500/40 hover:bg-rose-900 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Square size={13} /> إغلاق كافة الصلاحيات
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} /> الافتراضي لهذا المسمى
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="بحث في الصلاحيات والكروت..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-purple-500/30 text-white placeholder-slate-400 rounded-xl py-1.5 pr-9 pl-3 text-xs focus:outline-none focus:border-amber-400 transition"
            />
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* MODAL BODY (PERMISSIONS LIST) */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {filteredCards.map(card => {
            const isMasterActive = !!permissions[card.masterKey];
            const activeSubCount = card.subPermissions.filter(s => permissions[s.id]).length;

            return (
              <div 
                key={card.id}
                className={`rounded-2xl border transition-all ${
                  isMasterActive 
                    ? 'bg-slate-900/90 border-purple-500/30 shadow-lg' 
                    : 'bg-slate-950/40 border-slate-800 opacity-80'
                }`}
              >
                {/* Card Master Header */}
                <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 rounded-t-2xl border-b border-purple-500/20">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${isMasterActive ? 'bg-purple-900/60 border-purple-400/50 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                      <Shield size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-amber-300 flex items-center gap-2">
                        <span>{card.title}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                          ({activeSubCount}/{card.subPermissions.length} إجـراء)
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{card.description}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleMaster(card)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 border cursor-pointer ${
                      isMasterActive 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-md' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                    }`}
                  >
                    {isMasterActive ? <Eye size={14} /> : <EyeOff size={14} />}
                    <span>{isMasterActive ? 'الكارت مـفـعـل' : 'الكارت مـغـلـق'}</span>
                  </button>
                </div>

                {/* Sub Permissions Grid */}
                {isMasterActive && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/40">
                    {card.subPermissions.map(sub => {
                      const isSubActive = !!permissions[sub.id];
                      return (
                        <div
                          key={sub.id}
                          onClick={() => handleToggle(sub.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                            isSubActive 
                              ? 'bg-purple-950/40 border-purple-400/40 shadow-sm' 
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-black ${isSubActive ? 'text-amber-200' : 'text-slate-400'}`}>
                                {sub.title}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              {sub.description}
                            </p>
                          </div>

                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition ${
                            isSubActive ? 'bg-amber-500 border-amber-400 text-slate-950' : 'border-slate-600 bg-slate-900'
                          }`}>
                            {isSubActive && <Check size={13} className="stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-amber-500/20 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-amber-300/90 font-bold flex items-center gap-1.5">
            <Zap size={15} className="text-amber-400 animate-pulse" />
            <span>سيتم تطبيق الصلاحيات فوراً على جميع الـ <strong>({matchingEmployees.length})</strong> موظف دون الحاجة لتعديل كل حساب على حدة.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleBulkSave}
              disabled={isSaving || matchingEmployees.length === 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 border border-amber-300 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>جاري تطبيق وحفظ الصلاحيات...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>تطبيق وتحديث كافة موظفي هذا المسمى الآن 🚀</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
