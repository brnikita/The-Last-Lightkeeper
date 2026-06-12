import dialogueData from '../data/dialogues.json';

const SPEAKER_NAMES = { eli: 'ЭЛИ', ded: 'ДЕД', marta: 'МАРТА' };
const MIN_LINE_TIME = 2600; // мс на строку, если нет/короче аудио

// Субтитры внизу экрана + синхронная озвучка. Очередь реплик.
const REPEAT_COOLDOWN = 40000; // мс — раньше этого реплика не повторится

export class Dialogue {
  constructor(audio, ui) {
    this.audio = audio;
    this.ui = ui;          // HUD с методами showSubtitle/hideSubtitle
    this.queue = [];
    this.playing = false;
    this.current = null;
    this.seen = new Set();      // прослушанные id (в сейв)
    this.lastPlayed = new Map(); // id -> timestamp (анти-спам повторов)
  }

  // Показать одну реплику или последовательность.
  // once=true — никогда не повторять; once=false — повтор не чаще REPEAT_COOLDOWN
  // и никогда дважды подряд в очереди (защита от спама E / повторного входа в зону).
  say(idOrSequence, { once = true } = {}) {
    const seq = dialogueData.sequences[idOrSequence] || [idOrSequence];
    if (once && this.seen.has(seq[0])) return false;
    if (!once) {
      const head = seq[0];
      if (this.queue.includes(head) || this.current === head) return false;
      const last = this.lastPlayed.get(head) || 0;
      if (Date.now() - last < REPEAT_COOLDOWN) return false;
    }
    for (const id of seq) {
      if (!dialogueData.lines[id]) { console.warn(`[Dialogue] Нет строки ${id}`); continue; }
      this.queue.push(id);
      this.seen.add(id);
    }
    if (!this.playing) this._next();
    return true;
  }

  async _next() {
    const id = this.queue.shift();
    if (!id) { this.playing = false; this.current = null; this.ui.hideSubtitle(); return; }
    this.playing = true;
    this.current = id;
    this.lastPlayed.set(id, Date.now());
    const line = dialogueData.lines[id];
    const isRadio = line.speaker !== 'eli';
    this.ui.showSubtitle(SPEAKER_NAMES[line.speaker] || '', line.text, isRadio);

    const minTime = new Promise((r) => setTimeout(r, Math.max(MIN_LINE_TIME, line.text.length * 55)));
    const voice = this.audio.playVoice(id);
    await Promise.all([voice, minTime]);
    await new Promise((r) => setTimeout(r, 350)); // пауза между репликами
    this._next();
  }

  getNote(id) { return dialogueData.notes[id] || null; }

  serialize() { return [...this.seen]; }
  restore(ids) { for (const id of ids || []) this.seen.add(id); }
}
