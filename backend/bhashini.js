const fetch = require('node-fetch');

const BHASHINI_ENDPOINT = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";
const BHASHINI_KEY = process.env.BHASHINI_SUBSCRIPTION_KEY || "KbA_dh-JvZvKpjo152OjtWmHPGindblWZNX-Usvx0SxqP0l0pzGgWoWcRwQ-WuoE";

async function translateTexts(textsArray, targetLang = 'as') {
    if (!textsArray || !Array.isArray(textsArray) || textsArray.length === 0) return [];

    const translatedTexts = [];
    const BATCH_SIZE = 50; // max inputs per API call to avoid 413 Payload Too Large

    for (let i = 0; i < textsArray.length; i += BATCH_SIZE) {
        const batch = textsArray.slice(i, i + BATCH_SIZE);

        const payloadInputs = batch.map(text => ({ source: text }));

        const payload = {
            pipelineTasks: [
                {
                    taskType: "translation",
                    config: {
                        language: {
                            sourceLanguage: "en",
                            targetLanguage: targetLang
                        }
                    }
                }
            ],
            inputData: {
                input: payloadInputs
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
                const errText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} msg: ${errText}`);
            }

            const data = await response.json();

            if (data.pipelineResponse && data.pipelineResponse[0] && data.pipelineResponse[0].output) {
                const outputs = data.pipelineResponse[0].output;
                outputs.forEach(outItem => {
                    translatedTexts.push(outItem.target);
                });
            } else {
                throw new Error("Invalid response missing output array");
            }

        } catch (error) {
            console.error("Bhashini API Error:", error);
            // Fallback: if a batch fails, push original texts to keep array alignment
            batch.forEach(text => translatedTexts.push(text));
        }
    }

    return translatedTexts;
}

module.exports = { translateTexts };
