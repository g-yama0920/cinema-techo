import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 11 12 4l8.5 7" />
    <path d="M6 9.5V20h12V9.5" />
    <path d="M10 20v-6h4v6" />
  </Svg>
);
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    <path d="M7 13h2M11 13h2M15 13h2M7 16.5h2M11 16.5h2" />
  </Svg>
);
export const IconWorks = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="10" />
    <rect x="13.5" y="3.5" width="7" height="10" />
    <path d="M3.5 17h7M3.5 20.5h5M13.5 17h7M13.5 20.5h5" />
  </Svg>
);
export const IconList = (p: P) => (
  <Svg {...p}>
    <path d="M6 3.5h12v17l-6-4-6 4z" />
    <path d="M9.5 8h5M9.5 11.5h5" />
  </Svg>
);
export const IconStats = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 20.5h17" />
    <rect x="5" y="11" width="3" height="9.5" />
    <rect x="10.5" y="5" width="3" height="15.5" />
    <rect x="16" y="14" width="3" height="6.5" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5v15M4.5 12h15" />
  </Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5.5 5.5" />
  </Svg>
);
export const IconGear = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <rect x="13" y="4.5" width="4" height="5" />
    <rect x="7" y="14.5" width="4" height="5" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="m14.5 5-7 7 7 7" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9.5 5 7 7-7 7" />
  </Svg>
);
export const IconChevronUp = (p: P) => (
  <Svg {...p}>
    <path d="m5 14.5 7-7 7 7" />
  </Svg>
);
export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="m5 9.5 7 7 7-7" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="m5.5 5.5 13 13M18.5 5.5l-13 13" />
  </Svg>
);
export const IconGrid = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" />
  </Svg>
);
export const IconRows = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4.5" width="4" height="5.5" />
    <rect x="4" y="14" width="4" height="5.5" />
    <path d="M11 6h9M11 9h6M11 15.5h9M11 18.5h6" />
  </Svg>
);
export const IconEdit = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="m13 7 4 4" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14" />
    <path d="M10.5 10.5v6M13.5 10.5v6" />
  </Svg>
);
export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5v15l12-7.5z" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
);
export const IconPause = (p: P) => (
  <Svg {...p}>
    <path d="M8 5v14M16 5v14" />
  </Svg>
);
export const IconBookmarkPlus = (p: P) => (
  <Svg {...p}>
    <path d="M6 3.5h12v17l-6-4-6 4z" />
    <path d="M12 7.5v6M9 10.5h6" />
  </Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15" />
  </Svg>
);
export const IconUpload = (p: P) => (
  <Svg {...p}>
    <path d="M12 16V5M7 9.5l5-5 5 5M4.5 20h15" />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5 21 19.5H3z" />
    <path d="M12 9.5v5M12 16.5v1.5" />
  </Svg>
);
export const IconFilm = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="16" />
    <path d="M7.5 4v16M16.5 4v16M3.5 8h4M3.5 12h4M3.5 16h4M16.5 8h4M16.5 12h4M16.5 16h4" />
  </Svg>
);
export const IconHourglass = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 3.5h11M6.5 20.5h11" />
    <path d="M8 3.5v3.2L12 12l4-5.3V3.5M8 20.5v-3.2L12 12l4 5.3v3.2" />
  </Svg>
);
