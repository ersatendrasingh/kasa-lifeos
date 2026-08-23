import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Redirect, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState, type ComponentProps } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import {
  getProfileDetails,
  saveProfileDetails,
  uploadProfileAvatar,
} from "@/lib/profile-details";

type HeightUnit = "cm" | "ft";

const phoneCountries = [
  { code: "IN", name: "India", dial: "+91" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "JP", name: "Japan", dial: "+81" },
] as const;

function localDialCode() {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const region = locale.split("-").find((part) => /^[A-Z]{2}$/.test(part));
  return phoneCountries.find((country) => country.code === region)?.dial ?? "+91";
}

function splitPhone(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const match = [...phoneCountries]
    .sort((first, second) => second.dial.length - first.dial.length)
    .find((country) => compact.startsWith(country.dial));
  return {
    dial: match?.dial ?? localDialCode(),
    number: match ? compact.slice(match.dial.length) : compact.replace(/^\+/, ""),
  };
}

function birthdayDate(value: string) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date(1995, 0, 1);
  return Number.isNaN(+date) ? new Date(1995, 0, 1) : date;
}

function birthdayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function heightParts(cm: number) {
  const totalInches = Math.round(cm / 2.54);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

function heightFromParts(feet: number, inches: number) {
  return Math.round((feet * 12 + inches) * 2.54);
}

function HeightWheel({
  values,
  selected,
  onChange,
  suffix,
  colors,
}: {
  values: number[];
  selected: number;
  onChange: (value: number) => void;
  suffix: string;
  colors: ReturnType<typeof useTheme>;
}) {
  const rowHeight = 42;
  const selectedIndex = Math.max(0, values.indexOf(selected));
  return (
    <View style={[s.wheel, { borderColor: colors.border }]}>
      <View
        pointerEvents="none"
        style={[s.wheelSelection, { backgroundColor: colors.brandSoft }]}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        snapToInterval={rowHeight}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: selectedIndex * rowHeight }}
        contentContainerStyle={s.wheelContent}
        onMomentumScrollEnd={(event) => {
          const index = Math.max(
            0,
            Math.min(
              values.length - 1,
              Math.round(event.nativeEvent.contentOffset.y / rowHeight),
            ),
          );
          onChange(values[index]);
        }}
      >
        {values.map((value) => (
          <View key={value} style={s.wheelRow}>
            <Text
              style={[
                s.wheelValue,
                {
                  color:
                    value === selected ? colors.text : colors.textSecondary,
                },
              ]}
            >
              {value}
              <Text style={s.wheelSuffix}> {suffix}</Text>
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function ProfileField({
  label,
  colors,
  ...props
}: {
  label: string;
  colors: ReturnType<typeof useTheme>;
} & ComponentProps<typeof TextInput>) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textSecondary}
        style={[
          s.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
      />
    </View>
  );
}

export default function EditProfileScreen() {
  const c = useTheme();
  const { data: session, isPending } = authClient.useSession();
  const [name, setName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneDialCode, setPhoneDialCode] = useState(localDialCode);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [birthday, setBirthday] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);
  const [heightPickerOpen, setHeightPickerOpen] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState(new Date(1995, 0, 1));
  const [heightDraftCm, setHeightDraftCm] = useState(170);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [biologicalSex, setBiologicalSex] = useState<"male" | "female" | "">(
    "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;
    getProfileDetails(session.user.id).then((details) => {
      setName(session.user.name || "");
      setPreferredName(details.preferredName);
      const parsedPhone = splitPhone(details.phone);
      setPhone(parsedPhone.number);
      setPhoneDialCode(parsedPhone.dial);
      setBirthday(details.birthday);
      setHeightCm(details.heightCm ? String(details.heightCm) : "");
      setBiologicalSex(details.biologicalSex);
      setAvatarUrl(details.avatarUrl);
    });
  }, [session?.user.id, session?.user.name]);

  async function save() {
    if (!session?.user.id || name.trim().length < 2) {
      setMessage("Please enter your full name.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await authClient.updateUser({ name: name.trim() });
      if (result.error) {
        setMessage(result.error.message || "Profile could not be updated.");
        return;
      }
      await saveProfileDetails(session.user.id, {
        birthday: birthday.trim(),
        phone: phone.trim() ? `${phoneDialCode} ${phone.trim()}` : "",
        preferredName: preferredName.trim(),
        heightCm: heightCm.trim() ? Number(heightCm) : null,
        biologicalSex,
        avatarUrl,
      });
      router.back();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Profile could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (isPending) {
    return (
      <View style={[s.center, { backgroundColor: c.background }]}>
        <KasaSpinner size={28} />
      </View>
    );
  }
  if (!session?.user) return <Redirect href="/sign-in" />;

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "K";
  const heightNumber = Number(heightCm);
  const heightDisplay = (() => {
    if (!Number.isFinite(heightNumber) || heightNumber <= 0)
      return "Choose height";
    if (heightUnit === "cm") return `${Math.round(heightNumber)} cm`;
    const parts = heightParts(heightNumber);
    return `${parts.feet} ft ${parts.inches} in`;
  })();

  function openBirthdayPicker() {
    setBirthdayDraft(birthdayDate(birthday));
    setBirthdayPickerOpen(true);
  }

  function openHeightPicker() {
    setHeightDraftCm(
      Number.isFinite(heightNumber) &&
        heightNumber >= 120 &&
        heightNumber <= 220
        ? Math.round(heightNumber)
        : 170,
    );
    setHeightPickerOpen(true);
  }

  async function chooseAvatar() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      setUploadingAvatar(true);
      setMessage(null);
      const image = await manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.88, format: SaveFormat.JPEG },
      );
      await uploadProfileAvatar({
        uri: image.uri,
        fileName: "kasa-profile.jpg",
        mimeType: "image/jpeg",
      });
      const details = await getProfileDetails(session!.user.id);
      setAvatarUrl(details.avatarUrl);
      setMessage("Profile photo updated.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Profile photo could not upload.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <Pressable
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={[
              s.navButton,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView name="chevron.left" size={17} tintColor={c.text} />
          </Pressable>
          <Text style={[s.navTitle, { color: c.text }]}>Edit profile</Text>
          <Pressable disabled={saving} onPress={save}>
            <Text style={[s.saveTop, { color: c.brand }]}>Save</Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.safe}
        >
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[s.avatar, { backgroundColor: c.brand }]}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={s.avatarImage}
                  alt=""
                />
              ) : (
                <Text style={s.avatarText}>{initials}</Text>
              )}
            </View>
            <Pressable
              disabled={uploadingAvatar}
              onPress={() => void chooseAvatar()}
              style={[s.changePhoto, { backgroundColor: c.brandSoft }]}
            >
              {uploadingAvatar ? (
                <KasaSpinner size={13} />
              ) : (
                <SymbolView name="camera.fill" size={12} tintColor={c.brand} />
              )}
              <Text style={[s.changePhotoText, { color: c.brand }]}>
                {uploadingAvatar ? "Uploading photo…" : "Change profile photo"}
              </Text>
            </Pressable>
            <Text style={[s.photoHint, { color: c.textSecondary }]}>
              Stored privately in your KASA account
            </Text>

            <ProfileField
              colors={c}
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
            />
            <ProfileField
              colors={c}
              label="What should KASA call you?"
              value={preferredName}
              onChangeText={setPreferredName}
              placeholder="Preferred name"
            />
            <View style={s.fieldWrap}>
              <Text style={[s.label, { color: c.text }]}>Phone number</Text>
              <View
                style={[
                  s.phoneField,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <Pressable
                  onPress={() => setCountryPickerOpen(true)}
                  style={[s.dialCodeButton, { backgroundColor: c.brandSoft }]}
                >
                  <Text style={[s.dialCode, { color: c.brand }]}>
                    {phoneDialCode}
                  </Text>
                  <SymbolView name="chevron.down" size={8} tintColor={c.brand} />
                </Pressable>
                <TextInput
                  value={phone}
                  onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ""))}
                  placeholder="Mobile number"
                  placeholderTextColor={c.textSecondary}
                  keyboardType="phone-pad"
                  style={[s.phoneInput, { color: c.text }]}
                />
              </View>
              <Text style={[s.healthHint, { color: c.textSecondary }]}>
                Country code selected from your device; tap it to change.
              </Text>
            </View>
            <View style={s.fieldWrap}>
              <Text style={[s.label, { color: c.text }]}>Birthday</Text>
              <Pressable
                onPress={openBirthdayPicker}
                style={[
                  s.pickerField,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View style={[s.pickerIcon, { backgroundColor: c.brandSoft }]}>
                  <SymbolView name="calendar" size={15} tintColor={c.brand} />
                </View>
                <Text
                  style={[
                    s.pickerFieldValue,
                    { color: birthday ? c.text : c.textSecondary },
                  ]}
                >
                  {birthday
                    ? new Intl.DateTimeFormat("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(birthdayDate(birthday))
                    : "Choose your birthday"}
                </Text>
                <SymbolView
                  name="chevron.right"
                  size={11}
                  tintColor={c.textSecondary}
                />
              </Pressable>
            </View>
            <View style={s.fieldWrap}>
              <View style={s.heightLabelRow}>
                <Text style={[s.label, { color: c.text }]}>Height</Text>
                <View
                  style={[
                    s.unitToggle,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  {(["cm", "ft"] as const).map((unit) => (
                    <Pressable
                      key={unit}
                      onPress={() => setHeightUnit(unit)}
                      style={[
                        s.unitOption,
                        heightUnit === unit && { backgroundColor: c.brand },
                      ]}
                    >
                      <Text
                        style={[
                          s.unitOptionText,
                          {
                            color:
                              heightUnit === unit ? "#FFFFFF" : c.textSecondary,
                          },
                        ]}
                      >
                        {unit === "cm" ? "cm" : "ft/in"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable
                onPress={openHeightPicker}
                style={[
                  s.pickerField,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View style={[s.pickerIcon, { backgroundColor: c.brandSoft }]}>
                  <SymbolView name="ruler.fill" size={15} tintColor={c.brand} />
                </View>
                <Text
                  style={[
                    s.pickerFieldValue,
                    { color: heightCm ? c.text : c.textSecondary },
                  ]}
                >
                  {heightDisplay}
                </Text>
                <SymbolView
                  name="chevron.right"
                  size={11}
                  tintColor={c.textSecondary}
                />
              </Pressable>
              <Text style={[s.healthHint, { color: c.textSecondary }]}>
                Used to personalise BMI, weight and scale insights.
              </Text>
            </View>
            <View style={s.fieldWrap}>
              <Text style={[s.label, { color: c.text }]}>Biological sex</Text>
              <View
                style={[
                  s.segmented,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                {(["male", "female"] as const).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setBiologicalSex(value)}
                    style={[
                      s.segment,
                      biologicalSex === value && { backgroundColor: c.brand },
                    ]}
                  >
                    <Text
                      style={[
                        s.segmentText,
                        {
                          color:
                            biologicalSex === value
                              ? "#FFFFFF"
                              : c.textSecondary,
                        },
                      ]}
                    >
                      {value === "male" ? "Male" : "Female"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[s.healthHint, { color: c.textSecondary }]}>
                Used only for health calculations from connected scales.
              </Text>
            </View>

            <View
              style={[s.emailCard, { backgroundColor: c.backgroundElement }]}
            >
              <SymbolView name="envelope.fill" size={16} tintColor={c.brand} />
              <View style={s.emailCopy}>
                <Text style={[s.emailLabel, { color: c.textSecondary }]}>
                  SIGNED-IN EMAIL
                </Text>
                <Text style={[s.email, { color: c.text }]}>
                  {session.user.email}
                </Text>
              </View>
              <SymbolView
                name="checkmark.seal.fill"
                size={16}
                tintColor={c.positive}
              />
            </View>
            {message ? <Text style={s.error}>{message}</Text> : null}
            <Pressable
              disabled={saving}
              onPress={save}
              style={[s.saveButton, { backgroundColor: c.brand }]}
            >
              {saving ? (
                <KasaSpinner color="#FFFFFF" size={20} />
              ) : (
                <>
                  <Text style={s.saveText}>Save changes</Text>
                  <SymbolView name="checkmark" size={15} tintColor="#FFFFFF" />
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Modal
        visible={countryPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCountryPickerOpen(false)}
      >
        <View style={s.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCountryPickerOpen(false)}
          />
          <View style={[s.countrySheet, { backgroundColor: c.background }]}>
            <View style={[s.handle, { backgroundColor: c.border }]} />
            <View style={s.sheetHead}>
              <View>
                <Text style={[s.sheetEyebrow, { color: c.brand }]}>
                  MOBILE NUMBER
                </Text>
                <Text style={[s.sheetTitle, { color: c.text }]}>
                  Choose country code
                </Text>
              </View>
              <Pressable
                onPress={() => setCountryPickerOpen(false)}
                style={[s.closeSheet, { backgroundColor: c.backgroundElement }]}
              >
                <SymbolView name="xmark" size={13} tintColor={c.text} />
              </Pressable>
            </View>
            {phoneCountries.map((country) => (
              <Pressable
                key={`${country.code}-${country.dial}`}
                onPress={() => {
                  setPhoneDialCode(country.dial);
                  setCountryPickerOpen(false);
                }}
                style={({ pressed }) => [
                  s.countryRow,
                  {
                    borderColor: c.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    s.countryCodeBadge,
                    {
                      backgroundColor:
                        phoneDialCode === country.dial
                          ? c.brandSoft
                          : c.backgroundElement,
                    },
                  ]}
                >
                  <Text style={[s.countryCodeText, { color: c.brand }]}>
                    {country.dial}
                  </Text>
                </View>
                <Text style={[s.countryName, { color: c.text }]}>
                  {country.name}
                </Text>
                {phoneDialCode === country.dial ? (
                  <SymbolView name="checkmark" size={12} tintColor={c.brand} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
      <Modal
        visible={birthdayPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBirthdayPickerOpen(false)}
      >
        <View style={s.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setBirthdayPickerOpen(false)}
          />
          <View style={[s.pickerSheet, { backgroundColor: c.background }]}>
            <View style={[s.handle, { backgroundColor: c.border }]} />
            <View style={s.sheetHead}>
              <View>
                <Text style={[s.sheetEyebrow, { color: c.brand }]}>
                  PERSONAL DETAILS
                </Text>
                <Text style={[s.sheetTitle, { color: c.text }]}>
                  Choose birthday
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setBirthday(birthdayString(birthdayDraft));
                  setBirthdayPickerOpen(false);
                }}
                style={[s.doneButton, { backgroundColor: c.brand }]}
              >
                <Text style={s.doneText}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={birthdayDraft}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              onValueChange={(_, date) => setBirthdayDraft(date)}
              textColor={c.text}
              style={s.dateSpinner}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={heightPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setHeightPickerOpen(false)}
      >
        <View style={s.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setHeightPickerOpen(false)}
          />
          <View style={[s.pickerSheet, { backgroundColor: c.background }]}>
            <View style={[s.handle, { backgroundColor: c.border }]} />
            <View style={s.sheetHead}>
              <View>
                <Text style={[s.sheetEyebrow, { color: c.brand }]}>
                  BODY PROFILE
                </Text>
                <Text style={[s.sheetTitle, { color: c.text }]}>
                  Choose height
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setHeightCm(String(heightDraftCm));
                  setHeightPickerOpen(false);
                }}
                style={[s.doneButton, { backgroundColor: c.brand }]}
              >
                <Text style={s.doneText}>Done</Text>
              </Pressable>
            </View>
            <View
              style={[
                s.pickerMode,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              {(["cm", "ft"] as const).map((unit) => (
                <Pressable
                  key={unit}
                  onPress={() => setHeightUnit(unit)}
                  style={[
                    s.pickerModeOption,
                    heightUnit === unit && { backgroundColor: c.brand },
                  ]}
                >
                  <Text
                    style={[
                      s.pickerModeText,
                      {
                        color:
                          heightUnit === unit ? "#FFFFFF" : c.textSecondary,
                      },
                    ]}
                  >
                    {unit === "cm" ? "Centimetres" : "Feet & inches"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {heightUnit === "cm" ? (
              <HeightWheel
                values={Array.from({ length: 101 }, (_, index) => 120 + index)}
                selected={heightDraftCm}
                onChange={setHeightDraftCm}
                suffix="cm"
                colors={c}
              />
            ) : (
              <View style={s.heightWheels}>
                <HeightWheel
                  values={[4, 5, 6, 7]}
                  selected={heightParts(heightDraftCm).feet}
                  onChange={(feet) =>
                    setHeightDraftCm(
                      heightFromParts(feet, heightParts(heightDraftCm).inches),
                    )
                  }
                  suffix="ft"
                  colors={c}
                />
                <HeightWheel
                  values={Array.from({ length: 12 }, (_, index) => index)}
                  selected={heightParts(heightDraftCm).inches}
                  onChange={(inches) =>
                    setHeightDraftCm(
                      heightFromParts(heightParts(heightDraftCm).feet, inches),
                    )
                  }
                  suffix="in"
                  colors={c}
                />
              </View>
            )}
            <Text style={[s.pickerSummary, { color: c.textSecondary }]}>
              {heightDraftCm} cm · {heightParts(heightDraftCm).feet} ft{" "}
              {heightParts(heightDraftCm).inches} in
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  nav: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: { fontSize: 16, fontWeight: "800" },
  saveTop: { fontSize: 13, fontWeight: "800", width: 40, textAlign: "right" },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 29,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 28px rgba(255,79,31,0.22)",
  },
  avatarText: { color: "#FFFFFF", fontSize: 25, fontWeight: "900" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 29 },
  changePhoto: {
    minHeight: 30,
    borderRadius: 12,
    alignSelf: "center",
    marginTop: 10,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  changePhotoText: { fontSize: 8, fontWeight: "900" },
  photoHint: {
    textAlign: "center",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 8,
    marginBottom: 20,
  },
  fieldWrap: { marginBottom: 15 },
  label: { fontSize: 12, fontWeight: "700", marginBottom: 7, marginLeft: 2 },
  input: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 15,
    fontSize: 14,
  },
  phoneField: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    padding: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  dialCodeButton: {
    height: "100%",
    minWidth: 68,
    borderRadius: 13,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dialCode: { fontSize: 11, fontWeight: "900" },
  phoneInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 11,
    fontSize: 14,
    fontWeight: "700",
  },
  pickerField: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
  },
  pickerIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerFieldValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 10,
  },
  heightLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unitToggle: {
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
    flexDirection: "row",
    marginBottom: 6,
  },
  unitOption: {
    borderRadius: 7,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  unitOptionText: { fontSize: 7, fontWeight: "900" },
  segmented: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    padding: 4,
    flexDirection: "row",
  },
  segment: {
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: { fontSize: 11, fontWeight: "800" },
  healthHint: { fontSize: 8, lineHeight: 12, marginTop: 6, marginLeft: 2 },
  emailCard: {
    minHeight: 66,
    borderRadius: 20,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  emailCopy: { flex: 1, marginLeft: 11 },
  emailLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  email: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  error: { color: "#D43C32", fontSize: 11, textAlign: "center", marginTop: 13 },
  saveButton: {
    height: 54,
    borderRadius: 18,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20,9,5,0.48)",
  },
  pickerSheet: {
    borderTopLeftRadius: 33,
    borderTopRightRadius: 33,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  countrySheet: {
    borderTopLeftRadius: 33,
    borderTopRightRadius: 33,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetEyebrow: { fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: 3,
  },
  doneButton: {
    height: 35,
    borderRadius: 13,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  closeSheet: {
    width: 35,
    height: 35,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  countryRow: {
    minHeight: 52,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  countryCodeBadge: {
    minWidth: 51,
    height: 29,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  countryCodeText: { fontSize: 9, fontWeight: "900" },
  countryName: { flex: 1, fontSize: 11, fontWeight: "800", marginLeft: 10 },
  dateSpinner: { height: 190, alignSelf: "center" },
  pickerMode: {
    height: 42,
    borderWidth: 1,
    borderRadius: 14,
    padding: 3,
    flexDirection: "row",
  },
  pickerModeOption: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerModeText: { fontSize: 9, fontWeight: "900" },
  wheel: {
    height: 174,
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 14,
    position: "relative",
  },
  wheelSelection: {
    position: "absolute",
    left: 8,
    right: 8,
    height: 42,
    top: 66,
    borderRadius: 12,
    zIndex: -1,
  },
  wheelContent: { paddingVertical: 66 },
  wheelRow: { height: 42, alignItems: "center", justifyContent: "center" },
  wheelValue: { fontSize: 18, fontWeight: "900" },
  wheelSuffix: { fontSize: 9, fontWeight: "700" },
  heightWheels: { flexDirection: "row", gap: 10 },
  pickerSummary: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 12,
  },
});
