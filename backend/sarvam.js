const fetch = require('node-fetch');

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || "sk_4wguqvkh_dQLb5VzLUJSblWRlL4F0HGhw";
const SARVAM_MODEL_ID = process.env.SARVAM_MODEL_ID || "sarvam-m";

async function chatWithSarvam(userQuery, pageContent, elements = {}) {
    const url = "https://api.sarvam.ai/v1/chat/completions";

    const prompt = `You are a browser assistant agent. Your ONLY job is to help the user interact with the current webpage.

You are given:
USER GOAL:
${userQuery}

WEBPAGE CONTENT:
${pageContent ? pageContent.substring(0, 2000) : "No context provided"}

AVAILABLE ELEMENTS:
${JSON.stringify(elements)}

You MUST respond ONLY in valid JSON format. Do not include any conversational text outside the JSON block.

AVAILABLE ACTIONS:
CLICK     - To click a button or link
SCROLL    - To scroll the page
TYPE      - To input text into a field
NAVIGATE  - To go to a URL
ANSWER    - To respond conversationally to the user

EXAMPLES:
{"action":"CLICK","target":"Login"}
{"action":"SCROLL","direction":"DOWN"}
{"action":"TYPE","target":"Search","text":"Rice price"}
{"action":"NAVIGATE","url":"https://example.com"}
{"action":"ANSWER","text":"This page shows rice prices"}

Respond in valid JSON only:`;

    const payload = {
        model: SARVAM_MODEL_ID,
        // Using "user" role instead of "system" because some models handle instructions better as a user prompt
        messages: [
            { role: "user", content: prompt }
        ],
        temperature: 0.2, // Lower temp for more deterministic JSON
        top_p: 1
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                "api-subscription-key": SARVAM_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errText}`);
        }

        const data = await response.json();
        let content = data.choices[0].message.content;

        if (!content || content.trim() === "") {
            console.log("Sarvam API returned empty content. Reprompting or returning default answer.");
            return { action: "ANSWER", text: "I'm having trouble understanding right now. Please try again." };
        }

        // Clean up JSON markup if present
        content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

        // One last check before parsing
        if (!content.startsWith('{')) {
            // Model hallucinated some text before the JSON
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                content = match[0];
            }
        }

        return JSON.parse(content);

    } catch (error) {
        console.error("Sarvam API Error:", error);
        return { action: "ANSWER", text: "Galixent may be incorrect. Please verify important information." };
    }
}

module.exports = { chatWithSarvam };
