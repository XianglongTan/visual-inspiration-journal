import React from 'react';
import { ChevronLeft, ChevronRight, Grid, Settings, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentDate: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onOpenConfig: () => void;
  onOpenInsights: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentDate, onPrevWeek, onNextWeek, onToday, onOpenConfig, onOpenInsights }) => {
  const getMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <header className="sticky top-0 z-50 bg-board/80 backdrop-blur-md px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Logo Area */}
        <div className="flex items-center gap-2 text-stone-800">
          <Grid size={20} strokeWidth={2.5} />
          <h1 className="font-sans text-xl font-bold tracking-tight">视觉灵感手账</h1>
        </div>
      </div>

      {/* Center Date Control */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
        <button onClick={onPrevWeek} className="text-stone-400 hover:text-stone-800 transition-colors">
          <ChevronLeft size={24} />
        </button>
        
        <span className="font-sans text-lg font-medium text-stone-700 w-40 text-center select-none">
          {getMonthYear(currentDate)}
        </span>

        <button onClick={onNextWeek} className="text-stone-400 hover:text-stone-800 transition-colors">
          <ChevronRight size={24} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button 
          onClick={onToday}
          className="px-4 py-1.5 bg-white border border-stone-200 text-stone-600 text-xs font-semibold rounded-full shadow-sm hover:bg-stone-50 transition-colors uppercase tracking-wider"
        >
          Today
        </button>
        <button
          onClick={onOpenInsights}
          className="p-2 text-stone-400 hover:text-amber-500 rounded-full hover:bg-amber-50 transition-colors"
          title="审美 DNA 词云"
          aria-label="审美洞察"
        >
          <Sparkles size={20} />
        </button>
        <button
          onClick={onOpenConfig}
          className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
          title="配置 API"
          aria-label="配置"
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;