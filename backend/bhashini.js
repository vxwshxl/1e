const fetch = require('node-fetch');

const BHASHINI_ENDPOINT = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";
const BHASHINI_KEY = process.env.BHASHINI_SUBSCRIPTION_KEY || "KbA_dh-JvZvKpjo152OjtWmHPGindblWZNX-Usvx0SxqP0l0pzGgWoWcRwQ-WuoE";

async function translateToAssamese(text) {
    if (!text) return null;

    // Truncate to avoid exceeding payload limits
    const safeText = text.substring(0, 8000);

    const payload = {
        pipelineTasks: [
            {
                taskType: "translation",
                config: {
                    language: {
                        sourceLanguage: "en",
                        targetLanguage: "as"
                    }
                }
            }
        ],
        inputData: {
            input: [
                {
                    source: safeText
                }
            ]
        }
    };

    try {
        const response = await fetch(BHASHINI_ENDPOINT, {
            method: 'POST',
            headers: {
                "Authorization": BHASHINI_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Safely extract translation target
        const translatedText = data.pipelineResponse[0].output[0].target;
        return translatedText;

    } catch (error) {
        console.error("Bhashini API Error:", error);
        return null;
    }
}

module.exports = { translateToAssamese };
