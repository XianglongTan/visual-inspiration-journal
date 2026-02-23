import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import DayCell from './components/DayCell';
import NotesArea from './components/NotesArea';
import ConfigModal from './components/ConfigModal';
import ScreenshotOverlay from './components/ScreenshotOverlay';
import FloatingCaptureButton from './components/FloatingCaptureButton';
import TermsInsightModal from './components/TermsInsightModal';
import { generateDesignTerms } from './services/cerebrasService';
import { WeekData, DayIndex, ImageCard } from './types';
import { v4 as uuidv4 } from 'uuid';
import { get, set } from 'idb-keyval';
import { Loader2 } from 'lucide-react';

const STORAGE_KEY = 'designlog_v1_data';

// Helper to get week ID
const getWeekId = (date: Date) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  start.setDate(diff);
  return `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`;
};

// Helper to get actual date number for a specific day index (0=Mon, 6=Sun)
const getDateForDayIndex = (currentWeekDate: Date, dayIndex: number) => {
  const start = new Date(currentWeekDate);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  
  const targetDate = new Date(start);
  targetDate.setDate(diff + dayIndex);
  return targetDate.getDate();
};

// 今天在周视图中的列索引：Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
const getTodayDayIndex = (): DayIndex => {
  const d = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return (d === 0 ? 6 : d - 1) as DayIndex;
};

const INITIAL_WEEK_STATE: WeekData = {
  id: '',
  days: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
  notes: '',
  notesHeight: 180,
};

// More vibrant, simple pin colors
const DECORATION_COLORS = [
  '#f43f5e', // Rose
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899'  // Pink
];

function App() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [data, setData] = useState<{ [weekId: string]: WeekData }>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [insightsModalOpen, setInsightsModalOpen] = useState(false);
  const [pasteTargetDay, setPasteTargetDay] = useState<DayIndex | null>(null);
  const [screenshotMode, setScreenshotMode] = useState(false);

  // Load data from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const stored = await get(STORAGE_KEY);
        if (stored) {
          setData(stored);
        } else {
          // Fallback migration: Try localStorage if IDB is empty
          const local = localStorage.getItem(STORAGE_KEY);
          if (local) {
            try {
               const parsed = JSON.parse(local);
               setData(parsed);
               // Migrate to IDB immediately
               await set(STORAGE_KEY, parsed);
            } catch(e) {
               console.warn("Failed to migrate localStorage", e);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, []);

  // Save data to IndexedDB whenever it changes
  useEffect(() => {
    if (isDataLoaded && Object.keys(data).length > 0) {
      set(STORAGE_KEY, data).catch(err => console.error("Save failed", err));
    }
  }, [data, isDataLoaded]);

  const currentWeekId = getWeekId(currentDate);
  const rawWeekData = data[currentWeekId] || { ...INITIAL_WEEK_STATE, id: currentWeekId };
  // Merge with initial state so all 7 day keys always exist (handles data stored before Sunday was added)
  const currentWeekData = {
    ...rawWeekData,
    days: { ...INITIAL_WEEK_STATE.days, ...rawWeekData.days }
  };

  const updateWeekData = useCallback((newData: Partial<WeekData>) => {
    setData(prev => ({
      ...prev,
      [currentWeekId]: {
        ...prev[currentWeekId] || { ...INITIAL_WEEK_STATE, id: currentWeekId },
        ...newData
      }
    }));
  }, [currentWeekId]);

  const changeWeek = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (offset * 7));
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleUpload = async (file: File, dayIndex: DayIndex) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      
      const newCard: ImageCard = {
        id: uuidv4(),
        url: result,
        terms: [],
        createdAt: Date.now(),
        rotation: Math.random() * 4 - 2, // Subtler rotation
        decorationType: 'pin', // Enforce Pins
        decorationColor: DECORATION_COLORS[Math.floor(Math.random() * DECORATION_COLORS.length)],
        isLoading: true
      };

      // Optimistic update for UI
      const currentDays = { ...currentWeekData.days };
      currentDays[dayIndex] = [...currentDays[dayIndex], newCard];
      
      // Update state immediately to show loading card
      setData(prev => ({
        ...prev,
        [currentWeekId]: {
          ...prev[currentWeekId] || { ...INITIAL_WEEK_STATE, id: currentWeekId },
          days: currentDays
        }
      }));

      // Call API
      const terms = await generateDesignTerms(result);
      
      // Update state with results
      setData(prevData => {
         const week = prevData[currentWeekId] || { ...INITIAL_WEEK_STATE, id: currentWeekId };
         const days = { ...INITIAL_WEEK_STATE.days, ...week.days };
         const updatedCards = (days[dayIndex] || []).map(c => 
            c.id === newCard.id 
              ? { ...c, isLoading: false, terms: terms.map(t => ({ id: uuidv4(), text: t })) }
              : c
         );
         days[dayIndex] = updatedCards;
         return { ...prevData, [currentWeekId]: { ...week, days } };
      });
    };
    reader.readAsDataURL(file);
  };

  // 全局粘贴：聚焦某天时粘贴到该天，否则粘贴到今天（输入框内不拦截）
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // 用户正在输入框/文本区域/可编辑元素中，不拦截
      const active = document.activeElement;
      const isTyping =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active as HTMLElement | null)?.isContentEditable;
      if (isTyping) return;

      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          // 优先放到聚焦列，否则放到今天
          const targetDay = pasteTargetDay ?? getTodayDayIndex();
          if (file) handleUpload(file, targetDay);
          return;
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [pasteTargetDay, handleUpload]);

  const deleteCard = (cardId: string, dayIndex: DayIndex) => {
    const newCards = currentWeekData.days[dayIndex].filter(c => c.id !== cardId);
    updateWeekData({ 
      days: { ...currentWeekData.days, [dayIndex]: newCards } 
    });
  };

  const deleteTerm = (cardId: string, termId: string, dayIndex: DayIndex) => {
     const cards = [...currentWeekData.days[dayIndex]];
     const cardIndex = cards.findIndex(c => c.id === cardId);
     if (cardIndex === -1) return;

     const updatedCard = { 
       ...cards[cardIndex], 
       terms: cards[cardIndex].terms.filter(t => t.id !== termId) 
     };
     cards[cardIndex] = updatedCard;

     updateWeekData({ 
      days: { ...currentWeekData.days, [dayIndex]: cards } 
    });
  };

  const editTerm = (cardId: string, termId: string, newText: string, dayIndex: DayIndex) => {
    const cards = [...currentWeekData.days[dayIndex]];
    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const updatedCard = {
      ...cards[cardIndex],
      terms: cards[cardIndex].terms.map(t => t.id === termId ? { ...t, text: newText } : t)
    };
    cards[cardIndex] = updatedCard;
    updateWeekData({ days: { ...currentWeekData.days, [dayIndex]: cards } });
  };

  const addTerm = (cardId: string, text: string, dayIndex: DayIndex) => {
    const cards = [...currentWeekData.days[dayIndex]];
    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const updatedCard = {
      ...cards[cardIndex],
      terms: [...cards[cardIndex].terms, { id: uuidv4(), text }]
    };
    cards[cardIndex] = updatedCard;
    updateWeekData({ days: { ...currentWeekData.days, [dayIndex]: cards } });
  };

  // 截屏完成后导入到「当天」对应的那一列（按当前日期所在周 + 星期几）
  const addScreenshotToToday = useCallback(async (dataUrl: string) => {
    setScreenshotMode(false);
    const today = new Date();
    const weekId = getWeekId(today);
    const dayIndex = getTodayDayIndex();

    const newCard: ImageCard = {
      id: uuidv4(),
      url: dataUrl,
      terms: [],
      createdAt: Date.now(),
      rotation: Math.random() * 4 - 2,
      decorationType: 'pin',
      decorationColor: DECORATION_COLORS[Math.floor(Math.random() * DECORATION_COLORS.length)],
      isLoading: true,
    };

    // 立即导航到当前周，确保截图添加后用户能看到
    setCurrentDate(today);

    setData(prev => {
      const week = prev[weekId] || { ...INITIAL_WEEK_STATE, id: weekId };
      const days = { ...INITIAL_WEEK_STATE.days, ...week.days };
      days[dayIndex] = [...(days[dayIndex] || []), newCard];
      return { ...prev, [weekId]: { ...week, days } };
    });

    try {
      const terms = await generateDesignTerms(dataUrl);
      setData(prev => {
        const week = prev[weekId] || { ...INITIAL_WEEK_STATE, id: weekId };
        const days = { ...INITIAL_WEEK_STATE.days, ...week.days };
        const updatedCards = (days[dayIndex] || []).map(c =>
          c.id === newCard.id
            ? { ...c, isLoading: false, terms: terms.map(t => ({ id: uuidv4(), text: t })) }
            : c
        );
        days[dayIndex] = updatedCards;
        return { ...prev, [weekId]: { ...week, days } };
      });
    } catch {
      // API 调用失败时，仍保留卡片，只是没有关键词（去掉 loading 状态）
      setData(prev => {
        const week = prev[weekId] || { ...INITIAL_WEEK_STATE, id: weekId };
        const days = { ...INITIAL_WEEK_STATE.days, ...week.days };
        const updatedCards = (days[dayIndex] || []).map(c =>
          c.id === newCard.id ? { ...c, isLoading: false } : c
        );
        days[dayIndex] = updatedCards;
        return { ...prev, [weekId]: { ...week, days } };
      });
    }
  }, []);

  // 扩展环境：从任意页截屏后会打开本页，此处消费 local 中的待导入截图
  useEffect(() => {
    if (!isDataLoaded) return;

    type ChromeStorageLocal = {
      get: (keys: string[], cb: (r: { pendingScreenshot?: string }) => void) => void;
      remove: (key: string) => void;
    };
    type ChromeStorageChanged = {
      onChanged: {
        addListener: (cb: (changes: Record<string, { newValue?: string }>, area: string) => void) => void;
        removeListener: (cb: (changes: Record<string, { newValue?: string }>, area: string) => void) => void;
      };
    };

    const g = typeof chrome !== 'undefined'
      ? (chrome as unknown as { storage?: { local?: ChromeStorageLocal } & ChromeStorageChanged })
      : null;
    if (!g?.storage?.local) return;

    const consumePending = () => {
      g.storage!.local!.get(['pendingScreenshot'], (result: { pendingScreenshot?: string }) => {
        if (result.pendingScreenshot) {
          addScreenshotToToday(result.pendingScreenshot);
          setCurrentDate(new Date());
          g.storage!.local!.remove('pendingScreenshot');
        }
      });
    };

    // 初次加载时检查（页面刷新 / 首次打开的情况）
    consumePending();

    // 监听 storage 变化：插件页已打开被聚焦时也能立即响应
    const onStorageChanged = (
      changes: Record<string, { newValue?: string }>,
      area: string
    ) => {
      if (area === 'local' && changes['pendingScreenshot']?.newValue) {
        consumePending();
      }
    };
    g.storage!.onChanged.addListener(onStorageChanged);

    return () => {
      g.storage!.onChanged.removeListener(onStorageChanged);
    };
  }, [isDataLoaded, addScreenshotToToday]);

  if (!isDataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-board text-stone-400">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-amber-500" size={40} />
          <p className="font-hand text-xl">Opening Journal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-stone-800 bg-board">
      <Header 
        currentDate={currentDate} 
        onPrevWeek={() => changeWeek(-1)} 
        onNextWeek={() => changeWeek(1)}
        onToday={goToToday}
        onOpenConfig={() => setConfigModalOpen(true)}
        onOpenInsights={() => setInsightsModalOpen(true)}
      />

      <ConfigModal isOpen={configModalOpen} onClose={() => setConfigModalOpen(false)} />
      <TermsInsightModal
        isOpen={insightsModalOpen}
        onClose={() => setInsightsModalOpen(false)}
        data={data}
      />

      {screenshotMode && (
        <ScreenshotOverlay
          onCapture={addScreenshotToToday}
          onCancel={() => setScreenshotMode(false)}
        />
      )}

      <FloatingCaptureButton onCapture={addScreenshotToToday} />
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-6 flex flex-col gap-6">
        
        {/* Main Board Container */}
        <div className="flex-1 flex flex-col">
           {/* Weekly Grid */}
           <div className="grid grid-cols-1 md:grid-cols-3 w-full border-b border-stone-200">
              {/* Row 1 */}
              <DayCell 
                dayName="MON" 
                dateNumber={getDateForDayIndex(currentDate, 0)}
                dayIndex={0} 
                cards={currentWeekData.days[0]} 
                onUpload={handleUpload} 
                onDeleteCard={deleteCard}
                onDeleteTerm={deleteTerm}
                onEditTerm={editTerm}
                onAddTerm={addTerm}
                onFocusForPaste={() => setPasteTargetDay(0)}
                onBlurForPaste={() => setPasteTargetDay(null)}
              />
              <DayCell 
                dayName="TUE" 
                dateNumber={getDateForDayIndex(currentDate, 1)}
                dayIndex={1} 
                cards={currentWeekData.days[1]} 
                onUpload={handleUpload} 
                onDeleteCard={deleteCard}
                onDeleteTerm={deleteTerm}
                onEditTerm={editTerm}
                onAddTerm={addTerm}
                onFocusForPaste={() => setPasteTargetDay(1)}
                onBlurForPaste={() => setPasteTargetDay(null)}
              />
              <DayCell 
                dayName="WED" 
                dateNumber={getDateForDayIndex(currentDate, 2)}
                dayIndex={2} 
                cards={currentWeekData.days[2]} 
                onUpload={handleUpload} 
                onDeleteCard={deleteCard}
                onDeleteTerm={deleteTerm}
                onEditTerm={editTerm}
                onAddTerm={addTerm}
                onFocusForPaste={() => setPasteTargetDay(2)}
                onBlurForPaste={() => setPasteTargetDay(null)}
              />

              {/* Row 2 */}
              <DayCell 
                dayName="THU" 
                dateNumber={getDateForDayIndex(currentDate, 3)}
                dayIndex={3} 
                cards={currentWeekData.days[3]} 
                onUpload={handleUpload} 
                onDeleteCard={deleteCard}
                onDeleteTerm={deleteTerm}
                onEditTerm={editTerm}
                onAddTerm={addTerm}
                onFocusForPaste={() => setPasteTargetDay(3)}
                onBlurForPaste={() => setPasteTargetDay(null)}
              />
              <DayCell 
                dayName="FRI" 
                dateNumber={getDateForDayIndex(currentDate, 4)}
                dayIndex={4} 
                cards={currentWeekData.days[4]} 
                onUpload={handleUpload} 
                onDeleteCard={deleteCard}
                onDeleteTerm={deleteTerm}
                onEditTerm={editTerm}
                onAddTerm={addTerm}
                onFocusForPaste={() => setPasteTargetDay(4)}
                onBlurForPaste={() => setPasteTargetDay(null)}
              />
              <DayCell 
                dayName="SAT" 
                dateNumber={getDateForDayIndex(currentDate, 5)}
                dayIndex={5} 
                cards={currentWeekData.days[5]} 
                onUpload={handleUpload} 
                onDeleteCard={deleteCard}
                onDeleteTerm={deleteTerm}
                onEditTerm={editTerm}
                onAddTerm={addTerm}
                onFocusForPaste={() => setPasteTargetDay(5)}
                onBlurForPaste={() => setPasteTargetDay(null)}
                isWeekend={true}
              />

              {/* Row 3: Sunday */}
              <DayCell 
                dayName="SUN" 
                dateNumber={getDateForDayIndex(currentDate, 6)}
                dayIndex={6} 
                cards={currentWeekData.days[6]} 
                onUpload={handleUpload} 
                onDeleteCard={deleteCard}
                onDeleteTerm={deleteTerm}
                onEditTerm={editTerm}
                onAddTerm={addTerm}
                onFocusForPaste={() => setPasteTargetDay(6)}
                onBlurForPaste={() => setPasteTargetDay(null)}
                isWeekend={true}
              />
           </div>

           {/* Row 3: Notes */}
           <NotesArea 
              content={currentWeekData.notes}
              onChange={(txt) => updateWeekData({ notes: txt })}
              height={currentWeekData.notesHeight}
              onHeightChange={(h) => updateWeekData({ notesHeight: h })}
           />
        </div>
      </main>
    </div>
  );
}

export default App;