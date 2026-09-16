/**
 * The small amount of Markdown a pinned note understands.
 *
 * Not a Markdown implementation: a notice on a corkboard is a few lines of
 * writing, and the things people reach for there are a list, a link, and a
 * word in bold. Headings, tables, footnotes and embedded HTML would each need
 * a place to live on a sticky note, and there isn't one.
 *
 * It parses to a tree of plain objects rather than to a string of HTML. That
 * is the whole security argument: there is no point at which text somebody
 * submitted becomes markup, so there is no sanitiser to get wrong. The
 * renderer turns these nodes into elements and can only ever produce the
 * handful of tags named here.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string; kids: Inline[] }
  | { kind: 'strong'; kids: Inline[] }
  | { kind: 'em'; kids: Inline[] }
  | { kind: 'strike'; kids: Inline[] };

/** One line of a paragraph, or the text of one bullet. */
export type Line = Inline[];

export interface ListItem {
  /**
   * 0 for a top-level bullet, 1 for one indented under it. That is as far as
   * it goes: a third level on a note this size is unreadable anyway.
   */
  depth: 0 | 1;
  kids: Line;
}

/**
 * Whether a blank line was typed above this block.
 *
 * A list can start without one - "Bring:" and then the bullets - and that is
 * a different thing on the page from a paragraph somebody deliberately put
 * air above. Keeping the two apart is the only way the second can still get
 * the empty line it had before any of this was parsed.
 */
interface Spaced {
  gap?: true;
}

export type Block = Spaced &
  (
    | { kind: 'p'; lines: Line[] }
    | { kind: 'ul'; items: ListItem[] }
    | { kind: 'ol'; start: number; items: ListItem[] }
  );

/** Bullets: -, * or + and then a space. */
const BULLET = /^(\s*)[-*+][ \t]+(.*)$/;
/** Numbers: 1. or 1) and then a space. Nine digits is more than plenty. */
const NUMBER = /^(\s*)(\d{1,9})[.)][ \t]+(.*)$/;
/** Characters a backslash can take the meaning out of. */
const ESCAPABLE = '\\`*_~[]()#+-.!>';
/** The trick that turns a refused scheme into an allowed-looking one. */
const CONTROL = /[\u0000-\u001f\u007f]/g;

/**
 * Where a URL is allowed to point.
 *
 * Anything carrying a scheme we did not name is refused outright rather than
 * guessed at, which is what keeps `javascript:` and `data:` out. Something
 * with no scheme at all is a person typing a domain, so it gets https.
 */
export function safeHref(raw: string): string | null {
  const url = raw.replace(CONTROL, '').trim();
  if (!url) return null;
  if (/^(?:https?:|mailto:)/i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  // Nothing here is a page of its own, so a path or an anchor points nowhere.
  if (url.startsWith('#') || url.startsWith('/')) return null;
  return `https://${url}`;
}

/** A bare URL somebody pasted, without the brackets around it. */
const AUTOLINK = /^https?:\/\/[^\s<>"']+/i;

/** Trailing punctuation belongs to the sentence, not to the address. */
function trimUrl(url: string): string {
  let end = url.length;
  while (end > 0 && '.,;:!?'.includes(url[end - 1])) end -= 1;
  // A closing bracket only counts as part of a URL if it was opened in it.
  while (end > 0 && url[end - 1] === ')') {
    const slice = url.slice(0, end);
    const opens = (slice.match(/\(/g) ?? []).length;
    const closes = (slice.match(/\)/g) ?? []).length;
    if (opens >= closes) break;
    end -= 1;
  }
  return url.slice(0, end);
}

const isWord = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

/**
 * One line of writing, marker by marker.
 *
 * An unmatched marker is left alone rather than treated as an error: somebody
 * writing "2 * 3" meant the asterisk, and a note that swallows it is worse
 * than a note that shows it.
 */
export function parseInline(src: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let plain = '';
  let i = 0;

  const flush = () => {
    if (plain) out.push({ kind: 'text', text: plain });
    plain = '';
  };
  const push = (node: Inline) => {
    flush();
    out.push(node);
  };

  /** A marked-off run, such as **this**, if it is closed on the same line. */
  const pair = (mark: string, kind: 'strong' | 'em' | 'strike'): boolean => {
    if (!src.startsWith(mark, i)) return false;
    const from = i + mark.length;
    // A marker with a space right after it is somebody's punctuation.
    if (/\s/.test(src[from] ?? ' ')) return false;
    let at = src.indexOf(mark, from);
    while (at > from && src[at - 1] === '\\') at = src.indexOf(mark, at + 1);
    if (at <= from) return false;
    push({ kind, kids: parseInline(src.slice(from, at), depth + 1) });
    i = at + mark.length;
    return true;
  };

  while (i < src.length) {
    const ch = src[i];

    if (ch === '\\' && i + 1 < src.length && ESCAPABLE.includes(src[i + 1])) {
      plain += src[i + 1];
      i += 2;
      continue;
    }

    // Code first, and nothing inside it means anything.
    if (ch === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i + 1) {
        push({ kind: 'code', text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // [what it says](where it goes). Links do not nest, so the label is read
    // at a depth that stops it looking for another one.
    if (ch === '[' && depth < 3) {
      const close = src.indexOf('](', i + 1);
      if (close > i) {
        const end = src.indexOf(')', close + 2);
        if (end > close) {
          const href = safeHref(src.slice(close + 2, end));
          const label = src.slice(i + 1, close);
          if (href && label) {
            push({ kind: 'link', href, kids: parseInline(label, 3) });
            i = end + 1;
            continue;
          }
        }
      }
    }

    if (ch === 'h' && depth < 3 && AUTOLINK.test(src.slice(i))) {
      const url = trimUrl(AUTOLINK.exec(src.slice(i))![0]);
      const href = safeHref(url);
      if (href) {
        push({ kind: 'link', href, kids: [{ kind: 'text', text: url }] });
        i += url.length;
        continue;
      }
    }

    if (pair('~~', 'strike')) continue;
    if (pair('**', 'strong')) continue;
    // snake_case is not emphasis, so an underscore inside a word is a letter.
    if (ch === '_' && !isWord(src[i - 1])) {
      if (pair('__', 'strong')) continue;
      if (pair('_', 'em')) continue;
    }
    if (ch === '*' && pair('*', 'em')) continue;

    plain += ch;
    i += 1;
  }

  flush();
  return out;
}

/** How far in a list item is written. Two spaces is one step. */
const indentOf = (spaces: string): 0 | 1 => (spaces.replace(/\t/g, '  ').length >= 2 ? 1 : 0);

/**
 * A body, split into paragraphs and lists.
 *
 * Single newlines stay where they are, as breaks inside a paragraph, rather
 * than being folded away the way CommonMark folds them. Notes were written
 * here before any of this existed and their line endings are load-bearing:
 * reflowing somebody's address block because the specification says so would
 * still be a bug.
 */
export function parseMarkup(src: string): Block[] {
  const blocks: Block[] = [];
  let para: Line[] | null = null;
  let list: (Block & { kind: 'ul' | 'ol' }) | null = null;
  let blank = false;

  const open = <T extends Block>(block: T): T => {
    if (blank && blocks.length) block.gap = true;
    blank = false;
    blocks.push(block);
    return block;
  };

  for (const raw of src.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/\s+$/, '');

    if (!line.trim()) {
      para = null;
      list = null;
      blank = true;
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBER.exec(line);

    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      const spaces = (bullet ?? numbered!)[1];
      const text = bullet ? bullet[2] : numbered![3];
      para = null;
      if (!list || list.kind !== kind) {
        list = open(
          kind === 'ul'
            ? ({ kind: 'ul', items: [] } as Block & { kind: 'ul' })
            : ({ kind: 'ol', start: Number(numbered![2]), items: [] } as Block & { kind: 'ol' }),
        );
      }
      list.items.push({ depth: indentOf(spaces), kids: parseInline(text) });
      continue;
    }

    // An indented line under a bullet is the rest of that bullet.
    if (list && list.items.length && /^\s{2,}/.test(line)) {
      const last = list.items[list.items.length - 1];
      last.kids.push({ kind: 'text', text: ' ' }, ...parseInline(line.trim()));
      continue;
    }

    list = null;
    if (!para) {
      para = [];
      open({ kind: 'p', lines: para });
    }
    para.push(parseInline(line));
  }

  return blocks;
}

/** Everything a run of writing says, with the marks taken back out of it. */
function textOf(nodes: Inline[]): string {
  return nodes
    .map((node) => (node.kind === 'text' || node.kind === 'code' ? node.text : textOf(node.kids)))
    .join('');
}

/**
 * What a body says, for somewhere that cannot show how it says it.
 *
 * A title bar is one line at one weight, so a heading full of asterisks there
 * is just noise. This gives back the writing without them.
 */
export function plainText(src: string): string {
  return parseMarkup(src)
    .map((block) =>
      (block.kind === 'p' ? block.lines : block.items.map((item) => item.kids))
        .map(textOf)
        .join(' '),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
