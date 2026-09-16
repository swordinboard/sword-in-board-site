import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BoardState, BoardStyle, TitleFont } from '../../shared/types';
import {
  BOARD_STYLES,
  TITLE_FONTS,
  TITLE_FONT_LABELS,
  WALL_TEXTURES,
  WALL_TEXTURE_LABELS,
} from '../../shared/types';
import * as api from '../lib/api';
import { mediaUrl } from '../lib/api';
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
  industrial: { name: 'Industrial', blurb: 'Steel, rust and warning paint.' },
};

/**
 * What each hand is for. Said in terms of the thing rather than the typeface,
 * because "Roman inscriptional capitals" tells almost nobody anything and
 * "a carved sign" tells almost everybody.
 */
const FONT_BLURBS: Record<TitleFont, string> = {
  marker: 'The hand everything else is written in.',
  plain: 'A quiet serif. The one it has always been.',
  carved: 'Cut into a sign, for the medieval board.',
  console: 'Squared off and lit, for the sci-fi panel.',
  saloon: 'Wood type, for the western board.',
  stencil: 'Sprayed through a plate, for the industrial one.',
};

/**
 * A few walls that suit the boards, for anyone not after a colour picker.
 *
 * Two rows, because a board hung on a dark wall and one hung on a pale wall
 * are different rooms. Eight in each rather than six, and chosen to go round
 * the hues rather than to sit near one another: the first six were four
 * browns and two blues in all but name, so most of the row looked like the
 * same wall twice. These run warm black, brown, oxblood, plum, navy, teal,
 * forest, charcoal - and the pale row the same way about.
 *
 * The light ones are plaster and paint rather than white. A true white wall
 * flattens the board's own shadow to nothing.
 */
const WALLS_DARK = [
  '#17140f',
  '#241a14',
  '#2b1618',
  '#2c1f28',
  '#1b2430',
  '#132228',
  '#101b16',
  '#2a2a2e',
];
const WALLS_LIGHT = [
  '#e6dfd1',
  '#e4d3bd',
  '#e8d5cf',
  '#dfd2e0',
  '#ccd6e2',
  '#c9dcd6',
  '#d5ddc6',
  '#d9d5cb',
];

/**
 * A chooser folded away behind whatever it is currently set to.
 *
 * The board styles and the hands are both lists of tall buttons, and together
 * they were most of the dialog: everything under them - the wall, the paper,
 * which way up - was a scroll away before you knew it was there. Folded, the
 * whole of the dialog is on a phone screen at once.
 *
 * Not a <select>. The whole of what these two offer is on the buttons: a hand
 * is chosen by reading the board's name set in it, and a board style by what
 * it says it is. An option list can carry neither.
 */
function Folded({
  label,
  now,
  open,
  onToggle,
  children,
}: {
  label: string;
  now: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <button
        type="button"
        className={`folded${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="folded-now">{now}</span>
        <span className="folded-mark" aria-hidden>
          &#9662;
        </span>
      </button>
      {open ? children : null}
    </div>
  );
}

export default function StyleDialog({ board, onChange, onClose }: Props) {
  /*
   * One at a time. Both open at once is the tall dialog this was meant to
   * fix, and there is no reason to compare a frame against a typeface.
   */
  const [openList, setOpenList] = useState<'style' | 'font' | null>(null);
  const fold = (which: 'style' | 'font') => () =>
    setOpenList((now) => (now === which ? null : which));
  const portrait = board.height > board.width;
  const [warning, setWarning] = useState<string | null>(null);
  const [wallBusy, setWallBusy] = useState(false);
  const [wallError, setWallError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  /**
   * A wall somebody brought themselves. Stored as a picture like any other,
   * which means it is cleared with the board and counts against the same
   * limit rather than being a second kind of thing with its own rules.
   */
  const upload = async (chosen: File | undefined) => {
    if (!chosen) return;
    setWallError(null);
    setWallBusy(true);
    try {
      const { id } = await api.uploadMedia(chosen, board.id);
      onChange({ wallImage: id, wallTex: undefined });
    } catch (e) {
      setWallError((e as Error).message);
    } finally {
      setWallBusy(false);
      if (file.current) file.current.value = '';
    }
  };

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

      <Folded
        label="Board style"
        now={STYLE_LABELS[board.style ?? 'cork'].name}
        open={openList === 'style'}
        onToggle={fold('style')}
      >
        <div className="chooser">
          {BOARD_STYLES.map((style) => (
            <button
              type="button"
              key={style}
              className={(board.style ?? 'cork') === style ? 'on' : ''}
              onClick={() => {
                onChange({ style });
                setOpenList(null);
              }}
            >
              {STYLE_LABELS[style].name}
              <span className="sub">{STYLE_LABELS[style].blurb}</span>
            </button>
          ))}
        </div>
      </Folded>

      {/*
        The name's hand. Each button is set in the face it offers, which is
        the whole of what somebody needs to choose one - and it is the thing
        that fetches the face, so nothing is downloaded until this is opened.
        Which now means opened twice: the list is folded away until asked for.
      */}
      <Folded
        label="Title font"
        now={
          <span className={`sample title-${board.titleFont ?? 'plain'}`}>
            {TITLE_FONT_LABELS[board.titleFont ?? 'plain']}
          </span>
        }
        open={openList === 'font'}
        onToggle={fold('font')}
      >
        <div className="chooser fonts">
          {TITLE_FONTS.map((font) => (
            <button
              type="button"
              key={font}
              className={`title-font title-${font}${(board.titleFont ?? 'plain') === font ? ' on' : ''}`}
              onClick={() => {
                onChange({ titleFont: font });
                setOpenList(null);
              }}
            >
              <span className="sample">{board.title || TITLE_FONT_LABELS[font]}</span>
              <span className="sub">
                {TITLE_FONT_LABELS[font]} &mdash; {FONT_BLURBS[font]}
              </span>
            </button>
          ))}
        </div>
      </Folded>

      <div className="field">
        <label htmlFor="wall-colour">Wall behind it</label>
        <div className="wall-row">
          <input
            id="wall-colour"
            type="color"
            value={board.wall ?? '#17140f'}
            onChange={(e) => onChange({ wall: e.target.value })}
          />
          <div className="swatch-rows">
            {[WALLS_DARK, WALLS_LIGHT].map((row, at) => (
              <div className="swatches" key={at}>
                {row.map((colour) => (
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
            ))}
          </div>
        </div>
      </div>

      {/*
        What the wall is papered with, over whatever colour it is. Bare is a
        choice of its own rather than the absence of one, so it is a button.
      */}
      <div className="field">
        <label>Papered with</label>
        <div className="chooser walls">
          <button
            type="button"
            className={!board.wallTex && !board.wallImage ? 'on' : ''}
            onClick={() => onChange({ wallTex: undefined, wallImage: undefined })}
          >
            <span className="wall-swatch bare" />
            Bare
          </button>
          {WALL_TEXTURES.map((tex) => (
            <button
              type="button"
              key={tex}
              className={!board.wallImage && board.wallTex === tex ? 'on' : ''}
              onClick={() => onChange({ wallTex: tex, wallImage: undefined })}
            >
              <span className={`wall-swatch wall-${tex}`} />
              {WALL_TEXTURE_LABELS[tex]}
            </button>
          ))}
          <button
            type="button"
            className={board.wallImage ? 'on' : ''}
            disabled={wallBusy}
            onClick={() => file.current?.click()}
          >
            <span
              className="wall-swatch uploaded"
              style={
                board.wallImage
                  ? { backgroundImage: `url("${mediaUrl(board.wallImage, board.id)}")` }
                  : undefined
              }
            />
            {wallBusy ? 'Putting it up...' : board.wallImage ? 'Yours' : 'Upload one'}
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        {wallError ? <p className="error-text">{wallError}</p> : null}
        <p className="hint-text">
          A wall of your own covers everything behind the board. <strong>2000 &times; 1500</strong>{' '}
          is about right &mdash; it is centred on the board and cropped to whatever shape the
          screen is, so keep what matters near the middle. It is stored with the board and goes
          when the board does.
        </p>
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
