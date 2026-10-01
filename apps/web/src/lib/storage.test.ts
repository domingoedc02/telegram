import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getUiPref, setUiPref } from './storage';

/**
 * A minimal in-memory Storage, stubbed onto the global explicitly rather than
 * relying on the ambient `window.localStorage` — Node's own experimental
 * built-in `localStorage` global can otherwise shadow jsdom's, silently
 * no-opping without a `--localstorage-file`.
 */
function createFakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe('storage (local-only UI prefs)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createFakeStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips a value under its own prefix', () => {
    setUiPref('sidebar-collapsed', 'true');
    expect(getUiPref('sidebar-collapsed')).toBe('true');
    expect(window.localStorage.getItem('tg:ui:sidebar-collapsed')).toBe('true');
  });

  it('returns null for a missing key', () => {
    expect(getUiPref('never-set')).toBeNull();
  });

  it('degrades gracefully (returns null / no throw) when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } satisfies Storage);

    expect(getUiPref('x')).toBeNull();
    expect(() => setUiPref('x', 'y')).not.toThrow();
  });
});
