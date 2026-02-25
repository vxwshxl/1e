const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const translateBtn = document.getElementById('translate-btn');

// Replace this with your actual local backend URL during testing
const BACKEND_URL = 'http://127.0.0.1:8000';

// Resize textarea dynamically
chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Handle enter key
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);
clearBtn.addEventListener('click', () => {
    // Keep welcome screen if needed, or just clear messages
    const welcomeScreen = document.querySelector('.welcome-screen');
    chatContainer.innerHTML = '';
    if (welcomeScreen) {
        chatContainer.appendChild(welcomeScreen);
    }
});

translateBtn.addEventListener('click', async () => {
    translateBtn.style.opacity = '0.5';
    try {
        const text = await getPageText();
        addMessage("Translating page to Assamese using Bhashini...", "ai");

        const response = await fetch(`${BACKEND_URL}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        const data = await response.json();
        if (data.translated_text) {
            addMessage("Translation complete. Updating the page...", "ai");
            replacePageText(data.translated_text);
        } else {
            throw new Error("Missing translated text");
        }
    } catch (error) {
        addMessage("Translation failed. Galixent may be incorrect. Please verify important information.", "ai", true);
        console.error(error);
    } finally {
        translateBtn.style.opacity = '1';
    }
});

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Remove welcome screen on first message
    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) welcomeScreen.remove();

    addMessage(text, 'user');

    // Add loading indicator
    const typingId = 'typing-' + Date.now();
    addTypingIndicator(typingId);

    try {
        // 1. Extract context from current tab
        const context = await getPageContext();

        // 2. Send to backend
        const response = await fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_query: text,
                page_content: context.page_content,
                elements: context.elements
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();

        removeElement(typingId);

        // Provide the result to the user or execute command
        if (data.action && data.action !== "ANSWER") {
            addMessage(`Executing command: ${data.action} ${data.target ? `on "${data.target}"` : ''}`, 'ai');
            executeCommandInPage(data);
        } else if (data.action === "ANSWER" && data.text) {
            addMessage(data.text, 'ai');
        } else if (data.text) { // fallback
            addMessage(data.text, 'ai');
        } else {
            addMessage("Task completed.", 'ai');
        }

    } catch (error) {
        console.error('Chat error:', error);
        removeElement(typingId);
        addMessage("Galixent may be incorrect. Please verify important information.", 'ai', true);
    }
}

function addMessage(text, sender, isError = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}-message`;

    if (isError) {
        msgDiv.innerHTML = `<div class="error-msg">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ${text}
        </div>`;
    } else {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'msg-content';
        contentDiv.innerText = text; // simple text formatting
        msgDiv.appendChild(contentDiv);
    }

    chatContainer.appendChild(msgDiv);
    scrollToBottom();
}

function addTypingIndicator(id) {
    const div = document.createElement('div');
    div.id = id;
    div.className = 'message ai-message typing-indicator';
    div.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatContainer.appendChild(div);
    scrollToBottom();
}

function removeElement(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function scrollToBottom() {
    const mainContent = document.querySelector('.main-content');
    mainContent.scrollTop = mainContent.scrollHeight;
}

// Extension APIs
async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

async function getPageContext() {
    const tab = await getActiveTab();
    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return { page_content: "Browser internal page - content access restricted.", elements: {} };
    }

    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_CONTEXT" }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn(chrome.runtime.lastError.message);
                resolve({ page_content: "Script injection pending or blocked.", elements: {} });
            } else {
                resolve(response || { page_content: "", elements: {} });
            }
        });
    });
}

async function getPageText() {
    const tab = await getActiveTab();
    if (!tab) return "";

    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_TEXT" }, (response) => {
            if (chrome.runtime.lastError) {
                resolve("");
            } else {
                resolve(response.text || "");
            }
        });
    });
}

async function executeCommandInPage(command) {
    const tab = await getActiveTab();
    if (!tab) return;

    chrome.tabs.sendMessage(tab.id, {
        type: "EXECUTE_COMMAND",
        command: command
    });
}

async function replacePageText(translatedText) {
    const tab = await getActiveTab();
    if (!tab) return;

    chrome.tabs.sendMessage(tab.id, {
        type: "TRANSLATE_PAGE",
        translatedText: translatedText
    });
}
