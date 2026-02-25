chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "EXTRACT_CONTEXT") {
        const context = extractContext();
        sendResponse(context);
    } else if (request.type === "EXECUTE_COMMAND") {
        executeCommand(request.command);
        sendResponse({ status: "success" });
    } else if (request.type === "EXTRACT_TEXT_NODES") {
        const texts = extractTextNodes();
        sendResponse({ texts: texts });
    } else if (request.type === "INJECT_TRANSLATION") {
        injectTranslation(request.translatedTexts);
        sendResponse({ status: "success" });
    } else if (request.type === "REVERT_TRANSLATION") {
        revertTranslation();
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

let originalTextNodes = [];

function extractTextNodes() {
    originalTextNodes = [];
    const texts = [];

    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
            const tag = node.parentElement ? node.parentElement.tagName.toLowerCase() : '';
            if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT;
            if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    }, false);

    let node;
    while (node = walk.nextNode()) {
        const text = node.nodeValue.trim();
        if (text.length > 1) {
            originalTextNodes.push({ node: node, originalText: node.nodeValue });
            texts.push(text);
        }
    }

    // Limit to avoid payload crashes
    const MAX_NODES = 500;
    if (texts.length > MAX_NODES) {
        originalTextNodes = originalTextNodes.slice(0, MAX_NODES);
        return texts.slice(0, MAX_NODES);
    }
    return texts;
}

function injectTranslation(translatedTexts) {
    if (!translatedTexts || !Array.isArray(translatedTexts)) return;

    for (let i = 0; i < Math.min(originalTextNodes.length, translatedTexts.length); i++) {
        const { node, originalText } = originalTextNodes[i];
        const translation = translatedTexts[i];

        const leadingSpace = originalText.match(/^\s*/)[0];
        const trailingSpace = originalText.match(/\s*$/)[0];

        node.nodeValue = leadingSpace + translation + trailingSpace;
    }
}

function revertTranslation() {
    for (const item of originalTextNodes) {
        if (item.node && item.originalText !== undefined) {
            item.node.nodeValue = item.originalText;
        }
    }
}
