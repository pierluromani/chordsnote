/**
 * Downloading a chart from a URL.
 *
 * On a phone this would be one `fetch` — but the app also runs in a browser,
 * where the same request is blocked unless the far site opts in with CORS
 * headers, which almost none do. So the direct attempt comes first (it costs
 * nothing and is the only one that runs on native), and public read-only
 * relays stand behind it. The last of them renders a real web page down to
 * text, which is what makes a tab site's HTML importable at all.
 */

import { looksLikeChord } from './chordpro';

type Source = {
  name: string;
  url: (target: string) => string;
  /** Whether this source hands back a rendered page rather than the raw file. */
  rendered?: boolean;
};

const SOURCES: Source[] = [
  { name: 'diretto', url: (target) => target },
  {
    name: 'allorigins',
    url: (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
  },
  {
    name: 'jina',
    url: (target) => `https://r.jina.ai/${target}`,
    rendered: true,
  },
];

export type FetchedChart = {
  /** Chart text, with any metadata found on the page turned into directives. */
  text: string;
  /** Which source produced it, for the "importato da" note. */
  via: string;
};

/** Enough lines with something on them to be worth handing to the parser. */
function looksUsable(text: string): boolean {
  const filled = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  return filled.length >= 3;
}

/**
 * Pulls the chart out of a rendered page. Tab sites put the chart in one
 * fenced block and surround it with navigation, ads and comments, so the
 * longest fence is a far better guess than the page as a whole.
 */
function longestFencedBlock(markdown: string): string | null {
  const blocks: string[] = [];
  const pattern = /```[^\n]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) blocks.push(match[1]);
  if (blocks.length === 0) return null;
  return blocks.sort((a, b) => b.length - a.length)[0];
}

/** `<pre>` is where a chart lives in hand-written HTML. */
function longestPreBlock(html: string): string | null {
  const blocks: string[] = [];
  const pattern = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) blocks.push(match[1]);
  if (blocks.length === 0) return null;
  return blocks.sort((a, b) => b.length - a.length)[0];
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#?\w+);/g, (whole, name: string) => {
    const known = ENTITIES[name.toLowerCase()];
    if (known !== undefined) return known;
    const numeric = /^#(\d+)$/.exec(name);
    return numeric ? String.fromCharCode(Number(numeric[1])) : whole;
  });
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  );
}

/**
 * Metadata a tab page prints beside the chart. Recognised loosely — a bare
 * "Key: F#m" line, or the table row a renderer makes of it — and re-emitted as
 * ChordPro directives so there's only one thing downstream that reads them.
 */
function directivesFromPage(text: string): string[] {
  const out: string[] = [];
  const find = (label: string): string | undefined => {
    // The label alternation has to be grouped, or the `|` would split the
    // whole pattern instead of just the label.
    const row = new RegExp(
      `^\\s*\\|?\\s*(?:${label})\\s*:?\\s*\\|?\\s*([^|\\n]+?)\\s*\\|?\\s*$`,
      'im'
    );
    return row.exec(text)?.[1]?.trim();
  };

  const key = find('key|tonalit[àa]');
  if (key && /^[A-G][#b]?m?$/.test(key)) out.push(`{key: ${key}}`);

  const capo = find('capo');
  const capoFret = capo?.match(/\d+/)?.[0];
  if (capoFret) out.push(`{capo: ${capoFret}}`);

  const tempo = find('tempo|bpm');
  const bpm = tempo?.match(/\d+/)?.[0];
  if (bpm) out.push(`{tempo: ${bpm}}`);

  return out;
}

/** Whether a line carries at least one real chord, bracketed or bare. */
function hasChords(line: string): boolean {
  const bracketed = line.match(/\[([^\]]*)\]/g);
  if (bracketed?.some((token) => looksLikeChord(token.slice(1, -1).trim()))) return true;
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => looksLikeChord(token));
}

/**
 * Narrows a rendered page down to the part that is actually the chart. Menus,
 * login forms and footers have no chords in them, so the span running from the
 * first chord to the last is a good deal closer to the song than the page is.
 */
function cropToChart(text: string): string {
  const lines = text.split('\n');
  const first = lines.findIndex(hasChords);
  if (first === -1) return text;

  let last = first;
  for (let i = lines.length - 1; i > first; i -= 1) {
    if (hasChords(lines[i])) {
      last = i;
      break;
    }
  }

  // A couple of lines past the final chord, so the last line it sits over
  // isn't left behind.
  return lines.slice(first, Math.min(lines.length, last + 3)).join('\n');
}

/**
 * Cleans up whatever a source returned into chart text. The rendered path
 * carries a short preamble naming the page, which is the best title we get
 * for a site that never states one in the chart itself.
 */
function normalize(raw: string, source: Source): string | null {
  let text = raw;
  const directives: string[] = [];

  if (source.rendered) {
    // Markdown links have to go before anything else looks at the text: the
    // `[label]` half is indistinguishable from an inline chord, so a page of
    // navigation would otherwise import as a page of chords. The exception is
    // a link whose label really is a chord — several sites make every chord a
    // link to its fingering — where the brackets are the whole point.
    text = text
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, (_whole, label: string) =>
        looksLikeChord(label.trim()) ? `[${label.trim()}]` : label
      );

    // "Title: Oasis - Wonderwall (Chords)" — the renderer's own header.
    const title = /^Title:\s*(.+)$/m.exec(text)?.[1]?.trim();
    if (title) {
      const clean = title.replace(/\s*\((?:chords?|tabs?|testo|accordi)\)\s*$/i, '').trim();
      const split = /^(.+?)\s+[-–—]\s+(.+)$/.exec(clean);
      if (split) {
        directives.push(`{artist: ${split[1].trim()}}`);
        directives.push(`{title: ${split[2].trim()}}`);
      } else if (clean) {
        directives.push(`{title: ${clean}}`);
      }
    }

    directives.push(...directivesFromPage(text.slice(0, 4000)));

    const body = /^Markdown Content:\s*$/m.exec(text);
    if (body) text = text.slice(body.index + body[0].length);

    text = longestFencedBlock(text) ?? text;

    // List bullets are the renderer's, not the chart's — left in, they'd
    // become the first characters of a lyric. Heading marks stay: they are
    // how a page says "Chorus", and the parser reads them as section titles.
    text = text
      .split('\n')
      .map((line) => line.replace(/^\s{0,4}(?:[*+-]|\d+\.)\s{1,4}/, ''))
      .join('\n');

    text = cropToChart(text);
  } else if (/^\s*</.test(text) || /<html|<body|<pre/i.test(text)) {
    // A raw page. Older chord sites put the whole chart in one `<pre>`, which
    // is worth taking; anything else is a layout we have no business guessing
    // at, so we decline and let the renderer downstream have it instead.
    const pre = longestPreBlock(text);
    if (!pre) return null;
    directives.push(...directivesFromPage(stripTags(text.slice(0, 8000))));
    text = decodeEntities(pre.replace(/<[^>]+>/g, ''));
  }

  text = text.replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  return directives.length > 0 ? `${directives.join('\n')}\n\n${text}\n` : `${text}\n`;
}

/** Fetches `url` through whichever source answers first with usable text. */
export async function fetchChart(url: string): Promise<FetchedChart> {
  const target = new URL(url).toString();
  let lastError: string | null = null;

  for (const source of SOURCES) {
    try {
      const response = await fetch(source.url(target), {
        headers: { Accept: 'text/plain, text/html, */*' },
      });
      if (!response.ok) {
        lastError = `${source.name}: HTTP ${response.status}`;
        continue;
      }
      const text = normalize(await response.text(), source);
      if (text === null || !looksUsable(text)) {
        lastError = `${source.name}: niente di leggibile`;
        continue;
      }
      return { text, via: source.name };
    } catch (error) {
      lastError = `${source.name}: ${error instanceof Error ? error.message : 'errore'}`;
    }
  }

  throw new Error(lastError ?? 'nessuna sorgente disponibile');
}
