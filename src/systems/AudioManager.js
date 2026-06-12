import { Howl, Howler } from 'howler';

// Все звуки предгенерированы и лежат в /assets/audio/{vo,sfx,music}.
// Позиционные источники привязываются к Vector3 и обновляются от позиции игрока.
export class AudioManager {
  constructor() {
    this.voices = new Map();      // id -> Howl (озвучка)
    this.sfx = new Map();         // id -> Howl
    this.positional = [];         // { howl, soundId, pos, refDist, maxDist }
    this.music = null;
    this.currentVoice = null;
    Howler.volume(1.0);
  }

  loadVoice(id, onend) {
    if (this.voices.has(id)) return this.voices.get(id);
    const howl = new Howl({
      src: [`/assets/audio/vo/${id}.mp3`],
      preload: true,
      onloaderror: (sid, err) => console.warn(`[Audio] VO ${id} не загрузилась:`, err),
    });
    this.voices.set(id, howl);
    return howl;
  }

  // Проиграть реплику; возвращает Promise по окончании (или сразу, если файла нет).
  playVoice(id) {
    this.stopVoice();
    return new Promise((resolve) => {
      const howl = this.loadVoice(id);
      let settled = false;
      const done = () => { if (!settled) { settled = true; this.currentVoice = null; resolve(); } };
      howl.once('end', done);
      howl.once('loaderror', done);
      howl.once('playerror', done);
      const sid = howl.play();
      this.currentVoice = { howl, sid };
      // страховка: если файл не существует, state останется unloaded
      setTimeout(() => { if (howl.state() === 'unloaded') done(); }, 3000);
    });
  }

  stopVoice() {
    if (this.currentVoice) {
      this.currentVoice.howl.stop(this.currentVoice.sid);
      this.currentVoice = null;
    }
  }

  loadSfx(id, { loop = false, volume = 1 } = {}) {
    if (this.sfx.has(id)) return this.sfx.get(id);
    const howl = new Howl({
      src: [`/assets/audio/sfx/${id}.mp3`],
      loop, volume,
      onloaderror: () => console.warn(`[Audio] SFX ${id} не загрузился`),
    });
    this.sfx.set(id, howl);
    return howl;
  }

  playSfx(id, volume = 1) {
    const howl = this.loadSfx(id);
    howl.volume(volume);
    return howl.play();
  }

  // Зацикленный позиционный источник (прибой, ветер в соснах, гул маяка).
  addPositional(id, pos, { refDist = 3, maxDist = 30, volume = 1 } = {}) {
    const howl = this.loadSfx(id, { loop: true, volume });
    const soundId = howl.play();
    howl.pos(pos.x, pos.y, pos.z, soundId);
    howl.pannerAttr({
      refDistance: refDist, maxDistance: maxDist,
      rolloffFactor: 1.2, distanceModel: 'exponential', panningModel: 'HRTF',
    }, soundId);
    this.positional.push({ howl, soundId, pos });
    return soundId;
  }

  // Вызывать каждый кадр: слушатель = камера.
  updateListener(camera) {
    const p = camera.position;
    Howler.pos(p.x, p.y, p.z);
    const fwd = camera.getWorldDirection(this._fwd ??= new (p.constructor)());
    Howler.orientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
  }

  playMusic(id, volume = 0.35) {
    this.stopMusic();
    this.music = new Howl({
      src: [`/assets/audio/music/${id}.mp3`],
      loop: true, volume: 0,
      onloaderror: () => console.warn(`[Audio] Музыка ${id} не загрузилась`),
    });
    this.music.play();
    this.music.fade(0, volume, 2500);
  }

  stopMusic() {
    if (this.music) {
      const m = this.music;
      m.fade(m.volume(), 0, 1500);
      setTimeout(() => m.unload(), 1600);
      this.music = null;
    }
  }
}
