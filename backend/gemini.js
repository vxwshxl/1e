const { GoogleGenAI } = require('@google/genai');
const { baseSystemPrompt } = require('./prompt');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBNWsI20kwS64RoJ1FMkNRR9AF7sDbOm9Q";
const GEMINI_MODEL_ID = process.env.GEMINI_MODEL_ID || "gemini-flash-latest";
const GEMINI_TEMPERATURE = parseFloat(process.env.GEMINI_TEMPERATURE || "1");
const GEMINI_TOP_P = parseFloat(process.env.GEMINI_TOP_P || "0.95");
const GEMINI_TOP_K = parseInt(process.env.GEMINI_TOP_K || "64", 10);

const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
});

async function chatWithGemini(messagesArray = [], pageContent = "", elements = {}, url = "", title = "") {


    const apiMessages = [];

    // Copy the messages over
    for (let i = 0; i < messagesArray.length; i++) {
        apiMessages.push({ ...messagesArray[i] });
    }

    if (apiMessages.length === 0) {
        apiMessages.push({ role: "user", content: "No explicit goal provided." });
    }

    // Inject current DOM into the MOST RECENT user message, avoiding stale context
    let lastUserMessage = null;
    for (let i = apiMessages.length - 1; i >= 0; i--) {
        if (apiMessages[i].role === "user") {
            lastUserMessage = apiMessages[i];
            break;
        }
    }

    if (lastUserMessage) {
        lastUserMessage.content = `[BROWSER STATE START] (IGNORE THIS if the user's COMMAND is a general question or search query. Only use this if they refer to "this page" or need browser automation)
URL: ${url}
TITLE: ${title}

CONTENT:
${pageContent ? pageContent.substring(0, 2000) : "No context provided"}

ELEMENTS:
${JSON.stringify(elements)}
[BROWSER STATE END]

COMMAND: ${lastUserMessage.content}

CRITICAL INSTRUCTION: If the COMMAND above is a general knowledge question (e.g. "who is [NAME]", "what is [THING]"), you MUST ignore the BROWSER STATE completely and use your Google Search capabilities to find the answer. Output a JSON ANSWER.`;
    }

    // Clean up consecutive roles: Gemini also prefers stricter role alternation or at least no consecutive same roles
    const cleanedMessages = [];
    if (apiMessages.length > 0) {
        cleanedMessages.push(apiMessages[0]);
        for (let i = 1; i < apiMessages.length; i++) {
            const currentRole = apiMessages[i].role;
            const prevRole = cleanedMessages[cleanedMessages.length - 1].role;

            if (currentRole === prevRole) {
                // Merge consecutive messages of the same role
                cleanedMessages[cleanedMessages.length - 1].content += `\n${apiMessages[i].content}`;
            } else {
                cleanedMessages.push(apiMessages[i]);
            }
        }
    }

    const contents = cleanedMessages.map(msg => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
    }));

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: contents,
            config: {
                systemInstruction: {
                    parts: [{ text: baseSystemPrompt }]
                },
                temperature: GEMINI_TEMPERATURE,
                topP: GEMINI_TOP_P,
                topK: GEMINI_TOP_K,
                responseMimeType: "application/json",
                tools: [{ googleSearch: {} }],
            }
        });

        let content = response.text;

        console.log("----------------------");
        console.log("raw content from gemini:", content);
        console.log("----------------------");

        if (!content || content.trim() === "") {
            console.log("Gemini API returned empty content.");
            return { action: "ANSWER", text: "I'm having trouble understanding right now. Please try again or provide more details." };
        }

        content = content.trim();

        // Check if the response is JSON markup
        if (content.startsWith('\`\`\`json')) {
            content = content.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
        }

        return JSON.parse(content);

    } catch (error) {
        console.error("Gemini API Error:", error);
        return { action: "ANSWER", text: "1e may be incorrect. Please verify important information." };
    }
}

module.exports = { chatWithGemini };
