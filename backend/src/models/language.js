// backend/src/models/language.js
// Language code → system prompt instruction map.
// Separated from chat logic so it's easy to add new languages.

export const LANG_INSTRUCTIONS = {
  en: '',
  hi: 'IMPORTANT: You MUST respond entirely in Hindi (हिन्दी). Do not use English.',
  ta: 'IMPORTANT: You MUST respond entirely in Tamil (தமிழ்). Do not use English.',
  te: 'IMPORTANT: You MUST respond entirely in Telugu (తెలుగు). Do not use English.',
  kn: 'IMPORTANT: You MUST respond entirely in Kannada (ಕನ್ನಡ). Do not use English.',
  mr: 'IMPORTANT: You MUST respond entirely in Marathi (मराठी). Do not use English.',
  bn: 'IMPORTANT: You MUST respond entirely in Bengali (বাংলা). Do not use English.',
  gu: 'IMPORTANT: You MUST respond entirely in Gujarati (ગુજરાતી). Do not use English.',
  pa: 'IMPORTANT: You MUST respond entirely in Punjabi (ਪੰਜਾਬੀ). Do not use English.',
  zh: 'IMPORTANT: You MUST respond entirely in Chinese (中文). Do not use English.',
  ja: 'IMPORTANT: You MUST respond entirely in Japanese (日本語). Do not use English.',
  ko: 'IMPORTANT: You MUST respond entirely in Korean (한국어). Do not use English.',
  es: 'IMPORTANT: You MUST respond entirely in Spanish (Español). Do not use English.',
  fr: 'IMPORTANT: You MUST respond entirely in French (Français). Do not use English.',
  de: 'IMPORTANT: You MUST respond entirely in German (Deutsch). Do not use English.',
  ar: 'IMPORTANT: You MUST respond entirely in Arabic (العربية). Do not use English.',
};

export function getLangInstruction(code) {
  return LANG_INSTRUCTIONS[code] || '';
}
