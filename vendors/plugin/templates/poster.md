# Conference poster scaffold

Source structure for `project://deliverables/poster/{artifact}`. A poster is a standing argument read at two distances: the title and headline claim from three metres, the panels from one. It is not a slide deck and not a compressed paper.

The deliverable is a laid-out page, not a text outline. Write it as one self-contained HTML file (for example `project://deliverables/poster/poster.html`) using the skeleton below, which fixes the page size, grid, hierarchy, palette, and type scale in CSS. The author opens it in any browser to see the layout and prints it to PDF at the page size. If the venue mandates a LaTeX or PowerPoint template, use that template instead and carry over the same grid, hierarchy, and type scale. WTF-P writes poster source only; it declares no rendering effect and runs no renderer. If the author wants a rendered PDF, hand back the exact command or print step for their own toolchain.

Follow this scaffold literally. Replace every bracketed placeholder from the manuscript and its evidence records, and delete any panel the work does not support rather than filling it.

## Confirm before writing

Dimensions and orientation, the venue's template or branding requirement, the session audience, the single claim the poster must land, which figures already exist as artifacts, and the exact author names, affiliations, contact, funding, and venue line. Ask for any of these the manifest does not record.

## Evidence gate

Complete this gate before writing any poster text, and repeat it on the finished file.

1. Build a claim ledger: one row per claim, number, comparison, or figure the poster will carry, each naming its support as a manuscript passage, a `project://sources/{source}` record, a `project://evidence/{evidence}` record, or a named project file path.
2. Refuse any row without support. Do not rephrase it into a softer claim; cut it. Statements about other systems, tools, or prior work (for example how another framework divides responsibilities) need a cited source record, never general knowledge.
3. Never invent author names, affiliations, emails, funding, grant numbers, venue, or dates. When the manifest or the author does not supply one, leave a visible placeholder such as `[AFFILIATION NEEDED]` in the poster and list it under unresolved items in the report.
4. Keep the ledger in the delivery manifest next to the poster so a reviewer can check every row.

## Diagram provenance

Every diagram is evidence, not decoration.

- Reuse an existing manuscript figure when one exists, and cite its path.
- When the subject is software, derive architecture and flow diagrams only from named source files or documentation in the project the author pointed to. Read those files first. Every box and arrow must correspond to a module, component, call, or data path that exists in them.
- State the source paths under each diagram, for example `Source: src/router/dispatch.ts, docs/ARCHITECTURE.md`.
- Draw diagrams as inline SVG or Mermaid source so they stay editable. If no grounded source exists, leave a labeled placeholder box stating which files are needed; never draw an invented architecture.

## Layout and design

| Element | Rule |
| --- | --- |
| Page | Confirmed size; default 48 × 36 in landscape (A0 841 × 1189 mm portrait is the common alternative) |
| Margins and gutters | 1 in outer margin, 0.75 in gutter between columns |
| Grid | Landscape uses three columns; portrait uses two. Results may span two columns |
| Reading order | Title band across the full width, headline claim band beneath it, then panels top to bottom within each column, left to right |
| Hierarchy | Title 90 to 110 pt bold, headline claim 54 to 60 pt, panel headings 40 to 48 pt, body 26 to 32 pt, captions and references 20 to 24 pt |
| Palette | One dark ink, one light ground, one primary accent for headings and the claim band, one secondary accent for highlights in figures. Text contrast of at least 4.5:1. Use venue or institution colours only when the author supplies them |
| Figures | The strongest result figure is the largest element after the title. Each figure carries a one-line reading and its source path |
| Density | 400 to 800 words total. If a panel exceeds its budget, the content belongs in the paper, not the poster |

| Panel | Words | Purpose |
| --- | --- | --- |
| Title band | 25 | Title, authors, affiliations, contact or code link |
| Headline claim | 30 | The finding, stated as a sentence a reader can repeat |
| Motivation | 80 | The problem and why the audience should care |
| Approach | 120 | What was built or done, with one grounded diagram |
| Results | 150 | Two or three figures, each with a one-line reading |
| What it means | 80 | The consequence, and the boundary of the claim |
| References and provenance | 60 | Cited sources, funding, and artifact links |

---

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>[Poster title]</title>
<style>
  @page { size: 48in 36in; margin: 0; }
  :root {
    --ink: #1b1f24; --ground: #fbfaf7; --accent: #1f4e79; --highlight: #c8553d; --muted: #5a6270;
    --margin: 1in; --gutter: 0.75in;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--ground); color: var(--ink); }
  body { width: 48in; height: 36in; padding: var(--margin); font: 28pt/1.35 "Source Sans 3", "Helvetica Neue", Arial, sans-serif;
         display: grid; grid-template-rows: auto auto 1fr auto; gap: var(--gutter); }
  header h1 { font-size: 100pt; line-height: 1.05; margin: 0 0 0.2in; }
  header .byline { font-size: 34pt; color: var(--muted); }
  .claim { background: var(--accent); color: var(--ground); font-size: 56pt; font-weight: 600; padding: 0.4in 0.6in; }
  main { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--gutter); align-items: start; }
  section h2 { font-size: 44pt; color: var(--accent); border-bottom: 4pt solid var(--accent); margin: 0 0 0.25in; }
  section + section { margin-top: var(--gutter); }
  .span-2 { grid-column: span 2; }
  figure { margin: 0.2in 0; }
  figure img, figure svg { width: 100%; height: auto; }
  figcaption, .source { font-size: 22pt; color: var(--muted); }
  footer { font-size: 22pt; color: var(--muted); display: flex; justify-content: space-between; gap: var(--gutter); }
  .placeholder { outline: 4pt dashed var(--highlight); padding: 0.3in; color: var(--highlight); }
</style>
</head>
<body>
  <header>
    <h1>[Title: the claim, not the topic]</h1>
    <div class="byline">[Author names from manifest or AUTHORS NEEDED] · [Affiliations or AFFILIATION NEEDED] · [contact or repository link]</div>
  </header>

  <div class="claim">[Headline claim in one sentence, backed by a ledger row]</div>

  <main>
    <div class="column">
      <section>
        <h2>Why this matters</h2>
        <ul>
          <li>[Problem, in the audience's terms]</li>
          <li>[What breaks today, with the number that shows it and its source]</li>
        </ul>
      </section>
      <section>
        <h2>What we did</h2>
        <p>[Approach in one sentence]</p>
        <figure>
          [Inline SVG or Mermaid diagram derived from the named files, or a .placeholder box naming the files needed]
          <figcaption>[What the diagram shows] <span class="source">Source: [paths]</span></figcaption>
        </figure>
      </section>
    </div>

    <div class="column span-2">
      <section>
        <h2>What we found</h2>
        <figure>
          <img src="[figure path inside the project]" alt="[accessible description]">
          <figcaption>[One-line reading of the primary figure, with the measured value] <span class="source">Source: [path or record]</span></figcaption>
        </figure>
        <ul>
          <li>[Second result, with its condition]</li>
          <li>[What the result does not show]</li>
        </ul>
      </section>
      <section>
        <h2>What it means</h2>
        <ul>
          <li>[Consequence for the audience]</li>
          <li>[Stated limitation]</li>
        </ul>
      </section>
    </div>
  </main>

  <footer>
    <div>[References: only sources with a project://sources/{source} record]</div>
    <div>[Funding acknowledgement or FUNDING NEEDED] · [artifact or data links]</div>
  </footer>
</body>
</html>
```

For portrait pages, change `@page` and the `body` size to the confirmed dimensions, set `main` to `repeat(2, 1fr)`, and drop the `span-2` class.

---

## Attribution rules

Every number, figure, and claim on the poster must trace to a row in the claim ledger. Carry the source attribution onto the poster itself for any figure reused from another work. Do not introduce a claim, a number, a citation, or a piece of author metadata that appears nowhere in the project's records or the author's answers.
