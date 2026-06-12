import itemsData from '../data/items.json';

export class Inventory {
  constructor(ui) {
    this.ui = ui;
    this.items = new Set();
  }

  add(id) {
    if (!itemsData[id]) { console.warn(`[Inventory] Неизвестный предмет ${id}`); return; }
    this.items.add(id);
    this.ui.refreshInventory(this.list());
    this.ui.toast(`Получено: ${itemsData[id].name}`);
  }

  has(id) { return this.items.has(id); }
  remove(id) { this.items.delete(id); this.ui.refreshInventory(this.list()); }

  lensCount() {
    return ['lens_1', 'lens_2', 'lens_3', 'lens_4'].filter((l) => this.items.has(l)).length;
  }

  list() {
    return [...this.items].map((id) => ({ id, ...itemsData[id] }));
  }

  serialize() { return [...this.items]; }
  restore(ids) {
    this.items = new Set(ids || []);
    this.ui.refreshInventory(this.list());
  }
}
