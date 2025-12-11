// Утилиты
const Utils = {
  randomInt: function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  shuffle: function(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  formatTime: function(seconds) {
    // Обрабатываем отрицательные значения
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const m = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const s = String(safeSeconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  },
  nowDateTime: function() {
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
  createEl: function(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  },
  clamp: function(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },
  isPrime: function(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i += 1) {
      if (n % i === 0) return false;
    }
    return true;
  }
};

