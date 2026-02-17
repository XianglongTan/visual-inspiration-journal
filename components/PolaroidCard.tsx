import React, { useState } from 'react';
import { ImageCard } from '../types';
import { Trash2, Copy, Loader2 } from 'lucide-react';

interface PolaroidCardProps {
  card: ImageCard;
  onDeleteTerm: (termId: string) => void;
  onDeleteCard: () => void;
}

const PolaroidCard: React.FC<PolaroidCardProps> = ({ card, onDeleteTerm, onDeleteCard }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Simplified Pin Decoration (Centered, colorful circle)
  const renderPin = () => (
    <div 
      className="absolute -top-3 left-1/2 -translate-x-1/2 z-20"
      style={{ transform: `translateX(-50%)` }}
    >
      <div 
        className="w-4 h-4 rounded-full shadow-md border border-black/5 relative"
        style={{ backgroundColor: card.decorationColor }}
      >
        <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-white/40 rounded-full"></div>
      </div>
      {/* Shadow of the pin on the paper */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-3 h-3 bg-black/10 rounded-full blur-[2px]"></div>
    </div>
  );

  return (
    <div
      className={`relative group bg-white p-2 rounded-sm shadow-float transition-all duration-300 ease-out hover:shadow-float-hover hover:z-20`}
      style={{
        transform: `rotate(${isHovered ? 0 : card.rotation}deg) scale(${isHovered ? 1.02 : 1})`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setExpanded(false); }}
    >
      {renderPin()}

      {/* Delete Card Button (Hidden by default) */}
      <button 
        onClick={(e) => { e.stopPropagation(); onDeleteCard(); }}
        className="absolute -top-2 -right-2 bg-white text-stone-400 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all z-30 shadow-md hover:text-red-500 hover:scale-110"
      >
        <Trash2 size={12} />
      </button>

      {/* Image Area - Clean, almost full bleed */}
      <div className="relative aspect-square w-full bg-stone-50 overflow-hidden rounded-sm filter brightness-[1.02]">
        <img src={card.url} alt="Inspiration" className="w-full h-full object-cover" />
        
        {/* Loading Overlay */}
        {card.isLoading && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-10">
             <div className="flex flex-col items-center text-stone-600">
                <Loader2 className="animate-spin mb-2" size={20} />
             </div>
          </div>
        )}
      </div>

      {/* Floating Tag Area */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] z-20 flex justify-center">
        {card.terms.length > 0 ? (
          <div 
            className={`transition-all duration-200 bg-white/95 backdrop-blur-sm rounded-md shadow-tag border border-white/50
              ${expanded ? 'absolute bottom-0 w-[120%] p-2 flex flex-wrap gap-1 justify-center' : 'px-3 py-1.5 flex items-center gap-1.5 cursor-pointer hover:bg-white'}
            `}
            onMouseEnter={() => setExpanded(true)}
          >
            {/* Collapsed State: Main Term + Count */}
            {!expanded ? (
              <>
                <span className="font-sans text-xs font-medium text-stone-700 truncate max-w-[100px]">
                  {card.terms[0].text}
                </span>
                {card.terms.length > 1 && (
                  <span className="text-[10px] text-stone-400 font-semibold">
                    +{card.terms.length - 1}
                  </span>
                )}
              </>
            ) : (
              // Expanded State: All Terms
              card.terms.map((term) => (
                <div 
                  key={term.id}
                  onClick={() => copyToClipboard(term.text)}
                  className="group/tag relative inline-flex items-center px-2 py-1 rounded bg-stone-50 border border-stone-100 text-stone-700 text-[10px] font-medium cursor-pointer hover:bg-amber-50 hover:text-amber-700 select-none"
                >
                  {term.text}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteTerm(term.id); }}
                    className="ml-1 text-stone-300 hover:text-red-400 opacity-0 group-hover/tag:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          !card.isLoading && (
            <div className="bg-white/80 px-2 py-1 rounded-sm shadow-sm backdrop-blur-sm">
                <span className="text-[10px] text-stone-400 italic">No tags</span>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default PolaroidCard;