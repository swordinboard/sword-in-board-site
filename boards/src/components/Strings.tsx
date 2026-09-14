import type { BoardItem, BoardString, StringColor, StringView } from '../../shared/types';
import { hangerAt } from '../lib/frames';

/**
 * The strings run between items, drawn over them.
 *
 * Over, not under: a string that vanished behind everything it crossed would
 * show a web in pieces, and on a board with any number of them the point is
 * the web. It is why the reader gets a dimmer - a thing drawn over the content
 * has to be gettable out of the way.
 *
 * The hangers are drawn again above this, so a string passes under the pin
 * holding it, the way one does.
 */

const INK: Record<StringColor, string> = {
  red: '#b02a22',
  twine: '#c3a367',
  blue: '#35629c',
  green: '#417a49',
  black: '#1f1d1a',
};

/** How faint the middle setting is. Enough to follow, not enough to read past. */
const FAINT = 0.3;

interface Props {
  strings: BoardString[];
  items: BoardItem[];
  view: StringView;
  /** Tapping a string takes it down, and only while an editor is stringing. */
  onCut?: (id: string) => void;
}

export default function Strings({ strings, items, view, onCut }: Props) {
  if (view === 'hidden' || strings.length === 0) return null;
  const where = new Map(items.map((item) => [item.id, hangerAt(item)]));

  return (
    <svg className="strings" aria-hidden style={{ opacity: view === 'faint' ? FAINT : 1 }}>
      {strings.map((string) => {
        const a = where.get(string.from);
        const b = where.get(string.to);
        // An item can go while somebody else is looking; its strings go too.
        if (!a || !b) return null;
        const span = Math.hypot(b.x - a.x, b.y - a.y);
        /*
         * String hangs. The sag grows with the run and then stops: a long one
         * that kept sagging in proportion would loop to the floor, and a short
         * one drawn dead straight reads as wire.
         */
        const sag = Math.min(span * 0.06, 90);
        const path = `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + sag * 2} ${b.x} ${b.y}`;
        return (
          <g key={string.id}>
            <path className="string" d={path} stroke={INK[string.color] ?? INK.red} />
            {onCut ? (
              // Its own fat invisible stroke: a 5px line is not a tap target.
              <path
                className="string-grab"
                d={path}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onCut(string.id);
                }}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
