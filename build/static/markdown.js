// ── MARKDOWN ───────────────────────────────────────────────────────────────
// A tiny markdown subset, used ONLY to draw the read view of a script.
//
// It never touches what is stored or what /run/{userHash}/{scriptHash} serves —
// `wget ... | bash` always gets the raw text, character for character. Edit mode
// also shows raw text: the textarea is layered over a highlight mirror and both
// must stay aligned, so anything that hides characters can only run in the read
// view, where there is no textarea.
//
// Adding syntax later means pushing one entry into BLOCK (whole-line rules) or
// INLINE (inside-a-line rules) — nothing outside this file needs to change.

const MD = (function () {

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Only these schemes become clickable. Anything else (javascript:, data:, …)
  // falls through and stays literal text, so a pasted URL can never turn into
  // something that runs on click.
  const SAFE_URL = /^(https?:\/\/|mailto:)/i;

  // ── whole-line rules ──
  // re matches the entire line; html() returns the element that replaces it.
  // A block ends its own line, so render() drops the newline that follows it.
  const BLOCK = [
    {
      name: 'hr',            // --- (or more dashes) on a line of its own
      re:   /^\s*-{3,}\s*$/,
      html: () => '<hr class="md-hr">',
    },
  ];

  // ── inline rules ──
  // re must be global; html(match) returns the replacement, or null to leave the
  // raw text untouched. Everything between matches is escaped by renderLine.
  const INLINE = [
    {
      name: 'link',          // [label](https://example.com)
      re:   /\[([^\]\n]*)\]\(([^)\s]+)\)/g,
      html: m => {
        const href = m[2];
        if (!SAFE_URL.test(href)) return null;
        return '<a class="md-a" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">'
             + esc(m[1] || href) + '</a>';
      },
    },
  ];

  // Collect every inline hit on the line, in order, and slice the line into
  // rendered chunks and the plain text between them. Earlier matches win when
  // two rules overlap.
  function tokenize(line) {
    const hits = [];
    INLINE.forEach(rule => {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        if (m[0] === '') { rule.re.lastIndex++; continue; }
        const html = rule.html(m);
        if (html !== null) hits.push({ start: m.index, end: m.index + m[0].length, html });
      }
    });
    hits.sort((a, b) => a.start - b.start);

    const out = [];
    let pos = 0;
    hits.forEach(h => {
      if (h.start < pos) return;
      if (h.start > pos) out.push({ text: line.slice(pos, h.start) });
      out.push({ html: h.html });
      pos = h.end;
    });
    if (pos < line.length) out.push({ text: line.slice(pos) });
    return out;
  }

  // `#` opens a bash comment that runs to end of line — but only outside a
  // rendered link, otherwise the fragment in https://example.com/#top would grey
  // out everything after it.
  function renderLine(line) {
    let html = '', comment = false;
    tokenize(line).forEach(tok => {
      if (tok.html !== undefined) { html += tok.html; return; }
      if (comment) { html += esc(tok.text); return; }
      const i = tok.text.indexOf('#');
      if (i === -1) { html += esc(tok.text); return; }
      html += esc(tok.text.slice(0, i)) + '<span class="cm">' + esc(tok.text.slice(i));
      comment = true;
    });
    return comment ? html + '</span>' : html;
  }

  // The container is white-space: pre-wrap, so newlines are the line breaks.
  function render(text) {
    const lines = String(text == null ? '' : text).split('\n');
    let out = '';
    lines.forEach((line, i) => {
      const block = BLOCK.find(rule => rule.re.test(line));
      out += block ? block.html(line) : renderLine(line);
      // a block element already broke the line — a newline too would blank-line it
      if (i < lines.length - 1 && !block) out += '\n';
    });
    return out;
  }

  return { render };
})();
