
import { GoogleGenAI } from "@google/genai";
import { DailyRecord, AppConfig } from "../types";
import { getAggregatedValues } from "../utils";

export const analyzeQualityData = async (
  data: DailyRecord[],
  config: AppConfig
): Promise<string> => {
  try {
    // Create a new GoogleGenAI instance right before the API call to ensure it uses the latest process.env.API_KEY.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const monthData = data.filter(d => {
        return d.dateStr.includes(`${config.year}`) && (
            d.dateStr.includes(`/${config.month}/`) || 
            d.dateStr.includes(`/${config.month.toString().padStart(2, '0')}/`)
        );
    });

    if (monthData.length === 0) {
       return "داده‌ای برای این ماه موجود نیست.";
    }

    const prompt = `
        Analyze the following CCS (Cold Crushing Strength) quality data for month ${config.month} of year ${config.year}.
        
        Configuration:
        - Standard Range: ${config.minRange} - ${config.maxRange}
        - Custom Range: ${config.customMinRange} - ${config.customMaxRange}

        Data Summary:
        ${monthData.map(d => {
            const vals = getAggregatedValues(d, 'daily');
            return `Day ${d.day}: ${vals[0] ? vals[0] : 'No Data'}`;
        }).join('\n')}

        Please provide response in Persian (Farsi):
        1. A summary of the quality trends.
        2. Identification of any problematic days (Low/High CCS).
        3. Recommendations for process improvement based on the data.
    `;

    // Use gemini-3-pro-preview for complex text tasks such as reasoning over quality data and providing recommendations.
    const response = await ai.models.generateContent({
       model: 'gemini-3-pro-preview',
       contents: prompt,
    });

    // Access the text property directly from the response object.
    return response.text || "تحلیلی تولید نشد.";

  } catch (error) {
    console.error("Gemini Error:", error);
    return "خطا در تحلیل هوشمند: " + (error instanceof Error ? error.message : String(error));
  }
};
