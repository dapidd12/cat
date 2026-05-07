import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export type AIModelType = 'gemini' | 'deepseek' | 'claude' | 'kimi' | 'qwen';

export async function parseQuestions(
  questionsText: string, 
  answerKeyText: string = "",
  modelType: AIModelType = "gemini",
  apiKey: string = ""
): Promise<Question[]> {
  
  const systemPrompt = `Parse the following extracted document text, and find ONLY the multiple-choice questions (soal pilihan ganda). Ignore any essay, fill-in-the-blank, or irrelevant text. Match the extracted questions with the provided answer key text (if any).
    
Create a structured JSON output representing the multiple-choice questions. 
For each multiple choice question:
- Extract the question text.
- Extract all the options as an array of strings.
- Identify the index of the correct answer (0-based) in the options array. If an answer key is provided, follow it strictly. If not, logically deduce the correct answer.
- Provide a clear, brief explanation for why the answer is correct.

Output ONLY a raw, pure JSON Array representing the questions. Ensure it follows this exact schema, and DO NOT wrap it in markdown block quotes like \`\`\`json. Output JUST the JSON array:
[
  {
    "text": "The text of the question.",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 0,
    "explanation": "A detailed explanation of why the answer is correct."
  }
]`;

  const userPrompt = `Questions Text:\n${questionsText}\n\nAnswer Key Text:\n${answerKeyText || "None provided."}`;

  let textOutput = "";

  if (modelType === 'gemini') {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("API Key Gemini tidak ditemukan.");
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "The text of the question." },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of possible options." },
              correctAnswerIndex: { type: Type.INTEGER, description: "The 0-based index of the correct option in the options array." },
              explanation: { type: Type.STRING, description: "A detailed explanation of why the answer is correct." }
            },
            required: ["text", "options", "correctAnswerIndex", "explanation"]
          }
        }
      }
    });
    textOutput = response.text || "";
  } else {
    // Other completely OpenAI compatible or Anthropic proxy-like
    if (!apiKey) throw new Error(`API Key untuk model ${modelType} diperlukan.`);
    
    let endpoint = "";
    let modelName = "";
    
    if (modelType === 'deepseek') {
        endpoint = "https://api.deepseek.com/chat/completions";
        modelName = "deepseek-chat";
    } else if (modelType === 'kimi') {
        endpoint = "https://api.moonshot.cn/v1/chat/completions";
        modelName = "moonshot-v1-8k";
    } else if (modelType === 'qwen') {
        endpoint = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
        modelName = "qwen-plus"; // or qwen-max
    } else if (modelType === 'claude') {
        // Claude might block CORS from browser unless we use anthropic sdk or proxy, but we will try generic open-router style or attempt standard fetch. Wait, Anthropic endpoint is api.anthropic.com/v1/messages, but to keep it simple and handle CORS we might need openrouter or similar.
        // Assuming we are just using a compatible API proxy for testing, or we throw if CORS issues happen. 
        // Note: Direct Anthropic API over fetch from front-end is blocked by CORS. We'll set it here but notify user.
        throw new Error("Claude tidak didukung langsung via browser (CORS limitation). Gunakan Gemini atau model OpenAI-compatible lainnya.");
    }
    
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: modelName,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" } // Deepseek supports this, Qwen/Kimi might, but system prompt forces JSON.
        })
    });
    
    if (!res.ok) {
        const errData = await res.text();
        throw new Error(`API Error (${res.status}): ${errData}`);
    }
    
    const data = await res.json();
    textOutput = data.choices[0]?.message?.content || "";
  }

  if (!textOutput) {
    throw new Error("Tidak ada hasil yang digenerate oleh AI.");
  }

  // clean up potential markdown formatting
  let cleanJsonString = textOutput.replace(/^\`\`\`json/m, '').replace(/^\`\`\`/m, '').trim();
  if (cleanJsonString.endsWith('```')) {
      cleanJsonString = cleanJsonString.slice(0, -3).trim();
  }

  try {
    const parsed = JSON.parse(cleanJsonString);
    if (!Array.isArray(parsed)) {
       // if they wrapped in { "questions": [...] }
       if (parsed.questions && Array.isArray(parsed.questions)) {
           return parsed.questions.map((item: any, index: number) => ({
              id: `q-${index}-${Date.now()}`,
              text: item.text,
              options: item.options,
              correctAnswerIndex: item.correctAnswerIndex,
              explanation: item.explanation
            }));
       }
       throw new Error("Output bukan array JSON.");
    }
    return parsed.map((item: any, index: number) => ({
      id: `q-${index}-${Date.now()}`,
      text: item.text,
      options: item.options,
      correctAnswerIndex: item.correctAnswerIndex,
      explanation: item.explanation
    }));
  } catch (e) {
     console.error("Failed to parse JSON:", textOutput);
     throw new Error("Gagal mengurai output JSON dari AI.");
  }
}

