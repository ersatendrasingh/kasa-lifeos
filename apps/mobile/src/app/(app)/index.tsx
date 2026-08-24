import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  Animated,
  DeviceEventEmitter,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import healthWellnessHero from "../../../assets/images/health-wellness-hero.png";
import momentumHero from "../../../assets/images/momentum-hero.png";
import { AppHeader } from "@/components/app-header";
import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { loadLifeOverview, type LifeOverview } from "@/lib/life-overview";
import {
  getProfileDetails,
  PROFILE_CHANGED_EVENT,
} from "@/lib/profile-details";

const quickModules = [
  { label: "Capture", icon: "sparkles", href: "/inbox" },
  { label: "Calendar", icon: "calendar", href: "/calendar" },
  { label: "Health", icon: "heart.fill", href: "/health" },
  { label: "Money", icon: "indianrupeesign.circle", href: "/money" },
  { label: "People", icon: "person.2.fill", href: "/people" },
  { label: "To-dos", icon: "checklist", href: "/responsibilities" },
  { label: "Learning", icon: "book.closed.fill", href: "/learning" },
  { label: "Growth", icon: "chart.line.uptrend.xyaxis", href: "/growth" },
  { label: "Vault", icon: "lock.doc.fill", href: "/life-vault" },
  { label: "Timeline", icon: "clock.arrow.circlepath", href: "/timeline" },
] as const;

const momentumModules = [
  {
    label: "Learning",
    detail: "Keep learning",
    icon: "book.closed.fill",
    href: "/learning",
  },
  {
    label: "Growth",
    detail: "Move your goals",
    icon: "chart.line.uptrend.xyaxis",
    href: "/growth",
  },
  {
    label: "To-dos",
    detail: "Stay ahead",
    icon: "checklist",
    href: "/responsibilities",
  },
] as const;

const confettiStyles = [
  { backgroundColor: "#FFD166", left: 7, top: 11 },
  { backgroundColor: "#FF657A", left: 39, top: 0 },
  { backgroundColor: "#FFE4A6", left: 73, top: 18 },
  { backgroundColor: "#FF91A2", left: 111, top: 4 },
  { backgroundColor: "#FFD166", left: 149, top: 15 },
  { backgroundColor: "#FFE4A6", left: 188, top: 2 },
  { backgroundColor: "#FF657A", left: 222, top: 17 },
  { backgroundColor: "#FFD166", left: 261, top: 7 },
  { backgroundColor: "#FFE4A6", left: 300, top: 14 },
] as const;

export default function TodayScreen() {
  const c = useTheme();
  const { data: session } = authClient.useSession();
  const [overview, setOverview] = useState<LifeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [preferredName, setPreferredName] = useState("");
  const [birthday, setBirthday] = useState("");
  const firstName =
    preferredName.trim() ||
    session?.user.name?.trim().split(/\s+/)[0] ||
    "there";
  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const glanceOrder = ["calendar", "responsibilities", "vault", "captures"];
  const glanceAreas = overview?.areas
    .filter((area) => glanceOrder.includes(area.id))
    .sort((a, b) => glanceOrder.indexOf(a.id) - glanceOrder.indexOf(b.id));

  async function load(background = false) {
    if (background) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);
    try {
      setOverview(await loadLifeOverview());
    } catch {
      setOverview(null);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    void loadLifeOverview()
      .then((data) => {
        if (active) {
          setOverview(data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (active) {
          setOverview(null);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;
    const refreshIdentity = () => {
      void getProfileDetails(session.user.id).then((details) => {
        if (active) setPreferredName(details.preferredName);
        if (active) setBirthday(details.birthday);
      });
    };
    refreshIdentity();
    const subscription = DeviceEventEmitter.addListener(
      PROFILE_CHANGED_EVENT,
      refreshIdentity,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, [session?.user.id]);

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={c.brand}
              onRefresh={() => void load(true)}
            />
          }
        >
          <AppHeader label={date} />

          {loading ? (
            <HomeSkeleton colors={c} />
          ) : loadError || !overview ? (
            <HomeLoadError colors={c} onRetry={() => void load()} />
          ) : (
            <>
              <Text style={[s.greeting, { color: c.text }]}>
                {greeting}, {firstName} 👋
              </Text>
              <Text style={[s.subtitle, { color: c.textSecondary }]}>
                Here&apos;s what matters today.
              </Text>

              <View style={[s.hero, { backgroundColor: c.brand }]}>
                <View style={s.heroOrbOne} />
                <View style={s.heroOrbTwo} />
                <HeroStatusStack
                  birthday={birthday}
                  score={overview.score}
                  streak={overview.streak}
                />
                <View style={s.heroBrandRow}>
                  <View style={s.heroBrandIdentity}>
                    <View style={s.heroBrandMark}>
                      <SymbolView
                        name="sparkles"
                        size={13}
                        tintColor="#FFFFFF"
                      />
                    </View>
                    <Text style={s.heroEyebrow}>KASA LIFE OS</Text>
                  </View>
                </View>
                <Text style={s.heroTitle}>Your whole life,{"\n"}in sync.</Text>
                <Text style={s.heroSubtitle}>
                  Plan what&apos;s next. Care for yourself. Grow with intention.
                </Text>
                <View style={s.heroPills}>
                  {[
                    ["calendar", "Plan", "/calendar"],
                    ["heart.fill", "Care", "/health"],
                    ["chart.line.uptrend.xyaxis", "Grow", "/growth"],
                  ].map(([icon, label, href]) => (
                    <Pressable
                      key={label}
                      onPress={() =>
                        router.push(href as "/calendar" | "/health" | "/growth")
                      }
                      style={({ pressed }) => [
                        s.heroPill,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <SymbolView
                        name={icon as never}
                        size={13}
                        tintColor="#FFFFFF"
                      />
                      <Text style={s.heroPillText}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={s.quickSection}>
                <View style={s.quickHeader}>
                  <Text style={[s.quickTitle, { color: c.text }]}>
                    Quick access
                  </Text>
                  <Text style={[s.quickHint, { color: c.textSecondary }]}>
                    Everything, one tap away
                  </Text>
                </View>
                <View style={s.quickGrid}>
                  {quickModules.map((module) => (
                    <Pressable
                      key={module.href}
                      accessibilityLabel={module.label}
                      onPress={() => {
                        void Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light,
                        );
                        router.push(module.href);
                      }}
                      style={({ pressed }) => [
                        s.quickItem,
                        pressed && { opacity: 0.66 },
                      ]}
                    >
                      <View
                        style={[
                          s.quickIcon,
                          { backgroundColor: c.surface, borderColor: c.border },
                        ]}
                      >
                        <View
                          style={[
                            s.quickIconInner,
                            { backgroundColor: c.brandSoft },
                          ]}
                        >
                          <SymbolView
                            name={module.icon as never}
                            size={18}
                            tintColor={c.brand}
                          />
                        </View>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[s.quickLabel, { color: c.text }]}
                      >
                        {module.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <WellbeingHero overview={overview} colors={c} />

              <View style={s.sectionHeader}>
                <View>
                  <Text style={[s.sectionTitle, { color: c.text }]}>
                    Keep an eye on
                  </Text>
                  <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
                    The few updates that matter today
                  </Text>
                </View>
              </View>
              <View
                style={[
                  s.glanceList,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                {(glanceAreas ?? []).map((area, index) => (
                  <Pressable
                    key={area.id}
                    onPress={() => router.push(area.href)}
                    style={[
                      s.glanceRow,
                      index > 0 && {
                        borderTopColor: c.border,
                        borderTopWidth: 1,
                      },
                    ]}
                  >
                    <View
                      style={[s.glanceIcon, { backgroundColor: c.brandSoft }]}
                    >
                      <SymbolView
                        name={area.icon as never}
                        size={16}
                        tintColor={c.brand}
                      />
                    </View>
                    <View style={s.glanceCopy}>
                      <Text style={[s.glanceLabel, { color: c.text }]}>
                        {area.label}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[s.glanceDetail, { color: c.textSecondary }]}
                      >
                        {area.detail}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[s.glanceValue, { color: c.brand }]}
                    >
                      {area.value}
                    </Text>
                    <SymbolView
                      name="chevron.right"
                      size={11}
                      tintColor={c.textSecondary}
                    />
                  </Pressable>
                ))}
              </View>

              <View style={s.sectionHeader}>
                <View>
                  <Text style={[s.sectionTitle, { color: c.text }]}>
                    Build momentum
                  </Text>
                  <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
                    Make room for the life you want next
                  </Text>
                </View>
              </View>
              <ImageBackground
                source={momentumHero}
                resizeMode="cover"
                imageStyle={s.momentumImage}
                style={s.momentumHero}
              >
                <View style={s.momentumShade}>
                  <Text style={s.momentumEyebrow}>ONE STEP AT A TIME</Text>
                  <Text style={s.momentumTitle}>The good stuff compounds.</Text>
                  <View style={s.momentumActions}>
                    {momentumModules.map((module) => (
                      <Pressable
                        key={module.href}
                        onPress={() => router.push(module.href)}
                        style={({ pressed }) => [
                          s.momentumAction,
                          pressed && { opacity: 0.68 },
                        ]}
                      >
                        <SymbolView
                          name={module.icon as never}
                          size={14}
                          tintColor="#FFFFFF"
                        />
                        <Text style={s.momentumActionLabel}>
                          {module.label}
                        </Text>
                        <SymbolView
                          name="chevron.right"
                          size={10}
                          tintColor="rgba(255,255,255,0.75)"
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              </ImageBackground>

              <View style={s.sectionHeader}>
                <View>
                  <Text style={[s.sectionTitle, { color: c.text }]}>
                    Needs attention
                  </Text>
                  <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
                    {overview.attention.length
                      ? "The items worth handling now"
                      : "Nothing urgent right now"}
                  </Text>
                </View>
                <View style={[s.countPill, { backgroundColor: c.brandSoft }]}>
                  <Text style={[s.countText, { color: c.brand }]}>
                    {overview.attention.length} NOW
                  </Text>
                </View>
              </View>
              <View
                style={[
                  s.attentionList,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                {overview.attention.map((item, i) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(item.href)}
                    style={[
                      s.attentionRow,
                      i > 0 && { borderTopColor: c.border, borderTopWidth: 1 },
                    ]}
                  >
                    <View
                      style={[
                        s.attentionIcon,
                        { backgroundColor: c.brandSoft },
                      ]}
                    >
                      <SymbolView
                        name={item.icon as never}
                        size={14}
                        tintColor={c.brand}
                      />
                    </View>
                    <View style={s.attentionCopy}>
                      <Text style={[s.attentionTitle, { color: c.text }]}>
                        {item.title}
                      </Text>
                      <Text
                        style={[s.attentionDetail, { color: c.textSecondary }]}
                      >
                        {item.detail}
                      </Text>
                    </View>
                    {item.action ? (
                      <View
                        style={[
                          s.attentionAction,
                          { backgroundColor: c.brandSoft },
                        ]}
                      >
                        <Text
                          style={[s.attentionActionText, { color: c.brand }]}
                        >
                          {item.action}
                        </Text>
                      </View>
                    ) : null}
                    <SymbolView
                      name="chevron.right"
                      size={11}
                      tintColor={c.textSecondary}
                    />
                  </Pressable>
                ))}
                {!overview.attention.length && (
                  <View style={s.attentionEmpty}>
                    <View
                      style={[
                        s.attentionIcon,
                        { backgroundColor: c.brandSoft },
                      ]}
                    >
                      <SymbolView
                        name="checkmark"
                        size={14}
                        tintColor={c.brand}
                      />
                    </View>
                    <View style={s.attentionCopy}>
                      <Text style={[s.attentionTitle, { color: c.text }]}>
                        You&apos;re clear for now
                      </Text>
                      <Text
                        style={[s.attentionDetail, { color: c.textSecondary }]}
                      >
                        KASA will surface the next thing when it needs you.
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={s.sectionHeader}>
                <View>
                  <Text style={[s.sectionTitle, { color: c.text }]}>
                    Coming up
                  </Text>
                  <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
                    Your next dated commitment
                  </Text>
                </View>
              </View>
              {overview.upcoming ? (
                <Pressable
                  onPress={() => router.push(overview.upcoming!.href)}
                  style={[s.upcoming, { backgroundColor: c.backgroundElement }]}
                >
                  <View style={s.upcomingDate}>
                    <Text style={[s.upcomingDay, { color: c.brand }]}>
                      {new Date(overview.upcoming.date!).getDate()}
                    </Text>
                    <Text style={[s.upcomingMonth, { color: c.brand }]}>
                      {new Intl.DateTimeFormat("en-IN", { month: "short" })
                        .format(new Date(overview.upcoming.date!))
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.upcomingCopy}>
                    <Text style={[s.upcomingLabel, { color: c.textSecondary }]}>
                      NEXT ON YOUR CALENDAR
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[s.upcomingTitle, { color: c.text }]}
                    >
                      {overview.upcoming.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[s.upcomingDetail, { color: c.textSecondary }]}
                    >
                      {overview.upcoming.detail}
                    </Text>
                  </View>
                  <SymbolView
                    name="arrow.right"
                    size={14}
                    tintColor={c.brand}
                  />
                </Pressable>
              ) : (
                <View
                  style={[
                    s.upcomingEmpty,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <SymbolView
                    name="calendar.badge.checkmark"
                    size={17}
                    tintColor={c.brand}
                  />
                  <Text
                    style={[s.upcomingEmptyText, { color: c.textSecondary }]}
                  >
                    Nothing scheduled next—enjoy the space.
                  </Text>
                </View>
              )}
              <View style={s.appFooter}>
                <View style={[s.footerMark, { backgroundColor: c.brandSoft }]}>
                  <SymbolView name="sparkles" size={11} tintColor={c.brand} />
                </View>
                <Text style={[s.footerText, { color: c.textSecondary }]}>
                  KASA keeps your day gently in view.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

type Theme = ReturnType<typeof useTheme>;

function HomeSkeleton({ colors: c }: { colors: Theme }) {
  const block = { backgroundColor: c.backgroundElement };
  return (
    <View style={s.skeletonRoot} accessibilityLabel="Loading your day">
      <View style={[s.skeletonGreeting, block]} />
      <View style={[s.skeletonSubtitle, block]} />
      <View style={[s.skeletonHero, block]}>
        <KasaSpinner size={25} />
      </View>
      <View style={s.skeletonQuickRow}>
        {Array.from({ length: 5 }).map((_, index) => (
          <View key={index} style={[s.skeletonQuick, block]} />
        ))}
      </View>
      <View style={s.skeletonSectionRow}>
        <View style={[s.skeletonSectionTitle, block]} />
        <View style={[s.skeletonSectionAction, block]} />
      </View>
      <View style={s.skeletonCards}>
        <View style={[s.skeletonCard, block]} />
        <View style={[s.skeletonCard, block]} />
      </View>
      <View style={[s.skeletonList, block]} />
    </View>
  );
}

function HomeLoadError({
  colors: c,
  onRetry,
}: {
  colors: Theme;
  onRetry: () => void;
}) {
  return (
    <View style={s.loadError}>
      <View style={[s.loadErrorIcon, { backgroundColor: c.brandSoft }]}>
        <SymbolView name="wifi.exclamationmark" size={22} tintColor={c.brand} />
      </View>
      <Text style={[s.loadErrorTitle, { color: c.text }]}>
        Couldn’t load your day
      </Text>
      <Text style={[s.loadErrorText, { color: c.textSecondary }]}>
        Your data is safe. Check the development connection and try again.
      </Text>
      <Pressable
        onPress={onRetry}
        style={[s.retryButton, { backgroundColor: c.brand }]}
      >
        <Text style={s.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function WellbeingHero({
  overview,
  colors: c,
}: {
  overview: LifeOverview;
  colors: Theme;
}) {
  return (
    <>
      <View style={s.sectionHeader}>
        <View>
          <Text style={[s.sectionTitle, { color: c.text }]}>
            Your wellbeing
          </Text>
          <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
            Live readings from Health Hub
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Open Health Hub"
          onPress={() => router.push("/health")}
          style={[s.healthOpen, { backgroundColor: c.brandSoft }]}
        >
          <SymbolView name="heart.fill" size={14} tintColor={c.brand} />
          <SymbolView name="arrow.up.right" size={10} tintColor={c.brand} />
        </Pressable>
      </View>
      <ImageBackground
        source={healthWellnessHero}
        resizeMode="cover"
        imageStyle={s.healthHeroImage}
        style={s.healthHero}
      >
        <View style={s.healthHeroShade}>
          <Pressable
            accessibilityLabel="Open Health Hub"
            onPress={() => router.push("/health")}
            style={s.healthHeroCopy}
          >
            <View style={s.healthHeroEyebrow}>
              <SymbolView name="heart.fill" size={12} tintColor="#FFFFFF" />
              <Text style={s.healthHeroEyebrowText}>HEALTH SNAPSHOT</Text>
            </View>
            <Text style={s.healthHeroTitle}>Feel good, stay in tune.</Text>
            <Text style={s.healthHeroSubtitle}>
              Small signals make a healthier rhythm.
            </Text>
          </Pressable>
          <View style={s.healthMetrics}>
            {overview.healthHighlights.map((item) => (
              <Pressable
                key={item.id}
                onPress={() =>
                  router.push({
                    pathname: "/health",
                    params: { measure: item.id },
                  })
                }
                style={({ pressed }) => [
                  s.healthCard,
                  pressed && { opacity: 0.72 },
                ]}
              >
                <Text style={s.healthLabel}>{item.label}</Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={s.healthValue}
                >
                  {item.value}
                </Text>
                <Text numberOfLines={1} style={s.healthDetail}>
                  {item.hasValue ? item.detail : "Tap to add"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ImageBackground>
    </>
  );
}

function birthdayState(value: string) {
  if (!value) return null;
  const birthday = new Date(value);
  if (Number.isNaN(birthday.getTime())) return null;
  const now = new Date();
  const today =
    now.getMonth() === birthday.getMonth() &&
    now.getDate() === birthday.getDate();
  const next = new Date(
    now.getFullYear(),
    birthday.getMonth(),
    birthday.getDate(),
  );
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    next.setFullYear(next.getFullYear() + 1);
  }
  return {
    today,
    next: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" })
      .format(next)
      .toUpperCase(),
  };
}

function HeroStatusStack({
  score,
  streak,
  birthday,
}: {
  score: number | null;
  streak: number;
  birthday: string;
}) {
  const birthdayInfo = birthdayState(birthday);
  const [balloonFloat] = useState(() => new Animated.Value(0));
  const [confettiFloat] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!birthdayInfo?.today) {
      balloonFloat.stopAnimation();
      confettiFloat.stopAnimation();
      balloonFloat.setValue(0);
      confettiFloat.setValue(0);
      return;
    }
    const balloonsAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(balloonFloat, {
          toValue: 1,
          duration: 1_500,
          useNativeDriver: true,
        }),
        Animated.timing(balloonFloat, {
          toValue: 0,
          duration: 1_500,
          useNativeDriver: true,
        }),
      ]),
    );
    const confettiAnimation = Animated.loop(
      Animated.timing(confettiFloat, {
        toValue: 1,
        duration: 2_900,
        useNativeDriver: true,
      }),
    );
    balloonsAnimation.start();
    confettiAnimation.start();
    return () => {
      balloonsAnimation.stop();
      confettiAnimation.stop();
    };
  }, [balloonFloat, birthdayInfo?.today, confettiFloat]);

  const lift = balloonFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });
  const confettiDrop = confettiFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 86],
  });
  const confettiFade = confettiFloat.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0, 1, 0],
  });

  return (
    <View style={s.heroStatusStack} pointerEvents="box-none">
      {birthdayInfo?.today ? (
        <View pointerEvents="none" style={s.birthdayCelebration}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
            <Animated.View
              key={index}
              style={[
                s.confetti,
                confettiStyles[index],
                {
                  opacity: confettiFade,
                  transform: [
                    {
                      translateY: Animated.add(confettiDrop, index * -12),
                    },
                    { rotate: `${index % 2 ? 28 : -22}deg` },
                  ],
                },
              ]}
            />
          ))}
          <Animated.View
            style={[
              s.celebrationBalloon,
              s.celebrationBalloonOne,
              { transform: [{ translateY: lift }] },
            ]}
          />
          <Animated.View
            style={[
              s.celebrationBalloon,
              s.celebrationBalloonTwo,
              { transform: [{ translateY: Animated.multiply(lift, -0.7) }] },
            ]}
          />
          <Animated.View
            style={[
              s.celebrationBalloon,
              s.celebrationBalloonThree,
              { transform: [{ translateY: Animated.multiply(lift, 0.6) }] },
            ]}
          />
        </View>
      ) : null}
      <View style={s.heroStatusChip}>
        <Text style={s.heroScoreValue}>{score === null ? "—" : score}</Text>
        <View style={s.heroScoreCopy}>
          <Text style={s.heroScoreLabel}>LIFE SCORE</Text>
          <Text style={s.heroScoreDetail}>Live balance</Text>
        </View>
      </View>
      {birthdayInfo ? (
        <Pressable
          accessibilityLabel={
            birthdayInfo.today ? "Happy birthday" : "View profile birthday"
          }
          onPress={() => router.push("/profile")}
          style={[s.heroStatusChip, birthdayInfo.today && s.heroBirthdayChip]}
        >
          <SymbolView name="gift.fill" size={14} tintColor="#FFFFFF" />
          <View style={s.heroScoreCopy}>
            <Text style={s.heroScoreLabel}>
              {birthdayInfo.today ? "HAPPY BIRTHDAY" : "NEXT BIRTHDAY"}
            </Text>
            <Text style={s.heroScoreDetail}>
              {birthdayInfo.today ? "It’s your day!" : birthdayInfo.next}
            </Text>
          </View>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel="Open Timeline"
        onPress={() => router.push("/timeline")}
        style={s.heroStatusChip}
      >
        <SymbolView name="flame.fill" size={14} tintColor="#FFFFFF" />
        <View style={s.heroScoreCopy}>
          <Text style={s.heroScoreLabel}>
            {streak} DAY{streak === 1 ? "" : "S"}
          </Text>
          <Text style={s.heroScoreDetail}>Your streak</Text>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 130 },
  greeting: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1.35,
  },
  subtitle: { fontSize: 14, marginTop: 5, marginBottom: 20 },
  hero: {
    borderRadius: 30,
    padding: 21,
    overflow: "hidden",
    boxShadow: "0 18px 40px rgba(223, 60, 13, 0.22)",
  },
  heroOrbOne: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 160,
    backgroundColor: "rgba(255,255,255,0.10)",
    right: -50,
    top: -70,
  },
  heroOrbTwo: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 100,
    borderWidth: 20,
    borderColor: "rgba(255,255,255,0.07)",
    left: -42,
    bottom: -62,
  },
  heroBrandRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  heroBrandIdentity: { alignItems: "center", flexDirection: "row", gap: 7 },
  heroBrandMark: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.17)",
    borderRadius: 10,
    height: 25,
    justifyContent: "center",
    width: 25,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.25,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 8,
    maxWidth: 205,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
    maxWidth: 205,
  },
  heroStatusStack: {
    gap: 6,
    position: "absolute",
    right: 17,
    top: 19,
    width: 108,
  },
  heroBirthdayChip: {
    backgroundColor: "rgba(185, 21, 43, 0.66)",
    borderColor: "rgba(255, 218, 222, 0.52)",
  },
  heroScoreValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -1,
  },
  heroScoreCopy: { justifyContent: "center" },
  heroScoreLabel: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  heroScoreDetail: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 6,
    fontWeight: "700",
    marginTop: 1,
  },
  birthdayCelebration: {
    height: 135,
    left: -232,
    position: "absolute",
    top: -18,
    width: 340,
    zIndex: 0,
  },
  confetti: {
    borderRadius: 2,
    height: 7,
    position: "absolute",
    width: 4,
  },
  celebrationBalloon: {
    borderRadius: 10,
    height: 22,
    position: "absolute",
    width: 17,
  },
  celebrationBalloonOne: { backgroundColor: "#FF405A", left: 35, top: 48 },
  celebrationBalloonTwo: { backgroundColor: "#FF9BA8", left: 66, top: 31 },
  celebrationBalloonThree: { backgroundColor: "#FFD1D8", left: 95, top: 57 },
  heroStatusChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    height: 31,
    paddingHorizontal: 9,
    zIndex: 1,
  },
  heroPills: { flexDirection: "row", gap: 7, marginTop: 18 },
  heroPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  heroPillText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  quickSection: { marginTop: 23 },
  quickHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  quickTitle: { fontSize: 17, fontWeight: "900", letterSpacing: -0.4 },
  quickHint: { fontSize: 9, fontWeight: "600" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 17 },
  quickItem: { alignItems: "center", width: "20%" },
  quickIcon: {
    alignItems: "center",
    borderRadius: 19,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 56,
    boxShadow: "0 7px 16px rgba(55,23,11,0.06)",
  },
  quickIconInner: {
    alignItems: "center",
    borderRadius: 14,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  quickLabel: {
    fontSize: 9,
    fontWeight: "800",
    marginTop: 7,
    maxWidth: 64,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 27,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.55 },
  sectionMeta: { fontSize: 10, marginTop: 3 },
  seeAll: { fontSize: 11, fontWeight: "800" },
  healthOpen: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 4,
    height: 34,
    justifyContent: "center",
    width: 42,
  },
  glanceList: { borderRadius: 22, borderWidth: 1, overflow: "hidden" },
  glanceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    minHeight: 67,
    paddingHorizontal: 13,
  },
  glanceIcon: {
    alignItems: "center",
    borderRadius: 13,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  glanceCopy: { flex: 1 },
  glanceLabel: { fontSize: 13, fontWeight: "800" },
  glanceDetail: { fontSize: 9, marginTop: 3 },
  glanceValue: {
    fontSize: 11,
    fontWeight: "900",
    maxWidth: 82,
    textAlign: "right",
  },
  healthHero: { height: 258, borderRadius: 28, overflow: "hidden" },
  healthHeroImage: { borderRadius: 28 },
  healthHeroShade: {
    backgroundColor: "rgba(25, 16, 11, 0.37)",
    flex: 1,
    justifyContent: "space-between",
    padding: 17,
  },
  healthHeroCopy: { alignSelf: "flex-start", maxWidth: "70%" },
  healthHeroEyebrow: { alignItems: "center", flexDirection: "row", gap: 6 },
  healthHeroEyebrowText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  healthHeroTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 27,
    marginTop: 9,
  },
  healthHeroSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },
  healthMetrics: { flexDirection: "row", gap: 7 },
  healthCard: {
    backgroundColor: "rgba(22, 15, 12, 0.61)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    padding: 10,
  },
  healthLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 8,
    fontWeight: "800",
  },
  healthValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  healthDetail: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 7,
    fontWeight: "700",
    marginTop: 4,
  },
  momentumHero: { height: 218, borderRadius: 27, overflow: "hidden" },
  momentumImage: { borderRadius: 27 },
  momentumShade: {
    backgroundColor: "rgba(27, 14, 8, 0.38)",
    flex: 1,
    justifyContent: "space-between",
    padding: 17,
  },
  momentumEyebrow: {
    color: "rgba(255,255,255,0.77)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  momentumTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: -34,
  },
  momentumActions: { flexDirection: "row", gap: 7 },
  momentumAction: {
    alignItems: "center",
    backgroundColor: "rgba(22, 14, 10, 0.62)",
    borderColor: "rgba(255,255,255,0.17)",
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minWidth: 0,
    paddingVertical: 9,
  },
  momentumActionLabel: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  countPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99 },
  countText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  attentionList: { borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  attentionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    minHeight: 70,
    paddingHorizontal: 13,
  },
  attentionEmpty: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    minHeight: 72,
    paddingHorizontal: 13,
  },
  attentionIcon: {
    alignItems: "center",
    borderRadius: 13,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  attentionCopy: { flex: 1 },
  attentionTitle: { fontSize: 13, fontWeight: "800" },
  attentionDetail: { fontSize: 9, marginTop: 3 },
  attentionAction: {
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  attentionActionText: { fontSize: 8, fontWeight: "900" },
  list: { borderWidth: 1, borderRadius: 25, paddingHorizontal: 14 },
  focusRow: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emptyFocus: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  check: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  focusCopy: { flex: 1 },
  focusTitle: { fontSize: 14, fontWeight: "700" },
  focusDetail: { fontSize: 10, marginTop: 3 },
  upcoming: {
    borderRadius: 23,
    padding: 14,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  upcomingDate: {
    width: 46,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(255,79,31,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingDay: { fontSize: 17, fontWeight: "900", lineHeight: 18 },
  upcomingMonth: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginTop: 2,
  },
  upcomingCopy: { flex: 1, marginLeft: 12 },
  upcomingLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 0.9 },
  upcomingTitle: { fontSize: 13, fontWeight: "800", marginTop: 3 },
  upcomingDetail: { fontSize: 9, marginTop: 3 },
  upcomingEmpty: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 56,
    paddingHorizontal: 15,
  },
  upcomingEmptyText: { fontSize: 10, fontWeight: "700" },
  appFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginTop: 28,
  },
  footerMark: {
    alignItems: "center",
    borderRadius: 9,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  footerText: { fontSize: 9, fontWeight: "700" },
  skeletonRoot: { paddingTop: 4 },
  skeletonGreeting: { width: "68%", height: 34, borderRadius: 13 },
  skeletonSubtitle: {
    width: "45%",
    height: 13,
    borderRadius: 7,
    marginTop: 9,
    marginBottom: 20,
  },
  skeletonHero: {
    height: 180,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonQuickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 25,
  },
  skeletonQuick: { borderRadius: 18, height: 58, width: 58 },
  skeletonSectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  skeletonSectionTitle: { width: 116, height: 24, borderRadius: 10 },
  skeletonSectionAction: { width: 48, height: 18, borderRadius: 9 },
  skeletonCards: { flexDirection: "row", gap: 11 },
  skeletonCard: { width: 210, height: 122, borderRadius: 26 },
  skeletonList: { height: 150, borderRadius: 25, marginTop: 28 },
  loadError: { minHeight: 430, alignItems: "center", justifyContent: "center" },
  loadErrorIcon: {
    width: 52,
    height: 52,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  loadErrorTitle: { fontSize: 19, fontWeight: "900", marginTop: 14 },
  loadErrorText: {
    maxWidth: 280,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },
  retryButton: {
    height: 43,
    borderRadius: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
});
