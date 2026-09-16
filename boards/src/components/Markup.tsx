import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { Block, Inline, Line, ListItem } from '../lib/markup';
import { parseMarkup } from '../lib/markup';

/**
 * Written text, drawn.
 *
 * The whole of what this can put on the page is in the two switches below:
 * em, strong, s, code, a, ul, ol, li, br. Nothing here takes a string of
 * markup and hands it to the browser, so no amount of angle brackets in
 * somebody's note turns into an element.
 */

interface Props {
  /** What was typed. */
  text: string;
  /**
   * Whether a link is a link.
   *
   * On the board it is not. A press there selects the item or pans the board,
   * and a link that fought that would take taps meant for the board and give
   * them to a website. Once the item is open there is nothing else the press
   * could have meant, so that is where the links live.
   */
  links?: boolean;
  className?: string;
}

function Run({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, at) => {
        switch (node.kind) {
          case 'text':
            return <Fragment key={at}>{node.text}</Fragment>;
          case 'code':
            return (
              <code className="md-code" key={at}>
                {node.text}
              </code>
            );
          case 'strong':
            return (
              <strong key={at}>
                <Run nodes={node.kids} />
              </strong>
            );
          case 'em':
            return (
              <em key={at}>
                <Run nodes={node.kids} />
              </em>
            );
          case 'strike':
            return (
              <s key={at}>
                <Run nodes={node.kids} />
              </s>
            );
          case 'link':
            // Dead on the board, live in the opened item. Either way it is
            // marked, so a reader can tell there is an address behind it.
            return (
              <span className="md-link" key={at}>
                <Run nodes={node.kids} />
              </span>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function Links({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, at) =>
        node.kind === 'link' ? (
          <a
            className="md-link"
            key={at}
            href={node.href}
            target="_blank"
            // Somebody else's link, opened from a board anybody can write on:
            // no window handle back to us, no referrer, and no vote of
            // confidence passed along to wherever it goes.
            rel="noopener noreferrer nofollow ugc"
            data-link
          >
            <Run nodes={node.kids} />
          </a>
        ) : (
          <Run nodes={[node]} key={at} />
        ),
      )}
    </>
  );
}

/** One line of writing, with its links live or not. */
function Written({ nodes, links }: { nodes: Line; links?: boolean }) {
  return links ? <Links nodes={nodes} /> : <Run nodes={nodes} />;
}

function Items({ items, links }: { items: ListItem[]; links?: boolean }) {
  /*
   * A run of items written further in is a list of its own, hung off the
   * bullet above it. Flattening it and indenting with a margin would be less
   * code and would renumber a nested "1." as "4.", which is wrong on the one
   * kind of list where the numbers are the point.
   */
  const out: ReactNode[] = [];
  let at = 0;
  while (at < items.length) {
    const item = items[at];
    let next = at + 1;
    const under: ListItem[] = [];
    if (item.depth === 0) {
      while (next < items.length && items[next].depth === 1) {
        under.push(items[next]);
        next += 1;
      }
    }
    out.push(
      <li key={at}>
        <Written nodes={item.kids} links={links} />
        {under.length ? (
          <ul className="md-list">
            <Items items={under.map((kid) => ({ ...kid, depth: 0 }))} links={links} />
          </ul>
        ) : null}
      </li>,
    );
    at = next;
  }
  return <>{out}</>;
}

function Drawn({ block, links }: { block: Block; links?: boolean }) {
  // A block with a typed blank line above it keeps that blank line.
  const air = block.gap ? ' md-air' : '';

  if (block.kind === 'p') {
    return (
      <p className={`md-p${air}`}>
        {block.lines.map((line, at) => (
          <Fragment key={at}>
            {/* A newline somebody typed is a newline they get. */}
            {at ? <br /> : null}
            <Written nodes={line} links={links} />
          </Fragment>
        ))}
      </p>
    );
  }

  const items = <Items items={block.items} links={links} />;
  return block.kind === 'ul' ? (
    <ul className={`md-list${air}`}>{items}</ul>
  ) : (
    <ol className={`md-list${air}`} start={block.start}>
      {items}
    </ol>
  );
}

export default function Markup({ text, links, className }: Props) {
  const blocks = parseMarkup(text);
  if (!blocks.length) return null;
  return (
    <div className={className ? `${className} md` : 'md'}>
      {blocks.map((block, at) => (
        <Drawn block={block} links={links} key={at} />
      ))}
    </div>
  );
}
