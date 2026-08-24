import * as SecureStore from "expo-secure-store";
import { File } from "expo-file-system";
import { DeviceEventEmitter } from "react-native";

import { apiFetch } from "@/lib/api-client";

export type ProfileDetails = {
  birthday: string;
  phone: string;
  preferredName: string;
  biologicalSex: "male" | "female" | "";
  heightCm: number | null;
  panNumber: string;
  aadhaarNumber: string;
  bloodGroup: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  avatarUrl: string;
};

const emptyProfile: ProfileDetails = {
  birthday: "",
  phone: "",
  preferredName: "",
  biologicalSex: "",
  heightCm: null,
  panNumber: "",
  aadhaarNumber: "",
  bloodGroup: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  avatarUrl: "",
};

export const PROFILE_CHANGED_EVENT = "kasa:profile-changed";

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
  DeviceEventEmitter.emit(PROFILE_CHANGED_EVENT);
}

export async function uploadProfileAvatar(input: {
  uri: string;
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}) {
  const file = new File(input.uri);
  if (!file.exists || file.size === 0)
    throw new Error("KASA could not access this photo.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Choose a profile photo smaller than 5 MB.");
  const response = await apiFetch<{ imageKey: string }>("/api/profile/avatar", {
    method: "POST",
    body: {
      fileName: input.fileName || file.name || "profile-photo.jpg",
      mimeType: input.mimeType,
      fileData: await file.base64(),
    },
  });
  if (response.error) throw new Error(response.error.message);
  DeviceEventEmitter.emit(PROFILE_CHANGED_EVENT);
  return response.data?.imageKey;
}
