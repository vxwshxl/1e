require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { chatWithSarvam } = require('./sarvam');
const { translateTexts } = require('./bhashini');

const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.get('/', (req, res) => {
    res.json({
        message: "Welcome to Galixent API!",
        status: "online",
        endpoints: {
            chat: "POST /chat",
            translate: "POST /translate"
        }
    });
});

app.post('/chat', async (req, res) => {
    console.log("RECEIVED /chat request:", Date.now());
    console.log("Payload messages length:", req.body.messages ? req.body.messages.length : 0);
    try {
        // We now expect an array of messages representing conversation history
        const { messages, page_content, elements, url, title } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: "messages array is required" });
        }

        const result = await chatWithSarvam(messages, page_content, elements, url, title);

        // Ensure response format
        res.json({
            action: result.action || "ANSWER",
            elementId: result.elementId,
            direction: result.direction,
            text: result.text,
            url: result.url
        });

    } catch (error) {
        console.error("Chat endpoint error:", error);
        res.status(500).json({
            action: "ANSWER",
            text: "Galixent may be incorrect. Please verify important information."
        });
    }
});

app.post('/translate', async (req, res) => {
    try {
        const { texts, targetLanguage } = req.body;

        if (!texts || !Array.isArray(texts)) {
            return res.status(400).json({ error: "texts array is required" });
        }

        let translatedTexts = await translateTexts(texts, targetLanguage || 'as');

        if (!translatedTexts || translatedTexts.length === 0) {
            throw new Error("Translation failed");
        }

        res.json({ translated_texts: translatedTexts });

    } catch (error) {
        console.error("Translate endpoint error:", error);
        res.status(500).json({
            error: "Translation failed. Galixent may be incorrect. Please verify important information."
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Galixent backend listening at http://localhost:${port}`);
});
