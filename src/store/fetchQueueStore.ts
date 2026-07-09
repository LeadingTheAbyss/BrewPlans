import { create } from 'zustand';

export type FetchTaskType = 'transport' | 'places' | 'food' | 'hotels';

export interface FetchTask {
  id: string; // Unique ID, e.g., "transport-pax1-flight"
  category: FetchTaskType; // e.g. "transport"
  subType?: string; // e.g., "flight", "train", "cab"
  paxId?: string; // For transport
  priority: number; // Lower number = higher priority. 0 = User clicked (Live Fetch). 1-10 = Background (Check Only).
  isLive: boolean; // If true, make the actual API call. If false, pass check_only=true
  status: 'idle' | 'loading' | 'completed' | 'error' | 'cache_miss';
  data?: any; // The fetched data
}

interface FetchQueueState {
  tasks: FetchTask[];
  isProcessing: boolean;
  
  // Actions
  enqueueTask: (task: Omit<FetchTask, 'status'>) => void;
  bumpPriority: (id: string) => void;
  updateTaskStatus: (id: string, status: FetchTask['status'], data?: any) => void;
  setProcessing: (status: boolean) => void;
  getNextTask: () => FetchTask | undefined;
  
  // Bulk initializer for background checking
  initBackgroundChecks: (trip: any) => void;
}

export const useFetchQueue = create<FetchQueueState>((set, get) => ({
  tasks: [],
  isProcessing: false,
  
  enqueueTask: (task) => set((state) => {
    // If task already exists, don't duplicate, unless we are bumping it to live
    const existingIndex = state.tasks.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) {
      const existing = state.tasks[existingIndex];
      // Only update if it's changing from check_only to live
      if (task.isLive && !existing.isLive) {
        const newTasks = [...state.tasks];
        newTasks[existingIndex] = { ...existing, isLive: true, priority: 0, status: 'idle' };
        return { tasks: newTasks.sort((a, b) => a.priority - b.priority) };
      }
      return state;
    }
    
    const newTasks = [...state.tasks, { ...task, status: 'idle' as const }];
    return { tasks: newTasks.sort((a, b) => a.priority - b.priority) };
  }),
  
  bumpPriority: (id) => set((state) => {
    const newTasks = state.tasks.map(t => {
      // Unconditionally set to 'idle' so BackgroundFetcher aborts any running checkOnly task
      if (t.id === id) return { ...t, priority: 0, isLive: true, status: 'idle' as const };
      return t;
    }).sort((a, b) => a.priority - b.priority);
    return { tasks: newTasks };
  }),
  
  updateTaskStatus: (id, status, data) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, status, data: data !== undefined ? data : t.data } : t)
  })),
  
  setProcessing: (isProcessing) => set({ isProcessing }),
  
  getNextTask: () => {
    const { tasks } = get();
    // Return the first idle task
    return tasks.find(t => t.status === 'idle');
  },
  
  initBackgroundChecks: (trip) => {
    const { enqueueTask, tasks } = get();
    // Don't re-init if we already have tasks
    if (tasks.length > 0) return;
    
    // Priority order for background checks: Trains(1) -> Flights(2) -> Bus(3) -> Cabs(4) -> Places(5) -> Food(6) -> Hotels(7)
    
    // 1-4: Transports for each passenger
    trip.passengers.forEach((pax: any) => {
      if (!pax.city) return;
      const dest = trip.destination || 'Unknown';
      enqueueTask({ id: `${pax.id}-${pax.city}-${dest}-train-v4`, category: 'transport', subType: 'train', paxId: pax.id, priority: 1, isLive: false });
      enqueueTask({ id: `${pax.id}-${pax.city}-${dest}-flight-v4`, category: 'transport', subType: 'flight', paxId: pax.id, priority: 2, isLive: false });
      enqueueTask({ id: `${pax.id}-${pax.city}-${dest}-bus-v4`, category: 'transport', subType: 'bus', paxId: pax.id, priority: 3, isLive: false });
      enqueueTask({ id: `${pax.id}-${pax.city}-${dest}-cab-v4`, category: 'transport', subType: 'cab', paxId: pax.id, priority: 4, isLive: false });
    });
    
    // 5-7: Destinations
    enqueueTask({ id: 'places-main', category: 'places', priority: 5, isLive: false });
    enqueueTask({ id: 'food-main', category: 'food', priority: 6, isLive: false });
    enqueueTask({ id: 'hotels-main', category: 'hotels', priority: 7, isLive: false });
  }
}));
