import { GoogleGenAI } from "@google/genai";

let cachedApiKey: string = '';

export const getGeminiApiKey = async (): Promise<string> => {
  if (cachedApiKey) return cachedApiKey;

  const LEGACY_REVOKED_KEY = 'AIzaSyAlSNRg4JUclqEPUZAOnM3Lgz749paKofM';

  // 1. Try SQLite Global Store (shared across all users on this installation)
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.dbGetGlobal) {
      const res = await (window as any).electronAPI.dbGetGlobal('app_gemini_api_key');
      if (res?.data && typeof res.data === 'string' && res.data.trim() && res.data.trim() !== LEGACY_REVOKED_KEY) {
        cachedApiKey = res.data.trim();
        try { localStorage.setItem('bpp_gemini_api_key', cachedApiKey); } catch (_) {}
        return cachedApiKey;
      }
    }
  } catch (_) {}

  // 2. Try localStorage (current app instance)
  try {
    const local = localStorage.getItem('bpp_gemini_api_key');
    if (local && local.trim() && local.trim() !== LEGACY_REVOKED_KEY) {
      cachedApiKey = local.trim();
      if ((window as any).electronAPI?.dbSetGlobal) {
        (window as any).electronAPI.dbSetGlobal('app_gemini_api_key', cachedApiKey).catch(() => {});
      }
      return cachedApiKey;
    }
  } catch (_) {}

  // 3. Fallback to bundled environment variable (from .env.local at build time)
  const envKey = (process.env.API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (envKey && envKey !== 'undefined' && envKey !== LEGACY_REVOKED_KEY) {
    cachedApiKey = envKey;
    return cachedApiKey;
  }

  return "";
};

export const setGeminiApiKey = async (key: string): Promise<void> => {
  const trimmed = key.trim();
  cachedApiKey = trimmed;

  try {
    if (trimmed) {
      localStorage.setItem('bpp_gemini_api_key', trimmed);
    } else {
      localStorage.removeItem('bpp_gemini_api_key');
    }
  } catch (_) {}

  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.dbSetGlobal) {
      await (window as any).electronAPI.dbSetGlobal('app_gemini_api_key', trimmed);
    }
  } catch (_) {}
};

export const getPayrollAdvice = async (query: string) => {
  const apiKey = await getGeminiApiKey();
  
  if (!apiKey || apiKey === "undefined") {
    console.error("AI Assistant Error: GEMINI_API_KEY is not defined in the environment or settings.");
    return "API Configuration Error: Gemini API key is missing. Please click the 'API Key' button at the top right to configure your Google Gemini API key.";
  }

  // Initialize the GoogleGenAI client right before making an API call
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: query,
      config: {
        systemInstruction: "You are an Indian Payroll Compliance Expert. Answer questions specifically related to Indian Labor Laws (EPF, ESI, Gratuity, Bonus, Income Tax). Keep it professional, concise, and structured.",
      }
    });
    
    // Check if response has text and return it
    if (response && response.text) {
      return response.text;
    }
    
    return "I received an empty response from the compliance database. Please try rephrasing your question.";
  } catch (error: any) {
    console.error("AI Assistant Error:", error);
    const errorStr = String(error?.message || (typeof error === 'object' ? JSON.stringify(error) : error));
    
    if (errorStr.includes('leaked') || errorStr.includes('PERMISSION_DENIED') || errorStr.includes('403')) {
      return "⚠️ Google Gemini Error: The configured API key was revoked by Google because it was reported as leaked. Please click the 'API Key' button at the top right to configure a fresh, valid Gemini API key from Google AI Studio.";
    }
    
    if (errorStr.includes('API_KEY_INVALID') || errorStr.includes('invalid') || errorStr.includes('API key not valid')) {
      return "⚠️ Google Gemini Error: The configured API key is invalid. Please verify and re-enter your API key.";
    }
    
    if (errorStr.includes('RESOURCE_EXHAUSTED') || errorStr.includes('429') || errorStr.includes('quota')) {
      return "⏳ Google Gemini Notice: Daily quota or rate limit reached. Please try again in a few moments.";
    }

    return "I'm having trouble connecting to my compliance database right now. Please check your internet connection or verify your Gemini API key.";
  }
};

