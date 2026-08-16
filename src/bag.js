// N-bag randomizer. Each refill shuffles a full copy of the piece type list.
window.Bag = class Bag {
  constructor(types) {
    this.types = (types && types.length > 0) ? types.slice() : PIECE_TYPES.slice();
    this.queue = [];
    this._refill();
    this._refill();
  }
  _refill() {
    const next = this.types.slice();
    for (let i = next.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [next[i], next[j]] = [next[j], next[i]];
    }
    this.queue.push(...next);
  }
  next() {
    if (this.queue.length <= this.types.length) this._refill();
    return this.queue.shift();
  }
  peek(n) {
    while (this.queue.length < n) this._refill();
    return this.queue.slice(0, n);
  }
};
