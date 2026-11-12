/* Toolbar icons (stroke icons, 20×20). */
const P: Record<string, string> = {
  new: 'M5 2h7l4 4v12H5z M12 2v4h4',
  open: 'M2 6h6l2 2h8v9H2z M2 6V4h6l2 2',
  save: 'M3 3h11l3 3v11H3z M6 3v5h7V3 M6 17v-5h8v5',
  assist: 'M3 3h14v14H3z M7.5 8a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7 M10 14.5v.5',
  update: 'M16 10a6 6 0 1 1-2-4.5 M16 3v4h-4',
  align: 'M3 5h14 M3 9h10 M3 13h14 M3 17h10',
  photo: 'M2.5 6h3l1.5-2h6l1.5 2h3v10h-15z M10 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  examples: 'M4 3h9l3 3v11H4z M7 8h6 M7 11h6 M7 14h4',
  share: 'M8 12l4-4 M7 9L5 11a3 3 0 0 0 4 4l2-2 M13 11l2-2a3 3 0 0 0-4-4L9 7',
  help: 'M3 4h5a2 2 0 0 1 2 2v11a2 2 0 0 0-2-2H3z M17 4h-5a2 2 0 0 0-2 2v11a2 2 0 0 1 2-2h5z',
  pdf: 'M5 2h7l4 4v12H5z M12 2v4h4 M7.5 11h5 M10 8.5v5',
  print: 'M5 8V3h10v5 M5 14H3V8h14v6h-2 M5 12h10v6H5z',
  rotate: 'M15 9a5 5 0 1 0-1.5 4 M15 4v5h-5',
  trash: 'M4 6h12 M8 6V4h4v2 M6 6l1 11h6l1-11',
  sidebyside: 'M3 4h14v12H3z M10 4v12',
  stacked: 'M3 4h14v12H3z M3 10h14',
  warn: 'M10 3l8 14H2z M10 8v4 M10 14.5v.5',
  check: 'M4 10.5l4 4 8-9',
  settings: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M10 2v2 M10 16v2 M2 10h2 M16 10h2 M4.3 4.3l1.4 1.4 M14.3 14.3l1.4 1.4 M4.3 15.7l1.4-1.4 M14.3 5.7l1.4-1.4',
};

export function Icon({ name }: { name: keyof typeof P | string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="ico">
      <path d={P[name] || ''} />
    </svg>
  );
}
