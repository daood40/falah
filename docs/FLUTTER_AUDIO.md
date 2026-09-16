# FLUTTER_AUDIO — تشغيل التلاوات في تطبيق Flutter

`AudioPlayerService` (في `flutter_app/lib/features/quran_api/audio/`) يملك قائمة
التشغيل ووضع التكرار والموضع الحالي، ويعتمد على منفذ `AudioBackend` لتشغيل
الصوت فعليًا. هذا يبقي التطبيق قابلًا للاختبار بلا شبكة، ويسمح باستبدال المشغّل
دون لمس منطق التشغيل.

**الوضع الحالي:** لا تلاوات مستوردة (AUDIO_LICENSE_CONFIRMED=false ولا Dataset
صوتي مرخّص)، لذلك لم تُضف حزمة `just_audio` إلى `pubspec.yaml` بعد — لا تُضاف
اعتمادية لا تُستعمل. عند تأكيد الحقوق واستيراد التلاوات، هذه هي الخطوات:

## 1. أضف الاعتمادية

```yaml
dependencies:
  just_audio: ^0.10.4
```

## 2. أضف المحوّل (ملف واحد)

`flutter_app/lib/features/quran_api/audio/just_audio_backend.dart`:

```dart
import 'package:just_audio/just_audio.dart';

import 'audio_player_service.dart';

class JustAudioBackend implements AudioBackend {
  JustAudioBackend([AudioPlayer? player]) : _player = player ?? AudioPlayer();

  final AudioPlayer _player;

  @override
  Future<void> load(String url) => _player.setUrl(url);

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> stop() => _player.stop();

  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Stream<Duration> get positionStream => _player.positionStream;

  @override
  Stream<bool> get completedStream => _player.playerStateStream
      .map((state) => state.processingState == ProcessingState.completed);

  @override
  Future<void> dispose() => _player.dispose();
}
```

## 3. اربطه بمزود Riverpod

```dart
final audioPlayerServiceProvider = Provider<AudioPlayerService>((ref) {
  final service = AudioPlayerService(JustAudioBackend());
  ref.onDispose(service.dispose);
  return service;
});
```

## 4. التشغيل

```dart
final files = await ref.read(audioRepositoryProvider).getSurahAudio(reciterSlug, 18);
final player = ref.read(audioPlayerServiceProvider);
await player.setPlaylist(files);      // الملفات غير المتحقَّقة تُرفض تلقائيًا
await player.play();                  // pause/resume/stop/seek/next/previous
player.setRepeatMode(RepeatMode.all);
```

## قواعد ملزمة

- لا يُشغَّل ملف `verified = false` — الخدمة ترفضه قبل أن يصل إلى المشغّل.
- `download_url` يبقى `null` ما لم يؤكَّد `AUDIO_LICENSE_CONFIRMED`؛ البث فقط.
- الأذونات (الخلفية/الشاشة المقفلة) تُضاف حين تُطلب الميزة، لا قبلها.
