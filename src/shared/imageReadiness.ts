/** Presentation updates reach the timeline without rerendering all app controls. */
export function createImageReadiness() {
  let ready = false;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => ready,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setReady: (next: boolean) => {
      if (next === ready) return;
      ready = next;
      for (const listener of listeners) listener();
    },
  };
}
export type ImageReadiness = ReturnType<typeof createImageReadiness>;
