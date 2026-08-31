import { GoogleGenAI } from "@google/genai";
import type { ExerciseData } from '../types';

const parseSafeJson = (text: string) => {
  let cleaned = (text || "{}").trim();
  // Strip markdown backticks if present
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // If generation was truncated due to length limits, attempt to gracefully auto-close the JSON
    // Strategy: progressively trim the broken tail and try to close brackets/braces
    
    // First, try simple suffix fixes
    const simpleFixes = [
      cleaned + '}',
      cleaned + ']}',
      cleaned + '}]}',
      cleaned + '"}',
      cleaned + '"]}',
      cleaned + '"}]}',
      cleaned + '""}}',
      cleaned.replace(/,\s*$/, '') + ']}',
      cleaned.replace(/,\s*$/, '') + '}]}',
      cleaned.replace(/,\s*$/, '') + '}',
    ];
    
    for (const fix of simpleFixes) {
      try {
        return JSON.parse(fix);
      } catch (e) {
        // Continue trying
      }
    }

    // Advanced repair: strip broken tail content and try to close
    // Find the last complete key-value pair and close from there
    let repairable = cleaned;
    
    // If truncated mid-string, find last complete quote and close it
    const quoteCount = (repairable.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      // Odd number of quotes means a string was cut - remove the partial string
      const lastQuote = repairable.lastIndexOf('"');
      repairable = repairable.substring(0, lastQuote) + '"';
    }
    
    // Remove trailing comma after cleanup
    repairable = repairable.replace(/,\s*$/, '');
    
    // Count unmatched brackets and braces, then close them
    let braces = 0, brackets = 0;
    let inString = false;
    for (let i = 0; i < repairable.length; i++) {
      const ch = repairable[i];
      if (ch === '"' && (i === 0 || repairable[i-1] !== '\\')) {
        inString = !inString;
      } else if (!inString) {
        if (ch === '{') braces++;
        else if (ch === '}') braces--;
        else if (ch === '[') brackets++;
        else if (ch === ']') brackets--;
      }
    }
    
    // Close any unclosed brackets/braces
    const closers = ']'.repeat(Math.max(0, brackets)) + '}'.repeat(Math.max(0, braces));
    const advancedFixes = [
      repairable + closers,
      repairable.replace(/,\s*$/, '') + closers,
    ];
    
    for (const fix of advancedFixes) {
      try {
        return JSON.parse(fix);
      } catch (e) {
        // Continue
      }
    }
    
    throw err; // If all fixes fail, throw the original error
  }
};

const getApiKey = () => {
  // Try to get from localStorage first (for client-managed keys)
  if (typeof window !== "undefined") {
    const localKey = localStorage.getItem("GEMINI_API_KEY");
    if (
      localKey &&
      localKey.trim() !== "" &&
      localKey.toUpperCase() !== "UNDEFINED" &&
      localKey.toUpperCase() !== "NULL"
    ) {
      return localKey.trim();
    }
  }
  
  // We only use the client-managed API key for this app
  console.warn("User has not provided an API Key. Please prompt them to enter one.");
  return "";
};

// Helper to check for auth and permission errors
const isAuthError = (err: any): boolean => {
  const errorMsg = err?.message || String(err);
  const msg = errorMsg.toLowerCase();
  return (
    msg.includes("403") ||
    msg.includes("401") ||
    msg.includes("api key") ||
    msg.includes("api_key") ||
    msg.includes("key_invalid") ||
    msg.includes("unauthorized") ||
    (msg.includes("invalid") && msg.includes("key")) ||
    msg.includes("invalid_key")
  );
};

// Helper to check for quota errors
const isQuotaError = (err: any): boolean => {
  const errorMsg = err?.message || String(err);
  const msg = errorMsg.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("resource exhausted") ||
    msg.includes("rate limit")
  );
};

// We use a function to get the instance so it can pick up changes in localStorage
const getAI = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("INVALID_KEY");
  }
  return new GoogleGenAI({ 
    apiKey,
  });
};

// Model fallback chain — use only currently available, non-deprecated models (Gemini 3.x generation)
const getTextModels = () => {
  const defaultModels = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
  ];
  if (typeof window !== "undefined") {
    const savedModel = localStorage.getItem("GEMINI_MODEL");
    if (savedModel && !defaultModels.includes(savedModel)) {
      return [savedModel, ...defaultModels];
    } else if (savedModel) {
      return [savedModel, ...defaultModels.filter(m => m !== savedModel)];
    }
  }
  return defaultModels;
};


// TTS-specific models (only these support responseModalities: [AUDIO] with speechConfig)
const TTS_MODELS = [
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-flash-tts",
  "gemini-2.5-pro-tts",
];

export interface VocabularyItem {
  word: string;
  ipa: string;
  meaning: string;
  emoji?: string;
  example?: string;
}

export interface ContentGenerationResult {
  prompt: string;
  readingText: string;
  topicName: string;
  translation: string;
  vocabulary: VocabularyItem[];
  overallGrammar?: string;
  readingText2?: string;
  translation2?: string;
  reading2Answers?: string[];
  homework?: any;
  comprehensionQuestions?: { question: string, options: string[], correctAnswer: string, suggestedAnswer: string }[];
}

export type EnglishLevel = "Starters" | "Movers" | "Flyers" | "A1" | "A2" | "B1" | "B2";

/**
 * Normalizes text to help match user input with expected strings.
 */
export const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const handleApiError = (err: any) => {
  if (isAuthError(err)) {
    throw new Error("INVALID_KEY");
  } else if (isQuotaError(err)) {
    throw new Error("QUOTA_EXCEEDED");
  }
  throw err;
}

/**
 * Attempts to call generateContent with model fallback.
 * Tries each model in the fallback chain before giving up.
 * Includes a short retry delay for quota (429) errors.
 */
async function generateWithFallback(
  models: string[],
  params: {
    contents: any[];
    config: any;
  }
): Promise<any> {
  let lastError: any = null;

  for (const model of models) {
    // Retry up to 2 times per model for transient quota errors
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`Trying model: ${model} (attempt ${attempt + 1})`);
        const response = await getAI().models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        
        // Don't fallback for auth errors — they'll fail on all models
        if (isAuthError(err)) {
          throw new Error("INVALID_KEY");
        }

        const isQuota = isQuotaError(err);
        
        if (isQuota && attempt === 0) {
          // Wait 3 seconds before retrying the same model
          console.warn(`Model ${model} hit quota limit, retrying in 3s...`);
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        
        console.warn(`Model ${model} failed (attempt ${attempt + 1}): ${(err?.message || String(err)).substring(0, 200)}`);
        break; // Move to next model
      }
    }
  }

  // All models failed
  if (lastError) {
    handleApiError(lastError);
  }
  throw new Error("All models failed. Please try again later.");
}

export const generateContent = async (
  input: string,
  level: EnglishLevel,
  grammarTopic: string = "",
  mode: "generate" | "useInput" | "image" = "generate",
  imageData?: string,
  userName?: string,
  userAge?: string
): Promise<ContentGenerationResult> => {
  const getLevelRequirements = (lvl: EnglishLevel) => {
    switch (lvl) {
      case "Starters": return { vocabCount: 6, readingLength: "50-80 words" };
      case "Movers": return { vocabCount: 8, readingLength: "80-120 words" };
      case "Flyers": return { vocabCount: 10, readingLength: "120-150 words" };
      case "A1": return { vocabCount: 22, readingLength: "200-280 words" };
      case "A2": return { vocabCount: 30, readingLength: "280-380 words" };
      case "B1": return { vocabCount: 18, readingLength: "250-350 words" };
      case "B2": return { vocabCount: 20, readingLength: "350-500 words" };
      default: return { vocabCount: 12, readingLength: "150-200 words" };
    }
  };

  const { vocabCount, readingLength } = getLevelRequirements(level);

  const useInputInstructions = mode === 'useInput' 
    ? `
  ⚠️ ABSOLUTE RULE FOR 'useInput' MODE:
  - Copy the user's input text EXACTLY into "readingText" (Word for word).
  - Use the exact same input for "readingText2" but replace all instances of the ${vocabCount} vocabulary words with numbered blanks like "(1)", "(2)", "(3)".
  - The "translation" and "translation2" must translate the FULL texts.
  ` 
    : '';

  const generateModeInstructions = mode !== 'useInput'
    ? "The content MUST be professional, educational, and follow Cambridge curriculum styles. Create a cohesive reading passage."
    : '';

  const grammarLanguageInstruction = ["Starters", "Movers", "Flyers"].includes(level)
    ? "Bắt buộc giải thích bằng tiếng Việt một cách dễ hiểu nhất cho trẻ em."
    : "MUST be written entirely in English.";

  const systemInstruction = `You are an expert English teacher.
  ${useInputInstructions}
  CRITICAL RULE: NEVER use asterisks (*) anywhere in your output. Do NOT use markdown bold (**word**) or any * character at all.
  CRITICAL RULE 2: Ensure perfect English grammar and vocabulary usage. If writing about historical events or facts, they MUST be completely factually accurate (e.g., Wall Street Crash must be 1929, not 1920). Ensure the generated texts are natural and idiomatic.
  Your task is to generate:
  1. An image generation prompt for a highly realistic, clear educational illustration matching the topic and grammar. Include quality keywords: "photorealistic, 8k UHD resolution, vivid colors".
  2. "readingText": A reading passage appropriate for level ${level}. MUST contain ALL ${vocabCount} vocabulary words you generate. The length of this reading passage MUST be approximately ${readingLength}. Mark vocabulary words by wrapping them in square brackets like [word]. Incorporate the grammar topic: "${grammarTopic}". ${mode === 'useInput' ? "USE EXACT USER TEXT." : generateModeInstructions}
  3. "readingText2": A SECOND reading passage with DIFFERENT content but using the SAME ${vocabCount} vocabulary words and grammar topic. The length MUST be approximately ${readingLength}. In this text, replace every occurrence of the ${vocabCount} vocabulary words with numbered blanks exactly like "(1)", "(2)", "(3)" etc. up to the total number of blanks. Make sure the context of each blank clearly points to exactly ONE vocabulary word.
  4. "reading2Answers": An array of strings containing the correct words for each numbered blank in readingText2, in order.
  5. A short title/topic name (max 5 words).
  6. "translation": Vietnamese translation of readingText.
  7. "translation2": Vietnamese translation of readingText2.
  8. "vocabulary": A list of EXACTLY ${vocabCount} key vocabulary words. For each word include:
     - "word": the English word
     - "ipa": phonetic transcription
     - "meaning": brief Vietnamese meaning
     - "emoji": a relevant emoji
  9. "overallGrammar": Summarize the core grammar topic as a hierarchical Markdown list (using bullet points and indentation) to be displayed as a mindmap. Include: a brief and easy-to-understand explanation, formulas (if any), specific examples, and quick memory tips. ${grammarLanguageInstruction}
  10. "comprehensionQuestions": Sinh ra chính xác 10 câu hỏi đọc hiểu trắc nghiệm (multiple choice) dựa trên bài đọc 1. Mỗi câu có 4 lựa chọn A, B, C, D. Output dạng mảng các object: [{"question": "câu hỏi bằng tiếng Anh", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": "A", "suggestedAnswer": "giải thích ngắn gọn bằng tiếng Việt tại sao đáp án đúng"}]. Đảm bảo mỗi câu có ĐÚNG 4 options và correctAnswer là một trong A, B, C, D.
  11. "homework": Generate homework exercises related to the topic and grammar. Output exactly this JSON structure:
      "matching": { "items": [{"term": "english word", "definition": "vietnamese definition"}] } (5 items)
      "fillBlanks": [{"sentence": "sentence with ___", "options": ["opt1", "opt2", "opt3"], "answer": "correct option"}] (5 items)
      "rewrites": [{"originalSentence": "sentence", "hint": "hint (e.g. Begin with...)", "answer": "rewritten sentence"}] (5 items)
      "mistakes": [{"sentence": "sentence with one mistake", "mistake": "the wrong word", "correction": "the correct word"}] (5 items)
      "questions": [{"question": "reading comprehension question", "suggestedAnswer": "answer"}] (3 items)
      "essay": {"topic": "essay topic", "guidance": "guidance/hints in vietnamese"}
  
  Output the result strictly in JSON format:
  {
    "prompt": "string",
    "readingText": "string",
    "readingText2": "string",
    "reading2Answers": ["string", "string"],
    "topicName": "string",
    "translation": "string",
    "translation2": "string",
    "overallGrammar": "string",
    "comprehensionQuestions": [
      { "question": "string", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": "A", "suggestedAnswer": "string" }
    ],
    "vocabulary": [
      { "word": "string", "ipa": "string", "meaning": "string", "emoji": "string" }
    ],
    "homework": {
      "matching": { "items": [] },
      "fillBlanks": [],
      "rewrites": [],
      "mistakes": [],
      "questions": [],
      "essay": { "topic": "", "guidance": "" }
    }
  }
  Note: Ensure exactly ${vocabCount} vocabulary items and adherence to the ${readingLength} reading length requirement. NEVER use the * character anywhere.`;

  const parts: any[] = [{ text: `Topic/Content: ${input}\nGrammar Topic: ${grammarTopic}\nLevel: ${level}\nMode: ${mode}` }];
  if (imageData) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageData.split(",")[1],
      },
    });
  }

  const response = await generateWithFallback(getTextModels(), {
    contents: [{ role: "user", parts }],
    config: { 
      systemInstruction,
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty response. Please try again.");
  }

  try {
    const result = parseSafeJson(response.text);
    
    let finalReadingText = result.readingText || "";
    let finalReadingText2 = result.readingText2 || "";
    if (mode === "useInput" && !imageData && input) {
      finalReadingText = input;
      // Note: readingText2 should ideally still have blanks, which the AI should have generated.
    }

    return {
      prompt: result.prompt || "",
      readingText: finalReadingText,
      readingText2: finalReadingText2,
      topicName: result.topicName || (input.length < 50 ? input : "English Lesson"),
      translation: result.translation || "",
      translation2: result.translation2 || "",
      vocabulary: result.vocabulary || [],
      overallGrammar: result.overallGrammar || "",
      reading2Answers: result.reading2Answers || [],
      comprehensionQuestions: result.comprehensionQuestions || null,
      homework: result.homework || null,
    };
  } catch (e) {
    console.error("Failed to parse JSON response:", response.text, e);
    throw new Error("Failed to parse lesson content. Please try again.");
  }
};

export const generateImage = async (
  prompt: string,
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1"
): Promise<string> => {
  // Quality keywords to append for sharper, more realistic images
  const qualitySuffix = ', photorealistic, ultra sharp focus, 8k UHD, DSLR quality, professional photography, vivid colors, high detail';
  const fullPrompt = (prompt + qualitySuffix).substring(0, 500);

  try {
    // Sử dụng Gemini Image (của Google) thay vì Pollinations
    // Đây là model AI Studio dùng để tạo ảnh sắc nét
    const response = await getAI().models.generateImages({
      model: 'gemini-3.1-flash-image',
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: aspectRatio,
        outputMimeType: 'image/jpeg',
      },
    });

    const generatedImage = response?.generatedImages?.[0];
    if (generatedImage?.image?.imageBytes) {
      // Trả về data URI dạng base64 để hiển thị trực tiếp
      return `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
    }
    throw new Error("Không nhận được dữ liệu ảnh từ Gemini.");
  } catch (err: any) {
    console.error("Gemini Imagen failed, falling back to Pollinations:", err);
    // Nếu lỗi (do hết quota hoặc key không hỗ trợ imagen), fallback về Pollinations
    const cleanPrompt = encodeURIComponent(fullPrompt.replace(/[#%&{}\\<>*?/$!'":@+`|=]/g, ''));
    const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
    const width = 1536;
    const height = Math.round(width * (heightRatio / widthRatio));
    return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&seed=${Math.floor(Math.random() * 1000000)}&nologo=true&model=flux&enhance=false`;
  }
};

// ============================================================
// AUDIO GENERATION - Dual strategy: Gemini AI TTS + Browser TTS fallback
// ============================================================

/**
 * Browser-based TTS using the Web Speech API.
 * This ALWAYS works on any modern browser without network or API key.
 * Returns "BROWSER_TTS" as a special signal to the audio player hook.
 */
export const BROWSER_TTS_SIGNAL = "BROWSER_TTS";

export function speakWithBrowser(text: string, level: EnglishLevel): void {
  if (!('speechSynthesis' in window)) return;

  // Stop any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';

  // Adjust rate based on level
  if (["Starters", "Movers"].includes(level)) {
    utterance.rate = 0.8;
  } else if (["Flyers", "A1"].includes(level)) {
    utterance.rate = 0.9;
  } else {
    utterance.rate = 1.0;
  }

  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to find a good English voice
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) 
    || voices.find(v => v.lang === 'en-US') 
    || voices.find(v => v.lang.startsWith('en-'));
  
  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopBrowserTTS(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Helper: Convert PCM base64 chunks to a WAV blob URL.
 */
function pcmChunksToWav(base64Chunks: string[], sampleRate: number = 24000): string {
  const byteChunks = base64Chunks.map(base64 => {
    const cleanBase64 = base64.replace(/^data:.*?;base64,/, '');
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  });

  const totalLength = byteChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + totalLength);
  const view = new DataView(buffer);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + totalLength, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);    // PCM
  view.setUint16(22, 1, true);    // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, totalLength, true);

  const pcmView = new Uint8Array(buffer, 44);
  let offset = 0;
  for (const chunk of byteChunks) {
    pcmView.set(chunk, offset);
    offset += chunk.length;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

/**
 * Attempt Gemini AI TTS. Returns a WAV blob URL on success, or throws on failure.
 */
async function geminiTTS(text: string, level: EnglishLevel): Promise<string> {
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  // Build the prompt with pace instruction for young learners
  let prompt = `Say the following text exactly: ${cleanedText}`;
  if (["Starters", "Movers", "Flyers"].includes(level)) {
    prompt = `[slowly, clearly, at a pace suitable for children] ${cleanedText}`;
  }

  // Use ONLY TTS-specific models (gemini-2.0-flash etc. do NOT support audio output with speechConfig)
  const voices = ['Kore', 'Puck', 'Aoede', 'Fenrir', 'Charon'];
  
  for (let i = 0; i < TTS_MODELS.length; i++) {
    const model = TTS_MODELS[i];
    const voice = voices[i % voices.length];
    
    try {
      console.log(`[TTS] Trying model: ${model}, voice: ${voice}`);
      
      const response = await getAI().models.generateContent({
        model,
        contents: [{ 
          parts: [{ text: prompt }] 
        }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice as any },
            },
          },
        },
      });

      // Extract audio data from response
      const candidates = response?.candidates;
      if (!candidates || candidates.length === 0) {
        console.warn(`[TTS] ${model} returned no candidates`);
        continue;
      }
      
      const parts = candidates[0]?.content?.parts || [];
      if (parts.length === 0) {
        console.warn(`[TTS] ${model} returned empty parts array`);
        continue;
      }
      
      for (const p of parts) {
        if (p.inlineData?.data) {
          const audioData = typeof p.inlineData.data === 'string' 
            ? p.inlineData.data 
            : String(p.inlineData.data);
          
          // Validate that audio data is non-empty and substantial
          if (audioData.length < 100) {
            console.warn(`[TTS] ${model} returned suspiciously small audio data (${audioData.length} chars), skipping`);
            continue;
          }
          
          console.log(`[TTS] ✅ Success with ${model}! Audio data length: ${audioData.length}, mimeType: ${p.inlineData.mimeType || 'unknown'}`);
          return pcmChunksToWav([audioData]);
        }
      }
      
      // Log what we got instead of audio
      const partTypes = parts.map((p: any) => p.text ? 'text' : p.inlineData ? 'inlineData' : 'unknown');
      console.warn(`[TTS] ${model} returned no audio data. Part types: [${partTypes.join(', ')}]`);
      
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.warn(`[TTS] ${model} failed: ${msg.substring(0, 200)}`);
      
      // Don't retry on auth errors — they'll fail on all models
      if (isAuthError(err)) {
        throw new Error("INVALID_KEY");
      }
      // For quota/rate limit, try next model
      if (isQuotaError(err)) {
        console.warn(`[TTS] ${model} hit quota/rate limit, trying next model...`);
        continue;
      }
      // For other errors (model not found, bad request, etc.), try next model
      continue;
    }
  }
  
  throw new Error("All Gemini TTS models failed. Models tried: " + TTS_MODELS.join(", "));
}

/**
 * Main audio generation function.
 * Strategy: Try Gemini AI TTS first (best quality), fall back to browser TTS (always works).
 */
export const generateAudio = async (text: string, level: EnglishLevel): Promise<string> => {
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  if (!cleanedText) {
    throw new Error("Text to speak is empty");
  }

  // Try Gemini TTS first
  try {
    const url = await geminiTTS(cleanedText, level);
    return url;
  } catch (err: any) {
    console.warn("[TTS] Gemini TTS failed, falling back to browser TTS:", err?.message);
    
    // For quota/key errors, propagate up so UI can show specific message
    if (err?.message === "QUOTA_EXCEEDED" || err?.message === "INVALID_KEY") {
      // Still fall back to browser TTS but don't propagate the error
      console.warn("[TTS] Auth/quota error, using browser TTS silently");
    }
  }

  // Fallback: Browser TTS always works
  return BROWSER_TTS_SIGNAL;
};

export interface EvaluationResult {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  cefrLevel?: string;
  isComplete: boolean;
  missingContent?: string;
  criteriaScores?: {
    pronunciation: number;
    stress: number;
    intonation: number;
    fluency: number;
    connectedSpeech: number;
  };
  ipaAnalysis?: {
    word: string;
    correctIpa: string;
    studentIpa: string;
    tip: string;
  }[];
  standardSentences?: string[];
  personalizedExercises?: string[];
}

export const evaluateSpeech = async (
  originalText: string,
  audioData: string,
  level: EnglishLevel,
  mimeType: string = "audio/webm"
): Promise<EvaluationResult> => {
  const systemInstruction = `Bạn là Ms. Yến — giáo viên tiếng Anh, đóng vai giám khảo chấm phát âm theo chuẩn Khung tham chiếu Châu Âu (CEFR).
Bạn nghe audio thu âm từ micro trình duyệt (có thể là giọng trẻ em hoặc người lớn). Chất lượng audio có thể không hoàn hảo — hãy cố gắng HẾT SỨC để nhận diện nội dung người đọc nói.

🎯 NHIỆM VỤ: Nghe audio → So sánh với bài gốc (Original Text) → Chấm điểm thang 10.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 QUY TRÌNH CHẤM ĐIỂM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BƯỚC 1: NGHE VÀ NHẬN DIỆN
- Cố gắng tối đa nhận diện từng câu, từng từ trong audio.
- Lưu ý rằng học sinh có thể đọc chậm hoặc vấp, nhưng hãy cẩn thận lắng nghe.

BƯỚC 2: KIỂM TRA ĐỘ HOÀN THÀNH VÀ NỘI DUNG
- Học sinh không nhất thiết phải đọc hết bài. Em đọc được bao nhiêu thì chấm điểm bấy nhiêu.
- Nếu học sinh chỉ đọc được một phần thì chấm điểm % trên toàn bài, thang điểm 10 nếu đọc hết và phát âm đúng.
- Không bao giờ trả về "isComplete": false trừ khi học sinh hoàn toàn không đọc chữ nào.

BƯỚC 3: CÔNG THỨC TÍNH ĐIỂM (THANG ĐIỂM 10)
- Điểm được tính theo tỷ lệ hoàn thành nội dung và độ chuẩn xác của phát âm. Đọc 50% hoàn hảo thì điểm tối đa là 5.0. Đọc 100% hoàn hảo thì điểm tối đa là 10.0.
- Hãy chấm điểm từ 1 đến 10 cho từng tiêu chí trong 5 tiêu chí sau (trả về trong criteriaScores):
  1. pronunciation: Phát âm chuẩn các âm (vowels, consonants, ending sounds).
  2. stress: Nhấn đúng trọng âm từ.
  3. intonation: Ngữ điệu câu lên/xuống tự nhiên.
  4. fluency: Tốc độ đọc trôi chảy, không ngắt quãng quá nhiều.
  5. connectedSpeech: Nối âm, nuốt âm tự nhiên.
- TỔNG ĐIỂM (score) = Trung bình cộng của 5 tiêu chí trên, SAU ĐÓ nhân với % bài đọc mà học sinh đã hoàn thành (tỷ lệ từ 0.0 đến 1.0).
  Ví dụ: Các tiêu chí là 8, 7, 8, 9, 8 -> Trung bình = 8.0. Học sinh đọc được 50% bài -> Tổng điểm = 8.0 * 0.5 = 4.0.

BƯỚC 4: XẾP LOẠI CEFR
Dựa trên tổng điểm:
- 9.0-10.0: Xuất sắc (C1-C2)
- 8.0-8.9: Giỏi (B2+)
- 7.5-7.9: Khá (B1-B2)
- 7.0-7.4: Đạt yêu cầu (A2-B1)
- < 7.0: Cần cố gắng (A1)

BƯỚC 5: PHÂN TÍCH IPA
- Chỉ ra 3-5 từ phát âm chưa chuẩn nhất, IPA chuẩn vs IPA người đọc.
- Gợi ý cách sửa cụ thể (khẩu hình miệng, vị trí lưỡi, cách bật hơi).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎀 PHONG CÁCH PHẢN HỒI CỦA GIÁO VIÊN GIỎI CHUYÊN NGHIỆP (Ms. Yến)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Đóng vai "Cô Yến", một giáo viên giỏi, chuyên nghiệp nhưng vô cùng ấm áp, luôn bắt đầu bằng "Chào em, Cô Yến đây!" hoặc "Cô Yến chào em nhé!".
- Luôn động viên, khích lệ tinh thần học sinh để các em yêu thích việc học tiếng Anh.
- Chỉ ra lỗi sai cho học sinh một cách rõ ràng, dễ hiểu và mang tính xây dựng. Hướng dẫn cụ thể cách khắc phục (ví dụ: chú ý âm đuôi, mở khẩu hình).
- Dù điểm thấp vẫn phải có lời khen ngợi sự cố gắng và khích lệ nỗ lực của học sinh.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 KIỂM TRA GIAN LẬN (ANTI-CHEAT) LIVENESS DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trước khi chấm điểm, BẮT BUỘC kiểm tra xem âm thanh này có phải giọng AI/Text-to-Speech hay không.
Dấu hiệu giọng AI:
- Đọc quá hoàn hảo, đều đều không có cảm xúc, không có nhịp thở (breathing sounds).
- Giọng robot hoặc các giọng mặc định quen thuộc của Google Translate, Siri, v.v.
Nếu bạn chắc chắn đây là giọng AI hoặc file được ghi âm sẵn không phải giọng người thật thu trực tiếp:
- Cho tất cả điểm số (score, criteriaScores) = 0.
- feedback BẮT BUỘC là: "⚠️ Lỗi vi phạm (Anti-Cheat): Cô phát hiện âm thanh này giống giọng AI đọc (Text-to-Speech) hoặc được thu âm sẵn. Em vui lòng dùng giọng thật của mình đọc trực tiếp nhé!"
- isComplete = false.

Output JSON:
{
  "isComplete": boolean,
  "missingContent": string (phần bị thiếu, rỗng nếu đọc đủ),
  "score": number (0.0 ~ 10.0),
  "cefrLevel": string,
  "criteriaScores": { "pronunciation": number, "stress": number, "intonation": number, "fluency": number, "connectedSpeech": number } (mỗi tiêu chí thang 10),
  "feedback": string,
  "ipaAnalysis": [ { "word": string, "correctIpa": string, "studentIpa": string, "tip": string } ],
  "standardSentences": string[],
  "personalizedExercises": string[],
  "strengths": string[],
  "improvements": string[]
}`;

  // Clean MIME type for Gemini API (strip codec info, keep base type)
  const cleanMimeType = mimeType.split(';')[0].trim() || "audio/webm";
  console.log(`[Speech Eval] Sending audio: mimeType=${cleanMimeType}, originalMime=${mimeType}, dataLength=${audioData.length}`);

  const response = await generateWithFallback(getTextModels(), {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: audioData.split(",")[1] || audioData,
              mimeType: cleanMimeType,
            },
          },
          {
            text: `Đây là đoạn văn bản gốc: "${originalText}". \n\nHãy so sánh với file âm thanh vừa cung cấp.`,
          },
        ],
      },
    ],
    config: { 
      systemInstruction,
      responseMimeType: "application/json",
      maxOutputTokens: 8192
    },
  });

  try {
    const result = parseSafeJson(response.text || "{}");
    
    // Enforce scoring formula: isComplete=true -> 7 base + 3 from criteria, isComplete=false -> 0
    let finalScore = 0;
    if (result.isComplete !== false) {
      if (result.criteriaScores && typeof result.criteriaScores === 'object') {
        const cs = result.criteriaScores;
        const p = Number(cs.pronunciation ?? 7);
        const s = Number(cs.stress ?? 7);
        const i = Number(cs.intonation ?? 7);
        const f = Number(cs.fluency ?? 7);
        const c = Number(cs.connectedSpeech ?? 7);
        
        // Calculate average of 5 criteria
        const avg = (p + s + i + f + c) / 5;
        finalScore = Math.round(avg * 10) / 10;
      } else {
        finalScore = Math.max(1.0, Math.min(10.0, result.score || 1.0));
        finalScore = Math.round(finalScore * 10) / 10;
      }
      finalScore = Math.max(0.0, Math.min(10.0, finalScore));
    }

    return {
      isComplete: result.isComplete ?? true,
      missingContent: result.missingContent || "",
      score: finalScore,
      cefrLevel: result.cefrLevel || "A1",
      criteriaScores: result.criteriaScores,
      feedback: result.feedback || "Không thể đánh giá.",
      ipaAnalysis: result.ipaAnalysis || [],
      standardSentences: result.standardSentences || [],
      personalizedExercises: result.personalizedExercises || [],
      strengths: result.strengths || [],
      improvements: result.improvements || []
    };
  } catch (err: any) {
    console.error("Speech Evaluation Error:", err);
    if (isQuotaError(err)) {
      throw new Error("QUOTA_EXCEEDED");
    }
    if (isAuthError(err)) {
      throw new Error("INVALID_KEY");
    }
    const msg = err?.message || String(err);
    // Propagate the original error message for easier debugging
    throw new Error(msg || "Failed to evaluate speech. Please try again.");
  }
};


export const generateExercise = async (
  readingText: string,
  level: EnglishLevel
): Promise<ExerciseData> => {
  const systemInstruction = `You are a highly skilled English pedagogical expert and school teacher. Create EXACTLY 30 written exercises based ON THE PROVIDED READING TEXT and general English knowledge appropriate for level ${level}.

The 30 questions MUST be divided into 4 types:
1. "fill_blank" (approx 8 questions): Điền từ thích hợp vào chỗ trống. Provide the sentence with a blank (e.g., "___"). Provide the suggested words to choose from in "suggestedWords" (e.g., "apple, banana, orange").
2. "rearrange" (approx 7 questions): Sắp xếp lại các từ thành câu hoàn chỉnh. Provide the scrambled words in "questionText" (e.g., "dog / the / barking / is").
3. "find_mistake" (approx 8 questions): Tìm lỗi sai và sửa chúng. Provide a sentence with one grammatical or vocabulary mistake in "questionText". 
4. "complete_sentence" (approx 7 questions): Hoàn thành câu sử dụng những từ đã cho. Provide a prompt or start of a sentence and some suggested words in "suggestedWords" (e.g., "if / rain / stay / home").

IMPORTANT RULES:
1. Ensure all questions and expected answers are grammatically correct and appropriate for the level.
2. Provide the "expectedAnswer" which is the correct final string the user should type.
3. Provide a brief, encouraging pedagogical "explanation" STRICTLY IN VIETNAMESE (e.g., "Câu này dùng thì hiện tại đơn vì diễn tả thói quen.").
4. All IDs must be unique strings (e.g., "wq1", "wq2", ..., "wq30").
5. The output must strictly match the JSON schema.
6. Do NOT use markdown bold (**) or asterisks in your output, just plain text or bracket notation if necessary.

Output strictly a JSON object matching this schema:
{
  "questions": [
    { 
      "id": "wq1", 
      "type": "fill_blank",
      "questionText": "I ___ a book every day.", 
      "suggestedWords": "read, reads, reading",
      "expectedAnswer": "read", 
      "explanation": "Chủ ngữ I đi với động từ nguyên thể." 
    },
    ... 30 items
  ]
}`;

  const response = await generateWithFallback(getTextModels(), {
    contents: [{ role: "user", parts: [{ text: `Reading Text: ${readingText}` }] }],
    config: { 
      systemInstruction,
      responseMimeType: "application/json",
      temperature: 0.2, // keep it deterministic
      maxOutputTokens: 8192
    },
  });

  try {
    const result = parseSafeJson(response.text || "{}");
    return result as ExerciseData;
  } catch (err: any) {
    console.error("Exercise Generation Error:", err);
    throw new Error("Failed to generate written exercises. Please try again.");
  }
};

export const evaluateSpeakingAnswer = async (
  questionText: string,
  expectedAnswer: string,
  audioData: string,
  level: EnglishLevel,
  mimeType: string = "audio/webm"
): Promise<{
  score: number;
  feedback: string;
  isCorrect: boolean;
  transcribedText: string;
}> => {
  const systemInstruction = `Bạn là Ms. Yến — giáo viên tiếng Anh, đóng vai giám khảo chấm điểm câu trả lời của học sinh.
Bạn nghe audio thu âm từ micro trình duyệt.

🎯 NHIỆM VỤ: Nghe audio → Ghi lại nguyên văn những gì nghe được (transcribedText) → So sánh với câu trả lời mẫu (expectedAnswer) → Đánh giá xem học sinh trả lời đúng hay sai ý của câu hỏi → Chấm điểm (thang 10) và đưa ra nhận xét.

Câu hỏi: "${questionText}"
Câu trả lời mong đợi (hoặc ý chính mong đợi): "${expectedAnswer}"

Output JSON:
{
  "isCorrect": boolean (true nếu học sinh trả lời đúng ý chính của câu hỏi, false nếu sai hoặc không liên quan),
  "score": number (0 đến 10, đánh giá dựa trên độ chính xác, phát âm, và ngữ pháp),
  "transcribedText": string (nguyên văn những gì học sinh nói, viết bằng tiếng Anh),
  "feedback": string (nhận xét bằng tiếng Việt, thân thiện, khen ngợi, chỉ ra lỗi sai nếu có)
}`;

  const cleanMimeType = mimeType.split(';')[0].trim() || "audio/webm";

  const response = await generateWithFallback(getTextModels(), {
    contents: [
      {
        role: "user",
        parts: [
          { text: 'Hãy nghe file audio bên dưới và đánh giá câu trả lời.' },
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: audioData.split(",")[1] || audioData,
            },
          },
        ],
      },
    ],
    config: { 
      systemInstruction,
      responseMimeType: "application/json",
    },
  });

  try {
    const result = parseSafeJson(response.text || "{}");
    return {
      isCorrect: result.isCorrect ?? false,
      score: result.score || 0,
      transcribedText: result.transcribedText || "",
      feedback: result.feedback || "Không thể nhận diện âm thanh."
    };
  } catch (err: any) {
    console.error("Speaking Answer Evaluation Error:", err);
    throw new Error("Failed to evaluate answer. Please try again.");
  }
};

export const evaluateComprehensionAnswer = async (
  apiKey: string,
  question: string,
  studentAnswer: string,
  suggestedAnswer: string
): Promise<{ isCorrect: boolean; feedback: string }> => {
  if (!apiKey) throw new Error("API key is required");
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return {
      isCorrect: false,
      feedback: "Cô không nghe rõ con nói gì. Con hãy thử đọc lại lớn và rõ ràng hơn nhé!"
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `You are an encouraging and professional English teacher (Ms. Yến) evaluating a young student's spoken answer to a reading comprehension question.

Question: "${question}"
Suggested Correct Answer: "${suggestedAnswer}"
Student's Spoken Answer (transcript): "${studentAnswer}"

Evaluate the student's answer. 
Is it conceptually correct based on the suggested answer? 
Keep in mind speech recognition might have minor typos, so evaluate the meaning and closeness to the correct answer.

Output your evaluation strictly in the following JSON format without any markdown blocks or extra text:
{
  "isCorrect": true/false,
  "feedback": "Your short, encouraging feedback in Vietnamese (max 2 sentences). If correct, praise them. If incorrect, explain gently what the correct idea is."
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    const parsed = parseSafeJson(text);
    return {
      isCorrect: !!parsed.isCorrect,
      feedback: parsed.feedback || (parsed.isCorrect ? "Câu trả lời của con rất chính xác! Khá lắm!" : "Câu trả lời chưa chính xác. Con hãy thử lại nhé!")
    };
  } catch (err: any) {
    console.error("Evaluate Comprehension Answer Error:", err);
    return {
      isCorrect: false,
      feedback: "Đã có lỗi xảy ra khi chấm bài. Con vui lòng thử lại nhé!"
    };
  }
};
