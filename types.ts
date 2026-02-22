export interface Term {
  id: string;
  text: string;
}

export interface ImageCard {
  id: string;
  url: string; // Base64 or URL
  terms: Term[];
  createdAt: number;
  rotation: number; // Random rotation for style
  decorationType: 'tape' | 'pin' | 'clip'; // Type of decoration
  decorationColor: string;
  isLoading: boolean;
}

// 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeekData {
  id: string; // "YYYY-Www" format
  days: {
    [key in DayIndex]: ImageCard[];
  };
  notes: string;
  notesHeight: number;
}

export interface AppState {
  weeks: { [weekId: string]: WeekData };
  currentDate: Date;
}