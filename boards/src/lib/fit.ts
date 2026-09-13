/**
 * How tall an item needs to be for everything on it.
 *
 * Measured from the parts rather than the container: a container stretched to
 * the item is as tall as the item by definition, whatever it holds, so it can
 * never report that its contents do not fit.
 */
export function heightForContent(root: HTMLElement | null | undefined): number | null {
  const surface = root?.querySelector<HTMLElement>('.surface');
  const flow = surface?.querySelector<HTMLElement>('.stack, .wb-face');
  if (!surface || !flow) return null;

  const box = getComputedStyle(surface);
  const pad = parseFloat(box.paddingTop) + parseFloat(box.paddingBottom);
  const gap = parseFloat(getComputedStyle(flow).rowGap) || 0;
  const parts = [...flow.children].filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && getComputedStyle(el).position !== 'absolute',
  );
  if (parts.length === 0) return null;

  const content =
    parts.reduce((total, part) => total + part.scrollHeight, 0) + (parts.length - 1) * gap;
  return Math.max(100, Math.round(content + pad));
}
