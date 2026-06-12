import * as THREE from 'three';
import { instantiate } from '../core/AssetLoader.js';

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
      // картинка предзагружена в main.js — ставим мгновенно, без зазора с игрой
      e.hud.showCutsceneImage('/assets/textures/cutscenes/intro.jpg', true);
      setTimeout(() => e.hud.hideCutsceneImage(), 7000);
      setTimeout(() => D.say('intro'), 1500);
    }
    objective();
    audio.playMusic(save.hasFlag('finale_started') ? 'theme_storm' : 'theme_calm', 0.22);

    // загрузка сейва посреди финала: вернуть шторм и интерактив линзы
    if (save.hasFlag('finale_started') && !save.hasFlag('finale_done')) {
      e.setStorm(true);
      e.hud.setObjective('Установить линзу в фонарь');
      I.add({
        id: 'lensMount', object: e.lampCore, prompt: 'Установить линзу',
        onInteract: () => this._assembleLens(),
      });
    }

    // ---------- эмбиент ----------
    audio.addPositional('waves_loop', a.positions.dock, { refDist: 8, maxDist: 90, volume: 0.7 });
    audio.addPositional('forest_loop', new THREE.Vector3(36, 6, -16), { refDist: 10, maxDist: 55, volume: 0.6 });
    audio.addPositional('fire_loop', new THREE.Vector3(35, 3, -14), { refDist: 2.5, maxDist: 18, volume: 0.7 });
    const windId = audio.loadSfx('wind_loop', { loop: true, volume: 0.25 });
    windId.play();

    // ---------- зоны ----------
    // зоны повторяемы: реплика звучит снова, только если игрок ушёл и вернулся
    // (защита от спама — кулдаун в Dialogue.say)
    I.addZone({ id: 'village', pos: new THREE.Vector3(-5, 3, 18), radius: 16, once: false, onEnter: () => D.say('village_entry', { once: false }) });
    I.addZone({ id: 'forest', pos: a.positions.forestEntry, radius: 10, once: false, onEnter: () => D.say('forest_entry', { once: false }) });
    I.addZone({ id: 'cove', pos: a.positions.coveEntry, radius: 10, once: false, onEnter: () => D.say('cove_entry', { once: false }) });
    I.addZone({
      id: 'lighthouse_base', pos: a.positions.lighthouse, radius: 14, once: false,
      onEnter: () => { if (!save.hasFlag('lighthouse_open')) D.say('lighthouse_locked', { once: false }); },
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

    // ---------- здания: входы и выходы ----------
    const wireBuilding = (id, room, label, onEnterOnce = null) => {
      I.add({
        id: `enter_${id}`, object: a.doors[id].marker, prompt: label, once: false,
        onInteract: async () => {
          e.character.playOnce('interact'); // открывает дверь
          await wait(500);
          e.hud.fade(true);
          await wait(900);
          audio.playSfx('door_open', 0.7);
          const p = room.entryPoint;
          e.player.teleport({ x: p.x, y: p.y + 0.2, z: p.z });
          e.player.facing = Math.PI; // лицом вглубь комнаты
          e.tpCamera.yaw = Math.PI;
          e.hud.fade(false);
          onEnterOnce?.();
        },
      });
      I.add({
        id: `exit_${id}`, object: room.doorInside, prompt: 'Выйти на улицу', once: false,
        onInteract: async () => {
          e.hud.fade(true);
          await wait(900);
          audio.playSfx('door_open', 0.7);
          const p = a.doors[id].outside;
          e.player.teleport({ x: p.x, y: p.y + 1.1, z: p.z });
          e.hud.fade(false);
        },
      });
    };
    wireBuilding('dedHouse', e.interiors.dedHouse, 'Войти в дом деда', () => D.say('house_ded'));
    wireBuilding('homeA', e.interiors.homeA, 'Войти в дом');
    wireBuilding('tavern', e.interiors.tavern, 'Войти в таверну');
    wireBuilding('market', e.interiors.market, 'Войти на склад');
    wireBuilding('windmill', e.interiors.windmill, 'Войти в мельницу');
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

  // Корабль вдали, медленно идущий через пролив; огонёк на мачте.
  async _spawnShip() {
    if (this.ship) return;
    const e = this.e;
    const ship = await instantiate('/assets/models/env/pirate/ship-small.glb');
    ship.scale.setScalar(2.2);
    ship.position.set(150, 0, -130);
    ship.rotation.y = -2.1;
    const lamp = new THREE.PointLight(0xffd28a, 3, 25, 1.5);
    lamp.position.set(0, 5, 0);
    ship.add(lamp);
    e.scene.add(ship);
    this.ship = ship;
    // дрейф через пролив + покачивание
    const start = ship.position.clone();
    const dir = new THREE.Vector3(-1, 0, 0.35).normalize();
    let t = 0;
    e.loop.onFrame((dt) => {
      if (!this.ship) return;
      t += dt;
      ship.position.copy(start).addScaledVector(dir, t * 2.2);
      ship.position.y = Math.sin(t * 0.8) * 0.3;
      ship.rotation.z = Math.sin(t * 0.6) * 0.04;
    });
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

  // Финал, часть 1: подъём (фейд) → галерея в шторм. Линзу устанавливает игрок.
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

    e.setStorm(true);
    await wait(900);
    e.hud.fade(false);
    e.dialogue.say('climb_mid');
    e.hud.setObjective('Установить линзу в фонарь');

    // установка линзы — отдельное действие игрока
    e.interaction.add({
      id: 'lensMount', object: e.lampCore, prompt: 'Установить линзу',
      onInteract: () => this._assembleLens(),
    });
  }

  // Финал, часть 2: сборка линзы (анимация) → свет → корабль → эпилог с титрами.
  async _assembleLens() {
    const { e } = this;
    e.hud.setObjective('');
    e.character.playOnce('interact');
    e.dialogue.say('final_assembly');
    await wait(3500);
    // лампа сперва теплится — линза встала на место
    e.lampCore.material.emissive.set(0x664d2a);
    e.lampCore.material.emissiveIntensity = 1.2;
    e.audio.playSfx('pickup', 0.8);
    await wait(2800);

    e.audio.playSfx('lamp_ignite', 1);
    e.dialogue.say('final_light');
    await wait(1800);
    e.igniteLighthouse();
    await wait(4200);

    this._spawnShip();
    e.dialogue.say('final_ship');
    await wait(7000);
    e.audio.playSfx('ship_horn', 0.9);
    await wait(3000);
    e.dialogue.say('final_marta');
    await wait(7000);
    e.dialogue.say('final_eli');
    this.e.saveSystem.setFlag('finale_done');
    this.refreshObjective();
    e.requestSave();
    await wait(9000);

    // эпилог: иллюстрация + экран «Конец»
    e.hud.fade(true);
    await wait(1500);
    e.hud.showCutsceneImage('/assets/textures/cutscenes/ending.jpg', true);
    e.hud.fade(false);
    await wait(6000);
    e.hud.showEndScreen();
  }
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
