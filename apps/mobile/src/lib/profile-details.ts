import * as SecureStore from "expo-secure-store";

import { apiFetch } from "@/lib/api-client";

export type ProfileDetails = {
  birthday: string;
  phone: string;
  preferredName: string;
};

const emptyProfile: ProfileDetails = {
  birthday: "",
  phone: "",
  preferredName: "",
};

function key(userId: string) {
  return `kasa.profile.${userId}`;
}

export async function getProfileDetails(userId: string) {
  try {
    const response = await apiFetch<ProfileDetails>("/api/profile");
    if (response.data) {
      await SecureStore.setItemAsync(
        key(userId),
        JSON.stringify(response.data),
      );
      return { ...emptyProfile, ...response.data };
    }
  } catch {
    // Use the encrypted cache while offline.
  }
  const stored = await SecureStore.getItemAsync(key(userId));
  if (!stored) return emptyProfile;
  try {
    return {
      ...emptyProfile,
      ...(JSON.parse(stored) as Partial<ProfileDetails>),
    };
  } catch {
    return emptyProfile;
  }
}

export async function saveProfileDetails(
  userId: string,
  details: ProfileDetails,
) {
  const response = await apiFetch<ProfileDetails>("/api/profile", {
    method: "PATCH",
    body: details,
  });
  if (response.error) throw new Error(response.error.message);
  await SecureStore.setItemAsync(key(userId), JSON.stringify(details));
}
