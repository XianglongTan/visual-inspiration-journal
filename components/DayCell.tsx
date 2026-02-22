import React, { useRef } from 'react';
import { ImageCard, DayIndex } from '../types';
import PolaroidCard from './PolaroidCard';
import { Plus } from 'lucide-react';

interface DayCellProps {
  dayName: string;
  dateNumber: number;
  dayIndex: DayIndex;
  cards: ImageCard[];
  onUpload: (file: File, dayIndex: DayIndex) => void;
  onDeleteCard: (cardId: string, dayIndex: DayIndex) => void;
  onDeleteTerm: (cardId: string, termId: string, dayIndex: DayIndex) => void;
  onEditTerm: (cardId: string, termId: string, newText: string, dayIndex: DayIndex) => void;
  onAddTerm: (cardId: string, text: string, dayIndex: DayIndex) => void;
  onFocusForPaste?: () => void;
  onBlurForPaste?: () => void;
  isWeekend?: boolean;
}

const DayCell: React.FC<DayCellProps> = ({ 
  dayName, 
  dateNumber,
  dayIndex, 
  cards, 
  onUpload,
  onDeleteCard,
  onDeleteTerm,
  onEditTerm,
  onAddTerm,
  onFocusForPaste,
  onBlurForPaste,
  isWeekend 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0], dayIndex);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUpload(file, dayIndex);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div 
      className={`relative flex flex-col h-full min-h-[350px] transition-colors p-2
        ${!isWeekend ? 'border-r border-transparent md:border-stone-200/50' : ''} 
      `}
      tabIndex={0}
      onFocus={onFocusForPaste}
      onBlur={onBlurForPaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      title="支持拖入图片或先点击此处再 Ctrl+V 粘贴"
    >
      {/* Header: Minimalist, Centered */}
      <div className="flex flex-col items-center justify-center py-6 group cursor-default relative">
        <span className="text-3xl font-light text-stone-400 leading-none group-hover:text-amber-500 transition-colors">
          {dateNumber}
        </span>
        <span className="text-[10px] font-bold tracking-[0.2em] text-stone-300 uppercase mt-1">
          {dayName}
        </span>
        
        {/* Upload Button near header (always accessible) */}
        <button 
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="absolute top-1/2 -translate-y-1/2 right-4 text-stone-300 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all p-1"
          title="Add Image"
        >
          <Plus size={20} />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 relative">
        {cards.length === 0 ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex items-start pt-10 justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer z-10"
          >
             <div className="border-2 border-dashed border-stone-200 rounded-lg p-6 text-center">
                <Plus className="mx-auto text-stone-300 mb-2" />
                <span className="text-xs text-stone-400 font-medium uppercase tracking-wide">Add Inspiration</span>
             </div>
          </div>
        ) : (
          <div className="flex flex-col px-2 pb-8">
            {/* Grid Layout: 2 Columns per row */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-10 w-full mb-6">
              {cards.map(card => (
                <div key={card.id} className="w-full">
                  <PolaroidCard 
                    card={card}
                    onDeleteCard={() => onDeleteCard(card.id, dayIndex)}
                    onDeleteTerm={(termId) => onDeleteTerm(card.id, termId, dayIndex)}
                    onEditTerm={(termId, newText) => onEditTerm(card.id, termId, newText, dayIndex)}
                    onAddTerm={(text) => onAddTerm(card.id, text, dayIndex)}
                  />
                </div>
              ))}
            </div>
            
            {/* Add More Button (Bottom full width) */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 border-2 border-dashed border-stone-200 rounded-lg flex items-center justify-center text-stone-300 hover:text-amber-500 hover:border-amber-300 hover:bg-amber-50/10 transition-all gap-2 group"
              title="Add another image"
            >
               <div className="bg-stone-100 rounded-full p-1 group-hover:bg-amber-100 transition-colors">
                 <Plus size={16} />
               </div>
               <span className="text-[10px] font-medium uppercase tracking-wider">Add</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DayCell;