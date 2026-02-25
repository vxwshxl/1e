chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "EXTRACT_CONTEXT") {
        const context = extractContext();
        sendResponse(context);
    } else if (request.type === "EXECUTE_COMMAND") {
        executeCommand(request.command);
        sendResponse({ status: "success" });
    } else if (request.type === "TRANSLATE_PAGE") {
        translatePage(request.translatedText);
        sendResponse({ status: "success" });
    } else if (request.type === "GET_PAGE_TEXT") {
        sendResponse({ text: document.body.innerText });
    }
    return true;
});

function extractContext() {
    // Limit text to avoid payload size issues
    const text = document.body.innerText.substring(0, 3000);

    const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]'))
        .slice(0, 30)
        .map(b => (b.innerText || b.value || b.getAttribute('aria-label') || "").trim())
        .filter(Boolean);

    const links = Array.from(document.querySelectorAll('a'))
        .slice(0, 30)
        .map(a => a.innerText.trim())
        .filter(Boolean);

    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'))
        .slice(0, 30)
        .map(i => i.placeholder || i.name || i.id || "input")
        .filter(Boolean);

    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .slice(0, 30)
        .map(h => h.innerText.trim())
        .filter(Boolean);

    return {
        page_content: text,
        elements: {
            buttons: [...new Set(buttons)],
            links: [...new Set(links)],
            inputs: [...new Set(inputs)],
            headings: [...new Set(headings)]
        }
    };
}

function executeCommand(command) {
    if (!command || !command.action) return;

    try {
        const action = command.action.toUpperCase();

        if (action === "CLICK" && command.target) {
            const targetText = command.target.toLowerCase();
            const elements = Array.from(document.querySelectorAll('button, a, input, [role="button"]'));
            // Find element containing the target text
            const el = elements.find(e => {
                const text = (e.innerText || e.value || e.placeholder || e.getAttribute('aria-label') || "").toLowerCase();
                return text.includes(targetText);
            });
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => el.click(), 500);
            }
        } else if (action === "SCROLL") {
            const dir = (command.direction || "DOWN").toUpperCase();
            if (dir === "DOWN") {
                window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
            } else {
                window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
            }
        } else if (action === "TYPE" && command.target && command.text) {
            const targetText = command.target.toLowerCase();
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea'));
            const el = inputs.find(e => {
                const text = (e.name || e.placeholder || e.id || "").toLowerCase();
                return text.includes(targetText);
            });
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
                el.value = command.text;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else if (action === "NAVIGATE" && command.url) {
            window.location.href = command.url;
        }
    } catch (error) {
        console.error("Error executing command:", error);
    }
}

function translatePage(translatedText) {
    // A simple replacement. A robust solution would walk the DOM and replace text nodes
    // Here we just replace the body content with the translation or overlay it.

    // Since we might break the page structure, let's create a non-intrusive readable overlay or replace text nodes
    const textNodes = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walk.nextNode()) {
        if (node.nodeValue.trim().length > 0) {
            textNodes.push(node);
        }
    }

    // For safety and avoiding destroying the page layout/functionality just completely Replacing the page content with a simple view
    // since the translate endpoint returns one big block of text.

    if (translatedText) {
        // Create a nice reading view overlay
        const overlay = document.createElement('div');
        overlay.id = 'galixent-translation-overlay';
        overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: #0f172a;
        color: #f8fafc;
        z-index: 9999999;
        overflow-y: auto;
        padding: 40px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 18px;
        line-height: 1.6;
      `;

        const closeBtn = document.createElement('button');
        closeBtn.innerText = 'Close Translation';
        closeBtn.style.cssText = `
        position: sticky;
        top: 0;
        background: #3b82f6;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        margin-bottom: 20px;
        font-weight: 600;
      `;
        closeBtn.onclick = () => overlay.remove();

        const content = document.createElement('div');
        content.style.maxWidth = '800px';
        content.style.margin = '0 auto';
        content.innerText = translatedText; // preserve formatting

        overlay.appendChild(closeBtn);
        overlay.appendChild(content);
        document.body.appendChild(overlay);
    }
}
