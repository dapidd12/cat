export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Quiz {
  title: string;
  durationMinutes: number;
  questions: Question[];
}

export type ViewState = 'upload' | 'generating' | 'taking' | 'results';
