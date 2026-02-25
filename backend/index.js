require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { chatWithSarvam } = require('./sarvam');
const { translateToAssamese } = require('./bhashini');

const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

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
    try {
        const { user_query, page_content, elements } = req.body;

        if (!user_query) {
            return res.status(400).json({ error: "user_query is required" });
        }

        const result = await chatWithSarvam(user_query, page_content, elements);

        // Ensure response format
        res.json({
            action: result.action || "ANSWER",
            target: result.target,
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
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: "text is required" });
        }

        let translatedText = await translateToAssamese(text);

        if (!translatedText) {
            translatedText = "Translation failed. Galixent may be incorrect. Please verify important information.";
        }

        res.json({ translated_text: translatedText });

    } catch (error) {
        console.error("Translate endpoint error:", error);
        res.status(500).json({
            translated_text: "Translation failed. Galixent may be incorrect. Please verify important information."
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Galixent backend listening at http://localhost:${port}`);
});
