import 'dart:async';

import 'package:falah/features/quran_api/audio/audio_player_service.dart';
import 'package:falah/features/quran_api/domain/models.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeBackend implements AudioBackend {
  final List<String> loaded = [];
  final List<String> actions = [];
  final _position = StreamController<Duration>.broadcast();
  final _completed = StreamController<bool>.broadcast();

  @override
  Future<void> load(String url) async {
    loaded.add(url);
    actions.add('load');
  }

  @override
  Future<void> play() async => actions.add('play');

  @override
  Future<void> pause() async => actions.add('pause');

  @override
  Future<void> stop() async => actions.add('stop');

  @override
  Future<void> seek(Duration position) async => actions.add('seek:${position.inMilliseconds}');

  @override
  Stream<Duration> get positionStream => _position.stream;

  @override
  Stream<bool> get completedStream => _completed.stream;

  void complete() => _completed.add(true);

  @override
  Future<void> dispose() async {
    await _position.close();
    await _completed.close();
  }
}

QuranAudioFile file(int sequence, {bool verified = true}) => QuranAudioFile(
  id: 'a$sequence',
  recitationId: 'r1',
  sequenceNumber: sequence,
  audioUrl: 'https://cdn.test/$sequence.mp3',
  status: 'streaming_only',
  verified: verified,
  downloadable: false,
);

void main() {
  late FakeBackend backend;
  late AudioPlayerService service;

  setUp(() {
    backend = FakeBackend();
    service = AudioPlayerService(backend);
  });

  tearDown(() => service.dispose());

  test('plays, pauses, resumes and stops', () async {
    await service.setPlaylist([file(1)]);
    await service.play();
    expect(service.state, PlaybackState.playing);
    await service.pause();
    expect(service.state, PlaybackState.paused);
    await service.resume();
    expect(service.state, PlaybackState.playing);
    await service.stop();
    expect(service.state, PlaybackState.idle);
    expect(backend.loaded, ['https://cdn.test/1.mp3']);
  });

  test('moves through the playlist with next and previous', () async {
    await service.setPlaylist([file(1), file(2), file(3)]);
    expect(service.current?.sequenceNumber, 1);
    await service.next();
    expect(service.current?.sequenceNumber, 2);
    await service.previous();
    expect(service.current?.sequenceNumber, 1);
    expect(service.hasPrevious, isFalse);
  });

  test('auto-advances when a track completes', () async {
    await service.setPlaylist([file(1), file(2)]);
    backend.complete();
    await Future<void>.delayed(Duration.zero);
    expect(service.current?.sequenceNumber, 2);
  });

  test('repeats one track when repeat mode is one', () async {
    await service.setPlaylist([file(1), file(2)]);
    service.setRepeatMode(RepeatMode.one);
    backend.complete();
    await Future<void>.delayed(Duration.zero);
    expect(service.current?.sequenceNumber, 1);
    expect(backend.actions, contains('seek:0'));
  });

  test('wraps around when repeat mode is all', () async {
    await service.setPlaylist([file(1), file(2)], startIndex: 1);
    service.setRepeatMode(RepeatMode.all);
    backend.complete();
    await Future<void>.delayed(Duration.zero);
    expect(service.current?.sequenceNumber, 1);
  });

  test('refuses unverified audio files', () async {
    await service.setPlaylist([file(1, verified: false)]);
    expect(service.playlist, isEmpty);
    expect(service.current, isNull);
    await service.play();
    expect(backend.actions, isEmpty);
  });

  test('seeks to a position', () async {
    await service.setPlaylist([file(1)]);
    await service.seek(const Duration(seconds: 12));
    expect(backend.actions, contains('seek:12000'));
  });
}
