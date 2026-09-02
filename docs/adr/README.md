# قرارات معمارية (ADRs)

القرارات الملزمة من وثيقة التوجيه v2 (§27). كل قرار في ملف مستقل بصيغة:
السياق → القرار → البديل المرفوض → السبب → الأثر على الكود الحالي.

| # | القرار | الحالة |
|---|---|---|
| [ADR-001](ADR-001-flutter-migration.md) | Flutter للواجهة — **هجرة مرحلية** من الـPWA الحالية | معتمد، غير منفَّذ بعد (انظر `MIGRATION.md`) |
| [ADR-002](ADR-002-supabase.md) | Supabase (PostgreSQL + Auth + Storage + Edge Functions) | معتمد ومنفَّذ |
| [ADR-003](ADR-003-clean-architecture.md) | Clean Architecture + Feature-based + Repository + DI | معتمد ومنفَّذ (Zustand حاليًا؛ Riverpod عند الهجرة) |
| [ADR-004](ADR-004-ffmpeg-worker.md) | FFmpeg في Worker خلفي | معتمد؛ المعاينة على الجهاز منفَّذة، الـWorker مرحلة 3 |
| [ADR-005](ADR-005-ai-tool-calling.md) | AI عبر Tool Calling + Output Guard | معتمد؛ الحارس الحالي client-side + system prompt، والـOutput Guard على الخادم مرحلة قادمة |
| [ADR-006](ADR-006-kms-token-encryption.md) | تشفير Tokens بمفتاح KMS خارج القاعدة | معتمد؛ يُنفَّذ مع أول Connector حقيقي (مرحلة 4) |
