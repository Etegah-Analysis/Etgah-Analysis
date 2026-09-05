import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ShieldCheck, AlertCircle, Check, Info, RefreshCw, 
  Search, CheckCircle2, XCircle, Save, Sparkles, Sliders,
  HelpCircle, Lock, Shield
} from 'lucide-react';
import { db, doc, updateDoc } from '../firebase';
import { toast } from 'react-hot-toast';
import { 
  PERMISSIONS_CATEGORIES, 
  SYSTEM_PERMISSIONS, 
  getEmployeeRoleKey, 
  getDefaultPermissionsForRole, 
  getEmployeeResolvedPermissions 
} from '../config/permissionsConfig';

export default function EmployeePermissionsModal({ isOpen, onClose, employee, onSaveSuccess }) {
  if (!isOpen || !employee) return null;

  const roleKey = getEmployeeRoleKey(employee);
  const [permissions, setPermissions] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTooltipId, setActiveTooltipId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize or re-sync permissions when employee changes
  useEffect(() => {
    if (employee) {
      setPermissions(getEmployeeResolvedPermissions(employee));
      setActiveTooltipId(null);
      setSearchQuery('');
      setSelectedCategory('all');
    }
  }, [employee]);

  // Toggle single permission
  const handleToggle = (permId) => {
    setPermissions(prev => ({
      ...prev,
      [permId]: !prev[permId]
    }));
  };

  // Reset to role defaults
  const handleResetToDefaults = () => {
    const defaults = getDefaultPermissionsForRole(roleKey);
    setPermissions(defaults);
    toast.success(`تم استعادة الصلاحيات الافتراضية لوظيفة (${getRoleArabicTitle(roleKey)}) بنجاح 🔄`);
  };

  // Enable all
  const handleEnableAll = () => {
    const allOn = {};
    SYSTEM_PERMISSIONS.forEach(p => {
      allOn[p.id] = true;
    });
    setPermissions(allOn);
    toast.success('تم تفعيل جميع الصلاحيات بالكامل ✅');
  };

  // Disable all
  const handleDisableAll = () => {
    const allOff = {};
    SYSTEM_PERMISSIONS.forEach(p => {
      allOff[p.id] = false;
    });
    setPermissions(allOff);
    toast('تم إيقاف وتعطيل جميع الصلاحيات ⛔', { icon: '⚠️' });
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
      toast.success(`تم حفظ وتحديث صلاحيات (${employee.name || employee.username}) فوراً في النظام 🔐✨`);
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
    return 'مسؤول مبيعات (Agent)';
  }

  // Filter permissions
  const filteredPermissions = SYSTEM_PERMISSIONS.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = !searchQuery.trim() || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.goal.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeCount = Object.values(permissions).filter(Boolean).length;
  const totalCount = SYSTEM_PERMISSIONS.length;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-slate-900 border border-purple-500/40 rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(112,26,117,0.5)] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border-b border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl shadow-lg border border-purple-400/30 text-white shrink-0">
              <Sliders size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-white">
                  إعدادات وصلاحيات الموظف: {employee.name || employee.username}
                </h2>
                <span className="bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {getRoleArabicTitle(roleKey)}
                </span>
                {employee.empCode && (
                  <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2 py-0.5 rounded-full text-xs font-mono">
                    #{employee.empCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-purple-200/70 mt-1">
                تحكم دقيق ومباشر في جميع وظائف وصلاحيات السيستم المتاحة لهذا الموظف
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="bg-slate-800/90 border border-purple-400/20 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs">
              <span className="text-gray-400 font-bold">المفعّل:</span>
              <span className="text-emerald-400 font-black font-mono text-sm">{activeCount}</span>
              <span className="text-gray-500">/</span>
              <span className="text-gray-400 font-mono">{totalCount}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              title="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* QUICK CONTROLS & FILTER BAR */}
        <div className="p-3 sm:p-4 bg-slate-900/90 border-b border-purple-500/20 flex flex-col gap-3 shrink-0">
          {/* Quick Action Buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="px-3 py-1.5 bg-purple-900/40 hover:bg-purple-800/60 border border-purple-400/30 text-purple-200 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="استعادة الصلاحيات الافتراضية لوظيفة الموظف كما هو مسجل بالسيستم"
              >
                <RefreshCw size={14} className="text-purple-300" />
                <span>استعادة افتراضي الوظيفة ({getRoleArabicTitle(roleKey).split(' ')[0]})</span>
              </button>
              <button
                type="button"
                onClick={handleEnableAll}
                className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-800/50 border border-emerald-500/30 text-emerald-300 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <CheckCircle2 size={14} />
                <span>تفعيل الكل</span>
              </button>
              <button
                type="button"
                onClick={handleDisableAll}
                className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-800/50 border border-rose-500/30 text-rose-300 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <XCircle size={14} />
                <span>إيقاف الكل</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400" />
              <input
                type="text"
                placeholder="بحث في الصلاحيات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-8 pl-3 py-1.5 bg-slate-800/80 border border-purple-500/30 rounded-xl text-xs text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
              }`}
            >
              🌐 جميع الصلاحيات ({SYSTEM_PERMISSIONS.length})
            </button>
            {PERMISSIONS_CATEGORIES.map(cat => {
              const catTotal = SYSTEM_PERMISSIONS.filter(p => p.category === cat.id).length;
              const catActive = SYSTEM_PERMISSIONS.filter(p => p.category === cat.id && permissions[p.id]).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    selectedCategory === cat.id
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{cat.title.split(' ')[0]}</span>
                  <span>{cat.title.split(' ')[1]}</span>
                  <span className="text-[10px] bg-black/30 px-1.5 py-0.2 rounded-md font-mono text-purple-200">
                    {catActive}/{catTotal}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PERMISSIONS LIST (BODY) */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-3 custom-scrollbar bg-slate-950/60">
          {filteredPermissions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              لم يتم العثور على صلاحيات مطابقة للبحث أو التصنيف المحدد.
            </div>
          ) : (
            filteredPermissions.map(perm => {
              const isEnabled = !!permissions[perm.id];
              const isTooltipOpen = activeTooltipId === perm.id;

              return (
                <div 
                  key={perm.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-2.5 ${
                    isEnabled 
                      ? 'bg-slate-900/90 border-emerald-500/40 shadow-[0_4px_15px_rgba(16,185,129,0.08)]' 
                      : 'bg-slate-900/40 border-rose-500/30 opacity-85'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                    {/* Permission Title & Info */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Exclamation / Info Tooltip Button */}
                      <button
                        type="button"
                        onClick={() => setActiveTooltipId(isTooltipOpen ? null : perm.id)}
                        className={`p-1.5 rounded-xl border transition cursor-pointer mt-0.5 shrink-0 ${
                          isTooltipOpen
                            ? 'bg-amber-500 text-black border-amber-300 shadow-md scale-110'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}
                        title="انقر لعرض معنى الصلاحية والهدف منها ومستوى أمانها"
                      >
                        <AlertCircle size={17} className={isTooltipOpen ? 'stroke-[2.5]' : ''} />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white tracking-wide">
                            {perm.title}
                          </h4>
                          {/* Risk Level Badge */}
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            perm.riskLevel === 'critical'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : perm.riskLevel === 'high'
                              ? 'bg-orange-950 text-orange-300 border border-orange-500/40'
                              : perm.riskLevel === 'medium'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-blue-950 text-blue-300 border border-blue-500/40'
                          }`}>
                            {perm.riskLabel}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                          {perm.description}
                        </p>
                      </div>
                    </div>

                    {/* Green / Red Interactive Toggle Switch */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <span className={`text-xs font-black font-mono transition-colors ${
                        isEnabled ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {isEnabled ? 'مفعّل' : 'معطّل'}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggle(perm.id)}
                        className={`w-16 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out cursor-pointer focus:outline-none flex items-center shadow-inner ${
                          isEnabled 
                            ? 'bg-emerald-600 justify-end shadow-[0_0_15px_rgba(16,185,129,0.5)]' 
                            : 'bg-rose-600 justify-start shadow-[0_0_15px_rgba(225,29,72,0.4)]'
                        }`}
                        title={isEnabled ? "انقر للتعطيل (إيقاف)" : "انقر للتفعيل (تشغيل)"}
                      >
                        <div 
                          className={`w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300 ${
                            isEnabled ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                          }`}
                        >
                          {isEnabled ? <Check size={14} className="stroke-[3]" /> : <X size={14} className="stroke-[3]" />}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Expandable Explanation Card (When Exclamation Mark Clicked) */}
                  {isTooltipOpen && (
                    <div className="p-3.5 bg-gradient-to-br from-amber-950/40 via-slate-900 to-purple-950/40 border border-amber-500/30 rounded-xl mt-1 text-xs space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                        <span className="text-amber-300 font-black flex items-center gap-1">
                          <span>💡 تفاصيل الصلاحية:</span>
                          <span>{perm.title}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTooltipId(null)}
                          className="text-gray-400 hover:text-white p-0.5"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-200">
                        <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                          <span className="text-purple-300 font-bold block mb-1">📖 معنى الصلاحية:</span>
                          <p className="text-gray-300 leading-relaxed">{perm.description}</p>
                        </div>
                        <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                          <span className="text-emerald-300 font-bold block mb-1">🎯 الهدف منها:</span>
                          <p className="text-gray-300 leading-relaxed">{perm.goal}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                        <span>مستوى الأمان: <strong className="text-amber-300">{perm.riskLabel}</strong></span>
                        <span>الوضع الافتراضي لوظيفة ({getRoleArabicTitle(roleKey).split(' ')[0]}): <strong className={perm.defaultByRole[roleKey] ? 'text-emerald-400' : 'text-rose-400'}>{perm.defaultByRole[roleKey] ? 'مفعّل تلقائياً' : 'معطّل افتراضياً'}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border-t border-purple-500/30 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="text-xs text-gray-400">
            <span>سيتم تطبيق الصلاحيات وحفظها في الحساب فور الضغط على حفظ.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إلغاء التراجع
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-xs font-black transition shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 border border-emerald-400/40"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>جاري حفظ الصلاحيات...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>حفظ الصلاحيات وتطبيقها فوراً 💾✨</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' && document.body ? createPortal(modalContent, document.body) : modalContent;
}
