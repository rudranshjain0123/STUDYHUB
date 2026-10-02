export const SUBJECTS = [
  "English",
  "Hindi",
  "Maths",
  "Science",
  "SST",
  "French",
  "Reasoning",
  "GK",
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const SUBTYPES = ["Literature", "Language"] as const;
export type Subtype = (typeof SUBTYPES)[number];

export type WorkType = "book" | "notebook";

export const SUBTYPE_SUBJECTS: Subject[] = ["English", "Hindi"];
export const BOOK_ONLY_SUBJECTS: Subject[] = ["Reasoning", "GK"];

export function hasSubtypes(subject: Subject) {
  return SUBTYPE_SUBJECTS.includes(subject);
}

export function isBookOnly(subject: Subject) {
  return BOOK_ONLY_SUBJECTS.includes(subject);
}

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  book: "Book Work",
  notebook: "Notebook Work",
};

export type WorkRecord = {
  id: string;
  uploader_id: string;
  title: string;
  subject: Subject;
  subtype: Subtype | null;
  work_type: WorkType;
  storage_path: string;
  file_name: string;
  created_at: string;
  uploader_name: string;
  comment_count: number;
};

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function timeAgo(iso: string) {
  const elapsed = Date.now() - new Date(iso).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < minute) return "just now";
  if (elapsed < hour) {
    const minutes = Math.max(1, Math.floor(elapsed / minute));
    return `${minutes}m ago`;
  }
  if (elapsed < day) {
    const hours = Math.floor(elapsed / hour);
    return `${hours}h ago`;
  }
  const days = Math.floor(elapsed / day);
  return `${days}d ago`;
}

/** Accepted upload extensions, grouped by how we can preview them. */
export const PDF_EXTENSIONS = ["pdf"] as const;
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"] as const;
export const TEXT_EXTENSIONS = ["txt", "md", "csv", "rtf"] as const;
export const OFFICE_EXTENSIONS = [
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "odt",
  "odp",
  "ods",
] as const;

export const ACCEPTED_EXTENSIONS: string[] = [
  ...PDF_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...TEXT_EXTENSIONS,
  ...OFFICE_EXTENSIONS,
];

/** `accept` attribute for the upload file input. */
export const UPLOAD_ACCEPT = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export type FileKind = "pdf" | "image" | "text" | "office" | "other";

export function fileExtension(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

export function fileKind(fileName: string): FileKind {
  const ext = fileExtension(fileName);
  if ((PDF_EXTENSIONS as readonly string[]).includes(ext)) return "pdf";
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return "image";
  if ((TEXT_EXTENSIONS as readonly string[]).includes(ext)) return "text";
  if ((OFFICE_EXTENSIONS as readonly string[]).includes(ext)) return "office";
  return "other";
}

export function fileKindLabel(fileName: string) {
  const ext = fileExtension(fileName);
  return ext ? ext.toUpperCase() : "FILE";
}
