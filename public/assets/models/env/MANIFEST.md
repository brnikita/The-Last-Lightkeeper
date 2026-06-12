# MANIFEST — ассеты окружения «Пристань и рыбацкая деревня»

Все ассеты — **CC0 (Creative Commons Zero)**, безатрибуционные, разрешено коммерческое использование.
Скачано: 2026-06-12. Суммарный размер папки env: ~2.6 МБ. HDRI: ~4.6 МБ.

## HDRI

| Файл | Описание | Источник | Лицензия |
|---|---|---|---|
| `public/assets/hdri/sky.hdr` | Qwantani Dusk 2 (Pure Sky), 2k HDR — тёплое предзакатное небо с лёгкими облаками | [Poly Haven](https://polyhaven.com/a/qwantani_dusk_2_puresky) | CC0 |

## pirate/ — Kenney Pirate Kit 2.1

Источник: https://kenney.nl/assets/pirate-kit · Лицензия: `pirate/LICENSE.txt` (CC0).
Формат: GLB с **внешней** текстурой `Textures/colormap.png` (не перемещать GLB без папки Textures!).
Масштаб: 1 unit = 1 м, модели на сетке 1–2 м. Проверено: dock-платформа 2.5×2.5 м, лодка 2.75 м, tower-complete-large — 11.2 м в высоту.

- **Пристань:** `structure-platform-dock.glb`, `structure-platform-dock-small.glb` (платформы на сваях), `platform.glb`, `platform-planks.glb` (дощатые настилы), `structure-fence.glb` (перила)
- **Лодки:** `boat-row-small.glb`, `boat-row-large.glb` (гребные рыбацкие), `ship-small.glb` (малый парусник)
- **МАЯК (замена):** `tower-complete-large.glb` (готовая башня 11 м — лучший кандидат), `tower-complete-small.glb`, либо собрать выше: `tower-base.glb`/`tower-base-door.glb` + N × `tower-middle.glb`/`tower-middle-windows.glb` + `tower-top.glb`/`tower-roof.glb`; `tower-watch.glb` — деревянная смотровая вышка
- **Пропсы:** `barrel.glb`, `crate.glb`, `crate-bottles.glb`, `chest.glb`, `flag.glb`
- **Камни/трава:** `rocks-a/b/c.glb`, `grass.glb`, `grass-patch.glb`, `grass-plant.glb` (подходят для InstancedMesh)

## survival/ — Kenney Survival Kit 2.0

Источник: https://kenney.nl/assets/survival-kit · Лицензия: `survival/LICENSE.txt` (CC0).
GLB + внешняя `Textures/colormap.png`. Масштаб: 1 unit = 1 м, но пропсы лежат на подложке-сетке — fish.glb имеет bbox 2×2, в сцене скорее всего нужен downscale ~0.5; проверить в движке.

- **Рыбацкая тема:** `fish.glb`, `fish-large.glb` (подвешенная рыба), `campfire-fishing-stand.glb` (костёр с рыбой на стойке), `campfire-pit.glb`, `campfire-stand.glb`, `bucket.glb`
- **Пропсы:** `barrel-open.glb`, `box.glb`, `box-open.glb`, `box-large.glb`, `signpost.glb`, `signpost-single.glb`, `resource-planks.glb`, `resource-wood.glb`

## town/ — Kenney Fantasy Town Kit 2.0

Источник: https://kenney.nl/assets/fantasy-town-kit · Лицензия: `town/LICENSE.txt` (CC0).
GLB + внешняя `Textures/colormap.png`. Масштаб: 1 unit = 1 м (lantern — уличный фонарь на столбе, ~2.5 м).

- `lantern.glb` — уличный фонарь (КЛЮЧЕВОЙ для настроения; в Three.js повесить PointLight в позицию плафона)
- `cart.glb` — телега, `stall.glb`, `stall-bench.glb`, `stall-stool.glb` — рыночный прилавок (рыбный рынок)
- `poles.glb`, `poles-horizontal.glb` (столбы — можно натянуть верёвки/сети), `planks.glb`, `pillar-wood.glb`
- `fence.glb`, `fence-broken.glb`, `fence-gate.glb`

## nature/ — Kenney Nature Kit 2.2

Источник: https://kenney.nl/assets/nature-kit · Лицензия: `nature/LICENSE.txt` (CC0).
GLB **без внешних текстур** (цвета в материалах) — полностью самодостаточные, идеальны для InstancedMesh.
ВНИМАНИЕ, масштаб: модели мелкие — tree_pineTallA всего 1.5 unit в высоту. Для реалистичного масштаба (сосна 6–12 м) умножать scale на ~5–8.

- **Хвойные:** `tree_pineDefaultA/B.glb`, `tree_pineGroundA/B.glb`, `tree_pineRoundA/B.glb`, `tree_pineSmallA/B.glb`, `tree_pineTallA/B/C.glb` — 11 вариантов сосен
- **Камни:** `rock_largeA/B.glb`, `rock_smallA/B.glb`, `rock_smallFlatA.glb`
- **Трава/растения:** `grass.glb`, `grass_large.glb`, `grass_leafs.glb`, `plant_bushSmall.glb`, `plant_bushLarge.glb`, `flower_redA.glb`, `flower_yellowA.glb`
- **Детали:** `stump_round.glb`, `stump_old.glb`, `log.glb`, `log_large.glb`, `log_stack.glb`, `campfire_stones.glb`

## village/ — KayKit Medieval Hexagon Pack 1.0 (постройки, red-вариант)

Источник: https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 · Лицензия: `village/LICENSE.txt` (CC0).
Формат: glTF + .bin + общая текстура `hexagons_medieval.png` (все 8 построек ссылаются на неё — держать в той же папке).
ВНИМАНИЕ, масштаб: постройки рассчитаны на гекс-тайлы — home_A всего ~0.9 unit. Для масштаба 1 м = 1 unit умножать scale на **~4–6** (дом ~4–5 м в коньке).

- **Дома:** `building_home_A_red.gltf`, `building_home_B_red.gltf` — деревенские дома
- **Крупные здания:** `building_tavern_red.gltf` (таверна), `building_market_red.gltf` (рынок), `building_blacksmith_red.gltf` (кузница), `building_windmill_red.gltf` (мельница)
- **Малые:** `building_well_red.gltf` (колодец), `building_tower_A_red.gltf` (каменная башня — запасной вариант маяка)

## Чего НЕТ (не нашлось готового CC0)

- **Маяк как отдельная модель** — ни у Kenney, ни у KayKit, ни у Quaternius (официальные источники) нет. Замена: `pirate/tower-complete-large.glb` (11 м, каменная башня с крышей) + `town/lantern.glb` сверху + яркий SpotLight с вращением = убедительный маяк. Альтернатива: стек tower-base + tower-middle-windows ×3 + tower-top.
- **Рыбацкие сети** — нет ни в одном CC0-паке. Замена: плоскость с альфа-текстурой сетки между `town/poles.glb`, либо просто бочки+ящики+рыба.
- **Quaternius-паки** — раздаются через itch.io/Patreon без прямых ссылок, скриптовое скачивание с официального источника невозможно; пропущены (Kenney/KayKit покрыли все нужды).

## Примечания для Three.js

- Kenney GLB (pirate/survival/town) ссылаются на `Textures/colormap.png` относительным путём — загружать через GLTFLoader с правильным base path (`loader.setPath('/assets/models/env/pirate/')`).
- Все паки используют одну palette-текстуру на пак → меши можно мерджить/инстансить, материалов мало.
- colormap-текстуры: задать `texture.colorSpace = SRGBColorSpace`, `magFilter = NearestFilter` не нужен (палитры градиентные).
- HDRI: `RGBELoader` → `scene.environment`; для предзакатного тона добавить DirectionalLight тёплого цвета под углом ~15°.
