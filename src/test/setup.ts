import '@testing-library/jest-dom/vitest';

if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
}
