// Permissions configuration
export const PERMISSIONS_CATEGORIES = [
  { id: 'crm', title: '📊 إدارة العملاء وقواعد البيانات (Leads & CRM)' },
  { id: 'distribution', title: '🔄 التعيين والتحويل والتوزيع (Assignment & Distribution)' },
  { id: 'deletion', title: '🗑️ الحذف وسلة المهملات (Deletion & Recycle Bin)' },
  { id: 'whatsapp', title: '💬 الواتساب والحملات الإعلانية (WhatsApp & Campaigns)' },
  { id: 'calls_analytics', title: '📞 المكالمات والبريد وتقارير الأداء (Calls, Email & Analytics)' },
  { id: 'system', title: '⚙️ التصدير والاستيراد وإدارة النظام (Export, Import & System)' },
];

export const SYSTEM_PERMISSIONS = [
  // 1. CRM & Leads Databases
  {
    id: 'canViewAllCrm',
    category: 'crm',
    title: 'عرض شيت CRM العام الشامل',
    description: 'يسمح للموظف بالوصول إلى قاعدة بيانات الـ CRM الشاملة لجميع العملاء (15,000+ عميل) وليس فقط العملاء المخصصين له.',
    goal: 'تمكين الإشراف العام والمتابعة الشاملة لتدفق العملاء والمشتركين عبر المنصة.',
    riskLevel: 'high',
    riskLabel: 'حساس',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false }
  },
  {
    id: 'canViewTeamLeads',
    category: 'crm',
    title: 'عرض وإشراف عملاء فريق العمل (Team Leads)',
    description: 'يسمح للمستخدم برؤية ومتابعة جميع عملاء موظفي المبيعات التابعين له في الفريق.',
    goal: 'مساعدة قادة الفرق (الليدر) في توجيه ومتابعة إنجاز الفريق وتقييم أداء كل موظف.',
    riskLevel: 'medium',
    riskLabel: 'متوسط',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: false }
  },
  {
    id: 'canViewEmployeeLeadsTab',
    category: 'crm',
    title: 'كارت وقاعدة داتا الموظف (Employee Leads)',
    description: 'إمكانية فتح كارت داتا الموظف الخاصة والعمل على أرقام الشيتات المسندة له شخصياً.',
    goal: 'تنظيم مهام الاتصال اليومية لكل موظف على شيتاته الخاصة بدون تداخل.',
    riskLevel: 'low',
    riskLabel: 'عادي',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true }
  },
  {
    id: 'canViewVisitorsTab',
    category: 'crm',
    title: 'كارت عملاء الزوار (Website Visitors / OTP)',
    description: 'الاطلاع على قائمة الزوار الجدد المسجلين عبر الموقع برمز التحقق (OTP) أو الواتساب المباشر.',
    goal: 'سرعة الاستجابة اللحظية للعملاء المهتمين الجدد وتحويلهم إلى عملاء فعليين.',
    riskLevel: 'medium',
    riskLabel: 'متوسط',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: false }
  },
  {
    id: 'canAddManualLeads',
    category: 'crm',
    title: 'إضافة عميل جديد يدوياً في السيستم',
    description: 'إتاحة زر ونموذج إضافة عميل جديد برقم الهاتف والاسم والملاحظات مباشرة إلى قاعدة البيانات.',
    goal: 'تسجيل العملاء القادمين عبر الاتصالات المباشرة أو المعارض دون انتظار شيت إكسيل.',
    riskLevel: 'low',
    riskLabel: 'عادي',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true }
  },
  {
    id: 'canEditClientStatus',
    category: 'crm',
    title: 'تعديل حالة وملاحظات وتصنيف العميل',
    description: 'إمكانية تغيير حالة العميل (مهتم، متردد، غير مهتم، إلخ) وتحديث تاريخ المتابعة وتسجيل الملاحظات ومستوى النجوم.',
    goal: 'الحفاظ على تحديث سجل رحلة العميل وتاريخ التواصل معه بدقة متناهية.',
    riskLevel: 'low',
    riskLabel: 'عادي',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true }
  },

  // 2. Assignment & Distribution
  {
    id: 'canReassignLeads',
    category: 'distribution',
    title: 'إعادة توزيع ونقل العملاء بين الموظفين',
    description: 'صلاحية تغيير الموظف المسؤول عن العميل وتحويله من موظف لآخر أو إرجاعه للإدارة.',
    goal: 'إعادة تدوير العملاء غير المتجاوبين وتوزيع الفرص بالتساوي لتحقيق أعلى نسب إغلاق.',
    riskLevel: 'high',
    riskLabel: 'حساس',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: false }
  },
  {
    id: 'canBulkAssignLeads',
    category: 'distribution',
    title: 'التوزيع الجماعي للعملاء (Bulk Reassign)',
    description: 'تحديد مئات أو آلاف العملاء دفعة واحدة وإسنادهم لموظف أو توزيعهم بنسب متساوية.',
    goal: 'توزيع الحملات الضخمة وقواعد البيانات الكبيرة في ثوانٍ معدودة.',
    riskLevel: 'high',
    riskLabel: 'حساس',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false }
  },
  {
    id: 'canFilterAllEmployees',
    category: 'distribution',
    title: 'فلترة وتصفية شيت الـ CRM بجميع الموظفين',
    description: 'إمكانية اختيار أي موظف من القائمة المنسدلة واستعراض كافة عملائه وإحصائياته.',
    goal: 'فحص ملفات العمل والمقارنة بين أداء مسؤولي المبيعات.',
    riskLevel: 'medium',
    riskLabel: 'متوسط',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false }
  },

  // 3. Deletion & Recycle Bin
  {
    id: 'canDeleteLeads',
    category: 'deletion',
    title: 'نقل العملاء إلى سلة المهملات (Soft Delete)',
    description: 'إمكانية حذف العميل غير الصالح أو المكرر ونقله مؤقتاً إلى سلة المهملات للحفظ الآمن.',
    goal: 'تنقية قوائم الاتصال من الأرقام الخاطئة أو الوهمية مع الحفاظ على إمكانية استرجاعها.',
    riskLevel: 'high',
    riskLabel: 'حساس (إداري)',
    defaultByRole: { admin: true, coordinator: false, leader: false, agent: false }
  },
  {
    id: 'canPermanentDelete',
    category: 'deletion',
    title: 'الحذف النهائي للأبد من السيرفر (Permanent Wipe)',
    description: 'صلاحية سيادية لإزالة العميل نهائياً من قاعدة البيانات وسلة المهملات بدون رجعة.',
    goal: 'حماية المنظومة ومنع فقدان الداتا العرضي أو المتعمد؛ مخصصة للإدارة العليا فقط.',
    riskLevel: 'critical',
    riskLabel: 'سيادي للإدارة',
    defaultByRole: { admin: true, coordinator: false, leader: false, agent: false }
  },
  {
    id: 'canRestoreFromRecycleBin',
    category: 'deletion',
    title: 'استعادة العملاء من سلة المهملات (Restore)',
    description: 'إعادة العملاء المحذوفين من سلة المهملات إلى كروت وشيتات العمل الأصلية.',
    goal: 'تصحيح أخطاء الحذف العرضي وإرجاع العملاء النشطين إلى مسار المبيعات.',
    riskLevel: 'medium',
    riskLabel: 'متوسط',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false }
  },

  // 4. WhatsApp & Campaigns
  {
    id: 'canManageCampaigns',
    category: 'whatsapp',
    title: 'إنشاء وإطلاق الحملات الإعلانية المجمعة',
    description: 'إمكانية كتابة نص ترويجي للحملة ورفع مرفقات (صور، إكسيل، وورد، فيديو، PDF) وإرسالها للأرقام.',
    goal: 'إطلاق عروض الترويج الدورية والتسويق الإلكتروني المباشر عبر الواتساب الرسمي.',
    riskLevel: 'high',
    riskLabel: 'حساس',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false }
  },
  {
    id: 'canSendBroadcast',
    category: 'whatsapp',
    title: 'إرسال رسائل البث الجماعي (Broadcast)',
    description: 'إرسال رسائل فورية موحدة لشرائح العملاء المحددة في الداشبورد دفعة واحدة.',
    goal: 'التنبيهات السريعة وتحديثات السوق اليومية للمشتركين والمهتمين.',
    riskLevel: 'medium',
    riskLabel: 'متوسط',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: false }
  },
  {
    id: 'canManageInternalGroups',
    category: 'whatsapp',
    title: 'إنشاء وإدارة جروبات الواتساب الداخلية',
    description: 'صلاحية إنشاء مجموعات محادثة جديدة وتسميتها وتحديد أعضائها من الزملاء والليدرات.',
    goal: 'تنسيق العمل الجماعي وبناء فرق تواصل سريعة للأقسام واللجان الداخلية.',
    riskLevel: 'medium',
    riskLabel: 'متوسط',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: false }
  },
  {
    id: 'canChatColleagues',
    category: 'whatsapp',
    title: 'محادثة الزملاء والموظفين مباشرة (شات داخلي)',
    description: 'إمكانية بدء محادثة واتساب داخلية مباشرة مع أي موظف أو ليدر مسجل في المنظومة.',
    goal: 'تسهيل التواصل السريع ونقل الاستفسارات بين أعضاء الفريق وسرعة حل المشكلات.',
    riskLevel: 'low',
    riskLabel: 'عادي',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true }
  },

  // 5. Calls, Email & Analytics
  {
    id: 'canViewCallLogs',
    category: 'calls_analytics',
    title: 'عرض وتتبع سجل وأداء المكالمات',
    description: 'الاطلاع على جدول المكالمات المنفذة، نتائج الاتصال، المدد الزمنية، وتسجيلات المكالمات.',
    goal: 'مراقبة جودة الاتصال وتدريب مسؤولي المبيعات وقياس إنتاجية الاتصال.',
    riskLevel: 'medium',
    riskLabel: 'متوسط',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: false }
  },
  {
    id: 'canViewPerformanceAnalytics',
    category: 'calls_analytics',
    title: 'عرض كروت ورسوم تحليلات الأداء المتقدمة',
    description: 'إظهار الكروت البيانية لمعدلات الإغلاق، كفاءة المبيعات، ومخططات توزيع العملاء الزمنية.',
    goal: 'قراءة المؤشرات المالية والتشغيلية لدعم اتخاذ القرارات الإدارية والتسويقية.',
    riskLevel: 'medium',
    riskLabel: 'متوسط',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: false }
  },
  {
    id: 'canAccessInternalEmail',
    category: 'calls_analytics',
    title: 'استخدام بريد اتجاه الداخلي (Internal Email)',
    description: 'الوصول لصندوق الوارد، قراءة المراسلات والتعاميم الإدارية، وإرسال الرسائل الرسمية.',
    goal: 'التوثيق الرسمي للطلبات والقرارات والمراسلات الإدارية بين موظفي الشركة.',
    riskLevel: 'low',
    riskLabel: 'عادي',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true }
  },
  {
    id: 'canSendAllStaffEmail',
    category: 'calls_analytics',
    title: 'إرسال تعميم بريدي لكافة موظفي الشركة',
    description: 'إرسال بريد جماعي فوري يصل لصناديق جميع الموظفين والإدارة دفعة واحدة.',
    goal: 'إعلان القرارات العامة واللوائح والمكافآت وتنبيهات السيستم الهامة.',
    riskLevel: 'high',
    riskLabel: 'حساس',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false }
  },

  // 6. Export, Import & System Management
  {
    id: 'canExportData',
    category: 'system',
    title: 'تصدير قواعد البيانات (Excel / CSV)',
    description: 'تحميل وتنزيل ملفات إكسيل تحتوي على أرقام وبيانات العملاء وتقارير الأداء.',
    goal: 'حفظ نسخ احتياطية خارجية أو إعداد تقارير دورية للإدارة العليا.',
    riskLevel: 'high',
    riskLabel: 'حساس جداً',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false }
  },
  {
    id: 'canImportData',
    category: 'system',
    title: 'استيراد ورفع ملفات إكسيل وقواعد بيانات جديدة',
    description: 'رفع ملفات Excel أو الربط مع Google Sheets لإضافة آلاف العملاء الجدد في ثوانٍ.',
    goal: 'تغذية النظام ببيانات المعارض والحملات التسويقية الخارجية بصورة مجمعة.',
    riskLevel: 'high',
    riskLabel: 'حساس',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false }
  },
  {
    id: 'canManageEmployees',
    category: 'system',
    title: 'إدارة وتعديل حسابات الموظفين والصلحيات',
    description: 'إضافة موظفين جدد، تغيير كلمات المرور، تجميد الحسابات، وضبط وتعديل الصلاحيات.',
    goal: 'التحكم المركزي الكامل في فريق العمل والوصول للمنظومة؛ سيادية للأدمن.',
    riskLevel: 'critical',
    riskLabel: 'سيادي للإدارة',
    defaultByRole: { admin: true, coordinator: false, leader: false, agent: false }
  }
];

// Helper: Get normalized role key for an employee
export function getEmployeeRoleKey(emp) {
  if (!emp) return 'agent';
  const role = (emp.role || '').toLowerCase();
  const title = (emp.jobTitle || '').toLowerCase();

  if (role === 'admin' || title === 'admin' || title === 'مدير' || title === 'إدارة') return 'admin';
  if (role === 'coordinator' || title === 'coordinator' || title.includes('منسق')) return 'coordinator';
  if (role === 'leader' || title === 'leader' || title.includes('ليدر')) return 'leader';
  return 'agent';
}

// Helper: Get effective default permissions for a role
export function getDefaultPermissionsForRole(roleKey) {
  const perms = {};
  SYSTEM_PERMISSIONS.forEach(p => {
    perms[p.id] = !!(p.defaultByRole[roleKey] ?? false);
  });
  return perms;
}

// Helper: Get resolved permissions for an employee (combining role defaults + custom stored overrides)
export function getEmployeeResolvedPermissions(emp) {
  if (!emp) return getDefaultPermissionsForRole('agent');
  const roleKey = getEmployeeRoleKey(emp);
  const defaults = getDefaultPermissionsForRole(roleKey);
  const custom = emp.customPermissions || {};
  return { ...defaults, ...custom };
}

// Helper: Check if an employee has a specific permission
export function hasPermission(emp, permKey) {
  if (!emp) return false;
  const roleKey = getEmployeeRoleKey(emp);
  if (roleKey === 'admin') return true; // Admin always has full access
  if (emp.customPermissions && emp.customPermissions[permKey] !== undefined) {
    return !!emp.customPermissions[permKey];
  }
  const defaults = getDefaultPermissionsForRole(roleKey);
  return !!defaults[permKey];
}
