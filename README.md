# In-Browser Design AI

**Your intelligent design companion, right in the browser.**

Transform any webpage into your creative canvas. **In-Browser Design AI** brings the power of state-of-the-art LLMs (Gemini) directly into Chrome, allowing you to iterate on UI/UX, prototype changes, and get instant creative feedback without ever leaving the page.

## Why Install?

🚀 **Instant Design Iteration**  
Visualize changes instantly. Describe your vision ("make this button pop with a modern gradient", "fix the spacing in this grid"), and watch the AI generate and apply the code for you in real-time.

🎨 **Your 24/7 Creative Partner**  
Stuck on a color palette? Need a layout alternative? The AI understands modern design trends, accessibility standards, and UX best practices, helping you build better interfaces faster.

🔍 **Context-Aware Intelligence**  
Unlike generic chat bots, this extension **sees what you see**. Select any element on the page, and the AI analyzes its specific computed styles and HTML structure to provide precise, working code snippets.

⚡ **Seamless Workflow**  
No more context switching between your IDE, browser inspector, and ChatGPT. Everything happens in the Chrome Side Panel, keeping your workflow fluid and focused.

🛠️ **Developer Ready**  
Get clean, standard Tailwind CSS or vanilla CSS output that you can copy-paste directly into your codebase. No proprietary formats, just standard web technologies.

## Quick Start

### 1. Prerequisites

- Node.js (v18+)
- npm or yarn

### 2. Install dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Create a `.env` file in the root directory and add your API keys:

```env
VITE_GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

### 4. Start development server

```bash
npm run dev
```

### 5. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable "Developer mode" in the top right.
3. Click "Load unpacked" and select the `dist` directory.

## Production & Publication

### Build and Package

To create a production build and generate a package for the Chrome Web Store:

```bash
npm run build
```

- The compiled files will be in the `dist/` directory.
- A ZIP archive for publication will be automatically generated at `release/bundle.zip`.

### Publication Steps

1. Go to the [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole).
2. Upload the `release/bundle.zip` file.
3. Fill in the store listing information (descriptions, category, screenshots).
4. Submit for review.

## Project Structure

- `src/sidepanel/` - Main Side Panel UI (React/Tailwind)
- `src/background/` - Extension background service worker
- `src/content/` - Content scripts for page interaction
- `public/icons/` - Extension icons for various sizes
- `manifest.config.ts` - Chrome extension manifest configuration
- `vite.config.ts` - Vite build configuration with CRXJS and Zip packaging

## License

MIT
