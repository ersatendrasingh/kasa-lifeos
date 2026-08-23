export type CaptureActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  category?: string;
  confidence?: number;
  submissionId?: string;
  title?: string;
  actionSummary?: string;
  classifier?: "AI" | "RULES";
};

export const initialCaptureState: CaptureActionState = { status: "idle" };
