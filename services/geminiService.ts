
import { GoogleGenAI } from "@google/genai";

// Initialize the GoogleGenAI client using the API key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getPayrollAdvice = async (query: string) => {
  try {
    // Fix: Using gemini-3-pro-preview as labor law compliance queries are complex text tasks
    // requiring advanced reasoning and knowledge.
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: query,
      config: {
        systemInstruction: "You are an Indian Payroll Compliance Expert. Answer questions specifically related to Indian Labor Laws (EPF, ESI, Gratuity, Bonus, Income Tax). Keep it professional, concise, and structured.",
      }
    });
    
    // Correct way to extract text output from the GenerateContentResponse object is the .text property
    return response.text;
  } catch (error) {
    console.error("AI Assistant Error:", error);
    return "I'm having trouble connecting to my compliance database right now. Please try again.";
  }
};
