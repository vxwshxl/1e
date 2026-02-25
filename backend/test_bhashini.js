const fetch = require('node-fetch');
const BHASHINI_ENDPOINT = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";
const BHASHINI_KEY = "KbA_dh-JvZvKpjo152OjtWmHPGindblWZNX-Usvx0SxqP0l0pzGgWoWcRwQ-WuoE";

async function test() {
    const payload = {
        pipelineTasks: [{
            taskType: "translation",
            config: { language: { sourceLanguage: "en", targetLanguage: "as" } }
        }],
        inputData: {
            input: [
                { source: "Hello world" },
                { source: "This is a test" }
            ]
        }
    };
    const res = await fetch(BHASHINI_ENDPOINT, {
        method: 'POST',
        headers: { "Authorization": BHASHINI_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}
test();
