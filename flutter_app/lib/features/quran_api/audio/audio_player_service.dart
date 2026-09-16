/// Quran audio playback.
///
/// The service owns the playlist, the repeat mode and the current position;
/// the actual player is a port ([AudioBackend]) so it can be backed by
/// `just_audio` in the app and by a fake in tests. The just_audio adapter is
/// documented in `docs/FLUTTER_AUDIO.md` — audio playback stays disabled until
/// AUDIO_LICENSE_CONFIRMED is true and licensed recitations are imported.
library;

import 'dart:async';

import '../domain/models.dart';

enum PlaybackState { idle, loading, playing, paused, completed, error }

enum RepeatMode { off, one, all }

abstract class AudioBackend {
  Future<void> load(String url);
  Future<void> play();
  Future<void> pause();
  Future<void> stop();
  Future<void> seek(Duration position);
  Stream<Duration> get positionStream;
  Stream<bool> get completedStream;
  Future<void> dispose();
}

class AudioPlayerService {
  AudioPlayerService(this._backend) {
    _completedSub = _backend.completedStream.listen((done) {
      if (done) unawaited(_onCompleted());
    });
  }

  final AudioBackend _backend;
  late final StreamSubscription<bool> _completedSub;

  final _stateController = StreamController<PlaybackState>.broadcast();
  final _trackController = StreamController<QuranAudioFile?>.broadcast();

  List<QuranAudioFile> _playlist = const [];
  int _index = 0;
  RepeatMode _repeat = RepeatMode.off;
  PlaybackState _state = PlaybackState.idle;

  Stream<PlaybackState> get stateStream => _stateController.stream;
  Stream<QuranAudioFile?> get trackStream => _trackController.stream;
  Stream<Duration> get positionStream => _backend.positionStream;

  PlaybackState get state => _state;
  RepeatMode get repeatMode => _repeat;
  List<QuranAudioFile> get playlist => List.unmodifiable(_playlist);
  QuranAudioFile? get current =>
      _index >= 0 && _index < _playlist.length ? _playlist[_index] : null;
  bool get hasNext => _index + 1 < _playlist.length;
  bool get hasPrevious => _index > 0;

  void setRepeatMode(RepeatMode mode) => _repeat = mode;

  /// Loads a playlist. Unverified files are refused: the app never plays a URL
  /// that the platform has not checked.
  Future<void> setPlaylist(List<QuranAudioFile> files, {int startIndex = 0}) async {
    _playlist = files.where((file) => file.verified).toList(growable: false);
    _index = _playlist.isEmpty ? 0 : startIndex.clamp(0, _playlist.length - 1);
    if (_playlist.isEmpty) {
      _emit(PlaybackState.idle);
      _trackController.add(null);
      return;
    }
    await _loadCurrent();
  }

  Future<void> play() async {
    if (current == null) return;
    await _backend.play();
    _emit(PlaybackState.playing);
  }

  Future<void> resume() => play();

  Future<void> pause() async {
    await _backend.pause();
    _emit(PlaybackState.paused);
  }

  Future<void> stop() async {
    await _backend.stop();
    _emit(PlaybackState.idle);
  }

  Future<void> seek(Duration position) => _backend.seek(position);

  Future<void> next() async {
    if (!hasNext) {
      if (_repeat == RepeatMode.all && _playlist.isNotEmpty) {
        _index = 0;
        await _loadCurrent();
        await play();
      }
      return;
    }
    _index += 1;
    await _loadCurrent();
    await play();
  }

  Future<void> previous() async {
    if (!hasPrevious) return;
    _index -= 1;
    await _loadCurrent();
    await play();
  }

  Future<void> _loadCurrent() async {
    final track = current;
    if (track == null) return;
    _emit(PlaybackState.loading);
    await _backend.load(track.playbackUrl);
    _trackController.add(track);
  }

  Future<void> _onCompleted() async {
    switch (_repeat) {
      case RepeatMode.one:
        await _backend.seek(Duration.zero);
        await play();
      case RepeatMode.all:
      case RepeatMode.off:
        if (hasNext) {
          await next();
        } else if (_repeat == RepeatMode.all && _playlist.isNotEmpty) {
          _index = 0;
          await _loadCurrent();
          await play();
        } else {
          _emit(PlaybackState.completed);
        }
    }
  }

  void _emit(PlaybackState state) {
    _state = state;
    _stateController.add(state);
  }

  Future<void> dispose() async {
    await _completedSub.cancel();
    await _backend.dispose();
    await _stateController.close();
    await _trackController.close();
  }
}
