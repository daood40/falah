# OWNER_LICENSE_CHECKLIST — ما أحتاجه منك قبل أي نشر

> الحالة اليوم: **PRIVATE MODE — لا نشر**. هذه قائمة ما يجب أن تحصل عليه أنت،
> ولا يستطيع أي وكيل أو اختبار أن ينوب عنك فيه.

## التراخيص والأذونات

- [ ] **Quran text redistribution permission** — إذن مكتوب بإعادة توزيع نص
      المصحف المستخدم (المصدر الحالي: `quran-json` ونصه من quranenc.com،
      وترخيصه متضارب). البديل: مصحف من جهة تمنح إذنًا صريحًا (مجمع الملك فهد
      مثلًا) يُوضع في `owner_dropzone/quran/`.
- [ ] **Translation permissions** — إذن لكل ترجمة على حدة (10 حاليًا):
      Saheeh International · Hamidullah · Diyanet · Maududi · Kemenag ·
      García · Kuliev · Bernström · Muhiuddin Khan · Ma Jian.
      أو قرار بحذف اللغات غير الموثّقة.
- [ ] **Tafsir permissions** — إن أردت التفسير (لا يوجد Dataset حاليًا).
- [ ] **Qiraat permissions** — لأي قراءة تُضاف غير عاصم.
- [ ] **Riwayat permissions** — لأي رواية تُضاف غير حفص.
- [ ] **Reciter permissions** — حقوق بيانات القارئ (واسمه وصورته إن استُخدمت).
- [ ] **Audio redistribution permission** — إعادة توزيع أو بثّ موثّق، مع
      manifest مطابق لـ`quran_api/schemas/audio-manifest.schema.json`.
- [ ] **Commercial usage permissions** — إن كان الاستخدام تجاريًا (اشتراكات،
      إعلانات، متجر مدفوع). بعض التراخيص تمنع ذلك تحديدًا.
- [ ] **Attribution requirements** — النص الحرفي للنسبة المطلوبة لكل مصدر،
      وأين يجب أن يظهر.

## الاعتماد والنشر

- [ ] **Human verification** — مراجع مؤهّل يعتمد النسخة:
      `npm run verify:human -- --version=2026.09.16-1 --verifier="…" --role="…" --scope="…" --sample=200 --result=approved`
- [ ] **Final dataset approval** — موافقتك على النسخة التي ستُنشر بعينها.
- [ ] **Public deployment approval** — قرارك برفع الأعلام:
      `PRIVATE_MODE=false` + `PUBLIC_DATA_ENABLED` + `PUBLIC_API_ENABLED` +
      `DATA_REDISTRIBUTION_ALLOWED` + `CONTENT_LICENSE_CONFIRMED` +
      `TRANSLATIONS_LICENSE_CONFIRMED` (+ `AUDIO_LICENSE_CONFIRMED` إن شمل الصوت).

## بنية تحتية (ليست ترخيصًا لكنها مطلوبة للنشر)

- [ ] `DATABASE_URL` + `SUPABASE_URL` + `SUPABASE_ANON_KEY` +
      `SUPABASE_SERVICE_ROLE_KEY` (للخادم فقط) + `SUPABASE_JWT_SECRET`
- [ ] مضيف للخدمة + نطاق (مثل `api.falah.app`) + شهادة TLS
- [ ] جعل مستودع GitHub **private** إن لم يكن كذلك
- [ ] تشغيل Android Release في GitHub Actions لإنتاج APK/AAB

## كيف تُدخل الإذن عند وصوله

1. ضع الملف في `owner_dropzone/licenses/<kind>-<subject>.pdf`.
2. سجّله: `npm run license:record -- --kind=… --subject=… --status=CONFIRMED --redistribution=allowed --evidence="…" --recorded-by="…"`.
3. تحقق: `npm run license:list` ثم `npm run release:gate`.
4. لا نشر قبل أن يقول الـgate: `ALLOWED`.
