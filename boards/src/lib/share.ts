/**
 * Sharing hands out the board's address and nothing else. The password travels
 * separately, by word of mouth, so a forwarded link is worthless on its own.
 */

export type ShareOutcome = 'shared' | 'copied' | 'failed';

export const boardLink = () => `${window.location.origin}/`;

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard access is refused in some mobile browsers unless the page is
    // focused; fall back to the old selection trick.
    try {
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(field);
      return ok;
    } catch {
      return false;
    }
  }
}

export async function shareBoard(title: string): Promise<ShareOutcome> {
  const url = boardLink();
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text: `${title} — you'll need the password from me to get in.`,
        url,
      });
      return 'shared';
    } catch (error) {
      // Dismissing the share sheet throws AbortError; that is not a failure,
      // and quietly copying instead would be confusing.
      if ((error as Error)?.name === 'AbortError') return 'shared';
    }
  }
  return (await copy(url)) ? 'copied' : 'failed';
}

export async function copyText(text: string): Promise<boolean> {
  return copy(text);
}
