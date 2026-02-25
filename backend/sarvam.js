const fetch = require('node-fetch');
const { baseSystemPrompt } = require('./prompt');

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || "sk_4wguqvkh_dQLb5VzLUJSblWRlL4F0HGhw";
const SARVAM_MODEL_ID = process.env.SARVAM_MODEL_ID || "sarvam-m";

async function chatWithSarvam(messagesArray = [], pageContent = "", elements = {}, url = "", title = "") {
    const apiUrl = "https://api.sarvam.ai/v1/chat/completions";



    const apiMessages = [];

    // Copy the messages over
    for (let i = 0; i < messagesArray.length; i++) {
        apiMessages.push({ ...messagesArray[i] });
    }

    if (apiMessages.length === 0) {
        apiMessages.push({ role: "user", content: "No explicit goal provided." });
    }

    // 1. Inject base instructions into the very first message
    if (apiMessages[0].role === "user") {
        apiMessages[0].content = `${baseSystemPrompt}\n\nUSER GOAL (History):\n${apiMessages[0].content}`;
    }

    // 2. Inject current DOM into the MOST RECENT user message, avoiding stale context
    let lastUserMessage = null;
    for (let i = apiMessages.length - 1; i >= 0; i--) {
        if (apiMessages[i].role === "user") {
            lastUserMessage = apiMessages[i];
            break;
        }
    }

    if (lastUserMessage) {
        lastUserMessage.content = `[CURRENT BROWSER CONTEXT]
URL: ${url}
TITLE: ${title}

(Note: The user's query might be completely independent of this page. Only use this context if the user's latest command refers to the page or requires browser automation.)

WEBPAGE CONTENT:
${pageContent ? pageContent.substring(0, 2000) : "No context provided"}

AVAILABLE INTERACTABLE ELEMENTS (map of unique IDs to elements):
${JSON.stringify(elements)}
[END CONTEXT]

LATEST COMMAND:
${lastUserMessage.content}`;
    }

    // Clean up consecutive roles: Sarvam requires strictly alternating user -> assistant -> user
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

    const payload = {
        model: SARVAM_MODEL_ID,
        messages: cleanedMessages,
        temperature: 0.1, // Even lower temp for strict JSON
        top_p: 1
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                "api-subscription-key": SARVAM_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Sarvam API HTTP Error:", errText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errText}`);
        }

        const data = await response.json();
        let content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;

        console.log("----------------------");
        console.log("raw content from sarvam:", content);
        console.log("----------------------");

        if (!content || content.trim() === "") {
            console.log("Sarvam API returned empty content.");
            return { action: "ANSWER", text: "I'm having trouble understanding right now. Please try again or provide more details." };
        }

        // Clean up JSON markup if present
        content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

        // One last check before parsing
        if (!content.startsWith('{')) {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                content = match[0];
            }
        }

        return JSON.parse(content);

    } catch (error) {
        console.error("Sarvam API Error:", error);
        return { action: "ANSWER", text: "1e may be incorrect. Please verify important information." };
    }
}

module.exports = { chatWithSarvam };
