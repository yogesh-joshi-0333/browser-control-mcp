/**
 * Waits until the DOM stops mutating for 300ms, or 3s max.
 * Catches JS init, deferred renders, post-load animations, and AJAX updates.
 */
export async function waitForDomStable(page: { waitForFunction: (fn: string, opts: Record<string, unknown>) => Promise<unknown> }): Promise<void> {
  await page.waitForFunction(`
    new Promise(resolve => {
      let timer;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => { observer.disconnect(); resolve(true); }, 300);
      });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      setTimeout(() => { observer.disconnect(); resolve(true); }, 3000);
    })
  `, { timeout: 5000 });
}
