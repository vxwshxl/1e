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

let nextElementId = 1;

function extractContext() {
    // Clean up old IDs
    document.querySelectorAll('[data-galixent-id]').forEach(el => el.removeAttribute('data-galixent-id'));
    nextElementId = 1;

    // Limit text to avoid payload size issues
    const text = document.body.innerText.substring(0, 3000);

    const inputs = [];
    document.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(i => {
        if (i.offsetParent !== null) {
            const label = (i.placeholder || i.name || i.id || i.value || i.getAttribute('aria-label') || "input").substring(0, 50);
            i.setAttribute('data-galixent-id', nextElementId);
            inputs.push({ id: nextElementId, name: label, type: i.type || i.tagName.toLowerCase() });
            nextElementId++;
        }
    });

    const buttons = [];
    document.querySelectorAll('button, a, [role="button"]').forEach(b => {
        if (b.offsetParent !== null) { // only visible
            const label = (b.innerText || b.value || b.getAttribute('aria-label') || "").trim().substring(0, 50);
            if (label && !b.hasAttribute('data-galixent-id')) {
                b.setAttribute('data-galixent-id', nextElementId);
                buttons.push({ id: nextElementId, text: label, tag: b.tagName.toLowerCase() });
                nextElementId++;
            }
        }
    });

    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .slice(0, 20)
        .map(h => h.innerText.trim())
        .filter(Boolean);

    return {
        page_content: text,
        elements: {
            interactable: [...inputs, ...buttons].slice(0, 60), // Keep payload small but prioritize inputs
            headings: [...new Set(headings)]
        }
    };
}

function executeCommand(command) {
    if (!command || !command.action) return Promise.resolve();

    return new Promise((resolve) => {
        try {
            const action = command.action.toUpperCase();

            if (action === "CLICK" && command.elementId) {
                const el = document.querySelector(`[data-galixent-id="${command.elementId}"]`);

                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        el.click();
                        resolve();
                    }, 500);
                } else {
                    console.warn("Element not found for click (ID):", command.elementId);
                    resolve();
                }
            } else if (action === "SCROLL") {
                const dir = (command.direction || "DOWN").toUpperCase();
                if (dir === "DOWN") {
                    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
                } else {
                    window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
                }
                setTimeout(resolve, 500);
            } else if (action === "TYPE" && command.elementId && command.text) {
                const el = document.querySelector(`[data-galixent-id="${command.elementId}"]`);

                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        el.focus();

                        // Deal with React/React DOM inputs
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                        if (nativeInputValueSetter) {
                            nativeInputValueSetter.call(el, command.text);
                        } else {
                            el.value = command.text;
                        }

                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));

                        // Simulate Enter key to trigger search/submit forms automatically
                        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));

                        resolve();
                    }, 300);
                } else {
                    console.warn("Element not found for type (ID):", command.elementId);
                    resolve();
                }
            } else if (action === "NAVIGATE" && command.url) {
                window.location.href = command.url;
                // Don't resolve immediately; let the page unload
            } else {
                resolve();
            }
        } catch (error) {
            console.error("Error executing command:", error);
            resolve();
        }
    });
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
