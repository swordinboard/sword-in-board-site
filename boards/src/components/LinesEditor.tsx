import type { BoardLine, BoardLineKind } from '../../shared/types';
import { MAX_LINES } from '../../shared/types';
import { lineValue, todayIn } from '../../shared/clock';

interface Props {
  lines: BoardLine[];
  onChange: (lines: BoardLine[]) => void;
  /** Called when an edit is finished, so the board saves. */
  onCommit?: () => void;
  /** Today in the board's zone, so the preview reads as it will on the wall. */
  today?: string;
}

const KIND_LABELS: Record<BoardLineKind, string> = {
  date: "Today's date",
  days: 'Day count',
};

const newLine = (kind: BoardLineKind): BoardLine => ({
  id: crypto.randomUUID(),
  kind,
  label: kind === 'days' ? 'Days since' : undefined,
  date: kind === 'days' ? todayIn() : undefined,
});

/**
 * The lines a whiteboard keeps for itself.
 *
 * Shared by the add dialog and the inspector, so a board can be set up at the
 * moment it goes on the wall rather than only afterwards.
 */
export default function LinesEditor({ lines, onChange, onCommit, today }: Props) {
  const day = today ?? todayIn();

  const patch = (id: string, change: Partial<BoardLine>) =>
    onChange(lines.map((line) => (line.id === id ? { ...line, ...change } : line)));

  const add = (kind: BoardLineKind) => {
    onChange([...lines, newLine(kind)]);
    onCommit?.();
  };

  return (
    <div className="lines-editor">
      {lines.map((line) => (
        <div className="line-row" key={line.id}>
          <div className="line-head">
            <span className="line-kind">{KIND_LABELS[line.kind]}</span>
            <span className="line-reads">{lineValue(line, day)}</span>
            <button
              type="button"
              aria-label="Remove this line"
              onClick={() => {
                onChange(lines.filter((other) => other.id !== line.id));
                onCommit?.();
              }}
            >
              &times;
            </button>
          </div>
          <input
            type="text"
            value={line.label ?? ''}
            placeholder={line.kind === 'days' ? 'Days since the last session' : 'Today'}
            maxLength={60}
            aria-label="What this line is called"
            onChange={(e) => patch(line.id, { label: e.target.value || undefined })}
            onBlur={() => onCommit?.()}
          />
          {line.kind === 'days' ? (
            <input
              type="date"
              value={line.date ?? ''}
              aria-label="The day it counts from"
              onChange={(e) => patch(line.id, { date: e.target.value || undefined })}
              onBlur={() => onCommit?.()}
            />
          ) : null}
        </div>
      ))}

      {lines.length < MAX_LINES ? (
        <div className="chooser">
          <button type="button" onClick={() => add('date')}>
            Add the date
          </button>
          <button type="button" onClick={() => add('days')}>
            Add a day count
          </button>
        </div>
      ) : (
        <p className="hint-text">That is as many lines as one board will hold.</p>
      )}
    </div>
  );
}
