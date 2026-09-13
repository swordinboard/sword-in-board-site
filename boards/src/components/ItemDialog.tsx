import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BoardItem } from '../../shared/types';
import { heightForContent } from '../lib/fit';
import { Contents, Fastener } from './ItemFace';

interface Props {
  item: BoardItem;
  /** Today in the board's zone, so a whiteboard reads the same as on the wall. */
  today: string;
  onClose: () => void;
}

/** Wide enough to read on, narrow enough not to sprawl on a desk. */
const MAX_WIDTH = 820;

/**
 * One item, opened to be read.
 *
 * Not a photograph of the item blown up: there is no size at which an eight
 * and a half inch page of twelve point fits a phone and can still be read,
 * and scaling it up only pushes the ends of the lines off the side. So it is
 * the same item, drawn with the same markup and the same stylesheet, given
 * the width of the screen instead of the width it has on the cork. The
 * writing is measured against the thing it is written on, so at that width it
 * comes out at the twelve point floor and the lines wrap to the screen.
 *
 * A picture keeps the shape it was cropped to and simply fills the width,
 * which is what looking at one closely has always meant here.
 */
export default function ItemDialog({ item, today, onClose }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const drawn = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const box = stage.current;
      if (!box) return;
      // clientWidth counts the padding, and the item has to sit inside it.
      const pad = getComputedStyle(box);
      const room = box.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      const w = Math.min(room, MAX_WIDTH);
      setSize({ w, h: Math.round(w * (item.h / item.w)) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [item.id, item.w, item.h]);

  /*
   * Then as tall as its contents need at that width. Its own proportions are
   * only a starting guess: text that filled a wide page fills several times
   * the height of a narrow one, and a whiteboard reads its own height to work
   * out how big a marker writes, so that one is left at the shape it has.
   */
  useLayoutEffect(() => {
    if (!size || item.frame === 'whiteboard') return;
    const needed = heightForContent(drawn.current);
    if (needed !== null && Math.abs(needed - size.h) > 1) setSize({ w: size.w, h: needed });
  }, [size, item.frame, item.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = item.heading || item.body?.split('\n')[0] || 'On the board';

  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-label={name}>
      <header>
        <h2>{name}</h2>
        <button type="button" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </header>

      <div className="item-view" ref={stage}>
        <div
          ref={drawn}
          className={`item frame-${item.frame}${item.aspect ? ' shaped' : ''}`}
          style={{
            width: size?.w,
            height: size?.h,
            visibility: size ? undefined : 'hidden',
            ...(item.aspect ? { ['--aspect' as string]: String(item.aspect) } : null),
            ...(item.typeSize ? { ['--type' as string]: `${item.typeSize * (117 / 72)}px` } : null),
          }}
        >
          <Fastener item={item} />
          <div className="surface">
            <Contents item={item} today={today} />
          </div>
        </div>
      </div>
    </div>
  );
}
