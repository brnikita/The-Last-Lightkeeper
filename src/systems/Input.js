// Клавиатура + мышь (pointer lock). Хранит текущее состояние, не решает геймплей.
export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pointerLocked = false;
    this.interactPressed = false; // E, сбрасывается после чтения

    this.jumpPressed = false;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.interactPressed = true;
      if (e.code === 'Space') { this.jumpPressed = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    this.dom.addEventListener('click', () => {
      if (!this.pointerLocked) this.dom.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  get forward() { return this.keys.has('KeyW') || this.keys.has('ArrowUp'); }
  get back()    { return this.keys.has('KeyS') || this.keys.has('ArrowDown'); }
  get left()    { return this.keys.has('KeyA') || this.keys.has('ArrowLeft'); }
  get right()   { return this.keys.has('KeyD') || this.keys.has('ArrowRight'); }
  get run()     { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }

  consumeMouse() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  consumeInteract() {
    const v = this.interactPressed;
    this.interactPressed = false;
    return v;
  }

  consumeJump() {
    const v = this.jumpPressed;
    this.jumpPressed = false;
    return v;
  }
}
