/**
 * Robust cross-browser clipboard utility.
 * Attempts modern navigator.clipboard.writeText first,
 * with graceful fallback to hidden textarea + document.execCommand('copy')
 * for environments without clipboard permissions, HTTP contexts, or older browsers.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Async Clipboard API if available and context is secure
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[clipboard] navigator.clipboard.writeText failed, attempting fallback:', err);
    }
  }

  // 2. Fallback using temporary textarea element and document.execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Prevent scrolling and keep invisible
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (fallbackErr) {
    console.error('[clipboard] execCommand fallback failed:', fallbackErr);
    return false;
  }
}
