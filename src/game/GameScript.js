import * as THREE from 'three';

// Сюжетная обвязка: зоны, интерактивы, цели, финал.
// Полный проход: интро → исследование → 4 линзы + ключ → маяк → финал.
export class GameScript {
  constructor(engine, anchors) {
    this.e = engine;
    this.a = anchors;
    this.t = 0;
  }

  start(loadedSave) {
    const { e, a } = this;
    const I = e.interaction;
    const D = e.dialogue;
    const inv = e.inventory;
    const save = e.saveSystem;
    const audio = e.audio;

    const objective = () => {
      if (save.hasFlag('finale_done')) e.hud.setObjective('Посиди ещё немного. Можно никуда не спешить.');
      else if (save.hasFlag('lighthouse_open')) e.hud.setObjective('Подняться на маяк');
      else if (inv.lensCount() === 4 && inv.has('lighthouse_key')) e.hud.setObjective('Открыть дверь маяка');
      else if (save.hasFlag('radio_fixed')) e.hud.setObjective(`Найти фрагменты линзы (${inv.lensCount()}/4)` + (inv.has('lighthouse_key') ? '' : ' · и ключ от маяка'));
      else e.hud.setObjective('Осмотреться на острове');
      e.hud.setLensCount(inv.lensCount());
    };
    this.refreshObjective = objective;

    // ---------- интро ----------
    if (!loadedSave) {
      this._showStill('intro', 6500);
      setTimeout(() => D.say('intro'), 1800);
    }
    objective();
    audio.playMusic(save.hasFlag('finale_started') ? 'theme_storm' : 'theme_calm', 0.22);

    // ---------- эмбиент ----------
    audio.addPositional('waves_loop', a.positions.dock, { refDist: 8, maxDist: 90, volume: 0.7 });
    audio.addPositional('forest_loop', new THREE.Vector3(36, 6, -16), { refDist: 10, maxDist: 55, volume: 0.6 });
    audio.addPositional('fire_loop', new THREE.Vector3(35, 3, -14), { refDist: 2.5, maxDist: 18, volume: 0.7 });
    const windId = audio.loadSfx('wind_loop', { loop: true, volume: 0.25 });
    windId.play();

    // ---------- зоны ----------
    I.addZone({ id: 'village', pos: new THREE.Vector3(-5, 3, 18), radius: 16, onEnter: () => D.say('village_entry') });
    I.addZone({ id: 'forest', pos: a.positions.forestEntry, radius: 10, onEnter: () => D.say('forest_entry') });
    I.addZone({ id: 'cove', pos: a.positions.coveEntry, radius: 10, onEnter: () => D.say('cove_entry') });
    I.addZone({
      id: 'lighthouse_base', pos: a.positions.lighthouse, radius: 14,
      onEnter: () => { if (!save.hasFlag('lighthouse_open')) D.say('lighthouse_locked', { once: true }); },
    });

    // ---------- интерактивы: записки ----------
    const note = (id, obj, prompt, noteId, line = null) => I.add({
      id, object: obj, prompt, once: false,
      onInteract: () => {
        audio.playSfx('paper', 0.7);
        const n = D.getNote(noteId);
        e.hud.showNote(n.title, n.text);
        if (line) D.say(line);
      },
    });
    note('noticeBoard', a.interactables.noticeBoard, 'Доска объявлений', 'note_board', 'dock_board');
    note('wellNote', a.interactables.well, 'Тетрадный листок у колодца', 'note_school');
    note('hutNote', a.interactables.hutNote, 'Журнал сторожки', 'note_hunters');
    note('dedBoatNote', a.interactables.dedBoat, 'Лодка «Чайка»', 'note_mihalych', 'cove_boat');
    note('tape3chest', a.interactables.tape_3, 'Вахтенный журнал', 'note_keeper_log');

    I.add({
      id: 'crane', object: a.interactables.crane, prompt: 'Старая лебёдка',
      onInteract: () => D.say('dock_crane'),
    });

    // ---------- линзы ----------
    for (let i = 1; i <= 4; i++) {
      const id = `lens_${i}`;
      I.add({
        id, object: a.interactables[id], prompt: 'Фрагмент линзы',
        onInteract: () => {
          audio.playSfx('pickup', 0.9);
          inv.add(id);
          D.say(`lens${i}_found`);
          const obj = a.interactables[id];
          obj.parent?.remove(obj);
          I.remove(id);
          save.setFlag(`${id}_taken`);
          objective();
          e.requestSave();
        },
      });
    }

    // ---------- дом деда ----------
    I.addZone({ id: 'ded_house', pos: a.positions.dedHouseDoor, radius: 6, onEnter: () => D.say('house_ded') });
    I.add({
      id: 'oldLantern', object: a.interactables.oldLantern, prompt: 'Дедушкин фонарь',
      onInteract: () => {
        audio.playSfx('pickup_item', 0.8);
        inv.add('old_lantern');
        D.say('lantern_found');
        save.setFlag('lantern_taken');
        e.requestSave();
      },
    });
    I.add({
      id: 'radioHandle', object: a.interactables.radioHandle, prompt: 'Что-то на прилавке',
      onInteract: () => {
        audio.playSfx('pickup_item', 0.8);
        inv.add('radio_handle');
        e.requestSave();
      },
    });
    I.add({
      id: 'radio', object: a.interactables.radio, prompt: 'Приёмник деда', once: false,
      onInteract: () => {
        if (save.hasFlag('radio_fixed')) { audio.playSfx('radio_static', 0.5); return; }
        if (!inv.has('radio_handle')) { D.say('radio_broken', { once: false }); return; }
        inv.remove('radio_handle');
        save.setFlag('radio_fixed');
        audio.playSfx('radio_on', 0.9);
        setTimeout(() => D.say('radio_fixed'), 1200);
        objective();
        e.requestSave();
      },
    });
    I.add({
      id: 'teaTin', object: a.interactables.teaTin, prompt: 'Жестянка из-под чая',
      condition: () => save.hasFlag('radio_fixed') || this.e.dialogue.seen.has('lighthouse_locked'),
      onInteract: () => {
        audio.playSfx('key_unlock', 0.7);
        inv.add('lighthouse_key');
        D.say('key_found');
        save.setFlag('key_taken');
        objective();
        e.requestSave();
      },
    });

    // ---------- записи деда ----------
    const tape = (n, obj) => I.add({
      id: `tape_${n}`, object: obj, prompt: 'Старая катушка с записью', once: false,
      onInteract: () => {
        audio.playSfx('radio_static', 0.6);
        setTimeout(() => D.say(`tape_${n}`), 900);
        save.setFlag(`tape_${n}_heard`);
      },
    });
    tape(1, a.interactables.tape_1);
    tape(2, a.interactables.tape_2);
    // tape_3 повешена на сундук как журнал — добавим саму запись рядом с дверью маяка через дверь

    I.add({
      id: 'forestHut', object: a.interactables.forestHut, prompt: 'Сторожка лесника',
      onInteract: () => D.say('forest_hut'),
    });

    // ---------- дверь маяка ----------
    const door = this.a.lighthouseDoor; // навешивается после загрузки маяка
    if (door) {
      I.add({
        id: 'lighthouseDoor', object: door, prompt: 'Дверь маяка', once: false,
        onInteract: () => {
          if (save.hasFlag('lighthouse_open')) { this.beginFinale(); return; }
          if (!inv.has('lighthouse_key')) { audio.playSfx('door_locked', 0.8); D.say('lighthouse_locked', { once: false }); return; }
          if (inv.lensCount() < 4) { D.say('need_lens', { once: false }); return; }
          audio.playSfx('key_unlock', 0.9);
          setTimeout(() => audio.playSfx('door_open', 0.9), 900);
          save.setFlag('lighthouse_open');
          D.say('lighthouse_open');
          // запись деда №3 — сразу за дверью
          setTimeout(() => D.say('tape_3'), 9000);
          objective();
          e.requestSave();
        },
      });
    }
  }

  // Показ иллюстрации катсцены, если файл существует.
  _showStill(name, ms) {
    const url = `/assets/textures/cutscenes/${name}.jpg`;
    const img = new Image();
    img.onload = () => {
      this.e.hud.showCutsceneImage(url);
      setTimeout(() => this.e.hud.hideCutsceneImage(), ms);
    };
    img.src = url;
  }

  // Финал: подъём (фейд) → галерея → сборка → свет → корабль.
  async beginFinale() {
    const { e } = this;
    if (e.saveSystem.hasFlag('finale_started')) return;
    e.saveSystem.setFlag('finale_started');
    const a = this.a;

    e.hud.fade(true);
    e.audio.playMusic('theme_storm', 0.26);
    e.audio.playSfx('stairs_metal', 0.8);
    this._showStill('storm', 5200);
    await wait(1600);
    e.audio.playSfx('stairs_metal', 0.6);

    // телепорт на галерею маяка
    const top = a.positions.lighthouseTop ?? a.positions.lighthouse.clone().add(new THREE.Vector3(0, 18, 0));
    e.player.teleport({ x: top.x, y: top.y + 1.2, z: top.z });
    e.tpCamera.yaw = 2.4; e.tpCamera.pitch = 0.15;

    // шторм
    e.setStorm(true);
    await wait(900);
    e.hud.fade(false);
    e.dialogue.say('climb_mid');
    await wait(5200);

    e.dialogue.say('final_assembly');
    await wait(6200);

    // зажигание
    e.audio.playSfx('lamp_ignite', 1);
    e.dialogue.say('final_light');
    await wait(1800);
    e.igniteLighthouse();
    await wait(4200);

    e.dialogue.say('final_ship');
    await wait(7000);
    e.audio.playSfx('ship_horn', 0.9);
    await wait(3000);
    e.dialogue.say('final_marta');
    await wait(7000);
    this._showStill('ending', 9000);
    e.dialogue.say('final_eli');
    this.e.saveSystem.setFlag('finale_done');
    this.refreshObjective();
    e.requestSave();
  }
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
