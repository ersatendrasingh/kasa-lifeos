import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signedProfileAvatarUrl } from "@/lib/storage/s3";

type ProfilePreferences = {
  birthday?: string;
  phone?: string;
  biologicalSex?: "male" | "female" | "";
  heightCm?: number | null;
  panNumber?: string;
  aadhaarNumber?: string;
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_PATTERN = /^[2-9][0-9]{11}$/;
const BLOOD_GROUPS = new Set([
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
]);

function profileResponse(
  preferences: ProfilePreferences,
  preferredName = "",
  avatarUrl = "",
) {
  return {
    birthday: preferences.birthday ?? "",
    phone: preferences.phone ?? "",
    biologicalSex: preferences.biologicalSex ?? "",
    heightCm: preferences.heightCm ?? null,
    panNumber: preferences.panNumber ?? "",
    aadhaarNumber: preferences.aadhaarNumber ?? "",
    bloodGroup: preferences.bloodGroup ?? "",
    emergencyContactName: preferences.emergencyContactName ?? "",
    emergencyContactPhone: preferences.emergencyContactPhone ?? "",
    preferredName,
    avatarUrl,
  };
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      image: true,
      profile: { select: { preferredName: true, preferences: true } },
    },
  });
  const profile = user?.profile;
  const preferences = (profile?.preferences ?? {}) as ProfilePreferences;
  let avatarUrl = "";
  if (user?.image) {
    try {
      avatarUrl = await signedProfileAvatarUrl(user.image);
    } catch {
      // A legacy provider image is not a KASA-owned S3 key; ignore it safely.
    }
  }

  return Response.json(
    profileResponse(preferences, profile?.preferredName ?? "", avatarUrl),
  );
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ProfilePreferences & {
    preferredName?: string;
  };
  const heightCm = Number(body.heightCm);
  const normalizedHeight =
    Number.isFinite(heightCm) && heightCm >= 80 && heightCm <= 230
      ? heightCm
      : null;
  const biologicalSex = ["male", "female"].includes(body.biologicalSex ?? "")
    ? body.biologicalSex
    : "";
  const panNumber = (body.panNumber ?? "").replace(/\s/g, "").toUpperCase();
  const aadhaarNumber = (body.aadhaarNumber ?? "").replace(/\D/g, "");
  const bloodGroup = (body.bloodGroup ?? "").trim().toUpperCase();
  if (panNumber && !PAN_PATTERN.test(panNumber)) {
    return Response.json(
      { error: "Enter a valid PAN, for example ABCDE1234F." },
      { status: 400 },
    );
  }
  if (aadhaarNumber && !AADHAAR_PATTERN.test(aadhaarNumber)) {
    return Response.json(
      { error: "Enter a valid 12-digit Aadhaar number." },
      { status: 400 },
    );
  }
  if (bloodGroup && !BLOOD_GROUPS.has(bloodGroup)) {
    return Response.json(
      { error: "Choose a valid blood group." },
      { status: 400 },
    );
  }
  const profile = await db.userProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      preferredName: body.preferredName?.trim() || null,
      preferences: {
        birthday: body.birthday?.trim() ?? "",
        phone: body.phone?.trim() ?? "",
        biologicalSex,
        heightCm: normalizedHeight,
        panNumber,
        aadhaarNumber,
        bloodGroup,
        emergencyContactName: body.emergencyContactName?.trim() ?? "",
        emergencyContactPhone: body.emergencyContactPhone?.trim() ?? "",
      },
    },
    update: {
      preferredName: body.preferredName?.trim() || null,
      preferences: {
        birthday: body.birthday?.trim() ?? "",
        phone: body.phone?.trim() ?? "",
        biologicalSex,
        heightCm: normalizedHeight,
        panNumber,
        aadhaarNumber,
        bloodGroup,
        emergencyContactName: body.emergencyContactName?.trim() ?? "",
        emergencyContactPhone: body.emergencyContactPhone?.trim() ?? "",
      },
    },
    select: { preferredName: true, preferences: true },
  });
  const preferences = (profile.preferences ?? {}) as ProfilePreferences;

  return Response.json(
    profileResponse(preferences, profile.preferredName ?? ""),
  );
}
