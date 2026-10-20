// Used on web. Native platforms automatically pick authStorage.native.ts instead.
const ls: any = (globalThis as any).localStorage;

export const authStorage = {
  getItem: async (key: string): Promise<string | null> => (ls ? ls.getItem(key) : null),
  setItem: async (key: string, value: string): Promise<void> => {
    if (ls) ls.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (ls) ls.removeItem(key);
  },
};