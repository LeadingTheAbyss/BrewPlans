import { StateStorage } from 'zustand/middleware';

export const dbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    try {
      const res = await fetch(`/api/state?name=${name}`);
      if (res.ok) {
        const data = await res.json();
        return data.value;
      }
      return null;
    } catch (error) {
      console.error(`Error loading state for ${name} from DB:`, error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      await fetch(`/api/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, value }),
      });
    } catch (error) {
      console.error(`Error saving state for ${name} to DB:`, error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      await fetch(`/api/state?name=${name}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error deleting state for ${name} from DB:`, error);
    }
  },
};
