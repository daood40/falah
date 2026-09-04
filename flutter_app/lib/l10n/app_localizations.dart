import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
  ];

  /// No description provided for @ai_disclaimer.
  ///
  /// In ar, this message translates to:
  /// **'المساعد لا يؤلف نصوصًا دينية. النصوص الشرعية تأتي حصريًا من المصادر الموثقة'**
  String get ai_disclaimer;

  /// No description provided for @ai_placeholder.
  ///
  /// In ar, this message translates to:
  /// **'اسألني عن التصميم، الأفكار، العناوين…'**
  String get ai_placeholder;

  /// No description provided for @ai_send.
  ///
  /// In ar, this message translates to:
  /// **'إرسال'**
  String get ai_send;

  /// No description provided for @ai_sug1.
  ///
  /// In ar, this message translates to:
  /// **'اقترح أفكار منشورات لرمضان'**
  String get ai_sug1;

  /// No description provided for @ai_sug2.
  ///
  /// In ar, this message translates to:
  /// **'اقترح عنوانًا لمنشور عن الصبر'**
  String get ai_sug2;

  /// No description provided for @ai_sug3.
  ///
  /// In ar, this message translates to:
  /// **'ما أفضل أبعاد لريلز إنستغرام؟'**
  String get ai_sug3;

  /// No description provided for @ai_sug4.
  ///
  /// In ar, this message translates to:
  /// **'اقترح هاشتاقات لمحتوى قرآني'**
  String get ai_sug4;

  /// No description provided for @ai_suggestions.
  ///
  /// In ar, this message translates to:
  /// **'جرّب'**
  String get ai_suggestions;

  /// No description provided for @ai_title.
  ///
  /// In ar, this message translates to:
  /// **'فلاح AI'**
  String get ai_title;

  /// No description provided for @ai_welcomeText.
  ///
  /// In ar, this message translates to:
  /// **'أساعدك في أفكار المحتوى والعناوين والوصف والوسوم والألوان والتخطيط. وأجلب النصوص الشرعية حصريًا من المصادر الموثقة.'**
  String get ai_welcomeText;

  /// No description provided for @ai_welcomeTitle.
  ///
  /// In ar, this message translates to:
  /// **'كيف أساعدك اليوم؟'**
  String get ai_welcomeTitle;

  /// No description provided for @app_name.
  ///
  /// In ar, this message translates to:
  /// **'فلاح'**
  String get app_name;

  /// No description provided for @app_tagline.
  ///
  /// In ar, this message translates to:
  /// **'منصة صناعة المحتوى الإسلامي الموثوق'**
  String get app_tagline;

  /// No description provided for @auth_continueLocal.
  ///
  /// In ar, this message translates to:
  /// **'المتابعة محليًا'**
  String get auth_continueLocal;

  /// No description provided for @auth_email.
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get auth_email;

  /// No description provided for @auth_localMode.
  ///
  /// In ar, this message translates to:
  /// **'وضع محلي (بدون حساب)'**
  String get auth_localMode;

  /// No description provided for @auth_localModeDesc.
  ///
  /// In ar, this message translates to:
  /// **'يُحفظ عملك على هذا الجهاز فقط. اربط Supabase للمزامنة.'**
  String get auth_localModeDesc;

  /// No description provided for @auth_loggedOut.
  ///
  /// In ar, this message translates to:
  /// **'تم تسجيل الخروج'**
  String get auth_loggedOut;

  /// No description provided for @auth_login.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول'**
  String get auth_login;

  /// No description provided for @auth_password.
  ///
  /// In ar, this message translates to:
  /// **'كلمة المرور'**
  String get auth_password;

  /// No description provided for @auth_signup.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء حساب'**
  String get auth_signup;

  /// No description provided for @auth_welcome.
  ///
  /// In ar, this message translates to:
  /// **'مرحبًا بك في فلاح'**
  String get auth_welcome;

  /// No description provided for @azkar_baqarahEnd.
  ///
  /// In ar, this message translates to:
  /// **'خواتيم سورة البقرة'**
  String get azkar_baqarahEnd;

  /// No description provided for @azkar_design.
  ///
  /// In ar, this message translates to:
  /// **'صمّمها'**
  String get azkar_design;

  /// No description provided for @azkar_falaq.
  ///
  /// In ar, this message translates to:
  /// **'سورة الفلق'**
  String get azkar_falaq;

  /// No description provided for @azkar_ikhlas.
  ///
  /// In ar, this message translates to:
  /// **'سورة الإخلاص'**
  String get azkar_ikhlas;

  /// No description provided for @azkar_kursi.
  ///
  /// In ar, this message translates to:
  /// **'آية الكرسي'**
  String get azkar_kursi;

  /// No description provided for @azkar_nas.
  ///
  /// In ar, this message translates to:
  /// **'سورة الناس'**
  String get azkar_nas;

  /// No description provided for @azkar_note.
  ///
  /// In ar, this message translates to:
  /// **'النصوص من المصدر الموثق حصريًا. أعداد التكرار متروكة لك؛ فلاح لا يقرر أحكامًا شرعية.'**
  String get azkar_note;

  /// No description provided for @azkar_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'المقاطع القرآنية التي يشيع وردها صباحًا ومساءً، من المصدر الموثق وبلا إنترنت'**
  String get azkar_subtitle;

  /// No description provided for @azkar_title.
  ///
  /// In ar, this message translates to:
  /// **'أذكار قرآنية'**
  String get azkar_title;

  /// No description provided for @common_cancel.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء'**
  String get common_cancel;

  /// No description provided for @common_close.
  ///
  /// In ar, this message translates to:
  /// **'إغلاق'**
  String get common_close;

  /// No description provided for @common_confirm.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد'**
  String get common_confirm;

  /// No description provided for @common_loading.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ التحميل…'**
  String get common_loading;

  /// No description provided for @common_menu.
  ///
  /// In ar, this message translates to:
  /// **'القائمة'**
  String get common_menu;

  /// No description provided for @common_noResults.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد نتائج'**
  String get common_noResults;

  /// No description provided for @common_offline.
  ///
  /// In ar, this message translates to:
  /// **'أنت غير متصل. تعمل الآن دون إنترنت'**
  String get common_offline;

  /// No description provided for @common_ok.
  ///
  /// In ar, this message translates to:
  /// **'حسنًا'**
  String get common_ok;

  /// No description provided for @common_retry.
  ///
  /// In ar, this message translates to:
  /// **'إعادة المحاولة'**
  String get common_retry;

  /// No description provided for @common_search.
  ///
  /// In ar, this message translates to:
  /// **'بحث'**
  String get common_search;

  /// No description provided for @common_showMore.
  ///
  /// In ar, this message translates to:
  /// **'المزيد'**
  String get common_showMore;

  /// No description provided for @common_skipToContent.
  ///
  /// In ar, this message translates to:
  /// **'تخطَّ إلى المحتوى'**
  String get common_skipToContent;

  /// No description provided for @create_ayah.
  ///
  /// In ar, this message translates to:
  /// **'الآية'**
  String get create_ayah;

  /// No description provided for @create_ayahCount.
  ///
  /// In ar, this message translates to:
  /// **'عدد الآيات'**
  String get create_ayahCount;

  /// No description provided for @create_book.
  ///
  /// In ar, this message translates to:
  /// **'الكتاب'**
  String get create_book;

  /// No description provided for @create_copied.
  ///
  /// In ar, this message translates to:
  /// **'نُسخ النص مع مرجعه ومصدره'**
  String get create_copied;

  /// No description provided for @create_copyAyah.
  ///
  /// In ar, this message translates to:
  /// **'نسخ النص مع المرجع'**
  String get create_copyAyah;

  /// No description provided for @create_ctxExtendNext.
  ///
  /// In ar, this message translates to:
  /// **'ضم الآية التالية'**
  String get create_ctxExtendNext;

  /// No description provided for @create_ctxExtendPrev.
  ///
  /// In ar, this message translates to:
  /// **'ضم الآية السابقة'**
  String get create_ctxExtendPrev;

  /// No description provided for @create_ctxNextException.
  ///
  /// In ar, this message translates to:
  /// **'الآية التالية تبدأ باستثناء يكمل المعنى.'**
  String get create_ctxNextException;

  /// No description provided for @create_ctxNextRelative.
  ///
  /// In ar, this message translates to:
  /// **'الآية التالية صلة تكمل وصف ما اخترت.'**
  String get create_ctxNextRelative;

  /// No description provided for @create_ctxPrevDep.
  ///
  /// In ar, this message translates to:
  /// **'الآية المختارة تكمل ما قبلها.'**
  String get create_ctxPrevDep;

  /// No description provided for @create_ctxTitle.
  ///
  /// In ar, this message translates to:
  /// **'تنبيه سياق'**
  String get create_ctxTitle;

  /// No description provided for @create_favAdd.
  ///
  /// In ar, this message translates to:
  /// **'حفظ الآية في المفضلة'**
  String get create_favAdd;

  /// No description provided for @create_favAdded.
  ///
  /// In ar, this message translates to:
  /// **'حُفظت الآية في مفضلتك'**
  String get create_favAdded;

  /// No description provided for @create_favRemoved.
  ///
  /// In ar, this message translates to:
  /// **'أُزيلت من المفضلة'**
  String get create_favRemoved;

  /// No description provided for @create_favorites.
  ///
  /// In ar, this message translates to:
  /// **'آياتي المحفوظة'**
  String get create_favorites;

  /// No description provided for @create_format.
  ///
  /// In ar, this message translates to:
  /// **'أبعاد المحتوى'**
  String get create_format;

  /// No description provided for @create_grade.
  ///
  /// In ar, this message translates to:
  /// **'الدرجة'**
  String get create_grade;

  /// No description provided for @create_hadith.
  ///
  /// In ar, this message translates to:
  /// **'الحديث الشريف'**
  String get create_hadith;

  /// No description provided for @create_hadithDesc.
  ///
  /// In ar, this message translates to:
  /// **'اختر حديثًا موثقًا وصمّم منه محتوى'**
  String get create_hadithDesc;

  /// No description provided for @create_hadithNumber.
  ///
  /// In ar, this message translates to:
  /// **'رقم الحديث'**
  String get create_hadithNumber;

  /// No description provided for @create_juz.
  ///
  /// In ar, this message translates to:
  /// **'الجزء'**
  String get create_juz;

  /// No description provided for @create_listen.
  ///
  /// In ar, this message translates to:
  /// **'استماع'**
  String get create_listen;

  /// No description provided for @create_makeVideo.
  ///
  /// In ar, this message translates to:
  /// **'أنشئ فيديو'**
  String get create_makeVideo;

  /// No description provided for @create_narrator.
  ///
  /// In ar, this message translates to:
  /// **'الراوي'**
  String get create_narrator;

  /// No description provided for @create_openInEditor.
  ///
  /// In ar, this message translates to:
  /// **'افتح في المحرر'**
  String get create_openInEditor;

  /// No description provided for @create_page.
  ///
  /// In ar, this message translates to:
  /// **'الصفحة'**
  String get create_page;

  /// No description provided for @create_quran.
  ///
  /// In ar, this message translates to:
  /// **'القرآن الكريم'**
  String get create_quran;

  /// No description provided for @create_quranDesc.
  ///
  /// In ar, this message translates to:
  /// **'ابحث عن آية وصمّم منها منشورًا أو فيديو'**
  String get create_quranDesc;

  /// No description provided for @create_reciter.
  ///
  /// In ar, this message translates to:
  /// **'القارئ'**
  String get create_reciter;

  /// No description provided for @create_searchHadith.
  ///
  /// In ar, this message translates to:
  /// **'ابحث في الأحاديث…'**
  String get create_searchHadith;

  /// No description provided for @create_searchQuran.
  ///
  /// In ar, this message translates to:
  /// **'ابحث في القرآن (نص أو ٢:٢٥٥)…'**
  String get create_searchQuran;

  /// No description provided for @create_source.
  ///
  /// In ar, this message translates to:
  /// **'المصدر'**
  String get create_source;

  /// No description provided for @create_surah.
  ///
  /// In ar, this message translates to:
  /// **'السورة'**
  String get create_surah;

  /// No description provided for @create_tafsir.
  ///
  /// In ar, this message translates to:
  /// **'التفسير'**
  String get create_tafsir;

  /// No description provided for @create_title.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء المحتوى'**
  String get create_title;

  /// No description provided for @create_translation.
  ///
  /// In ar, this message translates to:
  /// **'الترجمة'**
  String get create_translation;

  /// No description provided for @editor_addImage.
  ///
  /// In ar, this message translates to:
  /// **'صورة'**
  String get editor_addImage;

  /// No description provided for @editor_addShape.
  ///
  /// In ar, this message translates to:
  /// **'شكل'**
  String get editor_addShape;

  /// No description provided for @editor_addText.
  ///
  /// In ar, this message translates to:
  /// **'نص'**
  String get editor_addText;

  /// No description provided for @editor_align.
  ///
  /// In ar, this message translates to:
  /// **'المحاذاة'**
  String get editor_align;

  /// No description provided for @editor_alignCenter.
  ///
  /// In ar, this message translates to:
  /// **'وسط'**
  String get editor_alignCenter;

  /// No description provided for @editor_alignLeft.
  ///
  /// In ar, this message translates to:
  /// **'يسار'**
  String get editor_alignLeft;

  /// No description provided for @editor_alignRight.
  ///
  /// In ar, this message translates to:
  /// **'يمين'**
  String get editor_alignRight;

  /// No description provided for @editor_background.
  ///
  /// In ar, this message translates to:
  /// **'الخلفية'**
  String get editor_background;

  /// No description provided for @editor_borderColor.
  ///
  /// In ar, this message translates to:
  /// **'لون الإطار'**
  String get editor_borderColor;

  /// No description provided for @editor_color.
  ///
  /// In ar, this message translates to:
  /// **'اللون'**
  String get editor_color;

  /// No description provided for @editor_delete.
  ///
  /// In ar, this message translates to:
  /// **'حذف'**
  String get editor_delete;

  /// No description provided for @editor_duplicate.
  ///
  /// In ar, this message translates to:
  /// **'تكرار'**
  String get editor_duplicate;

  /// No description provided for @editor_export.
  ///
  /// In ar, this message translates to:
  /// **'تصدير'**
  String get editor_export;

  /// No description provided for @editor_exportPng.
  ///
  /// In ar, this message translates to:
  /// **'تصدير PNG'**
  String get editor_exportPng;

  /// No description provided for @editor_font.
  ///
  /// In ar, this message translates to:
  /// **'الخط'**
  String get editor_font;

  /// No description provided for @editor_fontSize.
  ///
  /// In ar, this message translates to:
  /// **'حجم الخط'**
  String get editor_fontSize;

  /// No description provided for @editor_gradient.
  ///
  /// In ar, this message translates to:
  /// **'تدرّج'**
  String get editor_gradient;

  /// No description provided for @editor_layers.
  ///
  /// In ar, this message translates to:
  /// **'الطبقات'**
  String get editor_layers;

  /// No description provided for @editor_lineHeight.
  ///
  /// In ar, this message translates to:
  /// **'تباعد الأسطر'**
  String get editor_lineHeight;

  /// No description provided for @editor_locked.
  ///
  /// In ar, this message translates to:
  /// **'نص موثوق. لا يمكن تعديله'**
  String get editor_locked;

  /// No description provided for @editor_moveDown.
  ///
  /// In ar, this message translates to:
  /// **'لأسفل'**
  String get editor_moveDown;

  /// No description provided for @editor_moveUp.
  ///
  /// In ar, this message translates to:
  /// **'لأعلى'**
  String get editor_moveUp;

  /// No description provided for @editor_opacity.
  ///
  /// In ar, this message translates to:
  /// **'الشفافية'**
  String get editor_opacity;

  /// No description provided for @editor_projectName.
  ///
  /// In ar, this message translates to:
  /// **'اسم التصميم'**
  String get editor_projectName;

  /// No description provided for @editor_properties.
  ///
  /// In ar, this message translates to:
  /// **'الخصائص'**
  String get editor_properties;

  /// No description provided for @editor_radius.
  ///
  /// In ar, this message translates to:
  /// **'استدارة الحواف'**
  String get editor_radius;

  /// No description provided for @editor_reference.
  ///
  /// In ar, this message translates to:
  /// **'المرجع'**
  String get editor_reference;

  /// No description provided for @editor_restore.
  ///
  /// In ar, this message translates to:
  /// **'استعادة'**
  String get editor_restore;

  /// No description provided for @editor_rotation.
  ///
  /// In ar, this message translates to:
  /// **'الدوران'**
  String get editor_rotation;

  /// No description provided for @editor_save.
  ///
  /// In ar, this message translates to:
  /// **'حفظ'**
  String get editor_save;

  /// No description provided for @editor_saved.
  ///
  /// In ar, this message translates to:
  /// **'تم الحفظ في مكتبتك'**
  String get editor_saved;

  /// No description provided for @editor_shadow.
  ///
  /// In ar, this message translates to:
  /// **'الظل'**
  String get editor_shadow;

  /// No description provided for @editor_solid.
  ///
  /// In ar, this message translates to:
  /// **'لون واحد'**
  String get editor_solid;

  /// No description provided for @editor_templates.
  ///
  /// In ar, this message translates to:
  /// **'قوالب'**
  String get editor_templates;

  /// No description provided for @editor_title.
  ///
  /// In ar, this message translates to:
  /// **'المحرر'**
  String get editor_title;

  /// No description provided for @editor_untitled.
  ///
  /// In ar, this message translates to:
  /// **'تصميم بدون عنوان'**
  String get editor_untitled;

  /// No description provided for @editor_versionRestored.
  ///
  /// In ar, this message translates to:
  /// **'استُعيدت النسخة'**
  String get editor_versionRestored;

  /// No description provided for @editor_versions.
  ///
  /// In ar, this message translates to:
  /// **'سجل النسخ'**
  String get editor_versions;

  /// No description provided for @editor_versionsEmpty.
  ///
  /// In ar, this message translates to:
  /// **'ستُحفظ نسخة قابلة للاستعادة مع كل حفظ'**
  String get editor_versionsEmpty;

  /// No description provided for @editor_watermark.
  ///
  /// In ar, this message translates to:
  /// **'علامة مائية'**
  String get editor_watermark;

  /// No description provided for @errors_auth.
  ///
  /// In ar, this message translates to:
  /// **'مشكلة في تسجيل الدخول. حاول مرة أخرى.'**
  String get errors_auth;

  /// No description provided for @errors_database.
  ///
  /// In ar, this message translates to:
  /// **'مشكلة مؤقتة في البيانات. حاول مجددًا.'**
  String get errors_database;

  /// No description provided for @errors_imageSize.
  ///
  /// In ar, this message translates to:
  /// **'حجم الصورة يتجاوز الحد (8MB)'**
  String get errors_imageSize;

  /// No description provided for @errors_imageType.
  ///
  /// In ar, this message translates to:
  /// **'صيغة الصورة غير مدعومة. المسموح: PNG أو JPG أو WebP أو GIF'**
  String get errors_imageType;

  /// No description provided for @errors_network.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الاتصال بالشبكة. تحقق من الإنترنت وحاول مجددًا.'**
  String get errors_network;

  /// No description provided for @errors_notConfigured.
  ///
  /// In ar, this message translates to:
  /// **'هذه الخدمة تحتاج إعدادًا. راجع الإعدادات.'**
  String get errors_notConfigured;

  /// No description provided for @errors_publishing.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر النشر. سيُعاد المحاولة لاحقًا.'**
  String get errors_publishing;

  /// No description provided for @errors_rendering.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر إنشاء التصميم. حاول مجددًا.'**
  String get errors_rendering;

  /// No description provided for @errors_sourceLock.
  ///
  /// In ar, this message translates to:
  /// **'لا يمكن نشر نص ديني بدون مصدر موثّق.'**
  String get errors_sourceLock;

  /// No description provided for @errors_storage.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الحفظ. تحقق من المساحة المتاحة.'**
  String get errors_storage;

  /// No description provided for @errors_unknown.
  ///
  /// In ar, this message translates to:
  /// **'حدث خطأ غير متوقع. حاول مجددًا.'**
  String get errors_unknown;

  /// No description provided for @errors_validation.
  ///
  /// In ar, this message translates to:
  /// **'بعض البيانات غير صحيحة. راجع المدخلات.'**
  String get errors_validation;

  /// No description provided for @help_cat1.
  ///
  /// In ar, this message translates to:
  /// **'الإنشاء والتصميم'**
  String get help_cat1;

  /// No description provided for @help_cat2.
  ///
  /// In ar, this message translates to:
  /// **'الحفظ والنسخ الاحتياطي'**
  String get help_cat2;

  /// No description provided for @help_cat3.
  ///
  /// In ar, this message translates to:
  /// **'القراءة والأدوات'**
  String get help_cat3;

  /// No description provided for @help_cat4.
  ///
  /// In ar, this message translates to:
  /// **'النشر والجدولة'**
  String get help_cat4;

  /// No description provided for @help_faq1a.
  ///
  /// In ar, this message translates to:
  /// **'من «إنشاء» اختر القرآن الكريم، حدد السورة والآية، ثم افتح في المحرر.'**
  String get help_faq1a;

  /// No description provided for @help_faq1q.
  ///
  /// In ar, this message translates to:
  /// **'كيف أنشئ تصميم آية؟'**
  String get help_faq1q;

  /// No description provided for @help_faq2a.
  ///
  /// In ar, this message translates to:
  /// **'يُحفظ تلقائيًا كل 5 ثوانٍ على جهازك، ويمكنك استعادة نسخ سابقة من «سجل النسخ» في المحرر.'**
  String get help_faq2a;

  /// No description provided for @help_faq2q.
  ///
  /// In ar, this message translates to:
  /// **'كيف يُحفظ عملي؟'**
  String get help_faq2q;

  /// No description provided for @help_faq3a.
  ///
  /// In ar, this message translates to:
  /// **'نعم. القرآن كاملًا والمحرر والمكتبة والسبحة والورد تعمل دون اتصال.'**
  String get help_faq3a;

  /// No description provided for @help_faq3q.
  ///
  /// In ar, this message translates to:
  /// **'هل يعمل التطبيق بلا إنترنت؟'**
  String get help_faq3q;

  /// No description provided for @help_faq4a.
  ///
  /// In ar, this message translates to:
  /// **'من قسم التخزين صدّر نسخة احتياطية بملف واحد، ثم استوردها على الجهاز الآخر.'**
  String get help_faq4a;

  /// No description provided for @help_faq4q.
  ///
  /// In ar, this message translates to:
  /// **'كيف أنقل بياناتي إلى جهاز آخر؟'**
  String get help_faq4q;

  /// No description provided for @help_faq5a.
  ///
  /// In ar, this message translates to:
  /// **'من تبويب «القوالب» داخل المحرر، أو من شريط القوالب في الرئيسية. يتغير التصميم فقط ولا يُمس النص الشرعي.'**
  String get help_faq5a;

  /// No description provided for @help_faq5q.
  ///
  /// In ar, this message translates to:
  /// **'كيف أستخدم قالبًا جاهزًا؟'**
  String get help_faq5q;

  /// No description provided for @help_faq6a.
  ///
  /// In ar, this message translates to:
  /// **'فعّل خيار «إنشاء فيديو» في صانع القرآن واختر القارئ، ثم صدّر الفيديو من المحرر.'**
  String get help_faq6a;

  /// No description provided for @help_faq6q.
  ///
  /// In ar, this message translates to:
  /// **'كيف أصنع فيديو تلاوة؟'**
  String get help_faq6q;

  /// No description provided for @help_faq7a.
  ///
  /// In ar, this message translates to:
  /// **'في القائمة الجانبية (زر ☰ أعلى الصفحة) تحت قسم «أدوات».'**
  String get help_faq7a;

  /// No description provided for @help_faq7q.
  ///
  /// In ar, this message translates to:
  /// **'أين السبحة والورد اليومي والأذكار؟'**
  String get help_faq7q;

  /// No description provided for @help_faq8a.
  ///
  /// In ar, this message translates to:
  /// **'الربط الفعلي يتطلب مفاتيح رسمية لكل منصة. فلاح لا يدّعي نشرًا لا يحدث؛ جدولتك محفوظة وتُنفَّذ فور الربط.'**
  String get help_faq8a;

  /// No description provided for @help_faq8q.
  ///
  /// In ar, this message translates to:
  /// **'لماذا تظهر منصات النشر «غير مهيأة»؟'**
  String get help_faq8q;

  /// No description provided for @home_continue.
  ///
  /// In ar, this message translates to:
  /// **'أكمل من حيث توقفت'**
  String get home_continue;

  /// No description provided for @home_hadithOfDay.
  ///
  /// In ar, this message translates to:
  /// **'حديث اليوم'**
  String get home_hadithOfDay;

  /// No description provided for @home_managePublishing.
  ///
  /// In ar, this message translates to:
  /// **'إدارة النشر'**
  String get home_managePublishing;

  /// No description provided for @home_noRecent.
  ///
  /// In ar, this message translates to:
  /// **'لم تنشئ محتوى بعد. ابدأ الآن'**
  String get home_noRecent;

  /// No description provided for @home_qa_ai.
  ///
  /// In ar, this message translates to:
  /// **'فلاح AI'**
  String get home_qa_ai;

  /// No description provided for @home_qa_aiDesc.
  ///
  /// In ar, this message translates to:
  /// **'أفكار وعناوين وتصميم. بلا تأليف نصوص'**
  String get home_qa_aiDesc;

  /// No description provided for @home_qa_hadith.
  ///
  /// In ar, this message translates to:
  /// **'الحديث الشريف'**
  String get home_qa_hadith;

  /// No description provided for @home_qa_hadithDesc.
  ///
  /// In ar, this message translates to:
  /// **'أحاديث بمصادرها ودرجاتها'**
  String get home_qa_hadithDesc;

  /// No description provided for @home_qa_library.
  ///
  /// In ar, this message translates to:
  /// **'مكتبتي'**
  String get home_qa_library;

  /// No description provided for @home_qa_libraryDesc.
  ///
  /// In ar, this message translates to:
  /// **'كل أعمالك ومسوداتك وقوالبك'**
  String get home_qa_libraryDesc;

  /// No description provided for @home_qa_publish.
  ///
  /// In ar, this message translates to:
  /// **'الجدولة والنشر التلقائي'**
  String get home_qa_publish;

  /// No description provided for @home_qa_publishDesc.
  ///
  /// In ar, this message translates to:
  /// **'جدول محتواك ودعه يُنشر تلقائيًا'**
  String get home_qa_publishDesc;

  /// No description provided for @home_qa_quran.
  ///
  /// In ar, this message translates to:
  /// **'القرآن الكريم'**
  String get home_qa_quran;

  /// No description provided for @home_qa_quranDesc.
  ///
  /// In ar, this message translates to:
  /// **'تصفح وابحث وصمم آية موثقة'**
  String get home_qa_quranDesc;

  /// No description provided for @home_recent.
  ///
  /// In ar, this message translates to:
  /// **'آخر أعمالك'**
  String get home_recent;

  /// No description provided for @home_scheduled.
  ///
  /// In ar, this message translates to:
  /// **'المجدولة القادمة'**
  String get home_scheduled;

  /// No description provided for @home_stats_drafts.
  ///
  /// In ar, this message translates to:
  /// **'مسودات'**
  String get home_stats_drafts;

  /// No description provided for @home_stats_published.
  ///
  /// In ar, this message translates to:
  /// **'منشورة'**
  String get home_stats_published;

  /// No description provided for @home_stats_scheduled.
  ///
  /// In ar, this message translates to:
  /// **'مجدولة'**
  String get home_stats_scheduled;

  /// No description provided for @home_stats_total.
  ///
  /// In ar, this message translates to:
  /// **'كل الأعمال'**
  String get home_stats_total;

  /// No description provided for @home_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'ماذا تريد أن تصنع اليوم؟'**
  String get home_subtitle;

  /// No description provided for @home_templates.
  ///
  /// In ar, this message translates to:
  /// **'قوالب جاهزة'**
  String get home_templates;

  /// No description provided for @home_verseOfDay.
  ///
  /// In ar, this message translates to:
  /// **'آية اليوم'**
  String get home_verseOfDay;

  /// No description provided for @home_viewAll.
  ///
  /// In ar, this message translates to:
  /// **'عرض الكل'**
  String get home_viewAll;

  /// No description provided for @home_welcome.
  ///
  /// In ar, this message translates to:
  /// **'السلام عليكم'**
  String get home_welcome;

  /// No description provided for @home_welcomeText.
  ///
  /// In ar, this message translates to:
  /// **'أهلًا بك في فلاح. مساحتك الهادئة لصياغة آيات وأحاديث موثقة بتصميم يليق بها، ومشاركتها بطمأنينة.'**
  String get home_welcomeText;

  /// No description provided for @library_all.
  ///
  /// In ar, this message translates to:
  /// **'الكل'**
  String get library_all;

  /// No description provided for @library_delete.
  ///
  /// In ar, this message translates to:
  /// **'حذف'**
  String get library_delete;

  /// No description provided for @library_deleteConfirm.
  ///
  /// In ar, this message translates to:
  /// **'هل تريد حذف هذا التصميم نهائيًا؟'**
  String get library_deleteConfirm;

  /// No description provided for @library_deleted.
  ///
  /// In ar, this message translates to:
  /// **'تم الحذف'**
  String get library_deleted;

  /// No description provided for @library_drafts.
  ///
  /// In ar, this message translates to:
  /// **'مسودات'**
  String get library_drafts;

  /// No description provided for @library_duplicate.
  ///
  /// In ar, this message translates to:
  /// **'نسخ'**
  String get library_duplicate;

  /// No description provided for @library_edit.
  ///
  /// In ar, this message translates to:
  /// **'تعديل'**
  String get library_edit;

  /// No description provided for @library_empty.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد محتوى هنا بعد'**
  String get library_empty;

  /// No description provided for @library_export.
  ///
  /// In ar, this message translates to:
  /// **'تصدير PNG'**
  String get library_export;

  /// No description provided for @library_favorite.
  ///
  /// In ar, this message translates to:
  /// **'مفضلة'**
  String get library_favorite;

  /// No description provided for @library_favorites.
  ///
  /// In ar, this message translates to:
  /// **'مفضلة'**
  String get library_favorites;

  /// No description provided for @library_posts.
  ///
  /// In ar, this message translates to:
  /// **'منشورات'**
  String get library_posts;

  /// No description provided for @library_published.
  ///
  /// In ar, this message translates to:
  /// **'منشورة'**
  String get library_published;

  /// No description provided for @library_reels.
  ///
  /// In ar, this message translates to:
  /// **'Reels'**
  String get library_reels;

  /// No description provided for @library_schedule.
  ///
  /// In ar, this message translates to:
  /// **'جدولة'**
  String get library_schedule;

  /// No description provided for @library_scheduled.
  ///
  /// In ar, this message translates to:
  /// **'مجدولة'**
  String get library_scheduled;

  /// No description provided for @library_search.
  ///
  /// In ar, this message translates to:
  /// **'بحث في المكتبة…'**
  String get library_search;

  /// No description provided for @library_share.
  ///
  /// In ar, this message translates to:
  /// **'مشاركة'**
  String get library_share;

  /// No description provided for @library_shareUnsupported.
  ///
  /// In ar, this message translates to:
  /// **'المشاركة غير مدعومة هنا. تم التنزيل بدلًا منها'**
  String get library_shareUnsupported;

  /// No description provided for @library_shared.
  ///
  /// In ar, this message translates to:
  /// **'تمت المشاركة'**
  String get library_shared;

  /// No description provided for @library_sortName.
  ///
  /// In ar, this message translates to:
  /// **'الاسم'**
  String get library_sortName;

  /// No description provided for @library_sortNewest.
  ///
  /// In ar, this message translates to:
  /// **'الأحدث'**
  String get library_sortNewest;

  /// No description provided for @library_sortOldest.
  ///
  /// In ar, this message translates to:
  /// **'الأقدم'**
  String get library_sortOldest;

  /// No description provided for @library_stories.
  ///
  /// In ar, this message translates to:
  /// **'Stories'**
  String get library_stories;

  /// No description provided for @library_title.
  ///
  /// In ar, this message translates to:
  /// **'مكتبتي'**
  String get library_title;

  /// No description provided for @library_videos.
  ///
  /// In ar, this message translates to:
  /// **'فيديوهات'**
  String get library_videos;

  /// No description provided for @menu_about.
  ///
  /// In ar, this message translates to:
  /// **'حول فلاح'**
  String get menu_about;

  /// No description provided for @menu_account.
  ///
  /// In ar, this message translates to:
  /// **'الحساب'**
  String get menu_account;

  /// No description provided for @menu_help.
  ///
  /// In ar, this message translates to:
  /// **'المساعدة'**
  String get menu_help;

  /// No description provided for @menu_language.
  ///
  /// In ar, this message translates to:
  /// **'اللغة'**
  String get menu_language;

  /// No description provided for @menu_login.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الدخول'**
  String get menu_login;

  /// No description provided for @menu_logout.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج'**
  String get menu_logout;

  /// No description provided for @menu_notifications.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات'**
  String get menu_notifications;

  /// No description provided for @menu_privacy.
  ///
  /// In ar, this message translates to:
  /// **'الخصوصية'**
  String get menu_privacy;

  /// No description provided for @menu_profile.
  ///
  /// In ar, this message translates to:
  /// **'الملف الشخصي'**
  String get menu_profile;

  /// No description provided for @menu_subscription.
  ///
  /// In ar, this message translates to:
  /// **'الاشتراك'**
  String get menu_subscription;

  /// No description provided for @menu_terms.
  ///
  /// In ar, this message translates to:
  /// **'الشروط'**
  String get menu_terms;

  /// No description provided for @menu_theme.
  ///
  /// In ar, this message translates to:
  /// **'المظهر'**
  String get menu_theme;

  /// No description provided for @menu_tools.
  ///
  /// In ar, this message translates to:
  /// **'أدوات'**
  String get menu_tools;

  /// No description provided for @nav_ai.
  ///
  /// In ar, this message translates to:
  /// **'فلاح AI'**
  String get nav_ai;

  /// No description provided for @nav_create.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء'**
  String get nav_create;

  /// No description provided for @nav_home.
  ///
  /// In ar, this message translates to:
  /// **'الرئيسية'**
  String get nav_home;

  /// No description provided for @nav_library.
  ///
  /// In ar, this message translates to:
  /// **'مكتبتي'**
  String get nav_library;

  /// No description provided for @nav_publish.
  ///
  /// In ar, this message translates to:
  /// **'النشر'**
  String get nav_publish;

  /// No description provided for @nav_settings.
  ///
  /// In ar, this message translates to:
  /// **'الإعدادات'**
  String get nav_settings;

  /// No description provided for @notifications_clearAll.
  ///
  /// In ar, this message translates to:
  /// **'مسح الكل'**
  String get notifications_clearAll;

  /// No description provided for @notifications_empty.
  ///
  /// In ar, this message translates to:
  /// **'لا إشعارات بعد'**
  String get notifications_empty;

  /// No description provided for @notifications_exportDone.
  ///
  /// In ar, this message translates to:
  /// **'تم تصدير التصميم'**
  String get notifications_exportDone;

  /// No description provided for @notifications_markRead.
  ///
  /// In ar, this message translates to:
  /// **'تحديد الكل كمقروء'**
  String get notifications_markRead;

  /// No description provided for @notifications_publishFailed.
  ///
  /// In ar, this message translates to:
  /// **'فشل النشر'**
  String get notifications_publishFailed;

  /// No description provided for @notifications_publishSuccess.
  ///
  /// In ar, this message translates to:
  /// **'تم النشر بنجاح'**
  String get notifications_publishSuccess;

  /// No description provided for @notifications_scheduleCreated.
  ///
  /// In ar, this message translates to:
  /// **'تمت جدولة منشور'**
  String get notifications_scheduleCreated;

  /// No description provided for @notifications_title.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات'**
  String get notifications_title;

  /// No description provided for @occasions_arafah.
  ///
  /// In ar, this message translates to:
  /// **'يوم عرفة'**
  String get occasions_arafah;

  /// No description provided for @occasions_ashura.
  ///
  /// In ar, this message translates to:
  /// **'يوم عاشوراء'**
  String get occasions_ashura;

  /// No description provided for @occasions_days.
  ///
  /// In ar, this message translates to:
  /// **'يومًا'**
  String get occasions_days;

  /// No description provided for @occasions_designNow.
  ///
  /// In ar, this message translates to:
  /// **'جهّز محتوى المناسبة من الآن'**
  String get occasions_designNow;

  /// No description provided for @occasions_eidAdha.
  ///
  /// In ar, this message translates to:
  /// **'عيد الأضحى'**
  String get occasions_eidAdha;

  /// No description provided for @occasions_eidFitr.
  ///
  /// In ar, this message translates to:
  /// **'عيد الفطر'**
  String get occasions_eidFitr;

  /// No description provided for @occasions_hijriNewYear.
  ///
  /// In ar, this message translates to:
  /// **'رأس السنة الهجرية'**
  String get occasions_hijriNewYear;

  /// No description provided for @occasions_inDays.
  ///
  /// In ar, this message translates to:
  /// **'بعد'**
  String get occasions_inDays;

  /// No description provided for @occasions_ramadan.
  ///
  /// In ar, this message translates to:
  /// **'بداية شهر رمضان'**
  String get occasions_ramadan;

  /// No description provided for @occasions_title.
  ///
  /// In ar, this message translates to:
  /// **'مناسبات قادمة'**
  String get occasions_title;

  /// No description provided for @occasions_today.
  ///
  /// In ar, this message translates to:
  /// **'اليوم'**
  String get occasions_today;

  /// No description provided for @privacy_p1.
  ///
  /// In ar, this message translates to:
  /// **'لا إعلانات، لا أدوات تتبع، ولا يُطلب إذن الموقع الجغرافي إطلاقًا.'**
  String get privacy_p1;

  /// No description provided for @privacy_p2.
  ///
  /// In ar, this message translates to:
  /// **'تصاميمك وبياناتك تُحفظ محليًا على جهازك.'**
  String get privacy_p2;

  /// No description provided for @privacy_p3.
  ///
  /// In ar, this message translates to:
  /// **'لا يغادر أي شيء جهازك إلا عند ربط حساب مزامنة أو منصة نشر بموافقتك.'**
  String get privacy_p3;

  /// No description provided for @privacy_p4.
  ///
  /// In ar, this message translates to:
  /// **'النصوص الشرعية تُعرض من مصادر موثقة ببياناتها الوصفية ولا تُعدَّل أبدًا.'**
  String get privacy_p4;

  /// No description provided for @publish_attempts.
  ///
  /// In ar, this message translates to:
  /// **'محاولات'**
  String get publish_attempts;

  /// No description provided for @publish_connected.
  ///
  /// In ar, this message translates to:
  /// **'مربوطة'**
  String get publish_connected;

  /// No description provided for @publish_connections.
  ///
  /// In ar, this message translates to:
  /// **'حالة المنصات'**
  String get publish_connections;

  /// No description provided for @publish_empty.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد منشورات مجدولة. افتح تصميمًا من مكتبتك واختر «جدولة»'**
  String get publish_empty;

  /// No description provided for @publish_history.
  ///
  /// In ar, this message translates to:
  /// **'السجل'**
  String get publish_history;

  /// No description provided for @publish_notConfigured.
  ///
  /// In ar, this message translates to:
  /// **'غير مهيأة. تحتاج ربط الحساب (docs/DEPLOYMENT.md)'**
  String get publish_notConfigured;

  /// No description provided for @publish_notConnected.
  ///
  /// In ar, this message translates to:
  /// **'غير مربوطة'**
  String get publish_notConnected;

  /// No description provided for @publish_retried.
  ///
  /// In ar, this message translates to:
  /// **'أُعيدت الجدولة للنشر الآن'**
  String get publish_retried;

  /// No description provided for @publish_retry.
  ///
  /// In ar, this message translates to:
  /// **'إعادة المحاولة'**
  String get publish_retry;

  /// No description provided for @publish_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'كل منشوراتك المجدولة وحالتها في مكان واحد'**
  String get publish_subtitle;

  /// No description provided for @publish_title.
  ///
  /// In ar, this message translates to:
  /// **'النشر والجدولة'**
  String get publish_title;

  /// No description provided for @publish_upcoming.
  ///
  /// In ar, this message translates to:
  /// **'القادمة'**
  String get publish_upcoming;

  /// No description provided for @schedule_cancel.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء الجدولة'**
  String get schedule_cancel;

  /// No description provided for @schedule_confirm.
  ///
  /// In ar, this message translates to:
  /// **'جدولة النشر'**
  String get schedule_confirm;

  /// No description provided for @schedule_date.
  ///
  /// In ar, this message translates to:
  /// **'التاريخ'**
  String get schedule_date;

  /// No description provided for @schedule_notConnected.
  ///
  /// In ar, this message translates to:
  /// **'المنصة غير مربوطة. اربط حسابك من الإعدادات'**
  String get schedule_notConnected;

  /// No description provided for @schedule_pastTime.
  ///
  /// In ar, this message translates to:
  /// **'اختر وقتًا في المستقبل'**
  String get schedule_pastTime;

  /// No description provided for @schedule_platform.
  ///
  /// In ar, this message translates to:
  /// **'المنصة'**
  String get schedule_platform;

  /// No description provided for @schedule_repeat.
  ///
  /// In ar, this message translates to:
  /// **'تكرار'**
  String get schedule_repeat;

  /// No description provided for @schedule_repeat_daily.
  ///
  /// In ar, this message translates to:
  /// **'يوميًا'**
  String get schedule_repeat_daily;

  /// No description provided for @schedule_repeat_none.
  ///
  /// In ar, this message translates to:
  /// **'بدون تكرار'**
  String get schedule_repeat_none;

  /// No description provided for @schedule_repeat_weekly.
  ///
  /// In ar, this message translates to:
  /// **'أسبوعيًا'**
  String get schedule_repeat_weekly;

  /// No description provided for @schedule_scheduled.
  ///
  /// In ar, this message translates to:
  /// **'تمت الجدولة'**
  String get schedule_scheduled;

  /// No description provided for @schedule_status_draft.
  ///
  /// In ar, this message translates to:
  /// **'مسودة'**
  String get schedule_status_draft;

  /// No description provided for @schedule_status_failed.
  ///
  /// In ar, this message translates to:
  /// **'فشل'**
  String get schedule_status_failed;

  /// No description provided for @schedule_status_published.
  ///
  /// In ar, this message translates to:
  /// **'منشور'**
  String get schedule_status_published;

  /// No description provided for @schedule_status_publishing.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ النشر'**
  String get schedule_status_publishing;

  /// No description provided for @schedule_status_scheduled.
  ///
  /// In ar, this message translates to:
  /// **'مجدول'**
  String get schedule_status_scheduled;

  /// No description provided for @schedule_time.
  ///
  /// In ar, this message translates to:
  /// **'الوقت'**
  String get schedule_time;

  /// No description provided for @schedule_title.
  ///
  /// In ar, this message translates to:
  /// **'الجدولة'**
  String get schedule_title;

  /// No description provided for @schedule_upcoming.
  ///
  /// In ar, this message translates to:
  /// **'المنشورات المجدولة'**
  String get schedule_upcoming;

  /// No description provided for @settings_about.
  ///
  /// In ar, this message translates to:
  /// **'حول التطبيق'**
  String get settings_about;

  /// No description provided for @settings_aboutText.
  ///
  /// In ar, this message translates to:
  /// **'فلاح. منصة صناعة المحتوى الإسلامي الموثوق. الإصدار 2.0.0'**
  String get settings_aboutText;

  /// No description provided for @settings_account.
  ///
  /// In ar, this message translates to:
  /// **'الحساب'**
  String get settings_account;

  /// No description provided for @settings_appearance.
  ///
  /// In ar, this message translates to:
  /// **'المظهر'**
  String get settings_appearance;

  /// No description provided for @settings_backupDone.
  ///
  /// In ar, this message translates to:
  /// **'نُزّلت النسخة الاحتياطية'**
  String get settings_backupDone;

  /// No description provided for @settings_backupExport.
  ///
  /// In ar, this message translates to:
  /// **'تنزيل نسخة احتياطية'**
  String get settings_backupExport;

  /// No description provided for @settings_backupImport.
  ///
  /// In ar, this message translates to:
  /// **'استعادة نسخة احتياطية'**
  String get settings_backupImport;

  /// No description provided for @settings_backupInvalid.
  ///
  /// In ar, this message translates to:
  /// **'الملف ليس نسخة احتياطية صالحة من فلاح'**
  String get settings_backupInvalid;

  /// No description provided for @settings_backupNote.
  ///
  /// In ar, this message translates to:
  /// **'ملف JSON واحد يضم تصاميمك وقوالبك ومفضلتك وجدولك، لتنقله بين أجهزتك بنفسك.'**
  String get settings_backupNote;

  /// No description provided for @settings_backupRestored.
  ///
  /// In ar, this message translates to:
  /// **'تمت الاستعادة'**
  String get settings_backupRestored;

  /// No description provided for @settings_clearData.
  ///
  /// In ar, this message translates to:
  /// **'مسح البيانات المحلية'**
  String get settings_clearData;

  /// No description provided for @settings_clearDataConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سيؤدي هذا لحذف كل التصاميم والمسودات المحلية. متابعة؟'**
  String get settings_clearDataConfirm;

  /// No description provided for @settings_connect.
  ///
  /// In ar, this message translates to:
  /// **'ربط'**
  String get settings_connect;

  /// No description provided for @settings_connected.
  ///
  /// In ar, this message translates to:
  /// **'مربوط'**
  String get settings_connected;

  /// No description provided for @settings_errorLog.
  ///
  /// In ar, this message translates to:
  /// **'سجل الأخطاء'**
  String get settings_errorLog;

  /// No description provided for @settings_errorLogClear.
  ///
  /// In ar, this message translates to:
  /// **'مسح السجل'**
  String get settings_errorLogClear;

  /// No description provided for @settings_errorLogEmpty.
  ///
  /// In ar, this message translates to:
  /// **'لا أخطاء مسجلة'**
  String get settings_errorLogEmpty;

  /// No description provided for @settings_errorLogNote.
  ///
  /// In ar, this message translates to:
  /// **'يُحفظ محليًا على جهازك فقط للمساعدة في التشخيص، ولا يُرسل لأي جهة.'**
  String get settings_errorLogNote;

  /// No description provided for @settings_help.
  ///
  /// In ar, this message translates to:
  /// **'المساعدة'**
  String get settings_help;

  /// No description provided for @settings_installButton.
  ///
  /// In ar, this message translates to:
  /// **'تثبيت التطبيق'**
  String get settings_installButton;

  /// No description provided for @settings_installDesc.
  ///
  /// In ar, this message translates to:
  /// **'يعمل كتطبيق كامل بلا متصفح، وبدون إنترنت بعد أول فتح.'**
  String get settings_installDesc;

  /// No description provided for @settings_installTitle.
  ///
  /// In ar, this message translates to:
  /// **'ثبّت فلاح على جهازك'**
  String get settings_installTitle;

  /// No description provided for @settings_language.
  ///
  /// In ar, this message translates to:
  /// **'اللغة'**
  String get settings_language;

  /// No description provided for @settings_network.
  ///
  /// In ar, this message translates to:
  /// **'الشبكة'**
  String get settings_network;

  /// No description provided for @settings_notConfigured.
  ///
  /// In ar, this message translates to:
  /// **'يتطلب إعداد API. راجع docs/DEPLOYMENT.md'**
  String get settings_notConfigured;

  /// No description provided for @settings_notifications.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات'**
  String get settings_notifications;

  /// No description provided for @settings_notifications_desc.
  ///
  /// In ar, this message translates to:
  /// **'تنبيهات النشر المجدول'**
  String get settings_notifications_desc;

  /// No description provided for @settings_plan_free.
  ///
  /// In ar, this message translates to:
  /// **'مجاني'**
  String get settings_plan_free;

  /// No description provided for @settings_plan_premium.
  ///
  /// In ar, this message translates to:
  /// **'بريميوم'**
  String get settings_plan_premium;

  /// No description provided for @settings_plan_pro.
  ///
  /// In ar, this message translates to:
  /// **'برو'**
  String get settings_plan_pro;

  /// No description provided for @settings_privacy.
  ///
  /// In ar, this message translates to:
  /// **'الخصوصية'**
  String get settings_privacy;

  /// No description provided for @settings_quality.
  ///
  /// In ar, this message translates to:
  /// **'جودة التصدير'**
  String get settings_quality;

  /// No description provided for @settings_security.
  ///
  /// In ar, this message translates to:
  /// **'الأمان'**
  String get settings_security;

  /// No description provided for @settings_socialAccounts.
  ///
  /// In ar, this message translates to:
  /// **'حسابات النشر'**
  String get settings_socialAccounts;

  /// No description provided for @settings_storage.
  ///
  /// In ar, this message translates to:
  /// **'التخزين'**
  String get settings_storage;

  /// No description provided for @settings_storageUsed.
  ///
  /// In ar, this message translates to:
  /// **'المساحة المستخدمة'**
  String get settings_storageUsed;

  /// No description provided for @settings_subscription.
  ///
  /// In ar, this message translates to:
  /// **'الاشتراك'**
  String get settings_subscription;

  /// No description provided for @settings_theme_dark.
  ///
  /// In ar, this message translates to:
  /// **'داكن'**
  String get settings_theme_dark;

  /// No description provided for @settings_theme_light.
  ///
  /// In ar, this message translates to:
  /// **'فاتح'**
  String get settings_theme_light;

  /// No description provided for @settings_theme_system.
  ///
  /// In ar, this message translates to:
  /// **'النظام'**
  String get settings_theme_system;

  /// No description provided for @settings_title.
  ///
  /// In ar, this message translates to:
  /// **'الإعدادات'**
  String get settings_title;

  /// No description provided for @shell_search.
  ///
  /// In ar, this message translates to:
  /// **'ابحث عن آية…'**
  String get shell_search;

  /// No description provided for @source_approve.
  ///
  /// In ar, this message translates to:
  /// **'اعتماد النص'**
  String get source_approve;

  /// No description provided for @source_approveDesc.
  ///
  /// In ar, this message translates to:
  /// **'أقرّ بأنني راجعت النص ومصدره'**
  String get source_approveDesc;

  /// No description provided for @source_blocked.
  ///
  /// In ar, this message translates to:
  /// **'غير موثّق'**
  String get source_blocked;

  /// No description provided for @source_pending.
  ///
  /// In ar, this message translates to:
  /// **'قيد المراجعة'**
  String get source_pending;

  /// No description provided for @source_title.
  ///
  /// In ar, this message translates to:
  /// **'المصدر'**
  String get source_title;

  /// No description provided for @source_verified.
  ///
  /// In ar, this message translates to:
  /// **'موثّق'**
  String get source_verified;

  /// No description provided for @tasbih_reset.
  ///
  /// In ar, this message translates to:
  /// **'تصفير'**
  String get tasbih_reset;

  /// No description provided for @tasbih_sourceNote.
  ///
  /// In ar, this message translates to:
  /// **'ورد اللفظ في القرآن الكريم:'**
  String get tasbih_sourceNote;

  /// No description provided for @tasbih_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'عدّاد ذكر يعمل بلا إنترنت، وبياناتك تبقى على جهازك'**
  String get tasbih_subtitle;

  /// No description provided for @tasbih_title.
  ///
  /// In ar, this message translates to:
  /// **'السبحة'**
  String get tasbih_title;

  /// No description provided for @tasbih_today.
  ///
  /// In ar, this message translates to:
  /// **'ذكر اليوم'**
  String get tasbih_today;

  /// No description provided for @templates_deleted.
  ///
  /// In ar, this message translates to:
  /// **'حُذف القالب'**
  String get templates_deleted;

  /// No description provided for @templates_mine.
  ///
  /// In ar, this message translates to:
  /// **'قوالبي'**
  String get templates_mine;

  /// No description provided for @templates_mineEmpty.
  ///
  /// In ar, this message translates to:
  /// **'صمّم مرة واحدة ثم احفظه هنا لتعيد استخدامه مع أي آية أو حديث'**
  String get templates_mineEmpty;

  /// No description provided for @templates_namePlaceholder.
  ///
  /// In ar, this message translates to:
  /// **'اسم القالب'**
  String get templates_namePlaceholder;

  /// No description provided for @templates_premium.
  ///
  /// In ar, this message translates to:
  /// **'بريميوم'**
  String get templates_premium;

  /// No description provided for @templates_premiumOnly.
  ///
  /// In ar, this message translates to:
  /// **'متاح في الاشتراك المدفوع'**
  String get templates_premiumOnly;

  /// No description provided for @templates_saveCurrent.
  ///
  /// In ar, this message translates to:
  /// **'حفظ التصميم الحالي كقالب'**
  String get templates_saveCurrent;

  /// No description provided for @templates_saved.
  ///
  /// In ar, this message translates to:
  /// **'حُفظ القالب. ستجده في «قوالبي»'**
  String get templates_saved;

  /// No description provided for @video_anim_fade.
  ///
  /// In ar, this message translates to:
  /// **'ظهور تدريجي'**
  String get video_anim_fade;

  /// No description provided for @video_anim_rise.
  ///
  /// In ar, this message translates to:
  /// **'صعود'**
  String get video_anim_rise;

  /// No description provided for @video_anim_typewriter.
  ///
  /// In ar, this message translates to:
  /// **'كتابة متدرجة'**
  String get video_anim_typewriter;

  /// No description provided for @video_animation.
  ///
  /// In ar, this message translates to:
  /// **'حركة النص'**
  String get video_animation;

  /// No description provided for @video_done.
  ///
  /// In ar, this message translates to:
  /// **'تم إنشاء الفيديو'**
  String get video_done;

  /// No description provided for @video_downloadWebm.
  ///
  /// In ar, this message translates to:
  /// **'تنزيل WebM'**
  String get video_downloadWebm;

  /// No description provided for @video_duration.
  ///
  /// In ar, this message translates to:
  /// **'المدة (ثواني)'**
  String get video_duration;

  /// No description provided for @video_notSupported.
  ///
  /// In ar, this message translates to:
  /// **'متصفحك لا يدعم تسجيل الفيديو. جرّب Chrome أو Edge'**
  String get video_notSupported;

  /// No description provided for @video_preview.
  ///
  /// In ar, this message translates to:
  /// **'معاينة'**
  String get video_preview;

  /// No description provided for @video_reciter.
  ///
  /// In ar, this message translates to:
  /// **'صوت التلاوة'**
  String get video_reciter;

  /// No description provided for @video_render.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء الفيديو'**
  String get video_render;

  /// No description provided for @video_rendering.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ الإنشاء…'**
  String get video_rendering;

  /// No description provided for @video_subtitles.
  ///
  /// In ar, this message translates to:
  /// **'الترجمة النصية'**
  String get video_subtitles;

  /// No description provided for @video_title.
  ///
  /// In ar, this message translates to:
  /// **'صانع الفيديو'**
  String get video_title;

  /// No description provided for @werd_ayahs.
  ///
  /// In ar, this message translates to:
  /// **'آية'**
  String get werd_ayahs;

  /// No description provided for @werd_finishSurah.
  ///
  /// In ar, this message translates to:
  /// **'أنهيت السورة'**
  String get werd_finishSurah;

  /// No description provided for @werd_markHere.
  ///
  /// In ar, this message translates to:
  /// **'توقفت هنا'**
  String get werd_markHere;

  /// No description provided for @werd_marked.
  ///
  /// In ar, this message translates to:
  /// **'حُفظ موضعك'**
  String get werd_marked;

  /// No description provided for @werd_progress.
  ///
  /// In ar, this message translates to:
  /// **'تقدم الختمة'**
  String get werd_progress;

  /// No description provided for @werd_streak.
  ///
  /// In ar, this message translates to:
  /// **'سلسلة الأيام'**
  String get werd_streak;

  /// No description provided for @werd_subtitle.
  ///
  /// In ar, this message translates to:
  /// **'تابع ختمتك: علّم آخر آية قرأتها ويحسب فلاح تقدمك وسلسلتك اليومية'**
  String get werd_subtitle;

  /// No description provided for @werd_title.
  ///
  /// In ar, this message translates to:
  /// **'الورد اليومي'**
  String get werd_title;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
