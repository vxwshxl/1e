<p align="center">
  <img src="1e.png" width="200"/>
</p>

<h1 align="center">1e Agentic Engine</h1>

# 1e — Regional Language AI Browser Assistant

1e is a production-ready, AI-powered browser sidebar assistant built using Chrome Extension MV3, FastAPI, Sarvam AI, and Bhashini AI.

## Features

1. **Read and understand the current webpage:** Extracts page text, links, buttons, and inputs for reasoning context.
2. **Answer contextual questions:** Powered by Sarvam AI (`sarvam-m`).
3. **Agentic Browser Actions:** Autonomously executes UI commands on the user's behalf:
   - `CLICK` (e.g. "Click login")
   - `SCROLL` (e.g. "Scroll down to footer")
   - `TYPE` (e.g. "Type 'rice price' in the search bar")
   - `NAVIGATE` (e.g. "Go to github.com")
4. **Regional Translation:** Uses Bhashini AI to translate the entire webpage to Assamese in real-time.
5. **Premium UI:** Features a modern, sleek dark-mode sidebar built for clarity and focus.

---

## Project Structure

```
1e/
│
├ manifest.json       # Chrome Extension MV3 Manifest
├ background.js       # Background service worker (sidebar configuration)
├ content.js          # DOM extraction and Agentic execution engine
├ sidebar.html        # Floating chat sidebar UI markup
├ sidebar.css         # Premium dark mode styles (LoopSync inspired)
├ sidebar.js          # Extension frontend logic and API integration
│
├ backend/
│   ├ package.json     # Node.js dependencies
│   ├ index.js         # Express server
│   ├ sarvam.js        # Sarvam AI chat agent logic
│   ├ bhashini.js      # Bhashini translation pipeline integration
│
├ README.md
```

---

## How to Install the Extension

1. Open Google Chrome.
2. Go to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click on **Load unpacked** in the top left.
5. Select the `1e` root folder (where `manifest.json` is located).
6. Pin the 1e extension to your toolbar.
7. Click the 1e icon to open the Sidebar Assistant on any website!

---

## How to Run the Backend

1. Ensure you have [Node.js](https://nodejs.org/) installed.
2. Navigate to the `backend` directory:
   ```bash
   cd 1e/backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the Express server:
   ```bash
   npm start
   ```
   *The server will start at `http://localhost:8000`*.

---

## How to Test

1. Ensure the Python backend is running.
2. Open a webpage (e.g., Wikipedia, a blog, or a login page) in Chrome.
3. Click the **1e Extension Icon** to open the side panel.
4. **Test Prompts:**
   - *"Explain this page"* (Agent will summarize based on page context)
   - *"Click login"* (Agent will find and click the nearest login button)
   - *"Scroll down"* (Agent will scroll the window)
   - *"Type 'hello world' in the search"* (Agent will locate search input and type)
   - Click the **Translate Icon** (globe icon at the top right of the sidebar) to translate the page to Assamese using Bhashini AI.

---

## Error Handling

- If API requests fail or models are unreachable, you will see a fallback error in chat: *"1e may be incorrect. Please verify important information."*
- If elements (for click/type) are obscured or missing, the agent skips execution gracefully and reports fallback.
