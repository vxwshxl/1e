const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBNWsI20kwS64RoJ1FMkNRR9AF7sDbOm9Q";
const GEMINI_MODEL_ID = process.env.GEMINI_MODEL_ID || "gemini-flash-latest";
const GEMINI_TEMPERATURE = parseFloat(process.env.GEMINI_TEMPERATURE || "1");
const GEMINI_TOP_P = parseFloat(process.env.GEMINI_TOP_P || "0.95");
const GEMINI_TOP_K = parseInt(process.env.GEMINI_TOP_K || "64", 10);

const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
});

async function chatWithGemini(messagesArray = [], pageContent = "", elements = {}, url = "", title = "") {
    const baseSystemPrompt = `You are an intelligent, 1e AI assistant. You can perform actions on the user's current webpage AND answer general knowledge questions.

You MUST respond ONLY in valid JSON format!

AVAILABLE ACTIONS:
CLICK     - To click a button or link. Requires 'elementId'.
SCROLL    - To scroll the page. Requires 'direction' ("UP" or "DOWN").
TYPE      - To input text. Requires 'elementId' and 'text'.
NAVIGATE  - To go to a URL dynamically. Requires 'url'.
TRANSLATE - To translate the page content. Requires 'language' code (e.g., 'as' for Assamese, 'bn' for Bengali, 'brx' for Bodo, 'hi' for Hindi, 'en' for English).
ANSWER    - To talk to the user, answer general questions, provide information, or report task completion/errors.

CRITICAL RULES:
1. When you need to interact with the DOM (CLICK or TYPE), you MUST USE the 'elementId' provided in the CURRENT BROWSER CONTEXT! Do not use fuzzy text targeting.
2. GENERAL QUESTIONS: If the user asks a general question or wants to search for something (e.g., "who is veeshal d bodosa", "what is Y", "write a poem"), you MUST reply directly using the ANSWER action. You MUST use your built-in Google Search tool to find the answer if you don't know it! ABSOLUTELY DO NOT assume they are asking about the current webpage unless they explicitly refer to it (e.g., "summarize this page", "what does this [word on page] mean").
3. If you need user input (like an OTP) or confirmation, return '{"action":"ANSWER", "text":"..."}'.
4. Do NOT make up OTPs or user details if you don't know them. Ask via ANSWER.
5. Execute only one action per turn.
6. When translating, automatically use the 2-letter or 3-letter language code based on the user's request.
7. To continue a multi-step browser workflow, output the next action like CLICK or SCROLL. Do not output ANSWER until the workflow represents completion or an error.
8. If the user commands you to go to a website in ANY language (e.g. Hindi, Bengali), or if you suggest a URL and the user agrees (e.g. "Yes here"), you MUST issue a NAVIGATE action to that URL! Do NOT answer saying you are navigating. Just output the JSON NAVIGATE action.
9. Do not provide legal or medical advice through the assistant—always redirect to official sources.

EXAMPLES:
{"action":"CLICK","elementId":15}
{"action":"SCROLL","direction":"DOWN"}
{"action":"TYPE","elementId":12,"text":"Search query"}
{"action":"NAVIGATE","url":"https://example.com"}
{"action":"TRANSLATE","language":"as"}
{"action":"ANSWER","text":"Your answer goes here..."}

Respond in valid JSON only:`;

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
