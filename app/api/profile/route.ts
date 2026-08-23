import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ProfilePreferences = {
  birthday?: string;
  phone?: string;
};

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { preferredName: true, preferences: true },
  });
  const preferences = (profile?.preferences ?? {}) as ProfilePreferences;

  return Response.json({
    birthday: preferences.birthday ?? "",
    phone: preferences.phone ?? "",
    preferredName: profile?.preferredName ?? "",
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
  const profile = await db.userProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      preferredName: body.preferredName?.trim() || null,
      preferences: {
        birthday: body.birthday?.trim() ?? "",
        phone: body.phone?.trim() ?? "",
      },
    },
    update: {
      preferredName: body.preferredName?.trim() || null,
      preferences: {
        birthday: body.birthday?.trim() ?? "",
        phone: body.phone?.trim() ?? "",
      },
    },
    select: { preferredName: true, preferences: true },
  });
  const preferences = (profile.preferences ?? {}) as ProfilePreferences;

  return Response.json({
    birthday: preferences.birthday ?? "",
    phone: preferences.phone ?? "",
    preferredName: profile.preferredName ?? "",
  });
}
