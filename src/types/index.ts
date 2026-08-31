import type { EvaluationResult, EnglishLevel, VocabularyItem } from '../services/geminiService';

export type { EvaluationResult, EnglishLevel, VocabularyItem };

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
export type ContentMode = "generate" | "useInput" | "image";

export type QuestionType = 'fill_blank' | 'rearrange' | 'find_mistake' | 'complete_sentence';

export interface WrittenQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  suggestedWords?: string; // used for fill_blank or complete_sentence
  expectedAnswer: string;
  explanation: string;
}

export interface ExerciseData {
  questions: WrittenQuestion[]; // 30 questions
}

export interface MatchingExercise {
  items: { term: string; definition: string }[];
}

export interface FillBlankExercise {
  sentence: string; // e.g., "The cat ___ on the mat."
  options?: string[]; // Multiple choice options
  answer: string;
}

export interface RewriteExercise {
  originalSentence: string;
  hint: string; // e.g., "Begin with 'If...'"
  answer: string;
}

export interface MistakeExercise {
  sentence: string; // "She don't like apples."
  mistake: string; // "don't"
  correction: string; // "doesn't"
}

export interface QuestionExercise {
  question: string;
  suggestedAnswer: string;
}

export interface EssayExercise {
  topic: string;
  guidance: string; // Bullet points or hints
}

export interface HomeworkData {
  matching: MatchingExercise;
  fillBlanks: FillBlankExercise[];
  rewrites: RewriteExercise[];
  mistakes: MistakeExercise[];
  questions: QuestionExercise[];
  essay: EssayExercise;
}

export interface AppState {
  topic: string;
  grammarTopic: string;
  level: EnglishLevel;
  apiKey: string;
  showApiKeyModal: boolean;
  imagePreview: string | null;
  aspectRatio: AspectRatio;
  isGenerating: boolean;
  isAudioLoading: boolean;
  generatedImage: string | null;
  generatedPrompt: string | null;
  readingText: string | null;
  translationText: string | null;
  readingText2: string | null;
  translationText2: string | null;
  vocabulary: VocabularyItem[];
  showTranslation: boolean;
  generatedTopicName: string | null;
  error: string | null;
  contentMode: ContentMode;
  exerciseData: ExerciseData | null;
  homeworkData: HomeworkData | null;
  exerciseScore: number | null;
  isDragging: boolean;
  isProcessingFile: boolean;
  isDownloading: boolean;
  isPlaying: boolean;
  audioUrl: string | null;
  audioUrl2: string | null;
  // Recording
  isRecording: boolean;
  isEvaluating: boolean;
  evaluation: EvaluationResult | null;
  studentName: string;
  teacherName: string;
  showCertificate: boolean;
}
