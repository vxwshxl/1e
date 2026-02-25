const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const translateLang = document.getElementById('translate-lang');

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
const welcomeScreenHTML = `
                <div class="welcome-screen">
                    <div class="welcome-icon">
                        <img src="1e.png" alt="1e Logo" width="48" height="48" style="border-radius: 8px;">
                    </div>
                    <h2>Welcome to 1e Assistant</h2>
                    <p>Designed for Pure Intelligence.</p>
                    <p class="subtitle">I can read the page, answer questions, translate, and perform browser actions.
                    </p>
                </div>
`;

clearBtn.addEventListener('click', () => {
    chatContainer.innerHTML = welcomeScreenHTML;
    // RESET AGENT STATE
    chatHistory = [];
    isAgentRunning = false;
});

translateLang.addEventListener('change', async (e) => {
    const targetLang = e.target.value;

    if (!targetLang) {
        revertPageText();
        addMessage("Reverted to original page language.", "ai");
        return;
    }

    const langName = e.target.options[e.target.selectedIndex].text;
    translateLang.disabled = true;

    try {
        addMessage(`Scanning and translating page to ${langName}...`, "ai");

        // Tell content script to gather text nodes
        const texts = await getPageTextNodes();

        if (!texts || texts.length === 0) {
            addMessage("No translatable text found on this page.", "ai", "error");
            translateLang.value = "";
            return;
        }

        const response = await fetch(`${BACKEND_URL}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: texts, targetLanguage: targetLang })
        });

        const data = await response.json();
        if (data.translated_texts) {
            addMessage("Translation complete. Updating the page in-place...", "ai", "success");
            replacePageTextNodes(data.translated_texts);
        } else {
            throw new Error("Missing translated texts from backend");
        }
    } catch (error) {
        addMessage("Translation failed. 1e may be incorrect. Please verify connection.", "ai", "error");
        console.error(error);
        translateLang.value = "";
    } finally {
        translateLang.disabled = false;
    }
});

let chatHistory = [];
let isAgentRunning = false;
const MAX_AUTONOMOUS_STEPS = 8;

async function sendMessage() {
    if (isAgentRunning) return;

    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Remove welcome screen on first message
    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) welcomeScreen.remove();

    addMessage(text, 'user');
    chatHistory.push({ role: "user", content: text });

    runAgentLoop();
}

async function runAgentLoop() {
    isAgentRunning = true;
    let stepCount = 0;

    const typingId = 'typing-' + Date.now();
    addTypingIndicator(typingId);

    try {
        while (stepCount < MAX_AUTONOMOUS_STEPS) {
            stepCount++;

            // 1. Extract context from current tab
            const context = await getPageContext();

            // 2. Send history and context to backend
            const response = await fetch(`${BACKEND_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: chatHistory,
                    page_content: context.page_content,
                    elements: context.elements,
                    url: context.url,
                    title: context.title
                })
            });

            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            // Log assistant's action into history 
            // Only add valid string content for Sarvam's prompt engine
            const assistantMessageStr = typeof data.text === "string" ? data.text : JSON.stringify(data);
            chatHistory.push({
                role: "assistant",
                content: assistantMessageStr
            });

            // 3. Evaluate Action
            if (data.action && data.action !== "ANSWER") {
                let msgText = `Executing command: ${data.action} ${data.elementId ? `on element #${data.elementId}` : ''}`;
                if (data.action === "NAVIGATE") msgText = `Navigating to ${data.url}`;
                if (data.action === "TYPE") msgText = `Typing "${data.text}" into element #${data.elementId}`;

                removeElement(typingId);
                addMessage(msgText, 'ai');

                // Add typing indicator back for the next step 
                addTypingIndicator(typingId);

                // Execute command
                await executeCommandInPage(data);

                // We need to give the page time to react (navigate, modal open, DOM update)
                // If it's a navigation, wait longer for the new page to load
                if (data.action === "NAVIGATE") {
                    await new Promise(r => setTimeout(r, 6000));
                } else {
                    await new Promise(r => setTimeout(r, 1500));
                }

                // Prompt the AI to continue based on new context
                chatHistory.push({
                    role: "user",
                    content: `Action ${data.action} executed. Review the new WEBPAGE CONTENT and AVAILABLE ELEMENTS. What is the next logical action to achieve the USER GOAL? If you meet the goal, or need the user to input something, return {"action":"ANSWER", "text":"..."}.`
                });

            } else if (data.action === "ANSWER" || data.text) {
                // Task is complete, or we require user input
                removeElement(typingId);
                const finalMsg = data.text || "Task completed.";
                addMessage(finalMsg, 'ai');
                break; // Exit the loop
            } else {
                // Fallback
                removeElement(typingId);
                addMessage("Task completed.", 'ai');
                break;
            }
        }

        if (stepCount >= MAX_AUTONOMOUS_STEPS) {
            removeElement(typingId);
            addMessage("Paused execution to prevent infinite loops. You can type instructions to continue.", 'ai', true);
        }

    } catch (error) {
        console.error('Chat error:', error);
        removeElement(typingId);
        addMessage("1e encountered an error connecting to the backend. Please verify your connection.", 'ai', 'error');
        // On error, let the user retry
        isAgentRunning = false;
    } finally {
        isAgentRunning = false;
    }
}

function addMessage(text, sender, type = 'normal') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}-message`;

    if (type === 'error' || type === true) {
        msgDiv.innerHTML = `<div class="error-msg">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ${text}
        </div>`;
    } else if (type === 'success') {
        msgDiv.innerHTML = `<div class="success-msg">
            <img src="1e.png" alt="Success Logo" width="16" height="16" style="border-radius: 2px;">
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
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return { page_content: "Browser internal page - content access restricted.", elements: {}, url: tab ? tab.url : "", title: tab ? tab.title : "" };
    }

    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_CONTEXT" }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn(chrome.runtime.lastError.message);
                resolve({ page_content: "Script injection pending or blocked.", elements: {}, url: tab.url, title: tab.title });
            } else {
                resolve({ ...(response || { page_content: "", elements: {} }), url: tab.url, title: tab.title });
            }
        });
    });
}

async function getPageTextNodes() {
    const tab = await getActiveTab();
    if (!tab) return null;

    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_TEXT_NODES" }, (response) => {
            if (chrome.runtime.lastError) {
                resolve(null);
            } else {
                resolve(response.texts || null);
            }
        });
    });
}

async function executeCommandInPage(command) {
    const tab = await getActiveTab();
    if (!tab) return;

    if (command.action === "NAVIGATE" && command.url) {
        chrome.tabs.update(tab.id, { url: command.url });
        return;
    }

    chrome.tabs.sendMessage(tab.id, {
        type: "EXECUTE_COMMAND",
        command: command
    }, () => {
        if (chrome.runtime.lastError) {
            console.warn("Execute command error:", chrome.runtime.lastError.message);
        }
    });
}

async function replacePageTextNodes(translatedTexts) {
    const tab = await getActiveTab();
    if (!tab) return;

    chrome.tabs.sendMessage(tab.id, {
        type: "INJECT_TRANSLATION",
        translatedTexts: translatedTexts
    });
}

async function revertPageText() {
    const tab = await getActiveTab();
    if (!tab) return;

    chrome.tabs.sendMessage(tab.id, { type: "REVERT_TRANSLATION" });
}
