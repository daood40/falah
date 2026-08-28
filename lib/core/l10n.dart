/// نصوص التطبيق بالعربية والإنجليزية.
///
/// نستخدم أصنافًا ثابتة الحقول بدل خرائط نصية حتى يكتشف المحلّل
/// أي مفتاح ناقص وقت الترجمة لا وقت التشغيل.
class AppStrings {
  const AppStrings({
    required this.appName,
    required this.home,
    required this.calendar,
    required this.stats,
    required this.tasks,
    required this.achievements,
    required this.settings,
    required this.search,
    required this.monthlySchedule,
    required this.trackDesc,
    required this.completion,
    required this.completed,
    required this.remaining,
    required this.streak,
    required this.xp,
    required this.done,
    required this.late,
    required this.missed,
    required this.none,
    required this.addTask,
    required this.editTask,
    required this.newTask,
    required this.name,
    required this.description,
    required this.color,
    required this.icon,
    required this.category,
    required this.noCategory,
    required this.priority,
    required this.low,
    required this.medium,
    required this.high,
    required this.recurrence,
    required this.once,
    required this.daily,
    required this.weekly,
    required this.monthly,
    required this.specificDays,
    required this.date,
    required this.weekday,
    required this.dayOfMonth,
    required this.chooseDays,
    required this.notifications,
    required this.save,
    required this.cancel,
    required this.delete,
    required this.noTasks,
    required this.categoriesManage,
    required this.addCategory,
    required this.categoryName,
    required this.weekdays,
    required this.weekdaysShort,
    required this.months,
    required this.avgCompletion,
    required this.bestStreak,
    required this.bestHabit,
    required this.worstHabit,
    required this.weeklyChart,
    required this.level,
    required this.yourLevel,
    required this.totalXp,
    required this.language,
    required this.theme,
    required this.light,
    required this.dark,
    required this.notifSettings,
    required this.masterNotif,
    required this.morningRecap,
    required this.eveningRecap,
    required this.dataMgmt,
    required this.exportData,
    required this.importData,
    required this.guestUser,
    required this.taskDetails,
    required this.commitment,
    required this.doneCount,
    required this.missedCount,
    required this.history,
    required this.close,
    required this.noResults,
    required this.achDesc,
    required this.lockedTitle,
    required this.noData,
    required this.login,
    required this.signup,
    required this.welcomeBack,
    required this.createAccountTitle,
    required this.authSubtitle,
    required this.email,
    required this.password,
    required this.fullName,
    required this.forgotPassword,
    required this.orContinueWith,
    required this.continueGoogle,
    required this.continueApple,
    required this.continueGuest,
    required this.noAccount,
    required this.haveAccount,
    required this.fillFields,
    required this.invalidEmail,
    required this.shortPassword,
    required this.resetLinkSent,
    required this.logout,
    required this.logoutConfirm,
    required this.subscription,
    required this.freePlan,
    required this.premiumPlan,
    required this.monthlyPlan,
    required this.yearlyPlan,
    required this.saveBadge,
    required this.currentPlanTag,
    required this.mostPopular,
    required this.upgradeNow,
    required this.subscribeNow,
    required this.cancelSubscription,
    required this.manageSubscription,
    required this.subscribedMsg,
    required this.cancelledMsg,
    required this.perMonth,
    required this.perYear,
    required this.featAds,
    required this.featUnlimited,
    required this.featSync,
    required this.featBackup,
    required this.featStats,
    required this.featThemes,
    required this.featExport,
    required this.featGoals,
    required this.featFuture,
    required this.freeFeat1,
    required this.freeFeat2,
    required this.freeFeat3,
    required this.adBannerTitle,
    required this.adBannerSub,
    required this.adBannerTag,
    required this.accountSection,
    required this.subscriptionSection,
    required this.freeTag,
    required this.premiumTag,
    required this.dailyTrend,
    required this.tasksAxis,
    required this.customIconLabel,
    required this.customIconPlaceholder,
    required this.customColorLabel,
    required this.addNew,
    required this.enterTaskName,
    required this.deleteTaskConfirm,
    required this.deleteCategoryConfirm,
    required this.undo,
    required this.taskDeleted,
    required this.freeLimitReached,
    required this.exportCopied,
    required this.importHint,
    required this.importSuccess,
    required this.invalidFile,
    required this.hexColorHint,
    required this.simulatedNote,
    required this.today,
    required this.system,
    required this.todayTasks,
    required this.todayAllDone,
    required this.todayNoTasks,
    required this.loadDemoData,
    required this.demoLoaded,
    required this.yearHeatmap,
    required this.heatmapLegendLess,
    required this.heatmapLegendMore,
    required this.reorderHint,
    required this.about,
    required this.aboutVersion,
    required this.aboutDesc,
  });

  final String appName;
  final String home;
  final String calendar;
  final String stats;
  final String tasks;
  final String achievements;
  final String settings;
  final String search;
  final String monthlySchedule;
  final String trackDesc;
  final String completion;
  final String completed;
  final String remaining;
  final String streak;
  final String xp;
  final String done;
  final String late;
  final String missed;
  final String none;
  final String addTask;
  final String editTask;
  final String newTask;
  final String name;
  final String description;
  final String color;
  final String icon;
  final String category;
  final String noCategory;
  final String priority;
  final String low;
  final String medium;
  final String high;
  final String recurrence;
  final String once;
  final String daily;
  final String weekly;
  final String monthly;
  final String specificDays;
  final String date;
  final String weekday;
  final String dayOfMonth;
  final String chooseDays;
  final String notifications;
  final String save;
  final String cancel;
  final String delete;
  final String noTasks;
  final String categoriesManage;
  final String addCategory;
  final String categoryName;
  final List<String> weekdays;
  final List<String> weekdaysShort;
  final List<String> months;
  final String avgCompletion;
  final String bestStreak;
  final String bestHabit;
  final String worstHabit;
  final String weeklyChart;
  final String level;
  final String yourLevel;
  final String totalXp;
  final String language;
  final String theme;
  final String light;
  final String dark;
  final String notifSettings;
  final String masterNotif;
  final String morningRecap;
  final String eveningRecap;
  final String dataMgmt;
  final String exportData;
  final String importData;
  final String guestUser;
  final String taskDetails;
  final String commitment;
  final String doneCount;
  final String missedCount;
  final String history;
  final String close;
  final String noResults;
  final String achDesc;
  final String lockedTitle;
  final String noData;
  final String login;
  final String signup;
  final String welcomeBack;
  final String createAccountTitle;
  final String authSubtitle;
  final String email;
  final String password;
  final String fullName;
  final String forgotPassword;
  final String orContinueWith;
  final String continueGoogle;
  final String continueApple;
  final String continueGuest;
  final String noAccount;
  final String haveAccount;
  final String fillFields;
  final String invalidEmail;
  final String shortPassword;
  final String resetLinkSent;
  final String logout;
  final String logoutConfirm;
  final String subscription;
  final String freePlan;
  final String premiumPlan;
  final String monthlyPlan;
  final String yearlyPlan;
  final String saveBadge;
  final String currentPlanTag;
  final String mostPopular;
  final String upgradeNow;
  final String subscribeNow;
  final String cancelSubscription;
  final String manageSubscription;
  final String subscribedMsg;
  final String cancelledMsg;
  final String perMonth;
  final String perYear;
  final String featAds;
  final String featUnlimited;
  final String featSync;
  final String featBackup;
  final String featStats;
  final String featThemes;
  final String featExport;
  final String featGoals;
  final String featFuture;
  final String freeFeat1;
  final String freeFeat2;
  final String freeFeat3;
  final String adBannerTitle;
  final String adBannerSub;
  final String adBannerTag;
  final String accountSection;
  final String subscriptionSection;
  final String freeTag;
  final String premiumTag;
  final String dailyTrend;
  final String tasksAxis;
  final String customIconLabel;
  final String customIconPlaceholder;
  final String customColorLabel;
  final String addNew;
  final String enterTaskName;
  final String deleteTaskConfirm;
  final String deleteCategoryConfirm;
  final String undo;
  final String taskDeleted;
  final String freeLimitReached;
  final String exportCopied;
  final String importHint;
  final String importSuccess;
  final String invalidFile;
  final String hexColorHint;
  final String simulatedNote;
  final String today;
  final String system;
  final String todayTasks;
  final String todayAllDone;
  final String todayNoTasks;
  final String loadDemoData;
  final String demoLoaded;
  final String yearHeatmap;
  final String heatmapLegendLess;
  final String heatmapLegendMore;
  final String reorderHint;
  final String about;
  final String aboutVersion;
  final String aboutDesc;

  static const ar = AppStrings(
    appName: 'وقتي',
    home: 'الرئيسية',
    calendar: 'التقويم',
    stats: 'الإحصائيات',
    tasks: 'المهام والعادات',
    achievements: 'الإنجازات',
    settings: 'الإعدادات',
    search: 'ابحث عن مهمة أو عادة...',
    monthlySchedule: 'الجدول الشهري',
    trackDesc: 'تابع إنجاز مهامك وعاداتك اليومية',
    completion: 'نسبة الإنجاز',
    completed: 'مهمة منجزة',
    remaining: 'مهمة متبقية',
    streak: 'أيام متتالية',
    xp: 'نقطة',
    done: 'تم الإنجاز',
    late: 'تم الإنجاز متأخرًا',
    missed: 'لم يتم الإنجاز',
    none: 'لا توجد مهمة',
    addTask: 'إضافة مهمة',
    editTask: 'تعديل مهمة',
    newTask: 'مهمة جديدة',
    name: 'الاسم',
    description: 'الوصف',
    color: 'اللون',
    icon: 'الأيقونة',
    category: 'التصنيف',
    noCategory: 'بدون تصنيف',
    priority: 'الأولوية',
    low: 'منخفضة',
    medium: 'متوسطة',
    high: 'عالية',
    recurrence: 'التكرار',
    once: 'مرة واحدة',
    daily: 'يومي',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    specificDays: 'أيام محددة',
    date: 'التاريخ',
    weekday: 'يوم الأسبوع',
    dayOfMonth: 'يوم من الشهر',
    chooseDays: 'اختر الأيام',
    notifications: 'الإشعارات',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    noTasks: 'لا توجد مهام بعد. أضف أول مهمة لك!',
    categoriesManage: 'إدارة التصنيفات',
    addCategory: 'إضافة تصنيف',
    categoryName: 'اسم التصنيف',
    weekdays: [
      'الأحد',
      'الإثنين',
      'الثلاثاء',
      'الأربعاء',
      'الخميس',
      'الجمعة',
      'السبت',
    ],
    weekdaysShort: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
    months: [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ],
    avgCompletion: 'متوسط الإنجاز',
    bestStreak: 'أطول تتابع',
    bestHabit: 'أكثر عادة التزامًا',
    worstHabit: 'أقل عادة التزامًا',
    weeklyChart: 'الإحصائيات الأسبوعية',
    level: 'المستوى',
    yourLevel: 'مستواك الحالي',
    totalXp: 'إجمالي النقاط',
    language: 'اللغة',
    theme: 'المظهر',
    light: 'فاتح',
    dark: 'داكن',
    notifSettings: 'إعدادات الإشعارات',
    masterNotif: 'تفعيل جميع الإشعارات',
    morningRecap: 'الملخص الصباحي',
    eveningRecap: 'الملخص المسائي',
    dataMgmt: 'إدارة البيانات',
    exportData: 'تصدير البيانات',
    importData: 'استيراد البيانات',
    guestUser: 'مستخدم زائر',
    taskDetails: 'تفاصيل المهمة',
    commitment: 'نسبة الالتزام',
    doneCount: 'مرات الإنجاز',
    missedCount: 'مرات عدم الإنجاز',
    history: 'سجل الإنجازات هذا الشهر',
    close: 'إغلاق',
    noResults: 'لا توجد نتائج مطابقة',
    achDesc: 'إنجازاتك تُفتح تلقائيًا كلما تقدمت',
    lockedTitle: 'مقفل',
    noData: 'لا توجد بيانات كافية بعد',
    login: 'تسجيل الدخول',
    signup: 'إنشاء حساب',
    welcomeBack: 'مرحبًا بعودتك',
    createAccountTitle: 'أنشئ حسابك',
    authSubtitle: 'نظّم مهامك وعاداتك اليومية بكل سهولة',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    fullName: 'الاسم الكامل',
    forgotPassword: 'هل نسيت كلمة المرور؟',
    orContinueWith: 'أو تابع عبر',
    continueGoogle: 'المتابعة عبر Google',
    continueApple: 'المتابعة عبر Apple',
    continueGuest: 'المتابعة كزائر',
    noAccount: 'ليس لديك حساب؟',
    haveAccount: 'لديك حساب بالفعل؟',
    fillFields: 'يرجى تعبئة جميع الحقول',
    invalidEmail: 'يرجى إدخال بريد إلكتروني صالح',
    shortPassword: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    resetLinkSent:
        'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني (محاكاة)',
    logout: 'تسجيل الخروج',
    logoutConfirm: 'هل تريد تسجيل الخروج؟ بياناتك ستبقى محفوظة على هذا الجهاز.',
    subscription: 'الاشتراك المميز',
    freePlan: 'الخطة المجانية',
    premiumPlan: 'وقتي Premium',
    monthlyPlan: 'شهري',
    yearlyPlan: 'سنوي',
    saveBadge: 'وفّر 33%',
    currentPlanTag: 'خطتك الحالية',
    mostPopular: 'الأكثر اختيارًا',
    upgradeNow: 'الترقية الآن',
    subscribeNow: 'اشترك الآن',
    cancelSubscription: 'إلغاء الاشتراك',
    manageSubscription: 'إدارة الاشتراك',
    subscribedMsg: 'تم تفعيل اشتراكك المميز بنجاح 🎉 (محاكاة — بدون دفع فعلي)',
    cancelledMsg: 'تم إلغاء الاشتراك المميز',
    perMonth: 'شهريًا',
    perYear: 'سنويًا',
    featAds: 'إزالة الإعلانات',
    featUnlimited: 'مهام وعادات غير محدودة',
    featSync: 'مزامنة بين الأجهزة',
    featBackup: 'نسخ احتياطي تلقائي',
    featStats: 'إحصائيات متقدمة',
    featThemes: 'تخصيص الثيمات والألوان',
    featExport: 'تصدير البيانات',
    featGoals: 'أهداف طويلة المدى',
    featFuture: 'الوصول للمزايا الجديدة مستقبلًا',
    freeFeat1: 'حتى 5 مهام وعادات',
    freeFeat2: 'إحصائيات أساسية',
    freeFeat3: 'يحتوي على إعلانات',
    adBannerTitle: 'أزل الإعلانات وافتح كل المزايا',
    adBannerSub: 'جرّب وقتي Premium الآن',
    adBannerTag: 'إعلان',
    accountSection: 'الحساب',
    subscriptionSection: 'الاشتراك',
    freeTag: 'مجاني',
    premiumTag: 'Premium',
    dailyTrend: 'الرسم البياني للإنجازات',
    tasksAxis: 'عدد المهام المنجزة',
    customIconLabel: 'أضف أيقونتك الخاصة',
    customIconPlaceholder: 'اكتب أو الصق إيموجي',
    customColorLabel: 'لون مخصص',
    addNew: 'إضافة',
    enterTaskName: 'يرجى إدخال اسم المهمة',
    deleteTaskConfirm:
        'هل أنت متأكد من حذف هذه المهمة؟ سيُحذف سجل إنجازها أيضًا.',
    deleteCategoryConfirm:
        'حذف هذا التصنيف؟ ستبقى المهام المرتبطة به بدون تصنيف.',
    undo: 'تراجع',
    taskDeleted: 'تم حذف المهمة',
    freeLimitReached:
        'وصلت للحد الأقصى في الخطة المجانية (5 مهام). قم بالترقية لإضافة المزيد.',
    exportCopied: 'تم نسخ بياناتك إلى الحافظة بصيغة JSON',
    importHint: 'الصق بيانات JSON التي صدّرتها سابقًا',
    importSuccess: 'تم استيراد البيانات بنجاح',
    invalidFile: 'بيانات غير صالحة',
    hexColorHint: 'كود اللون مثل 6E8F72',
    simulatedNote: 'محاكاة — بدون دفع فعلي',
    today: 'اليوم',
    system: 'تلقائي',
    todayTasks: 'مهام اليوم',
    todayAllDone: 'أحسنت! أنجزت كل مهام اليوم 🎉',
    todayNoTasks: 'لا توجد مهام مستحقة اليوم',
    loadDemoData: 'تحميل بيانات تجريبية',
    demoLoaded: 'تم تحميل البيانات التجريبية',
    yearHeatmap: 'خريطة السنة',
    heatmapLegendLess: 'أقل',
    heatmapLegendMore: 'أكثر',
    reorderHint: 'اضغط مطولًا واسحب لإعادة الترتيب',
    about: 'حول التطبيق',
    aboutVersion: 'الإصدار',
    aboutDesc: 'تطبيق لتتبع المهام والعادات اليومية، مبني بـ Flutter.',
  );

  static const en = AppStrings(
    appName: 'Waqti',
    home: 'Home',
    calendar: 'Calendar',
    stats: 'Statistics',
    tasks: 'Tasks & Habits',
    achievements: 'Achievements',
    settings: 'Settings',
    search: 'Search tasks or habits...',
    monthlySchedule: 'Monthly Schedule',
    trackDesc: 'Track your daily tasks and habits',
    completion: 'Completion',
    completed: 'Completed',
    remaining: 'Remaining',
    streak: 'Day Streak',
    xp: 'pts',
    done: 'Done',
    late: 'Done late',
    missed: 'Not done',
    none: 'No task',
    addTask: 'Add Task',
    editTask: 'Edit Task',
    newTask: 'New Task',
    name: 'Name',
    description: 'Description',
    color: 'Color',
    icon: 'Icon',
    category: 'Category',
    noCategory: 'No category',
    priority: 'Priority',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    recurrence: 'Recurrence',
    once: 'Once',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    specificDays: 'Specific days',
    date: 'Date',
    weekday: 'Weekday',
    dayOfMonth: 'Day of month',
    chooseDays: 'Choose days',
    notifications: 'Notifications',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    noTasks: 'No tasks yet. Add your first one!',
    categoriesManage: 'Manage Categories',
    addCategory: 'Add Category',
    categoryName: 'Category name',
    weekdays: [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ],
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    avgCompletion: 'Avg. completion',
    bestStreak: 'Best streak',
    bestHabit: 'Top habit',
    worstHabit: 'Weakest habit',
    weeklyChart: 'Weekly stats',
    level: 'Level',
    yourLevel: 'Current level',
    totalXp: 'Total points',
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    notifSettings: 'Notification settings',
    masterNotif: 'Enable all notifications',
    morningRecap: 'Morning recap',
    eveningRecap: 'Evening recap',
    dataMgmt: 'Data management',
    exportData: 'Export data',
    importData: 'Import data',
    guestUser: 'Guest user',
    taskDetails: 'Task details',
    commitment: 'Commitment rate',
    doneCount: 'Times completed',
    missedCount: 'Times missed',
    history: "This month's log",
    close: 'Close',
    noResults: 'No matching results',
    achDesc: 'Achievements unlock automatically as you progress',
    lockedTitle: 'Locked',
    noData: 'Not enough data yet',
    login: 'Log In',
    signup: 'Sign Up',
    welcomeBack: 'Welcome back',
    createAccountTitle: 'Create your account',
    authSubtitle: 'Organize your daily tasks and habits with ease',
    email: 'Email',
    password: 'Password',
    fullName: 'Full name',
    forgotPassword: 'Forgot password?',
    orContinueWith: 'Or continue with',
    continueGoogle: 'Continue with Google',
    continueApple: 'Continue with Apple',
    continueGuest: 'Continue as guest',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    fillFields: 'Please fill in all fields',
    invalidEmail: 'Please enter a valid email address',
    shortPassword: 'Password must be at least 6 characters',
    resetLinkSent: 'A password reset link was sent to your email (simulated)',
    logout: 'Log Out',
    logoutConfirm: 'Log out? Your data will remain saved on this device.',
    subscription: 'Premium Subscription',
    freePlan: 'Free plan',
    premiumPlan: 'Waqti Premium',
    monthlyPlan: 'Monthly',
    yearlyPlan: 'Yearly',
    saveBadge: 'Save 33%',
    currentPlanTag: 'Your current plan',
    mostPopular: 'Most popular',
    upgradeNow: 'Upgrade now',
    subscribeNow: 'Subscribe now',
    cancelSubscription: 'Cancel subscription',
    manageSubscription: 'Manage subscription',
    subscribedMsg:
        'Your Premium subscription is active 🎉 (simulated — no real payment)',
    cancelledMsg: 'Premium subscription cancelled',
    perMonth: '/month',
    perYear: '/year',
    featAds: 'Remove ads',
    featUnlimited: 'Unlimited tasks & habits',
    featSync: 'Cross-device sync',
    featBackup: 'Automatic backup',
    featStats: 'Advanced statistics',
    featThemes: 'Custom themes & colors',
    featExport: 'Data export',
    featGoals: 'Long-term goals',
    featFuture: 'Access to future features',
    freeFeat1: 'Up to 5 tasks & habits',
    freeFeat2: 'Basic statistics',
    freeFeat3: 'Contains ads',
    adBannerTitle: 'Remove ads and unlock everything',
    adBannerSub: 'Try Waqti Premium now',
    adBannerTag: 'Ad',
    accountSection: 'Account',
    subscriptionSection: 'Subscription',
    freeTag: 'Free',
    premiumTag: 'Premium',
    dailyTrend: 'Achievements Chart',
    tasksAxis: 'Tasks completed',
    customIconLabel: 'Add your own icon',
    customIconPlaceholder: 'Type or paste an emoji',
    customColorLabel: 'Custom color',
    addNew: 'Add',
    enterTaskName: 'Please enter a task name',
    deleteTaskConfirm:
        'Delete this task? Its completion history will be deleted too.',
    deleteCategoryConfirm:
        'Delete this category? Its tasks will become uncategorized.',
    undo: 'Undo',
    taskDeleted: 'Task deleted',
    freeLimitReached:
        'You reached the free plan limit (5 tasks). Upgrade to add more.',
    exportCopied: 'Your data was copied to the clipboard as JSON',
    importHint: 'Paste the JSON data you exported earlier',
    importSuccess: 'Data imported successfully',
    invalidFile: 'Invalid data',
    hexColorHint: 'Hex code like 6E8F72',
    simulatedNote: 'Simulated — no real payment',
    today: 'Today',
    system: 'Auto',
    todayTasks: "Today's tasks",
    todayAllDone: 'Well done! You completed all of today\'s tasks 🎉',
    todayNoTasks: 'No tasks due today',
    loadDemoData: 'Load demo data',
    demoLoaded: 'Demo data loaded',
    yearHeatmap: 'Year heatmap',
    heatmapLegendLess: 'Less',
    heatmapLegendMore: 'More',
    reorderHint: 'Long-press and drag to reorder',
    about: 'About',
    aboutVersion: 'Version',
    aboutDesc: 'A daily tasks & habits tracker built with Flutter.',
  );

  static AppStrings of(String langCode) => langCode == 'en' ? en : ar;
}
