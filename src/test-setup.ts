/**
 * Подпорки под jsdom. В браузерах всё это есть; здесь нужно только для того,
 * чтобы Recharts смог смонтироваться в дымовом тесте.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
