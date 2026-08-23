import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signedProfileAvatarUrl } from "@/lib/storage/s3";

type ProfilePreferences = {
  birthday?: string;
  phone?: string;
  biologicalSex?: "male" | "female" | "";
  heightCm?: number | null;
};

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

  return Response.json({
    birthday: preferences.birthday ?? "",
    phone: preferences.phone ?? "",
    biologicalSex: preferences.biologicalSex ?? "",
    heightCm: preferences.heightCm ?? null,
    preferredName: profile?.preferredName ?? "",
    avatarUrl,
  });
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
      },
    },
    update: {
      preferredName: body.preferredName?.trim() || null,
      preferences: {
        birthday: body.birthday?.trim() ?? "",
        phone: body.phone?.trim() ?? "",
        biologicalSex,
        heightCm: normalizedHeight,
      },
    },
    select: { preferredName: true, preferences: true },
  });
  const preferences = (profile.preferences ?? {}) as ProfilePreferences;

  return Response.json({
    birthday: preferences.birthday ?? "",
    phone: preferences.phone ?? "",
    biologicalSex: preferences.biologicalSex ?? "",
    heightCm: preferences.heightCm ?? null,
    preferredName: profile.preferredName ?? "",
  });
}
