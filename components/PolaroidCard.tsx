import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ImageCard } from '../types';
import { Trash2, Loader2, X, Pencil, Plus, Check, RotateCw } from 'lucide-react';

interface PolaroidCardProps {
  card: ImageCard;
  onDeleteTerm: (termId: string) => void;
  onEditTerm: (termId: string, newText: string) => void;
  onAddTerm: (text: string) => void;
  onDeleteCard: () => void;
  onRetryAnalysis?: () => void;
}

const PolaroidCard: React.FC<PolaroidCardProps> = ({ card, onDeleteTerm, onEditTerm, onAddTerm, onDeleteCard, onRetryAnalysis }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addingText, setAddingText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTermId && editInputRef.current) editInputRef.current.focus();
  }, [editingTermId]);

  useEffect(() => {
    if (isAdding && addInputRef.current) addInputRef.current.focus();
  }, [isAdding]);

  const startEdit = (termId: string, currentText: string) => {
    setEditingTermId(termId);
    setEditingText(currentText);
  };

  const commitEdit = () => {
    if (editingTermId && editingText.trim()) {
      onEditTerm(editingTermId, editingText.trim());
    }
    setEditingTermId(null);
    setEditingText('');
  };

  const commitAdd = () => {
    if (addingText.trim()) {
      onAddTerm(addingText.trim());
    }
    setIsAdding(false);
    setAddingText('');
  };

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
      onMouseLeave={() => { setIsHovered(false); setExpanded(false); setEditingTermId(null); setEditingText(''); setIsAdding(false); setAddingText(''); }}
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
      <div
        className="relative aspect-square w-full bg-stone-50 overflow-hidden rounded-sm filter brightness-[1.02] cursor-zoom-in"
        onClick={(e) => { e.stopPropagation(); if (!card.isLoading) setPreviewing(true); }}
      >
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
            {/* Collapsed State: Main Term + Count + Retry */}
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
                {onRetryAnalysis && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRetryAnalysis(); }}
                    className="ml-1 p-0.5 rounded text-stone-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                    title="重新用 AI 分析关键词"
                  >
                    <RotateCw size={10} />
                  </button>
                )}
              </>
            ) : (
              // Expanded State: All Terms + Add Button
              <>
                {card.terms.map((term) => (
                  <div
                    key={term.id}
                    className="group/tag relative inline-flex items-center px-2 py-1 rounded bg-stone-50 border border-stone-100 text-stone-700 text-[10px] font-medium select-none"
                  >
                    {editingTermId === term.id ? (
                      <input
                        ref={editInputRef}
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingTermId(null); } }}
                        onClick={e => e.stopPropagation()}
                        className="w-20 outline-none bg-transparent text-[10px] font-medium text-stone-700"
                      />
                    ) : (
                      <span
                        onClick={() => copyToClipboard(term.text)}
                        className="cursor-pointer hover:text-amber-700"
                      >
                        {term.text}
                      </span>
                    )}
                    {/* Edit button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(term.id, term.text); }}
                      className="ml-1 text-stone-300 hover:text-amber-400 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                      title="编辑"
                    >
                      <Pencil size={9} />
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteTerm(term.id); }}
                      className="ml-0.5 text-stone-300 hover:text-red-400 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                      title="删除"
                    >
                      <X size={9} />
                    </button>
                  </div>
                ))}

                {/* Add new tag */}
                {isAdding ? (
                  <div className="inline-flex items-center px-2 py-1 rounded bg-amber-50 border border-amber-200 text-[10px]">
                    <input
                      ref={addInputRef}
                      value={addingText}
                      onChange={e => setAddingText(e.target.value)}
                      onBlur={commitAdd}
                      onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setIsAdding(false); setAddingText(''); } }}
                      onClick={e => e.stopPropagation()}
                      placeholder="新关键词"
                      className="w-16 outline-none bg-transparent text-[10px] font-medium text-stone-700 placeholder:text-stone-300"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); commitAdd(); }}
                      className="ml-1 text-amber-500 hover:text-amber-600"
                    >
                      <Check size={9} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsAdding(true); }}
                    className="inline-flex items-center gap-0.5 px-2 py-1 rounded border border-dashed border-stone-200 text-stone-300 hover:text-amber-500 hover:border-amber-300 text-[10px] transition-colors"
                    title="添加关键词"
                  >
                    <Plus size={9} />
                    <span>添加</span>
                  </button>
                )}
                {onRetryAnalysis && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRetryAnalysis(); }}
                    className="inline-flex items-center gap-0.5 px-2 py-1 rounded border border-stone-200 text-stone-400 hover:text-amber-500 hover:border-amber-300 text-[10px] transition-colors"
                    title="重新用 AI 分析关键词"
                  >
                    <RotateCw size={9} />
                    <span>重试</span>
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {onRetryAnalysis && (
              <button
                onClick={(e) => { e.stopPropagation(); if (!card.isLoading) onRetryAnalysis(); }}
                disabled={card.isLoading}
                className="bg-white/80 px-2 py-1 rounded-sm shadow-sm backdrop-blur-sm inline-flex items-center gap-1 text-stone-500 hover:text-amber-600 hover:bg-amber-50/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/80 disabled:hover:text-stone-500"
                title="重新用 AI 分析关键词"
              >
                <RotateCw size={9} />
                <span className="text-[10px]">重试</span>
              </button>
            )}
            {!card.isLoading && (isAdding ? (
              <div className="inline-flex items-center px-2 py-1 rounded bg-amber-50 border border-amber-200 shadow-sm backdrop-blur-sm text-[10px]">
                <input
                  ref={addInputRef}
                  value={addingText}
                  onChange={e => setAddingText(e.target.value)}
                  onBlur={commitAdd}
                  onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setIsAdding(false); setAddingText(''); } }}
                  onClick={e => e.stopPropagation()}
                  placeholder="新关键词"
                  className="w-20 outline-none bg-transparent text-[10px] font-medium text-stone-700 placeholder:text-stone-300"
                />
                <button onClick={(e) => { e.stopPropagation(); commitAdd(); }} className="ml-1 text-amber-500">
                  <Check size={9} />
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setIsAdding(true); }}
                className="bg-white/80 px-2 py-1 rounded-sm shadow-sm backdrop-blur-sm inline-flex items-center gap-1 text-stone-400 hover:text-amber-500 transition-colors"
              >
                <Plus size={9} />
                <span className="text-[10px] italic">添加标签</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 图片预览弹窗（Portal 渲染到 body，避免 z-index 问题） */}
      {previewing && ReactDOM.createPortal(
        <ImagePreviewModal card={card} onClose={() => setPreviewing(false)} />,
        document.body
      )}
    </div>
  );
};

/** 图片全尺寸预览弹窗：图片原始尺寸居中，关键词列在右侧 */
const ImagePreviewModal: React.FC<{ card: ImageCard; onClose: () => void }> = ({ card, onClose }) => {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const date = new Date(card.createdAt);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const hasTags = card.terms.length > 0 || card.isLoading;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 bg-white/15 hover:bg-white/30 text-white rounded-full p-2 transition-all z-10"
        aria-label="关闭预览"
      >
        <X size={18} />
      </button>

      {/* 内容区：图片 + 右侧标签 */}
      <div
        className="flex items-start gap-5"
        onClick={e => e.stopPropagation()}
      >
        {/* 图片：原始尺寸，超出视口时等比缩小 */}
        <img
          src={card.url}
          alt="Inspiration preview"
          className="block rounded-lg shadow-2xl"
          style={{
            maxWidth: hasTags ? 'calc(90vw - 196px)' : '90vw',
            maxHeight: '90vh',
          }}
        />

        {/* 右侧关键词列 */}
        {hasTags && (
          <div
            className="flex flex-col gap-2 shrink-0 overflow-y-auto"
            style={{ width: 168, maxHeight: '90vh' }}
          >
            <p className="text-white/40 text-[10px] uppercase tracking-widest shrink-0">Tags</p>
            <p className="text-white/25 text-[10px] mb-1 shrink-0">{dateStr}</p>

            {card.isLoading && (
              <div className="flex items-center gap-2 text-white/40 text-xs shrink-0">
                <Loader2 size={11} className="animate-spin" /> 识别中…
              </div>
            )}

            {card.terms.map(term => (
              <button
                key={term.id}
                onClick={() => navigator.clipboard.writeText(term.text)}
                className="text-left w-full px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors border border-white/10 hover:border-white/25 shrink-0"
                title="点击复制"
              >
                {term.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PolaroidCard;