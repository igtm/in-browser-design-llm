

let overlay: HTMLDivElement | null = null;
let hoveredElement: HTMLElement | null = null;

const createOverlay = () => {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '999999';
  overlay.style.border = '2px solid #6366f1';
  overlay.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
  overlay.style.transition = 'all 0.1s ease-out';
  document.body.appendChild(overlay);
  return overlay;
};

const getUniqueSelector = (el: HTMLElement): string => {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el === document.body) return 'body';
  
  let selector = el.tagName.toLowerCase();
  if (el.classList.length > 0) {
    // Escape each class name properly (handles Tailwind [ & ] etc)
    const classes = Array.from(el.classList)
      .filter(c => !c.includes(':')) // Ignore hover: etc for now as they are problematic
      .map(c => `.${CSS.escape(c)}`)
      .join('');
    selector += classes;
  }
  
  // If not unique enough or too generic, add nth-child
  const parent = el.parentElement;
  if (parent && parent !== document.documentElement) {
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(el) + 1;
    const parentSelector = parent.id ? `#${CSS.escape(parent.id)}` : parent.tagName.toLowerCase();
    selector = `${parentSelector} > ${selector}:nth-child(${index})`;
  }
  
  return selector;
};

const handleMouseMove = (e: MouseEvent) => {
  const el = e.target as HTMLElement;
  if (!el || el === overlay) return;
  
  if (hoveredElement !== el) {
  }
  
  hoveredElement = el;
  const rect = el.getBoundingClientRect();
  const ov = createOverlay();
  ov.style.top = `${rect.top}px`;
  ov.style.left = `${rect.left}px`;
  ov.style.width = `${rect.width}px`;
  ov.style.height = `${rect.height}px`;
  ov.style.display = 'block';
};

const handleMouseClick = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  
  if (hoveredElement) {
    const selector = getUniqueSelector(hoveredElement);
    const html = hoveredElement.outerHTML;
    
    chrome.storage.local.set({ 
      selectedElement: { 
        selector, 
        html, 
        timestamp: Date.now() 
      } 
    });
  }
  
  stopSelection();
};

export const startSelection = () => {
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleMouseClick, true);
  document.body.style.cursor = 'crosshair';
};

const stopSelection = () => {
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleMouseClick, true);
  document.body.style.cursor = 'default';
  if (overlay) {
    overlay.style.display = 'none';
  }
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_SELECTION') {
    startSelection();
    sendResponse({ status: 'started' });
  } else if (message.type === 'STOP_SELECTION') {
    stopSelection();
    sendResponse({ status: 'stopped' });
  }
});

(window as any).__startSelection = startSelection;
(window as any).__stopSelection = stopSelection;
