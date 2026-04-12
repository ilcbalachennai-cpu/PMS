import { GoogleGenAI } from "@google/genai";

export const getPayrollAdvice = async (query: string) => {
  const apiKey = (process.env.API_KEY || "").trim();
  
  if (!apiKey || apiKey === "undefined") {
    console.error("AI Assistant Error: GEMINI_API_KEY is not defined in the environment.");
    return "API Configuration Error: My license for the compliance engine is missing or not configured correctly in .env.local. Please check your system settings.";
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
  } catch (error) {
    console.error("AI Assistant Error:", error);
    return "I'm having trouble connecting to my compliance database right now. Please check your internet connection and try again.";
  }
};
