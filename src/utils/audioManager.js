// AudioManager — singleton for menu/energizer music + SFX
// Lives outside React — not affected by component mount/unmount

class AudioManager {
  constructor() {
    this.menuTracks = [];
    this.energizerTracks = [];
    this.menuIndex = 0;
    this.energizerIndex = 0;
    this.currentAudio = null;
    this.currentType = null; // 'menu' | 'energizer'
    this.volume = 0.3;
    this.muted = false;
    this.initialized = false;
    this._initPromise = null;
  }

  // Start init (non-blocking, call early)
  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  }

  async _doInit() {
    if (this.initialized) return;
    this.menuTracks = await this._detectTracks('menu');
    this.energizerTracks = await this._detectTracks('energizer');
    this.initialized = true;
    console.log('AudioManager: menu tracks:', this.menuTracks.length, 'energizer tracks:', this.energizerTracks.length);
  }

  async _detectTracks(prefix) {
    const tracks = [];
    for (let i = 1; i <= 50; i++) {
      const path = `/audio/${prefix}-${i}.mp3`;
      try {
        const res = await fetch(path, { method: 'HEAD' });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('audio')) tracks.push(path);
        else break;
      } catch { break; }
    }
    return tracks;
  }

  // Call from a user-gesture handler (click/key/touch)
  // Plays menu-1.mp3 immediately, then continues sequentially
  playMenu() {
    // Already playing menu music — don't restart
    if (this.currentType === 'menu' && this.currentAudio && !this.currentAudio.paused) {
      console.log('AudioManager.playMenu: already playing, skip');
      return;
    }
    console.log('AudioManager.playMenu: starting, tracks:', this.menuTracks.length, 'muted:', this.muted, 'vol:', this.volume);
    this.currentType = 'menu';

    if (this.menuTracks.length > 0) {
      // Init done — play from current index
      this._playTrack(this.menuTracks, 'menu');
    } else {
      // Init not done yet — play menu-1.mp3 directly (must be synchronous for user gesture)
      this._playDirect('/audio/menu-1.mp3', 'menu');
    }
  }

  playEnergizer() {
    this.stopCurrent();
    this.currentType = 'energizer';
    if (this.energizerTracks.length > 0) {
      this._playTrack(this.energizerTracks, 'energizer');
    } else {
      this._playDirect('/audio/energizer-1.mp3', 'energizer');
    }
  }

  // Play a specific track from the playlist at current index
  _playTrack(tracks, type) {
    if (tracks.length === 0) return;
    const indexKey = type === 'energizer' ? 'energizerIndex' : 'menuIndex';
    const idx = this[indexKey] % tracks.length;
    const src = tracks[idx];

    this.stopCurrent();
    const audio = new Audio(src);
    audio.volume = this.muted ? 0 : this.volume;
    audio.onended = () => {
      this[indexKey] = (this[indexKey] + 1) % tracks.length;
      this._playTrack(tracks, type);
    };
    audio.play().then(() => {
      console.log('AudioManager._playTrack: playing', src);
    }).catch((e) => {
      console.warn('AudioManager._playTrack: play failed', src, e.message);
    });
    this.currentAudio = audio;
  }

  // Play a single path directly (before init completes)
  _playDirect(src, type) {
    this.stopCurrent();
    const audio = new Audio(src);
    audio.volume = this.muted ? 0 : this.volume;
    audio.onended = () => {
      // By now init should be done — switch to sequential playlist
      const tracks = type === 'menu' ? this.menuTracks : this.energizerTracks;
      const indexKey = type === 'energizer' ? 'energizerIndex' : 'menuIndex';
      if (tracks.length > 1) {
        this[indexKey] = 1; // Start from track 2 (we just played track 1)
        this._playTrack(tracks, type);
      } else {
        // Only one track or init still running — loop it
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    };
    audio.play().then(() => {
      console.log('AudioManager._playDirect: playing', src);
    }).catch((e) => {
      console.warn('AudioManager._playDirect: play BLOCKED', src, e.message);
    });
    this.currentAudio = audio;
  }

  stopCurrent() {
    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  pause() {
    if (this.currentAudio) this.currentAudio.pause();
  }

  resume() {
    if (this.currentAudio) {
      this.currentAudio.play().catch(() => {});
    }
  }

  resumeMenu() {
    if (this.currentType === 'menu' && this.currentAudio) {
      this.currentAudio.play().catch(() => {});
    } else {
      this.playMenu();
    }
  }

  setVolume(v) {
    this.volume = v;
    this.muted = v === 0;
    if (this.currentAudio) this.currentAudio.volume = this.muted ? 0 : v;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.currentAudio) this.currentAudio.volume = this.muted ? 0 : this.volume;
    return this.muted;
  }

  skipTrack() {
    const type = this.currentType || 'menu';
    const tracks = type === 'energizer' ? this.energizerTracks : this.menuTracks;
    const indexKey = type === 'energizer' ? 'energizerIndex' : 'menuIndex';
    if (tracks.length === 0) return;
    this[indexKey] = (this[indexKey] + 1) % tracks.length;
    this._playTrack(tracks, type);
  }

  // --- SFX (plays on top of music) ---
  playSfx(name) {
    const src = `/audio/sfx/${name}.mp3`;
    const audio = new Audio(src);
    audio.volume = this.muted ? 0 : this.volume;
    audio.play().catch(() => {});
  }
}

export const audioManager = new AudioManager();
