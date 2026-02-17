import React, { useRef, useState, useEffect } from 'react';

interface NotesAreaProps {
  content: string;
  onChange: (text: string) => void;
  height: number;
  onHeightChange: (h: number) => void;
}

const NotesArea: React.FC<NotesAreaProps> = ({ content, onChange, height, onHeightChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const newHeight = e.clientY - containerRef.current.getBoundingClientRect().top;
      // Min height 100, max height 600
      if (newHeight > 100 && newHeight < 600) {
        onHeightChange(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onHeightChange]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full border-t border-stone-300 bg-white"
      style={{ height: `${height}px` }}
    >
      {/* Drag Handle */}
      <div 
        className="absolute top-0 left-0 right-0 h-2 bg-transparent hover:bg-amber-400/20 cursor-ns-resize z-10 flex justify-center items-start group"
        onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
      >
        <div className="w-16 h-1 bg-stone-300 rounded-full mt-0.5 group-hover:bg-amber-400 transition-colors"></div>
      </div>

      {/* Content */}
      <div className="h-full flex flex-col p-4 bg-[url('https://www.transparenttextures.com/patterns/lined-paper.png')] bg-paper">
        <label className="text-xs font-mono uppercase text-amber-600/70 mb-2 font-bold tracking-widest">Weekly Field Notes & Observations</label>
        <textarea
          className="w-full h-full bg-transparent resize-none outline-none font-hand text-xl leading-8 text-ink placeholder-stone-300 notes-scroll"
          placeholder="Jot down loose ideas, sketch references, or meeting notes here..."
          value={content}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
};

export default NotesArea;