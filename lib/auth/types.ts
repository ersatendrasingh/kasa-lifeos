export type AuthActionState = {
  status: "idle" | "error" | "otp_sent";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  identifier?: string;
  intent?: "SIGN_IN" | "SIGN_UP";
  name?: string;
  previewCode?: string;
};

export const initialAuthState: AuthActionState = { status: "idle" };
