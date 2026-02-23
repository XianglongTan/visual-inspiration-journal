import React, { useMemo } from 'react';
import { X, Sparkles } from 'lucide-react';
import { WeekData } from '../types';

interface TermsInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: { [weekId: string]: WeekData };
}

interface TermFrequency {
  text: string;
  count: number;
}

// Deterministic hash from string → number in [0, 1)
const strHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
};

// Arrange words into rows forming an oval/cloud shape.
// Most frequent words go to the CENTER row first, then radiate outward.
const buildRows = (terms: TermFrequency[]): TermFrequency[][] => {
  const n = terms.length;
  if (n === 0) return [];

  // Row word-count patterns indexed by total word count (1-based)
  const patterns: number[][] = [
    [1],
    [2],
    [1, 2],
    [1, 2, 1],
    [2, 3],
    [2, 3, 1],
    [2, 3, 2],
    [1, 3, 3, 1],
    [2, 3, 3, 1],
    [2, 3, 4, 2],
    [2, 4, 4, 2],
    [2, 3, 4, 3, 2],
    [2, 3, 4, 4, 2],
    [2, 3, 5, 4, 2],
    [2, 4, 5, 4, 2],
    [2, 4, 5, 4, 3],
    [2, 4, 5, 5, 3],
    [2, 4, 5, 5, 4],
    [3, 4, 5, 5, 4],
    [3, 4, 6, 5, 4],
  ];
  const pattern = patterns[Math.min(n, patterns.length) - 1];
  const numRows = pattern.length;

  // Build fill order: center row first, then alternating up/down outward
  const centerIdx = Math.floor(numRows / 2);
  const fillOrder: number[] = [centerIdx];
  for (let d = 1; d <= centerIdx; d++) {
    if (centerIdx + d < numRows) fillOrder.push(centerIdx + d); // below center
    if (centerIdx - d >= 0) fillOrder.push(centerIdx - d);      // above center
  }

  // Fill rows in center-first order with highest-frequency words first
  const rows: TermFrequency[][] = pattern.map(() => []);
  let wordIdx = 0;
  for (const rowIdx of fillOrder) {
    const count = pattern[rowIdx];
    for (let i = 0; i < count && wordIdx < n; i++) {
      rows[rowIdx].push(terms[wordIdx++]);
    }
  }

  return rows;
};

const MIN_WORDS = 20;

// 50th percentile (median) of an array of numbers
const percentile50 = (sortedAsc: number[]): number => {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  const mid = n / 2;
  return n % 2 === 1
    ? sortedAsc[Math.floor(mid)]
    : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
};

const TermsInsightModal: React.FC<TermsInsightModalProps> = ({ isOpen, onClose, data }) => {
  const { termFrequencies, totalImages } = useMemo(() => {
    const freq: { [term: string]: number } = {};
    let totalImages = 0;

    Object.values(data).forEach(week => {
      Object.values(week.days).forEach(cards => {
        cards.forEach(card => {
          totalImages++;
          card.terms.forEach(term => {
            const normalized = term.text.trim().toLowerCase();
            if (!normalized) return;
            freq[normalized] = (freq[normalized] || 0) + 1;
          });
        });
      });
    });

    const sorted: TermFrequency[] = Object.entries(freq)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count);

    if (sorted.length === 0) return { termFrequencies: [], totalImages };

    const countsAsc = [...sorted].map(t => t.count).sort((a, b) => a - b);
    const p50 = percentile50(countsAsc);
    const byP50 = sorted.filter(t => t.count >= p50);
    const termFrequencies =
      byP50.length < MIN_WORDS
        ? sorted.slice(0, Math.min(MIN_WORDS, sorted.length))
        : byP50;

    return { termFrequencies, totalImages };
  }, [data]);

  const maxCount = termFrequencies[0]?.count || 1;
  const minCount = termFrequencies[termFrequencies.length - 1]?.count || 1;

  const getFontSize = (count: number): number => {
    const ratio = maxCount === minCount ? 1 : (count - minCount) / (maxCount - minCount);
    // Exponential scaling feels more natural for word clouds
    return 0.72 + Math.pow(ratio, 0.6) * 2.1; // 0.72rem → 2.82rem
  };

  // Warm, journal-ink color palette
  const PALETTE = [
    '#78350f', // amber-900
    '#c2410c', // orange-700
    '#be123c', // rose-700
    '#9f1239', // rose-800
    '#b45309', // amber-700
    '#92400e', // amber-800
    '#7c2d12', // orange-900
    '#881337', // rose-900
    '#713f12', // yellow-900
  ];

  const getColor = (text: string, count: number): string => {
    const h = strHash(text);
    const base = PALETTE[Math.floor(h * PALETTE.length)];
    // Fade low-frequency words toward stone
    const ratio = maxCount === minCount ? 1 : (count - minCount) / (maxCount - minCount);
    if (ratio < 0.25) return '#a8a29e'; // stone-400 for weakest
    if (ratio < 0.5) return '#78716c';  // stone-500
    return base;
  };

  const getRotation = (text: string): number => {
    const h = strHash(text + 'rot');
    return (h - 0.5) * 14; // ±7 degrees
  };

  const getLetterSpacing = (count: number): string => {
    const ratio = maxCount === minCount ? 1 : (count - minCount) / (maxCount - minCount);
    return ratio > 0.7 ? '0.04em' : 'normal';
  };

  const rows = useMemo(() => buildRows(termFrequencies), [termFrequencies]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-[#faf9f7] rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-600" />
            <h2 className="font-sans font-bold text-stone-800 text-sm tracking-wide uppercase">
              审美 DNA
            </h2>
            {totalImages > 0 && (
              <span className="text-xs text-stone-400 font-normal ml-1">
                · 基于 {totalImages} 张灵感
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Word Cloud */}
        <div className="px-6 pb-8 pt-2 min-h-[280px] flex flex-col items-center justify-center">
          {termFrequencies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-400">
              <Sparkles size={28} className="mb-3 opacity-25" />
              <p className="text-sm">还没有收录任何灵感</p>
              <p className="text-xs text-stone-300 mt-1">上传图片后 AI 会自动生成标签</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 w-full select-none">
              {rows.map((row, rowIdx) => (
                <div
                  key={rowIdx}
                  className="flex items-center justify-center flex-wrap gap-x-5 gap-y-1"
                >
                  {row.map(term => {
                    const fontSize = getFontSize(term.count);
                    const rotation = getRotation(term.text);
                    const color = getColor(term.text, term.count);
                    const ratio = maxCount === minCount ? 1 : (term.count - minCount) / (maxCount - minCount);
                    const fontWeight = ratio > 0.75 ? 800 : ratio > 0.4 ? 600 : 400;

                    return (
                      <span
                        key={term.text}
                        title={`出现 ${term.count} 次`}
                        style={{
                          fontSize: `${fontSize}rem`,
                          color,
                          fontWeight,
                          letterSpacing: getLetterSpacing(term.count),
                          transform: `rotate(${rotation}deg)`,
                          display: 'inline-block',
                          lineHeight: 1.15,
                          cursor: 'default',
                          transition: 'opacity 0.15s, transform 0.15s',
                          fontFamily: 'Georgia, "Times New Roman", serif',
                        }}
                        className="hover:opacity-60 hover:scale-105"
                      >
                        {term.text}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {termFrequencies.length > 0 && (
          <div className="border-t border-stone-100 px-6 py-3 flex justify-between items-center">
            <p className="text-xs text-stone-300">字越大出现越频繁</p>
            <p className="text-xs text-stone-300">Top {termFrequencies.length} 高频词</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TermsInsightModal;
