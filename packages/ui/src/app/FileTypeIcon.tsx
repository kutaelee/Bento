import React from "react";
import type { NodeItem } from "../api/nodes";

export type FileVisualKind =
  | "folder"
  | "image"
  | "video"
  | "pdf"
  | "sheet"
  | "doc"
  | "archive"
  | "audio"
  | "file";

export function getFileVisualKind(item: NodeItem): FileVisualKind {
  if (item.type === "FOLDER") return "folder";

  const mime = item.mime_type?.toLowerCase() ?? "";
  const extension = item.name.split(".").pop()?.toLowerCase() ?? "";

  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "heic", "heif", "avif"].includes(extension)) {
    return "image";
  }
  if (mime.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(extension)) {
    return "video";
  }
  if (mime.startsWith("audio/") || ["mp3", "wav", "flac", "aac", "ogg", "m4a"].includes(extension)) {
    return "audio";
  }
  if (mime.includes("pdf") || extension === "pdf") {
    return "pdf";
  }
  if (mime.includes("sheet") || mime.includes("excel") || ["csv", "xls", "xlsx", "numbers"].includes(extension)) {
    return "sheet";
  }
  if (mime.includes("word") || ["doc", "docx", "pages", "txt", "md"].includes(extension)) {
    return "doc";
  }
  if (mime.includes("zip") || ["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
    return "archive";
  }
  return "file";
}

type FileTypeIconProps = {
  item: NodeItem;
  className?: string;
};

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function FolderGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M3.75 7.5A2.25 2.25 0 0 1 6 5.25h3.045c.596 0 1.168.237 1.59.66l.87.87c.422.422.994.66 1.59.66H18A2.25 2.25 0 0 1 20.25 9.75v6A2.25 2.25 0 0 1 18 18H6a2.25 2.25 0 0 1-2.25-2.25V7.5Z" />
    </svg>
  );
}

function ImageGlyph() {
  return (
    <svg {...svgProps}>
      <rect x="3.75" y="4.5" width="16.5" height="15" rx="2.25" />
      <circle cx="8.25" cy="9" r="1.5" />
      <path d="m19.5 15-3.814-3.814a1.5 1.5 0 0 0-2.122 0L7.5 17.25" />
    </svg>
  );
}

function VideoGlyph() {
  return (
    <svg {...svgProps}>
      <rect x="3.75" y="5.25" width="11.25" height="13.5" rx="2.25" />
      <path d="m15 10.125 4.21-2.526a.75.75 0 0 1 1.14.643v7.516a.75.75 0 0 1-1.14.643L15 13.875" />
    </svg>
  );
}

function PdfGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M7.5 3.75h6l4.5 4.5v10.5A1.5 1.5 0 0 1 16.5 20.25h-9A1.5 1.5 0 0 1 6 18.75v-13.5A1.5 1.5 0 0 1 7.5 3.75Z" />
      <path d="M13.5 3.75v4.5H18" />
      <path d="M8.25 15h2.25M8.25 12h5.25M8.25 9h3" />
    </svg>
  );
}

function SheetGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M7.5 3.75h6l4.5 4.5v10.5A1.5 1.5 0 0 1 16.5 20.25h-9A1.5 1.5 0 0 1 6 18.75v-13.5A1.5 1.5 0 0 1 7.5 3.75Z" />
      <path d="M13.5 3.75v4.5H18" />
      <path d="M8.25 10.5h7.5M8.25 13.5h7.5M11.25 7.5v9M15 7.5v9" />
    </svg>
  );
}

function DocGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M7.5 3.75h6l4.5 4.5v10.5A1.5 1.5 0 0 1 16.5 20.25h-9A1.5 1.5 0 0 1 6 18.75v-13.5A1.5 1.5 0 0 1 7.5 3.75Z" />
      <path d="M13.5 3.75v4.5H18" />
      <path d="M8.25 10.5h7.5M8.25 13.5h7.5M8.25 16.5h4.5" />
    </svg>
  );
}

function ArchiveGlyph() {
  return (
    <svg {...svgProps}>
      <rect x="4.5" y="5.25" width="15" height="3.75" rx="1.25" />
      <path d="M6 9h12v8.25A2.25 2.25 0 0 1 15.75 19.5h-7.5A2.25 2.25 0 0 1 6 17.25V9Z" />
      <path d="M12 11.25v4.5" />
    </svg>
  );
}

function AudioGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M14.25 5.25v9a2.25 2.25 0 1 1-1.5-2.12V7.61l6-1.36v6.75a2.25 2.25 0 1 1-1.5-2.12V4.5l-3 0.75Z" />
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg {...svgProps}>
      <path d="M7.5 3.75h6l4.5 4.5v10.5A1.5 1.5 0 0 1 16.5 20.25h-9A1.5 1.5 0 0 1 6 18.75v-13.5A1.5 1.5 0 0 1 7.5 3.75Z" />
      <path d="M13.5 3.75v4.5H18" />
    </svg>
  );
}

const glyphByKind: Record<FileVisualKind, React.ReactNode> = {
  folder: <FolderGlyph />,
  image: <ImageGlyph />,
  video: <VideoGlyph />,
  pdf: <PdfGlyph />,
  sheet: <SheetGlyph />,
  doc: <DocGlyph />,
  archive: <ArchiveGlyph />,
  audio: <AudioGlyph />,
  file: <FileGlyph />,
};

export function FileTypeIcon({ item, className }: FileTypeIconProps) {
  const kind = getFileVisualKind(item);
  const classes = ["file-type-icon", `file-type-icon--${kind}`, className].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden="true">
      {glyphByKind[kind]}
    </span>
  );
}
