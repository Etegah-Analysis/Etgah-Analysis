import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ShieldCheck, AlertCircle, Check, Info, RefreshCw, 
  Search, CheckCircle2, XCircle, Save, Sparkles, Sliders,
  Eye, EyeOff, Lock, Shield, Layers, HelpCircle, CheckSquare, Square
} from 'lucide-react';
import { db, doc, updateDoc } from '../firebase';
import { toast } from 'react-hot-toast';
import { 
  CARDS_PERMISSIONS_CONFIG, 
  SYSTEM_PERMISSIONS, 
  getEmployeeRoleKey, 
  getDefaultPermissionsForRole, 
  getEmployeeResolvedPermissions 
} from '../config/permissionsConfig';

export default function EmployeePermissionsModal({ isOpen, onClose, employee, onSaveSuccess }) {
  if (!isOpen || !employee) return null;

  const roleKey = getEmployeeRoleKey(employee);
  const [permissions, setPermissions] = useState({});
  const [selectedCardFilter, setSelectedCardFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTooltipId, setActiveTooltipId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize or re-sync permissions when employee changes
  useEffect(() => {
    if (employee) {
      setPermissions(getEmployeeResolvedPermissions(employee));
      setActiveTooltipId(null);
      setSearchQuery('');
      setSelectedCardFilter('all');
    }
  }, [employee]);

  // Toggle single permission (master or sub)
  const handleToggle = (permId) => {
    const permObj = SYSTEM_PERMISSIONS.find(p => p.id === permId);
    if (roleKey === 'leader' && permObj?.cardId === 'recycle_bin' && permId === 'canEmptyRecycleBin') {
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
      // If turning master ON and all sub-permissions are off, turn on default sub-permissions
      if (newVal) {
        const anySubActive = card.subPermissions.some(sub => prev[sub.id]);
        if (!anySubActive) {
          card.subPermissions.forEach(sub => {
            updated[sub.id] = !!(sub.defaultByRole[roleKey] ?? true);
          });
        }
      }
      return updated;
    });

    if (newVal) {
      toast.success(`تم تفعيل وإظهار كارت (${card.title}) للموظف 👁️`);
    } else {
      toast(`تم إخفاء كارت (${card.title}) عن الموظف 🔒`, { icon: '🙈' });
    }
  };

  // Toggle all actions for a specific card
  const handleToggleCardActions = (card, enable) => {
    setPermissions(prev => {
      const updated = { ...prev, [card.masterKey]: enable };
      card.subPermissions.forEach(sub => {
        if (roleKey === 'leader' && sub.id === 'canEmptyRecycleBin') {
          updated[sub.id] = false;
        } else {
          updated[sub.id] = enable;
        }
      });
      return updated;
    });
  };

  // Reset to role defaults
  const handleResetToDefaults = () => {
    const defaults = getDefaultPermissionsForRole(roleKey);
    setPermissions(defaults);
    toast.success(`تم استعادة الصلاحيات الافتراضية لوظيفة (${getRoleArabicTitle(roleKey)}) بنجاح 🔄`);
  };

  // Enable all cards and all permissions
  const handleEnableAll = () => {
    const allOn = {};
    SYSTEM_PERMISSIONS.forEach(p => {
      if (roleKey === 'leader' && p.id === 'canEmptyRecycleBin') {
        allOn[p.id] = false;
      } else {
        allOn[p.id] = true;
      }
    });
    setPermissions(allOn);
    toast.success('تم تفعيل جميع الكروت والصلاحيات بالكامل في النظام ✅✨');
  };

  // Disable all cards and permissions
  const handleDisableAll = () => {
    const allOff = {};
    SYSTEM_PERMISSIONS.forEach(p => {
      allOff[p.id] = false;
    });
    setPermissions(allOff);
    toast('تم إيقاف وحجب جميع الكروت والصلاحيات ⛔', { icon: '⚠️' });
  };

  // Save to Firestore
  const handleSave = async () => {
    if (!employee.uid && !employee.id) {
      toast.error('تعذر تحديد معرّف الموظف في النظام');
      return;
    }
    const empDocId = employee.uid || employee.id;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', empDocId);
      await updateDoc(userRef, {
        customPermissions: permissions,
        permissionsUpdatedAt: new Date().toISOString()
      });
      toast.success(`تم حفظ وتطبيق صلاحيات (${employee.name || employee.username}) فوراً في النظام 🔐✨`);
      if (onSaveSuccess) {
        onSaveSuccess(permissions, empDocId);
      }
      onClose();
    } catch (err) {
      console.error('Error saving permissions:', err);
      toast.error('حدث خطأ أثناء حفظ الصلاحيات: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  function getRoleArabicTitle(key) {
    if (key === 'admin') return 'مدير النظام (Admin)';
    if (key === 'coordinator') return 'منسق عام للإدارة (Coordinator)';
    if (key === 'leader') return 'قائد فريق مبيعات (Leader)';
    if (key === 'customer_service') return 'خدمة العملاء (Customer Service)';
    return 'مسؤول مبيعات (Agent)';
  }

  // Filter cards based on selected filter and search query
  const filteredCards = CARDS_PERMISSIONS_CONFIG.filter(card => {
    if (selectedCardFilter !== 'all' && card.id !== selectedCardFilter) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.trim().toLowerCase();
    const matchesCard = card.title.toLowerCase().includes(q) || 
                        card.subtitle.toLowerCase().includes(q) || 
                        card.description.toLowerCase().includes(q);
    const matchesSub = card.subPermissions.some(sub => 
      sub.title.toLowerCase().includes(q) || sub.description.toLowerCase().includes(q)
    );
    return matchesCard || matchesSub;
  });

  const activeCardsCount = CARDS_PERMISSIONS_CONFIG.filter(c => !!permissions[c.masterKey]).length;
  const totalSubPermsActive = SYSTEM_PERMISSIONS.filter(p => !p.isMaster && !!permissions[p.id]).length;

  return createPortal(
    <div 
      className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border border-amber-500/30 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-[0_20px_70px_rgba(0,0,0,0.8)] overflow-hidden text-white my-auto animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-lg shadow-amber-500/20 shrink-0">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-amber-300 font-black text-xl sm:text-2xl">
                {(employee.name || employee.username || 'م').charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black text-amber-300">
                  لوحة تحكم الصلاحيات والكروت 🔐
                </h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {employee.name || employee.username}
                </span>
                <span className="bg-purple-500/20 text-purple-300 border border-purple-400/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {employee.jobTitle || getRoleArabicTitle(roleKey)}
                </span>
              </div>
              <p className="text-xs text-purple-200/80 mt-1">
                حدد الكروت التي تظهر في لوحة الموظف واضبط الصلاحيات والإجراءات الفرعية بنقرة واحدة
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* STATUS & BULK ACTIONS BAR */}
        <div className="px-4 sm:px-6 py-3 bg-slate-950/60 border-b border-purple-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-emerald-300 font-bold">
              <Eye size={15} />
              <span>الكروت المفعلة:</span>
              <span className="font-black text-white">{activeCardsCount} من {CARDS_PERMISSIONS_CONFIG.length}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-purple-950/60 border border-purple-500/30 px-3 py-1.5 rounded-xl text-purple-300 font-bold">
              <Shield size={15} />
              <span>الإجراءات النشطة:</span>
              <span className="font-black text-white">{totalSubPermsActive}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleEnableAll}
              className="bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="تفعيل كافة الكروت والإجراءات في السيستم"
            >
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>تفعيل الكل ✅</span>
            </button>
            <button
              onClick={handleDisableAll}
              className="bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="تعطيل وحجب جميع الكروت والإجراءات"
            >
              <XCircle size={14} className="text-rose-400" />
              <span>حجب الكل ⛔</span>
            </button>
            <button
              onClick={handleResetToDefaults}
              className="bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="استعادة الصلاحيات القياسية الافتراضية"
            >
              <RefreshCw size={14} className="text-amber-400" />
              <span>الافتراضي 🔄</span>
            </button>
          </div>
        </div>

        {/* SEARCH & FILTER BAR */}
        <div className="p-4 sm:px-6 bg-slate-900/40 border-b border-purple-500/10 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-purple-400" size={17} />
            <input
              type="text"
              placeholder="🔍 ابحث عن اسم كارت أو صلاحية (مثال: بوفيه، توصيات، رواتب، حذف، واتساب)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-purple-500/30 rounded-xl pr-10 pl-4 py-2 text-xs font-bold text-slate-100 placeholder-purple-400/50 focus:outline-none focus:border-amber-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-300 font-bold shrink-0">فلترة بالكارت:</span>
            <select
              value={selectedCardFilter}
              onChange={e => setSelectedCardFilter(e.target.value)}
              className="bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">🌐 جميع الكروت (16 كارت)</option>
              {CARDS_PERMISSIONS_CONFIG.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CARDS CONTAINER (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredCards.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <AlertCircle className="mx-auto text-amber-400 mb-2" size={36} />
              <p className="font-bold text-sm">لا توجد كروت أو صلاحيات مطابقة لكلمة البحث</p>
            </div>
          ) : (
            filteredCards.map(card => {
              const isMasterActive = !!permissions[card.masterKey];
              const cardSubPerms = card.subPermissions;
              const activeSubsCount = cardSubPerms.filter(s => !!permissions[s.id]).length;

              return (
                <div 
                  key={card.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isMasterActive 
                      ? 'bg-slate-900/90 border-amber-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.3)]' 
                      : 'bg-slate-950/60 border-slate-800 opacity-80'
                  }`}
                >
                  {/* CARD HEADER WITH MASTER SWITCH */}
                  <div className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b ${
                    isMasterActive ? 'bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border-amber-500/20' : 'bg-slate-900/50 border-slate-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl border text-xl sm:text-2xl shrink-0 ${
                        isMasterActive 
                          ? 'bg-amber-500/20 border-amber-400/40 shadow-inner' 
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}>
                        {card.title.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-sm sm:text-base font-black ${isMasterActive ? 'text-amber-300' : 'text-slate-400'}`}>
                            {card.title}
                          </h3>
                          <span className="text-[11px] text-purple-300/70 font-bold">
                            ({card.subtitle})
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isMasterActive 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' 
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {isMasterActive ? `مفعل (${activeSubsCount}/${cardSubPerms.length} إجراء)` : 'الكارت مخفي'}
                          </span>
                        </div>
                        <p className="text-xs text-purple-200/70 mt-0.5">
                          {card.description}
                        </p>
                      </div>
                    </div>

                    {/* MASTER TOGGLE SWITCH */}
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <span className="text-[11px] font-black block text-slate-300">
                          {isMasterActive ? 'ظهور الكارت: مفعل 👁️' : 'ظهور الكارت: مخفي 🔒'}
                        </span>
                        <span className="text-[10px] text-purple-300/70">
                          {isMasterActive ? 'يظهر بالداشبورد' : 'محجوب عن الموظف'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleMaster(card)}
                        className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer shadow-inner ${
                          isMasterActive ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-slate-700'
                        }`}
                      >
                        <div 
                          className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 flex items-center justify-center ${
                            isMasterActive ? '-translate-x-6' : 'translate-x-0'
                          }`}
                        >
                          {isMasterActive ? <Check size={14} className="text-emerald-600 font-black" /> : <X size={14} className="text-slate-600" />}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* SUB PERMISSIONS ACCORDION / BODY */}
                  <div className="p-4 sm:p-5">
                    {!isMasterActive ? (
                      <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                          <EyeOff size={16} className="text-slate-500" />
                          <span>هذا الكارت مخفي حالياً في لوحة تحكم هذا الموظف. انقر زر التفعيل بالأعلى لإظهاره.</span>
                        </div>
                        <button
                          onClick={() => handleToggleMaster(card)}
                          className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                        >
                          إظهار الكارت الآن 👁️
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-500/10">
                          <span className="text-xs font-bold text-purple-300">
                            الإجراءات والصلاحيات التفصيلية التابعة للكارت:
                          </span>
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              onClick={() => handleToggleCardActions(card, true)}
                              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                            >
                              تحديد جميع إجراءات الكارت
                            </button>
                            <span className="text-slate-600">|</span>
                            <button
                              onClick={() => handleToggleCardActions(card, false)}
                              className="text-[11px] text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                            >
                              إلغاء إجراءات الكارت
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {cardSubPerms.map(sub => {
                            const isSubActive = !!permissions[sub.id];
                            return (
                              <div
                                key={sub.id}
                                onClick={() => handleToggle(sub.id)}
                                className={`p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                                  isSubActive 
                                    ? 'bg-purple-950/30 border-purple-500/40 hover:border-purple-400' 
                                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-black ${isSubActive ? 'text-amber-200' : 'text-slate-400'}`}>
                                      {sub.title}
                                    </span>
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                      sub.riskLevel === 'critical' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' :
                                      sub.riskLevel === 'high' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' :
                                      sub.riskLevel === 'medium' ? 'bg-blue-950 text-blue-300 border border-blue-500/40' :
                                      'bg-slate-800 text-slate-300'
                                    }`}>
                                      {sub.riskLabel}
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
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-purple-500/20 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-purple-300/80">
            <span>التعديلات تُطبق فوراً على حساب الموظف <strong>{employee.name || employee.username}</strong> بمجرد الحفظ.</span>
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
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>حفظ الصلاحيات فوراً 💾</span>
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
