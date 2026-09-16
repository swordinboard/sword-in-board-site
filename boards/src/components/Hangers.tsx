import type { BoardItem } from '../../shared/types';
import { Fastener } from './ItemFace';

/**
 * The hangers, drawn again above the strings.
 *
 * A fastener used to live inside its item, which put it under any string that
 * crossed it - and a string is supposed to pass under the pin holding it, not
 * over. An item is tilted, so it makes its own stacking context, and nothing
 * inside one can be lifted above a sibling of it. So each hanger is drawn in
 * an empty copy of its item instead: same box, same tilt, same frame class, so
 * every rule that places a fastener against its item still does, without one
 * of them having to know it is somewhere else now.
 *
 * Deliberately not class "item". It would have inherited the positioning for
 * free, and every `.cork .item` in the codebase - and in the tests - would
 * quietly have started matching twice.
 */
export default function Hangers({ items }: { items: BoardItem[] }) {
  return (
    <div className="hangers" aria-hidden>
      {items.map((item) => (
        <div
          key={item.id}
          className={`hanger-ghost frame-${item.frame}`}
          style={{
            left: item.x,
            top: item.y,
            width: item.w,
            height: item.h,
            transform: `rotate(${item.rotation}deg)`,
          }}
        >
          <Fastener item={item} />
        </div>
      ))}
    </div>
  );
}
