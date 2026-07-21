'use client';
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLedgerStore, Expense, Settlement, LineItem } from '@/store/ledgerStore';
import { useTripStore } from '@/store/tripStore';
import { useItineraryStore } from '@/store/itineraryStore';
import {
  Receipt, Wallet, Plus, CheckCircle2, ChevronRight, Users,
  Utensils, Hotel, Car, Activity, MoreHorizontal, X, ArrowRight,
  Camera, UploadCloud, TrendingUp, TrendingDown, Check, ChevronDown
} from 'lucide-react';

const CATEGORY_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  Food: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/20' },
  Hotel: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  Transport: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20' },
  Activity: { bg: 'bg-pink-500/10', text: 'text-pink-500', border: 'border-pink-500/20' },
  Other: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' }
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Food: <Utensils className="w-4 h-4" />,
  Hotel: <Hotel className="w-4 h-4" />,
  Transport: <Car className="w-4 h-4" />,
  Activity: <Activity className="w-4 h-4" />,
  Other: <MoreHorizontal className="w-4 h-4" />
};

const CATEGORY_IMAGES: Record<string, string> = {
  Food: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=600&auto=format&fit=crop',
  Hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=600&auto=format&fit=crop',
  Transport: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=600&auto=format&fit=crop',
  Activity: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=600&auto=format&fit=crop',
  Other: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=600&auto=format&fit=crop'
};

const AVATAR_COLORS = [
  { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  { bg: 'bg-pink-500/10', text: 'text-pink-500' },
  { bg: 'bg-yellow-500/10', text: 'text-yellow-500' }
];

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const time = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${month} ${day} • ${time}`;
};

export default function LedgerView() {
  const { expenses, markAsPaid, addExpense, deleteExpense } = useLedgerStore();
  const calculateSettlements = useLedgerStore(state => state.calculateSettlements);
  const { passengers, selectedHotel } = useTripStore();
  const { selectedPlaces } = useItineraryStore();
  
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  
  // For the Add Expense form (Fixed defaults)
  const [newExpense, setNewExpense] = useState({
    title: '',
    category: 'Food' as any,
    totalAmount: '',
    paidBy: [] as string[],
    splitAmong: [] as string[], // Empty by default
    receiptImageUrl: ''
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewExpense(prev => ({ ...prev, receiptImageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const passengerMap = useMemo(() => {
    const map: Record<string, string> = {};
    passengers.forEach(p => map[p.id] = p.name);
    return map;
  }, [passengers]);

  const getPassengerColor = (id: string) => AVATAR_COLORS[Math.max(0, passengers.findIndex(p => p.id === id)) % AVATAR_COLORS.length];

  const suggestedTitles = useMemo(() => {
    const titles = new Set<string>();
    if (selectedHotel) titles.add(`Hotel: ${selectedHotel.name}`);
    selectedPlaces.forEach(p => titles.add(`Place: ${p.name}`));
    // remove ones that already have an expense with that title
    const existingTitles = new Set(expenses.map(e => e.title));
    // also remove standard transformations like "Stay at X" or "Tickets for X"
    const existingValues = Array.from(existingTitles);
    return Array.from(titles).filter(t => {
      const cleanHotel = t.replace('Hotel: ', 'Stay at ');
      const cleanPlace = t.replace('Place: ', 'Tickets for ');
      return !existingTitles.has(t) && !existingValues.some(val => val.includes(cleanHotel) || val.includes(cleanPlace));
    });
  }, [selectedHotel, selectedPlaces, expenses]);

  const settlements = useMemo(() => {
    return calculateSettlements(passengers.map(p => p.id));
  }, [expenses, passengers, calculateSettlements]);

  // Calculate net balances for the Spend Breakdown
  const balances = useMemo(() => {
    const bals: Record<string, number> = {};
    passengers.forEach(p => bals[p.id] = 0);
    
    expenses.forEach(exp => {
      const payers = Array.isArray(exp.paidBy) ? exp.paidBy : [exp.paidBy];
      if (payers.length > 0) {
        const payerShare = exp.totalAmount / payers.length;
        payers.forEach(payerId => {
          if (bals[payerId] !== undefined) bals[payerId] += payerShare;
          else bals[payerId] = payerShare;
        });
      }
      
      exp.lineItems.forEach(item => {
        const splitCount = item.assignedTo.length;
        if (splitCount === 0) return;
        const splitAmount = item.amount / splitCount;
        item.assignedTo.forEach(consumerId => {
          if (bals[consumerId] !== undefined) bals[consumerId] -= splitAmount;
          else bals[consumerId] = -splitAmount;
        });
      });
    });
    return bals;
  }, [expenses, passengers]);

  const totalSpent = useMemo(() => {
    return expenses.filter(e => e.title !== 'Settlement Payment').reduce((sum, e) => sum + e.totalAmount, 0);
  }, [expenses]);

  const totalPending = useMemo(() => {
    return settlements.reduce((sum, s) => sum + s.amount, 0);
  }, [settlements]);

  const settledRatio = `${expenses.filter(e => e.title === 'Settlement Payment').length}/${settlements.length + expenses.filter(e => e.title === 'Settlement Payment').length}`;

  const isValidForm = newExpense.title && parseFloat(newExpense.totalAmount) > 0 && newExpense.paidBy.length > 0 && newExpense.splitAmong.length > 0;

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidForm) return;
    
    const amount = parseFloat(newExpense.totalAmount);

    const expense: Expense = {
      id: `exp_${Date.now()}`,
      title: newExpense.title,
      category: newExpense.category,
      totalAmount: amount,
      paidBy: newExpense.paidBy,
      date: new Date().toISOString(),
      receiptImageUrl: newExpense.receiptImageUrl,
      lineItems: [
        {
          id: `item_${Date.now()}`,
          description: 'Total Bill',
          amount: amount,
          assignedTo: newExpense.splitAmong
        }
      ]
    };
    
    addExpense(expense);
    setIsAddingExpense(false);
    setNewExpense({
      title: '',
      category: 'Food',
      totalAmount: '',
      paidBy: [],
      splitAmong: [],
      receiptImageUrl: ''
    });
  };

  const toggleSplitPerson = (id: string) => {
    setNewExpense(prev => ({
      ...prev,
      splitAmong: prev.splitAmong.includes(id) 
        ? prev.splitAmong.filter(p => p !== id)
        : [...prev.splitAmong, id]
    }));
  };

  const togglePaidByPerson = (id: string) => {
    setNewExpense(prev => ({
      ...prev,
      paidBy: prev.paidBy.includes(id) 
        ? prev.paidBy.filter(p => p !== id)
        : [...prev.paidBy, id]
    }));
  };

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  const realExpenses = expenses.filter(e => e.title !== 'Settlement Payment');

  return (
    <div className="w-full h-full flex gap-8 py-6 px-4 md:px-8 overflow-hidden relative bg-[#050505] font-sans">
      
      {/* Left Sidebar (30%) */}
      <div className="hidden lg:flex w-80 flex-col gap-8 h-full overflow-y-auto pr-2 pb-20 custom-scrollbar">
        <div>
          <h1 className="text-xs font-bold tracking-widest text-emerald-500 mb-1 flex items-center gap-2">
            <Wallet size={14} /> EXPENSE LEDGER
          </h1>
          <h2 className="text-3xl font-bold text-white tracking-tight">Trip Finances</h2>
        </div>

        {/* SETTLEMENTS */}
        <div className="flex flex-col gap-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-widest text-blue-500 uppercase flex items-center gap-2">
              <Users size={14} /> Settlements
            </h3>
            {settlements.length > 0 && (
              <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full">
                {settlements.length} pending
              </span>
            )}
          </div>
          
          {settlements.length === 0 ? (
            <div className="text-sm text-zinc-500 italic">All debts settled!</div>
          ) : (
            <div className="flex flex-col gap-3">
              {settlements.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl border border-white/10 bg-[#0a0a0a] hover:border-emerald-500/30 transition-colors group">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const color = getPassengerColor(s.from);
                      return (
                        <div className={`w-10 h-10 rounded-full ${color.bg} ${color.text} flex items-center justify-center text-xs font-bold border border-[#0a0a0a]`}>
                          {getInitials(passengerMap[s.from] || '')}
                        </div>
                      );
                    })()}
                    <div className="flex flex-col">
                      <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <span className="text-zinc-400">{passengerMap[s.from]}</span>
                        <ArrowRight size={12} className="text-zinc-600" />
                        <span>{passengerMap[s.to]}</span>
                      </div>
                      <div className="text-xs font-medium text-zinc-500 flex items-center gap-1">
                        owes <span className="text-white font-bold">₹{s.amount.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => markAsPaid(s.from, s.to, s.amount)}
                    className="px-3 py-1.5 rounded-full border border-emerald-500/30 text-emerald-500 text-xs font-bold hover:bg-emerald-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    Mark Paid
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SPEND BREAKDOWN */}
        <div className="flex flex-col gap-4 mt-4">
          <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Spend Breakdown</h3>
          <div className="flex flex-col gap-3">
            {passengers.map(p => {
              const bal = balances[p.id] || 0;
              const isPositive = bal >= 0;
              return (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const color = getPassengerColor(p.id);
                      return (
                        <div className={`w-6 h-6 rounded-full ${color.bg} ${color.text} flex items-center justify-center text-[10px] font-bold`}>
                          {getInitials(p.name)}
                        </div>
                      );
                    })()}
                    <span className="text-sm text-zinc-300 font-medium">{p.name}</span>
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {isPositive ? '+' : '-'}₹{Math.abs(bal).toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Feed (70%) */}
      <div className="flex-1 flex flex-col h-full relative z-10">
        
        {/* Top Header Stats */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col px-4 py-2 rounded-xl border border-white/10 bg-[#0a0a0a]">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1">
                <TrendingUp size={12}/> Total Spent
              </span>
              <span className="text-xl font-bold text-white">₹{totalSpent.toFixed(0)}</span>
            </div>
            <div className="flex flex-col px-4 py-2 rounded-xl border border-white/10 bg-[#0a0a0a]">
              <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-1">
                <Users size={12}/> Pending
              </span>
              <span className="text-xl font-bold text-white">₹{totalPending.toFixed(0)}</span>
            </div>
            <div className="flex flex-col px-4 py-2 rounded-xl border border-white/10 bg-[#0a0a0a]">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                <CheckCircle2 size={12}/> Settled
              </span>
              <span className="text-xl font-bold text-emerald-500">{settledRatio}</span>
            </div>
          </div>
          <button 
            onClick={() => setIsAddingExpense(true)}
            className="flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-black px-6 py-3 rounded-xl text-sm font-bold transition-colors shadow-[0_0_20px_rgba(52,211,153,0.3)]"
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-zinc-500 tracking-widest uppercase">
            {realExpenses.length} Expenses • ₹{totalSpent.toFixed(0)} Total
          </span>
        </div>

        {/* Expense Feed */}
        <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar flex flex-col gap-4 pr-2">
          {realExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed border-white/10 rounded-3xl mt-4">
              <Receipt className="w-12 h-12 text-white/20 mb-4" />
              <h3 className="text-white font-medium">No expenses yet</h3>
              <p className="text-zinc-500 text-sm mt-1 max-w-sm">Log your first hotel, cab, or dinner bill to start tracking.</p>
            </div>
          ) : (
            realExpenses.map(exp => {
              const colors = CATEGORY_COLORS[exp.category];
              const splitCount = exp.lineItems[0]?.assignedTo.length || 0;
              const perPerson = splitCount > 0 ? exp.totalAmount / splitCount : 0;
              
              return (
                <div 
                  key={exp.id}
                  onClick={() => setSelectedExpense(exp)}
                  className={`bg-[#0a0a0a] rounded-2xl p-5 flex flex-col sm:flex-row justify-between cursor-pointer hover:bg-[#111] transition-colors group relative overflow-hidden border border-white/5 hover:${colors.border}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center shrink-0`}>
                      {CATEGORY_ICONS[exp.category]}
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-xl font-bold text-white mb-2">{exp.title}</h3>
                      <div className="text-sm text-zinc-500 flex items-center gap-1.5 mb-5">
                        {(() => {
                          const payers = Array.isArray(exp.paidBy) ? exp.paidBy : [exp.paidBy];
                          const primaryPayer = payers[0];
                          const extra = payers.length - 1;
                          return (
                            <>
                              <span className={`font-semibold ${getPassengerColor(primaryPayer).text}`}>
                                {passengerMap[primaryPayer]} {extra > 0 && `& ${extra} other${extra > 1 ? 's' : ''}`}
                              </span>
                              <span>paid • {formatDate(exp.date)}</span>
                            </>
                          );
                        })()}
                      </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {exp.lineItems[0]?.assignedTo.slice(0, 4).map((id, idx) => {
                          const color = getPassengerColor(id);
                          return (
                            <div key={id} className={`w-8 h-8 rounded-full ${color.bg} border-2 border-[#0a0a0a] flex items-center justify-center text-[10px] font-bold ${color.text} z-10`} style={{ zIndex: 10 - idx }}>
                              {getInitials(passengerMap[id] || '')}
                            </div>
                          );
                        })}
                        {splitCount > 4 && (
                          <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-[#0a0a0a] flex items-center justify-center text-[10px] font-bold text-zinc-400 z-0">
                            +{splitCount - 4}
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-zinc-500 font-medium">{splitCount} people</span>
                    </div>
                  </div>
                </div>
                  
                  <div className="flex flex-col items-end mt-4 sm:mt-0">
                    <div className="text-2xl font-bold text-white mb-1 tracking-tight">
                      ₹{exp.totalAmount.toFixed(0)}
                    </div>
                    <div className="text-sm text-zinc-500 font-medium mb-auto">
                      ₹{perPerson.toFixed(0)} /person
                    </div>
                    <div className={`px-4 py-2 rounded-full ${colors.bg} ${colors.text} text-sm font-bold flex items-center gap-2 mt-4`}>
                      {CATEGORY_ICONS[exp.category]}
                      {exp.category}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isAddingExpense && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsAddingExpense(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <button 
                onClick={() => setIsAddingExpense(false)}
                className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              
              <h2 className="text-xl font-bold text-white mb-6">Add Expense</h2>
              
              <form onSubmit={handleAddExpense} className="flex flex-col gap-4">
                <div className="relative">
                  <label className="block text-xs font-bold text-zinc-500 tracking-widest uppercase mb-1.5">Title</label>
                  <input 
                    type="text" 
                    value={newExpense.title}
                    onChange={e => setNewExpense({...newExpense, title: e.target.value})}
                    onFocus={() => setShowTitleSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 200)}
                    placeholder="e.g. Dinner at Punjab Grill"
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-700"
                  />
                  {showTitleSuggestions && suggestedTitles.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-[#151515] border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                      {suggestedTitles.map(t => (
                        <button
                          key={t}
                          type="button"
                          className="w-full text-left px-4 py-3 text-sm text-white hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors border-b border-white/5 last:border-0"
                          onClick={() => {
                            let category = newExpense.category;
                            let cleanTitle = t;
                            if (t.startsWith('Hotel: ')) {
                              category = 'Hotel';
                              cleanTitle = t.replace('Hotel: ', 'Stay at ');
                            } else if (t.startsWith('Place: ')) {
                              category = 'Activity';
                              cleanTitle = t.replace('Place: ', 'Tickets for ');
                            }
                            setNewExpense({...newExpense, title: cleanTitle, category});
                            setShowTitleSuggestions(false);
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-zinc-500 tracking-widest uppercase mb-1.5">Amount (₹)</label>
                    <input 
                      type="number" 
                      value={newExpense.totalAmount}
                      onChange={e => setNewExpense({...newExpense, totalAmount: e.target.value})}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors font-bold text-lg placeholder:text-zinc-700"
                    />
                  </div>
                  <div className="w-1/2 relative">
                    <label className="block text-xs font-bold text-zinc-500 tracking-widest uppercase mb-1.5">Category</label>
                    <select 
                      value={newExpense.category}
                      onChange={e => setNewExpense({...newExpense, category: e.target.value as any})}
                      className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                    >
                      <option value="Food">Food</option>
                      <option value="Hotel">Hotel</option>
                      <option value="Transport">Transport</option>
                      <option value="Activity">Activity</option>
                      <option value="Other">Other</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-[38px] text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 tracking-widest uppercase mb-2">Paid By</label>
                  <div className="flex flex-wrap gap-2">
                    {passengers.map(p => {
                      const isSelected = newExpense.paidBy.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePaidByPerson(p.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            isSelected 
                              ? 'bg-emerald-500 text-black' 
                              : 'bg-[#111] text-zinc-400 border border-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] ${isSelected ? 'bg-black/20 text-black' : 'bg-white/10'}`}>
                            {getInitials(p.name)}
                          </div>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 tracking-widest uppercase mb-2">Split Equally Among</label>
                  <div className="flex flex-wrap gap-2">
                    {passengers.map(p => {
                      const isSelected = newExpense.splitAmong.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleSplitPerson(p.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            isSelected 
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                              : 'bg-[#111] text-zinc-500 border border-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${isSelected ? 'bg-blue-500 text-black' : 'bg-white/10'}`}>
                            {isSelected && <Check size={10} />}
                          </div>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 tracking-widest uppercase mb-2">Receipt Image</label>
                  <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-xl hover:bg-white/5 transition-colors cursor-pointer relative overflow-hidden bg-[#111]">
                    {newExpense.receiptImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={newExpense.receiptImageUrl} alt="Receipt" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 text-zinc-500">
                        <UploadCloud size={20} />
                        <span className="text-xs font-bold mt-1">Upload Picture</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>

                <button 
                  type="submit"
                  disabled={!isValidForm}
                  className="w-full bg-emerald-400 text-black font-bold rounded-xl py-3.5 mt-4 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-300 transition-colors shadow-lg"
                >
                  Save Expense
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deep Dive Side Panel */}
      <AnimatePresence>
        {selectedExpense && (
          <div className="fixed inset-0 z-[90] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setSelectedExpense(null)}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-[420px] bg-[#0a0a0a] border-l border-white/10 h-full flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Header Image */}
              <div 
                className="w-full h-48 bg-[#111] bg-cover bg-center relative shrink-0"
                style={{ backgroundImage: `url('${selectedExpense.receiptImageUrl || CATEGORY_IMAGES[selectedExpense.category] || CATEGORY_IMAGES.Other}')` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/50 to-black/20" />
                <button 
                  onClick={() => setSelectedExpense(null)}
                  className="absolute top-6 right-6 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
                
                <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-2">
                  <div className={`w-fit px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${CATEGORY_COLORS[selectedExpense.category].bg} ${CATEGORY_COLORS[selectedExpense.category].text}`}>
                    {CATEGORY_ICONS[selectedExpense.category]}
                    {selectedExpense.category}
                  </div>
                  <h2 className="text-2xl font-bold text-white leading-tight">{selectedExpense.title}</h2>
                  <p className="text-xs text-zinc-400 font-medium">
                    {new Date(selectedExpense.date).toLocaleDateString()} • {new Date(selectedExpense.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
                
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#111] border border-white/5 rounded-2xl p-4 flex flex-col">
                    <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-1">Total</span>
                    <span className="text-2xl font-bold text-white">₹{selectedExpense.totalAmount.toFixed(0)}</span>
                  </div>
                  <div className="bg-[#111] border border-white/5 rounded-2xl p-4 flex flex-col">
                    <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-1">Per Person</span>
                    <span className="text-2xl font-bold text-emerald-400">₹{(selectedExpense.totalAmount / Math.max(1, selectedExpense.lineItems[0]?.assignedTo.length)).toFixed(0)}</span>
                  </div>
                </div>

                {/* Paid By */}
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Paid By</span>
                  <div className="flex flex-col gap-2">
                    {(() => {
                      const payers = Array.isArray(selectedExpense.paidBy) ? selectedExpense.paidBy : [selectedExpense.paidBy];
                      const amountEach = selectedExpense.totalAmount / payers.length;
                      return payers.map(payerId => {
                        const color = getPassengerColor(payerId);
                        return (
                          <div key={payerId} className="flex items-center justify-between p-3 rounded-xl bg-[#111] border border-white/5">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full ${color.bg} ${color.text} flex items-center justify-center text-[9px] font-bold`}>
                                {getInitials(passengerMap[payerId] || '')}
                              </div>
                              <span className="text-sm font-bold text-white">{passengerMap[payerId]}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-bold text-white">₹{amountEach.toFixed(0)}</span>
                              {payers.length > 1 && <span className="text-[10px] text-zinc-500">their share</span>}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Line Items */}
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Line Items</span>
                  <div className="flex flex-col gap-4 bg-[#111] border border-white/5 rounded-2xl p-4">
                    {/* Mock line items for visual fidelity */}
                    <div className="flex flex-col gap-1 pb-4 border-b border-white/5">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-bold text-white">Shared Bill</span>
                        <span className="text-sm font-bold text-white">₹{selectedExpense.totalAmount.toFixed(0)}</span>
                      </div>
                      <div className="flex -space-x-1.5 mt-1">
                        {selectedExpense.lineItems[0]?.assignedTo.map(id => (
                          <div key={id} className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold border border-[#111] z-10 text-emerald-400 bg-emerald-500/20`}>
                            {getInitials(passengerMap[id] || '')}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-sm font-bold text-zinc-400">Total</span>
                      <span className="text-sm font-bold text-white">₹{selectedExpense.totalAmount.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                {/* Split Among */}
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Split Among</span>
                  <div className="flex flex-col gap-2">
                    {selectedExpense.lineItems[0]?.assignedTo.map(id => {
                      const share = selectedExpense.totalAmount / selectedExpense.lineItems[0].assignedTo.length;
                      const isPayer = id === selectedExpense.paidBy;
                      // Display logic: Consumers owe money (-), Payer is owed money (+)
                      // If the payer is also a consumer, their net for this bill is total - share
                      const netForBill = isPayer ? (selectedExpense.totalAmount - share) : -share;
                      const isPositive = netForBill > 0;
                      
                      return (
                        <div key={id} className="flex items-center justify-between p-3 rounded-xl bg-[#111] border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center text-[9px] font-bold">
                              {getInitials(passengerMap[id] || '')}
                            </div>
                            <span className="text-sm font-bold text-white">{passengerMap[id]}</span>
                          </div>
                          <div className={`flex items-center gap-1 text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {isPositive ? '+' : '-'}₹{Math.abs(netForBill).toFixed(0)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              <div className="p-6 border-t border-white/5 bg-[#0a0a0a]">
                <button 
                  onClick={() => {
                    deleteExpense(selectedExpense.id);
                    setSelectedExpense(null);
                  }}
                  className="w-full py-3.5 rounded-xl border border-red-500/20 text-red-500 text-sm font-bold hover:bg-red-500/10 transition-colors"
                >
                  Delete Expense
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
