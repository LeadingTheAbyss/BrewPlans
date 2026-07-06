import { create } from 'zustand';

interface CacheState {
  cache: Record<string, any>;
  setCache: (key: string, data: any) => void;
  getCache: (key: string) => any;
}

export const useCacheStore = create<CacheState>((set, get) => ({
  cache: {},
  setCache: (key, data) => set((state) => ({ cache: { ...state.cache, [key]: data } })),
  getCache: (key) => get().cache[key],
}));
