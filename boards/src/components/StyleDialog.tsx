import { useState } from 'react';
import type { BoardState, BoardStyle } from '../../shared/types';
import { BOARD_STYLES } from '../../shared/types';
import Scrim from './Scrim';

interface Props {
  board: BoardState;
  onChange: (patch: Partial<BoardState>) => void;
  onClose: () => void;
}

const STYLE_LABELS: Record<BoardStyle, { name: string; blurb: string }> = {
  cork: { name: 'Cork', blurb: 'Wood frame, cork, warm light.' },
  medieval: { name: 'Medieval', blurb: 'Dark oak and stretched hide.' },
  scifi: { name: 'Sci-fi', blurb: 'Graphite frame, a lit panel.' },
  western: { name: 'Western', blurb: 'Bleached planks and dust.' },
  apocalypse: { name: 'Apocalypse', blurb: 'Rusted steel, left out in it.' },
};

/** A few walls that suit the boards, for anyone not after a colour picker. */
const WALLS = ['#17140f', '#1b2430', '#241a14', '#2a2a2e', '#101b16', '#2c1f28'];

export default function StyleDialog({ board, onChange, onClose }: Props) {
  const portrait = board.height > board.width;
  const [warning, setWarning] = useState<string | null>(null);

  /**
   * Turning the board changes its shape, and items never reflow, so anything
   * past the new right edge would be off the board entirely. Rather than
   * move somebody's board around behind their back, this says what it would
   * cost and waits.
   */
  const turn = () => {
    const width = board.height;
    const height = board.width;
    const stranded = board.items.filter(
      (item) => item.x + item.w > width || item.y + item.h > height,
    ).length;
    if (stranded > 0 && warning === null) {
      setWarning(
        stranded === 1
          ? 'Turning it leaves 1 item past the edge. It is still there and can be dragged back. Turn it anyway?'
          : `Turning it leaves ${stranded} items past the edge. They are still there and can be dragged back. Turn it anyway?`,
      );
      return;
    }
    setWarning(null);
    onChange({ width, height });
  };

  return (
    <Scrim label="How the board looks" onClose={onClose}>
      <h2>How the board looks</h2>
      <p className="lede">
        This dresses the board itself &mdash; its surface, its frame, and the wall behind it.
        Everything pinned to it keeps the frame you gave it.
      </p>

      <div className="field">
        <label>Board</label>
        <div className="chooser">
          {BOARD_STYLES.map((style) => (
            <button
              type="button"
              key={style}
              className={(board.style ?? 'cork') === style ? 'on' : ''}
              onClick={() => onChange({ style })}
            >
              {STYLE_LABELS[style].name}
              <span className="sub">{STYLE_LABELS[style].blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="wall-colour">Wall behind it</label>
        <div className="wall-row">
          <input
            id="wall-colour"
            type="color"
            value={board.wall ?? '#17140f'}
            onChange={(e) => onChange({ wall: e.target.value })}
          />
          <div className="swatches">
            {WALLS.map((colour) => (
              <button
                type="button"
                key={colour}
                aria-label={colour}
                className={board.wall === colour ? 'on' : ''}
                style={{ background: colour }}
                onClick={() => onChange({ wall: colour })}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="field">
        <label>Which way up</label>
        <div className="chooser">
          <button type="button" className={portrait ? '' : 'on'} onClick={portrait ? turn : undefined}>
            Landscape
          </button>
          <button type="button" className={portrait ? 'on' : ''} onClick={portrait ? undefined : turn}>
            Portrait
          </button>
        </div>
        <p className="hint-text">
          {board.width} &times; {board.height}. Turning it swaps the two; nothing pinned to it
          moves.
        </p>
        {warning ? (
          <div className="danger-zone">
            <p>{warning}</p>
            <div className="actions">
              <button className="btn danger" type="button" onClick={turn}>
                Turn it
              </button>
              <button className="btn ghost" type="button" onClick={() => setWarning(null)}>
                Leave it
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="btn-row">
        <button className="btn" type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Scrim>
  );
}
