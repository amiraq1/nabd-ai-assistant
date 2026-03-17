export interface StudioPromptScene {
  id: "retail-pulse" | "clinic-quiet" | "archive-command";
  title: string;
  label: string;
  description: string;
  prompt: string;
  palette: string;
}

export const STUDIO_PROMPT_SCENES: StudioPromptScene[] = [
  {
    id: "retail-pulse",
    title: "Retail Pulse",
    label: "Luxury Commerce",
    description:
      "A premium analytics surface for product performance, inventory pressure, and VIP customer flows.",
    prompt:
      "Build a luxury retail analytics app with a product catalog, stock pressure alerts, VIP client CRM, and a responsive command dashboard.",
    palette:
      "border-amber-300/18 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_42%),linear-gradient(160deg,rgba(30,20,7,0.96),rgba(11,10,10,0.92))]",
  },
  {
    id: "clinic-quiet",
    title: "Clinic Quiet",
    label: "Healthcare Ops",
    description:
      "A calm but precise patient operations layer with appointment orchestration, notes, and intake flow.",
    prompt:
      "Build a healthcare operations app with appointment scheduling, patient intake cards, clinician notes, billing status, and a clean responsive admin dashboard.",
    palette:
      "border-cyan-300/18 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_42%),linear-gradient(160deg,rgba(7,22,28,0.96),rgba(11,10,10,0.92))]",
  },
  {
    id: "archive-command",
    title: "Archive Command",
    label: "Knowledge Systems",
    description:
      "A serious archival interface for digital preservation, controlled circulation, and metadata-heavy retrieval.",
    prompt:
      "Build a digital archive management app with strict metadata cataloging, circulation tracking, preservation queues, and a responsive librarian dashboard.",
    palette:
      "border-emerald-300/18 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.22),transparent_42%),linear-gradient(160deg,rgba(8,23,18,0.96),rgba(11,10,10,0.92))]",
  },
];
