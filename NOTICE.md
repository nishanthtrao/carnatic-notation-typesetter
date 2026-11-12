# Notice and credits

## Original work

**Carnatic Music Notation Typesetter**, created by **Arun K** (`arunk15` on SourceForge).

- Project: https://sourceforge.net/projects/cmnt/
- Home page: http://arunk.freepgs.com/wordpress/cm-typesetter/about/
- Original web app (v1.5 Beta): http://arunk.freepgs.com/cmntv15b/cmnt/newsong.html
- Licence: GNU General Public License, version 2 (GPLv2)

Arun K designed the typesetter, its input format (the `S:`, `L:`, `Tala`, `Layout`,
`Heading` and other directives, the swara, speed and gamaka syntax, manual mode and
inline tala markers, and the Unified Transliteration Scheme as used in it), and wrote
the v1.5 Beta manual. All credit for those belongs to him.

## This project

This repository is an **unofficial, community-maintained rebuild** of that typesetter,
made because the original site is no longer maintained and no longer works well in
current browsers. It is **not affiliated with or endorsed by Arun K**.

The code in this repository was written from scratch, using the original web app's
behaviour and the v1.5 Beta manual as the specification. It reads the same input format,
so notation written for the original works here unchanged. The following were taken from
or adapted from the original work:

- the input format and its documented behaviour;
- the examples in `src/engine/examples.ts` and `docs/manual.html`, most of which come
  from the v1.5 Beta manual;
- the structure and much of the content of `docs/manual.html`, rewritten for this version.

## Changes from the original (GNU GPL v2, section 2a)

Started in November 2026. Compared with the original v1.5 Beta:

- rewritten in React and TypeScript, with a new parser, layout engine and renderer;
- works in current browsers, on phones, and as a desktop app (Windows, macOS, Linux);
- new interface (light and dark mode, side-by-side or stacked panes, Assist dialogs);
- Malayalam added to the supported languages;
- three bundled font styles per language (Serif, Sans, Rounded);
- `Layout: …,Compact` option (rows at natural width);
- Read Photo: converts photos of handwritten notation to input text using Claude;
- deployment files (Dockerfile, Render blueprint, GitHub workflows).

The full history of changes is in this repository's git log.

## Licence

This project is free software, distributed under the terms of the **GNU General Public
License, version 2** (see `LICENSE`), the same licence as the original.

## Third-party components

- Fonts: Noto Serif, Anek, Nunito and the Baloo 2 family, under the SIL Open Font
  License 1.1 (see `src/assets/fonts/OFL.txt`).
- npm packages: see `package.json`; each is under its own licence.
