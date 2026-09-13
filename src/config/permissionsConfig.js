// Permissions configuration - v2.26 Card-Centric Permissions Matrix

export const CARDS_PERMISSIONS_CONFIG = [
  {
    id: 'saudi_stocks',
    masterKey: 'show_card_saudi_stocks',
    title: '🇸🇦 توصيات السوق السعودي',
    subtitle: 'Saudi Stock Recommendations',
    icon: 'TrendingUp',
    description: 'كارت وجدول تحليل وتوصيات وأهداف أسهم السوق السعودي',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: true },
    subPermissions: [
      {
        id: 'canViewSaudiStocks',
        title: 'عرض شيت وجدول توصيات السوق السعودي',
        description: 'إمكانية فتح الشيت واستعراض التوصيات والأسهم ونسب الإنجاز.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: true }
      },
      {
        id: 'canAddSaudiStocks',
        title: 'إضافة توصية سهم سعودي جديدة',
        description: 'صلاحية فتح نموذج إضافة سهم وتحديد الدعوم والمقاومات والوقف.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canEditSaudiStocks',
        title: 'تعديل وتحديث حالة وأهداف التوصية',
        description: 'إمكانية تغيير حالة التوصية (سارية، محققة، وقف خسارة) وتعديل الأسعار.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canDeleteSaudiStocks',
        title: 'حذف التوصيات ونقلها لسلة المهملات',
        description: 'إمكانية حذف توصية أو الحذف الجماعي ونقلها لسلة المهملات.',
        riskLevel: 'high',
        riskLabel: 'حساس',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canExportSaudiStocks',
        title: 'تحميل تقرير التوصيات (Excel / PDF)',
        description: 'تحميل الشيت إلى ملف إكسيل أو تقرير PDF رسمي بلوجو الشركة.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      }
    ]
  },
  {
    id: 'us_stocks',
    masterKey: 'show_card_us_stocks',
    title: '🇺🇸 توصيات السوق الأمريكي',
    subtitle: 'US Stocks & Options Signals',
    icon: 'TrendingUp',
    description: 'كارت وجدول تحليل وتوصيات أسهم وعقود السوق الأمريكي',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: true },
    subPermissions: [
      {
        id: 'canViewUsStocks',
        title: 'عرض شيت وجدول توصيات السوق الأمريكي',
        description: 'استعراض توصيات الأسهم وعقود الشركات ومتابعة نسب الإنجاز.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canAddUsStocks',
        title: 'إضافة شركة أو عقد خيارات جديد (Options / Stocks)',
        description: 'إضافة صفقة جديدة وتحديد سعر الشراء والأهداف والوقف.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canEditUsStocks',
        title: 'تعديل وتحديث حالة التوصية والعقود',
        description: 'تغيير حالة الصفقة وتحديث أرقام الأهداف ووقف الخسارة.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canDeleteUsStocks',
        title: 'حذف التوصيات ونقلها لسلة المهملات',
        description: 'حذف صفقة مفردة أو التحديد الجماعي والحذف لسلة المهملات.',
        riskLevel: 'high',
        riskLabel: 'حساس',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canExportUsStocks',
        title: 'تحميل تقرير التوصيات (Excel / PDF)',
        description: 'تنزيل الصفقات في ملف إكسيل أو تقرير PDF بلوجو الشركة.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      }
    ]
  },
  {
    id: 'buffet',
    masterKey: 'show_card_buffet',
    title: '☕ مصروفات ومحتويات البوفيه',
    subtitle: 'Buffet Expenses & Supplies',
    icon: 'Coffee',
    description: 'كارت مخزون ومشتريات ومصروفات البوفيه وفواتير المشتريات',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false },
    subPermissions: [
      {
        id: 'canViewBuffet',
        title: 'عرض كارت وجدول مصروفات ومخزون البوفيه',
        description: 'الاطلاع على قائمة الأصناف المتوفرة وجداول المشتريات الشهرية.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canAddBuffet',
        title: 'إضافة صنف جديد أو تسجيل مشتريات للبوفيه',
        description: 'تسجيل بند جديد في المخزون أو إدخال فاتورة مشترى ومصروف.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canEditBuffet',
        title: 'تعديل بنود المخزون ومبالغ المصروفات',
        description: 'تعديل الكميات المستهلكة أو الرصيد أو أسعار الفواتير.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canDeleteBuffet',
        title: 'حذف بنود أو مشتريات من البوفيه',
        description: 'حذف بند من المخزون أو إزالة عملية شراء مسجلة.',
        riskLevel: 'high',
        riskLabel: 'حساس',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canUploadBuffetSheet',
        title: 'رفع فواتير وسكرينات وربط Google Sheet',
        description: 'رفع صور الإيصالات وفواتير السوبرماركت أو ربط شيت جوجل.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canExportBuffet',
        title: 'تحميل شيت البوفيه إلى Excel',
        description: 'تنزيل كشف المصروفات والمخزون في ملف إكسيل دوري.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      }
    ]
  },
  {
    id: 'attendance_payroll',
    masterKey: 'show_card_attendance_payroll',
    title: '⏰ حضور وانصراف وخصومات الموظفين',
    subtitle: 'Attendance & Payroll Ledger',
    icon: 'Clock',
    description: 'كارت مسير الرواتب الشهرية، البصمة، التأخيرات، السلف وخصومات الـ KPI',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false },
    subPermissions: [
      {
        id: 'canViewAttendancePayroll',
        title: 'عرض مسير الرواتب وسجلات الحضور والبصمة',
        description: 'الاطلاع على جدول الرواتب ومواعيد الحضور وصافي المستحقات.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canEditAttendancePayroll',
        title: 'تعديل الراتب الثابت والسلف والخصومات والتأخير',
        description: 'إدخال أو تعديل الراتب الأساسي، السلف النقدية، وخصومات الـ KPI والتأخير.',
        riskLevel: 'high',
        riskLabel: 'حساس',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canUploadBiometrics',
        title: 'رفع شيت بصمة الحضور والانصراف (Excel)',
        description: 'رفع ملف البصمة المستخرج من جهاز الحضور لتحديث مواعيد وساعات العمل.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canDeleteAttendancePayroll',
        title: 'حذف سجلات الحضور وسلة المهملات',
        description: 'حذف بيانات موظف من دورة الرواتب مع الحفظ في سلة المهملات.',
        riskLevel: 'critical',
        riskLabel: 'سيادي للإدارة',
        defaultByRole: { admin: true, coordinator: false, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canExportAttendancePayrollPdf',
        title: 'تحميل مسير الرواتب PDF بالعلامة المائية الرسمية',
        description: 'توليد وطباعة ملف PDF لمسير الرواتب بلوجو منصة اتجاه وعلامة مائية معتمدة.',
        riskLevel: 'high',
        riskLabel: 'للإدارة فقط',
        defaultByRole: { admin: true, coordinator: false, leader: false, agent: false, customer_service: false }
      }
    ]
  },
  {
    id: 'leads_crm',
    masterKey: 'show_card_leads_crm',
    title: '🎯 Leads CRM (قاعدة العملاء الرئيسية)',
    subtitle: 'Master Leads Database',
    icon: 'Users',
    description: 'الشيت الرئيسي الشامل لجميع عملاء المنظومة (15,000+ عميل)',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true },
    subPermissions: [
      {
        id: 'canViewAllCrm',
        title: 'عرض شيت CRM العام الشامل لجميع العملاء',
        description: 'الوصول لقاعدة العملاء الكاملة وليس فقط العملاء المخصصين له.',
        riskLevel: 'high',
        riskLabel: 'حساس',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canAddManualLeads',
        title: 'إضافة عميل جديد يدوياً في السيستم',
        description: 'إضافة عميل مباشرة بالهاتف والاسم والملاحظات دون شيت إكسيل.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      },
      {
        id: 'canEditClientStatus',
        title: 'تعديل حالة وملاحظات وتصنيف العميل',
        description: 'تغيير الحالة (مهتم، متردد، غير مهتم، إلخ) ومستوى النجوم والملاحظات.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      },
      {
        id: 'canReassignLeads',
        title: 'إعادة توزيع ونقل العملاء بين الموظفين',
        description: 'تحويل العميل من موظف لآخر أو إرجاعه للإدارة.',
        riskLevel: 'high',
        riskLabel: 'حساس',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: false }
      },
      {
        id: 'canBulkAssignLeads',
        title: 'التوزيع الجماعي للعملاء (Bulk Reassign)',
        description: 'تحديد مئات العملاء دفعة واحدة وإسنادهم لموظف أو توزيعهم بنسب متساوية.',
        riskLevel: 'high',
        riskLabel: 'حساس',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: false }
      },
      {
        id: 'canFilterAllEmployees',
        title: 'فلترة شيت CRM بجميع الموظفين',
        description: 'استعراض بيانات وإحصائيات أي موظف من القائمة المنسدلة.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canDeleteLeads',
        title: 'نقل العملاء إلى سلة المهملات (Soft Delete)',
        description: 'حذف العميل غير الصالح أو المكرر ونقله مؤقتاً لسلة المهملات.',
        riskLevel: 'high',
        riskLabel: 'حساس',
        defaultByRole: { admin: true, coordinator: false, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canPermanentDelete',
        title: 'الحذف النهائي للأبد من السيرفر (Permanent Wipe)',
        description: 'إزالة العميل نهائياً من قاعدة البيانات وسلة المهملات بدون رجعة.',
        riskLevel: 'critical',
        riskLabel: 'سيادي للإدارة',
        defaultByRole: { admin: true, coordinator: false, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canExportData',
        title: 'تحميل وتصدير قواعد البيانات (Excel)',
        description: 'تحميل ملفات إكسيل تحتوي على أرقام وبيانات العملاء.',
        riskLevel: 'high',
        riskLabel: 'حساس جداً',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canImportData',
        title: 'رفع واستيراد ملفات إكسيل وقواعد بيانات جديدة',
        description: 'رفع ملفات Excel أو الربط مع Google Sheets لإضافة عملاء جدد.',
        riskLevel: 'high',
        riskLabel: 'حساس',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      }
    ]
  },
  {
    id: 'team_leads',
    masterKey: 'show_card_team_leads',
    title: '📁 Team Added Leads (عملاء فريق العمل)',
    subtitle: 'Team & Employee Leads',
    icon: 'Briefcase',
    description: 'كارت عملاء فريق العمل المضافين والمخصصين لأعضاء الفريق والليدر',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true },
    subPermissions: [
      {
        id: 'canViewTeamLeads',
        title: 'عرض وإشراف عملاء فريق العمل (Team Leads)',
        description: 'رؤية ومتابعة جميع عملاء موظفي المبيعات التابعين له في الفريق.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: false }
      },
      {
        id: 'canViewEmployeeLeadsTab',
        title: 'كارت وقاعدة داتا الموظف الشخصية (Employee Leads)',
        description: 'فتح كارت داتا الموظف الخاصة والعمل على أرقام الشيتات المسندة له شخصياً.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      }
    ]
  },
  {
    id: 'subscribed_clients',
    masterKey: 'show_card_subscribed_clients',
    title: '👥 العملاء المشتركون (Subscribed Clients)',
    subtitle: 'Paid Active Subscribers',
    icon: 'Award',
    description: 'كارت شيت العملاء المشتركين الفعليين بالباقات والخدمات المدفوعة',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true },
    subPermissions: [
      {
        id: 'canViewSubscribedClients',
        title: 'عرض كارت وشيت العملاء المشتركين',
        description: 'الاطلاع على العملاء المشتركين وباقاتهم وتواريخ التجديد.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      },
      {
        id: 'canEditSubscribedClients',
        title: 'تعديل بيانات وتجديد اشتراكات العملاء',
        description: 'تحديث مدة الاشتراك ونوع الباقة وتسجيل عمليات التجديد.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: false }
      },
      {
        id: 'canExportSubscribedClients',
        title: 'تحميل شيت المشتركين (Excel)',
        description: 'تنزيل قائمة العملاء المشتركين في ملف إكسيل.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      }
    ]
  },
  {
    id: 'visitors_otp',
    masterKey: 'show_card_visitors_otp',
    title: '🌐 زوار الموقع برمز التحقق (Website Visitors / OTP)',
    subtitle: 'Website OTP Visitors',
    icon: 'Globe',
    description: 'كارت زوار الموقع الجدد الذين سجلوا برمز OTP أو المحادثة المباشرة',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: true },
    subPermissions: [
      {
        id: 'canViewVisitorsTab',
        title: 'عرض كارت زوار الموقع وطلبات OTP',
        description: 'الاطلاع على قائمة الزوار الجدد المسجلين عبر الموقع لحظياً.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: true }
      },
      {
        id: 'canConvertVisitorsToLeads',
        title: 'تحويل الزوار إلى عملاء CRM معتمدين',
        description: 'صلاحية نقل الزائر المهتم وإضافته كعميل في Leads CRM.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: true }
      }
    ]
  },
  {
    id: 'website_whatsapp',
    masterKey: 'show_card_website_whatsapp',
    title: '🌐 داتا الموقع عبر الواتساب (Website Data by WhatsApp)',
    subtitle: 'Direct Website WhatsApp Leads',
    icon: 'MessageSquare',
    description: 'كارت العملاء القادمين عبر زر الواتساب المباشر من صفحات الموقع',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true },
    subPermissions: [
      {
        id: 'canViewWebsiteWhatsappData',
        title: 'عرض داتا عملاء واتساب الموقع المباشر',
        description: 'الاطلاع على الأرقام والرسائل الواردة من موقع اتجاه.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      }
    ]
  },
  {
    id: 'whatsapp_suite',
    masterKey: 'show_card_whatsapp_suite',
    title: '💬 محادثات ورسائل الواتساب والحملات',
    subtitle: 'WhatsApp Suite & Marketing Campaigns',
    icon: 'MessageCircle',
    description: 'منظومة الواتساب الرسمية: شات مباشر، حملات إعلانية، قوالب وبث جماعي',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true },
    subPermissions: [
      {
        id: 'canManageCampaigns',
        title: 'إنشاء وإطلاق الحملات الإعلانية والمرفقات',
        description: 'كتابة نص ترويجي ورفع مرفقات (صور، إكسيل، فيديو، PDF) وإرسالها للأرقام.',
        riskLevel: 'high',
        riskLabel: 'حساس',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canSendBroadcast',
        title: 'إرسال رسائل البث الجماعي (Broadcast)',
        description: 'إرسال رسائل فورية موحدة لشرائح العملاء المحددة دفعة واحدة.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: false }
      },
      {
        id: 'canManageInternalGroups',
        title: 'إنشاء وإدارة جروبات الواتساب الداخلية',
        description: 'إنشاء مجموعات محادثة جديدة وتسميتها وتحديد أعضائها من الزملاء والليدرات.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: false }
      },
      {
        id: 'canChatColleagues',
        title: 'محادثة الزملاء والموظفين (شات داخلي)',
        description: 'بدء محادثة واتساب داخلية مباشرة مع أي موظف أو ليدر مسجل.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      },
      {
        id: 'canDirectWhatsAppChat',
        title: 'المحادثة الفورية المباشرة مع العملاء',
        description: 'فتح نافذة الشات والتراسل مع العميل مباشرة عبر واجهة الواتساب.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      },
      {
        id: 'canSendTemplates',
        title: 'إرسال قوالب الرسائل الجاهزة للعملاء',
        description: 'اختيار وإرسال قوالب واتساب الإعلانية والتفاعلية المعتمدة.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      },
      {
        id: 'canExportChatHistory',
        title: 'تحميل وتصدير سجل المحادثات والرسائل',
        description: 'تحميل سجل الشات للعميل أو الحملة بصيغة نصية أو إكسيل.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      }
    ]
  },
  {
    id: 'calls',
    masterKey: 'show_card_calls',
    title: '📞 المكالمات الهاتفية وتسجيلات MicroSIP',
    subtitle: 'Calls & PBX Integration',
    icon: 'PhoneCall',
    description: 'كارت سجل المكالمات المنفذة، نتائج الاتصال والاستماع للتسجيلات',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true },
    subPermissions: [
      {
        id: 'canViewCallLogs',
        title: 'عرض وتتبع سجل وأداء المكالمات',
        description: 'الاطلاع على جدول المكالمات المنفذة ونتائج الاتصال والمدد الزمنية.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      },
      {
        id: 'canListenCallRecordings',
        title: 'الاستماع لتسجيلات المكالمات وتحميلها',
        description: 'تشغيل ملفات التسجيل الصوتي للمكالمات لمراقبة جودة الاتصال وتدريب الموظفين.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: false }
      },
      {
        id: 'canMakeDirectCalls',
        title: 'إجراء الاتصال السريع المباشر عبر السنترال',
        description: 'بدء مكالمة بنقرة واحدة من داخل جدول العملاء إلى برنامج MicroSIP.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      }
    ]
  },
  {
    id: 'leads_analysis',
    masterKey: 'show_card_leads_analysis',
    title: '📊 تحليلات كفاءة العملاء والليدرز (Leads CRM Analysis)',
    subtitle: 'Conversion & Leaderboard Analytics',
    icon: 'BarChart3',
    description: 'كارت تحليلات معدلات الإغلاق، تقرير فرق العمل والليدرز، وديمو اليوم',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true },
    subPermissions: [
      {
        id: 'canViewPerformanceAnalytics',
        title: 'عرض كروت ورسوم تحليلات الأداء المتقدمة',
        description: 'إظهار الكروت البيانية لمعدلات الإغلاق وكفاءة المبيعات وتوزيع الحالات.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      },
      {
        id: 'canViewLeadersTeamReport',
        title: 'عرض تقرير أداء فرق العمل والليدرز وديمو اليوم',
        description: 'الاطلاع على جدول مقارنة فرق العمل مع عمود ديمو اليوم المستقل.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: false }
      },
      {
        id: 'canViewEmployeeEfficiencyReport',
        title: 'عرض جدول تقييم وكفاءة الموظفين وديمو اليوم',
        description: 'متابعة تقييم الموظفين ونسب نجاحهم والتواصل وديمو اليوم اليومي والتراكمي.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: false, customer_service: false }
      }
    ]
  },
  {
    id: 'calls_analytics',
    masterKey: 'show_card_calls_analytics',
    title: '📞 تحليلات أداء المكالمات (Calls Performance Analysis)',
    subtitle: 'Call Duration & Outcomes Analytics',
    icon: 'PhoneCall',
    description: 'كارت تحليلات مدد ونتائج المكالمات ومعدلات الرد والتواصل اليومية',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true },
    subPermissions: [
      {
        id: 'canViewCallsAnalytics',
        title: 'عرض تقارير ومخططات مدد ونتائج المكالمات',
        description: 'إظهار الرسوم البيانية لأوقات الذروة ومتوسط مدة المكالمة ومعدل الإغلاق.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      }
    ]
  },
  {
    id: 'marketing_analytics',
    masterKey: 'show_card_marketing_analytics',
    title: '📢 تحليلات التسويق والحملات (Marketing Analytics)',
    subtitle: 'Campaign Performance & ROI',
    icon: 'PieChart',
    description: 'كارت مؤشرات الحملات الإعلانية ومصادر العملاء وتفاعل الرسائل',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true },
    subPermissions: [
      {
        id: 'canViewMarketingAnalytics',
        title: 'عرض كروت ومؤشرات الحملات الإعلانية ومصادر العملاء',
        description: 'تحليل تكلفة العميل، مصادر التدفق، ونسب التحويل من الحملات.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      }
    ]
  },
  {
    id: 'internal_email',
    masterKey: 'show_card_internal_email',
    title: '✉️ البريد الداخلي والتعاميم (Internal Emails)',
    subtitle: 'Internal Messaging & Memos',
    icon: 'Mail',
    description: 'كارت البريد الداخلي الرسمي للمراسلات والتعاميم والقرارات الإدارية',
    defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true },
    subPermissions: [
      {
        id: 'canAccessInternalEmail',
        title: 'استخدام بريد اتجاه الداخلي واستقبال المراسلات',
        description: 'الوصول لصندوق الوارد، قراءة التعاميم والقرارات، وإرسال الرسائل الرسمية.',
        riskLevel: 'low',
        riskLabel: 'عادي',
        defaultByRole: { admin: true, coordinator: true, leader: true, agent: true, customer_service: true }
      },
      {
        id: 'canSendAllStaffEmail',
        title: 'إرسال تعميم بريدي لكافة موظفي الشركة',
        description: 'إرسال بريد جماعي فوري يصل لصناديق جميع الموظفين والإدارة دفعة واحدة.',
        riskLevel: 'high',
        riskLabel: 'حساس',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      }
    ]
  },
  {
    id: 'recycle_bin',
    masterKey: 'show_card_recycle_bin',
    title: '🗑️ سلة المهملات واستعادة المحذوفات (Recycle Bin)',
    subtitle: 'Recycle Bin & Data Recovery',
    icon: 'Trash2',
    description: 'كارت سلة المهملات لحفظ واستعادة السجلات المحذوفة وتوثيق هوية الحاذف',
    defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false },
    subPermissions: [
      {
        id: 'canViewRecycleBin',
        title: 'عرض سلة المهملات وسجلات الحذف المؤرشفة',
        description: 'الاطلاع على قائمة المحذوفات من العملاء والتوصيات والرواتب وهوية من قام بالحذف.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canRestoreFromRecycleBin',
        title: 'استعادة السجلات المحذوفة وإرجاعها للسيستم',
        description: 'إعادة العملاء أو التوصيات أو السجلات المحذوفة إلى شيتاتها الأصلية.',
        riskLevel: 'medium',
        riskLabel: 'متوسط',
        defaultByRole: { admin: true, coordinator: true, leader: false, agent: false, customer_service: false }
      },
      {
        id: 'canEmptyRecycleBin',
        title: 'تفريغ سلة المهملات نهائياً (إداري سيادي)',
        description: 'مسح محتويات سلة المهملات للأبد بدون رجعة.',
        riskLevel: 'critical',
        riskLabel: 'سيادي للإدارة',
        defaultByRole: { admin: true, coordinator: false, leader: false, agent: false, customer_service: false }
      }
    ]
  }
];

// Flat list of all system permissions (including master card visibility toggles)
export const SYSTEM_PERMISSIONS = (() => {
  const list = [];
  CARDS_PERMISSIONS_CONFIG.forEach(card => {
    // Add master toggle
    list.push({
      id: card.masterKey,
      category: card.id,
      cardId: card.id,
      isMaster: true,
      title: `إظهار كارت (${card.title}) في لوحة التحكم 👁️`,
      description: `التحكم في ظهور أو إخفاء كارت ${card.title} في واجهة ولوحة تحكم الموظف بالكامل.`,
      riskLevel: 'high',
      riskLabel: 'تحكم في الكارت',
      defaultByRole: card.defaultByRole
    });
    // Add sub-permissions
    card.subPermissions.forEach(sub => {
      list.push({
        ...sub,
        category: card.id,
        cardId: card.id,
        isMaster: false
      });
    });
  });
  return list;
})();

// Helper: Get normalized role key for an employee
export function getEmployeeRoleKey(emp) {
  if (!emp) return 'agent';
  const title = (emp.jobTitle || '').toLowerCase();
  const role = (emp.role || '').toLowerCase();

  if (role === 'admin' || title === 'admin' || title === 'مدير' || title === 'إدارة') return 'admin';
  if (title === 'coordinator' || title.includes('منسق') || role === 'coordinator') return 'coordinator';
  if (title === 'customer service' || title.includes('خدمة') || role === 'customer_service') return 'customer_service';
  if (title === 'leader' || title.includes('ليدر') || role === 'leader') return 'leader';
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
