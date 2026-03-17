import { z } from "zod";

export const libraryMaterialFormats = [
  "book",
  "journal",
  "manuscript",
  "thesis",
  "dataset",
  "media",
  "archive",
  "digital_file",
] as const;

export const libraryAccessLevels = ["public", "restricted", "confidential"] as const;
export const libraryItemStatuses = [
  "available",
  "loaned",
  "reserved",
  "maintenance",
  "archived",
] as const;

export type LibraryMaterialFormat = (typeof libraryMaterialFormats)[number];
export type LibraryAccessLevel = (typeof libraryAccessLevels)[number];
export type LibraryItemStatus = (typeof libraryItemStatuses)[number];

export interface LibraryTaxonomyNode {
  code: string;
  label: string;
  classification: "DDC" | "LCC" | "LOCAL";
  description: string;
  children?: LibraryTaxonomyNode[];
}

export const libraryTaxonomyTree: LibraryTaxonomyNode[] = [
  {
    code: "000",
    label: "General Knowledge",
    classification: "DDC",
    description: "Reference works, information science, and institutional guides.",
    children: [
      {
        code: "020",
        label: "Library & Information Science",
        classification: "DDC",
        description: "Cataloging, archives, metadata, and library operations.",
      },
      {
        code: "030",
        label: "Reference Collections",
        classification: "DDC",
        description: "Encyclopedias, dictionaries, and research companions.",
      },
    ],
  },
  {
    code: "100",
    label: "Philosophy & Psychology",
    classification: "DDC",
    description: "Ethics, cognition, psychology, and reflective works.",
  },
  {
    code: "200",
    label: "Religion & Heritage",
    classification: "DDC",
    description: "Religious studies, manuscripts, and heritage collections.",
    children: [
      {
        code: "297",
        label: "Islamic Studies",
        classification: "DDC",
        description: "Quranic sciences, fiqh, hadith, and Islamic heritage.",
      },
      {
        code: "299",
        label: "Comparative Religion",
        classification: "DDC",
        description: "Comparative religious studies and philosophy of religion.",
      },
    ],
  },
  {
    code: "300",
    label: "Social Sciences",
    classification: "DDC",
    description: "Law, economics, public policy, education, and sociology.",
    children: [
      {
        code: "320",
        label: "Political Science & Governance",
        classification: "DDC",
        description: "Civics, governance, public administration, and policy.",
      },
      {
        code: "330",
        label: "Economics & Development",
        classification: "DDC",
        description: "Finance, accounting, economics, and development studies.",
      },
      {
        code: "340",
        label: "Law & Regulation",
        classification: "DDC",
        description: "Legal materials, legislation, and compliance records.",
      },
    ],
  },
  {
    code: "400",
    label: "Language & Literature",
    classification: "DDC",
    description: "Linguistics, literature, poetry, translation, and criticism.",
    children: [
      {
        code: "410",
        label: "Linguistics",
        classification: "DDC",
        description: "Language systems, lexicography, and discourse.",
      },
      {
        code: "890",
        label: "Arabic Literature",
        classification: "DDC",
        description: "Arabic poetry, prose, literary history, and criticism.",
      },
    ],
  },
  {
    code: "500",
    label: "Science & Technology",
    classification: "DDC",
    description: "Pure sciences, computing, engineering, and technical research.",
    children: [
      {
        code: "004",
        label: "Computer Science",
        classification: "DDC",
        description: "Programming, software engineering, and information systems.",
      },
      {
        code: "620",
        label: "Engineering",
        classification: "DDC",
        description: "Applied engineering, design systems, and manufacturing.",
      },
    ],
  },
  {
    code: "700",
    label: "Arts, Media & Design",
    classification: "DDC",
    description: "Visual arts, architecture, interface design, and media studies.",
  },
  {
    code: "900",
    label: "History & Geography",
    classification: "DDC",
    description: "Historical records, maps, biography, and geographic archives.",
  },
  {
    code: "DA-001",
    label: "Digital Assets & Institutional Archive",
    classification: "LOCAL",
    description: "Born-digital files, datasets, PDFs, meeting records, and internal archives.",
    children: [
      {
        code: "DA-010",
        label: "Policy Documents",
        classification: "LOCAL",
        description: "Policies, SOPs, governance manuals, and strategic memos.",
      },
      {
        code: "DA-020",
        label: "Research Datasets",
        classification: "LOCAL",
        description: "Structured datasets, data dictionaries, and analysis exports.",
      },
      {
        code: "DA-030",
        label: "Media Repository",
        classification: "LOCAL",
        description: "Audio, video, photography, and digitized multimedia assets.",
      },
    ],
  },
];

export const libraryCirculationPolicies = [
  {
    title: "Loan Windows",
    description: "Standard monographs circulate for 14 days, journals for 7 days, and reference-only items never leave custody.",
  },
  {
    title: "Sensitive Assets",
    description: "Confidential and manuscript materials are restricted to supervised access or authorized staff checkout.",
  },
  {
    title: "Inventory Discipline",
    description: "Every checkout and check-in updates availability instantly. Missing items move to maintenance review before archival action.",
  },
];

export const libraryMetadataSchema = z.object({
  isbn: z.string().trim().max(32).optional(),
  publisher: z.string().trim().max(255).optional(),
  publicationYear: z.string().trim().max(16).optional(),
  language: z.string().trim().max(32).optional(),
  keywords: z.array(z.string().trim().min(1)).max(24).default([]),
  shelfLocation: z.string().trim().max(128).optional(),
  filePath: z.string().trim().max(2048).optional(),
  mimeType: z.string().trim().max(128).optional(),
  pageCount: z.number().int().positive().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const libraryItemInputSchema = z.object({
  title: z.string().trim().min(1).max(255),
  creator: z.string().trim().min(1).max(255),
  description: z.string().trim().max(4000).default(""),
  format: z.enum(libraryMaterialFormats),
  subjectCode: z.string().trim().min(1).max(64),
  classificationCode: z.string().trim().min(1).max(64),
  classificationSystem: z.enum(["DDC", "LCC", "LOCAL"]).default("DDC"),
  accessLevel: z.enum(libraryAccessLevels).default("public"),
  itemStatus: z.enum(libraryItemStatuses).default("available"),
  copiesTotal: z.number().int().min(1).max(999).default(1),
  copiesAvailable: z.number().int().min(0).max(999).optional(),
  metadata: libraryMetadataSchema.default({
    keywords: [],
  }),
});

export const libraryCheckoutSchema = z.object({
  borrowerName: z.string().trim().min(1).max(255),
  borrowerEmail: z.string().trim().email().max(255).optional(),
  dueAt: z.string().datetime({ offset: true }),
  note: z.string().trim().max(2000).optional(),
});

export interface LibraryLoanRecord {
  id: string;
  itemId: string;
  borrowerName: string;
  borrowerEmail: string | null;
  note: string;
  checkedOutAt: string;
  dueAt: string;
  returnedAt: string | null;
}

export interface LibraryCatalogItemSummary {
  id: string;
  title: string;
  creator: string;
  format: LibraryMaterialFormat;
  subjectCode: string;
  subjectPath: string;
  classificationCode: string;
  classificationSystem: "DDC" | "LCC" | "LOCAL";
  accessLevel: LibraryAccessLevel;
  itemStatus: LibraryItemStatus;
  copiesTotal: number;
  copiesAvailable: number;
  metadata: z.infer<typeof libraryMetadataSchema>;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryCatalogItemDetail extends LibraryCatalogItemSummary {
  description: string;
  activeLoan: LibraryLoanRecord | null;
  loanHistory: LibraryLoanRecord[];
}

export interface LibraryCatalogStats {
  totalItems: number;
  availableItems: number;
  activeLoans: number;
  digitalAssets: number;
  restrictedItems: number;
  overdueLoans: number;
}

export interface LibraryCatalogListResponse {
  items: LibraryCatalogItemSummary[];
  pageInfo: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
  filters: {
    query: string | null;
    subjectCode: string | null;
    format: LibraryMaterialFormat | null;
    status: LibraryItemStatus | null;
    accessLevel: LibraryAccessLevel | null;
    availability: "all" | "available" | "checked_out";
  };
}

export function flattenLibraryTaxonomy(
  nodes: LibraryTaxonomyNode[],
  parentPath: string[] = [],
): Array<LibraryTaxonomyNode & { path: string[] }> {
  return nodes.flatMap((node) => {
    const path = [...parentPath, node.label];
    return [{ ...node, path }, ...flattenLibraryTaxonomy(node.children ?? [], path)];
  });
}

export function findLibraryTaxonomyNode(code: string): (LibraryTaxonomyNode & { path: string[] }) | null {
  return flattenLibraryTaxonomy(libraryTaxonomyTree).find((node) => node.code === code) ?? null;
}
