import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  View,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";

const APPLE_SPINNER_SEGMENTS = Array.from({ length: 12 }, (_, index) => index);

export function KasaSpinner({
  size = 22,
  color,
}: {
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  const spinnerColor = color ?? theme.brand;

  if (Platform.OS === "ios") {
    return (
      <ActivityIndicator
        accessibilityLabel="Loading"
        animating
        color={spinnerColor}
        size={size}
        style={{ width: size, height: size }}
      />
    );
  }

  return <AppleSpinnerFallback size={size} color={spinnerColor} />;
}

function AppleSpinnerFallback({
  size,
  color,
}: {
  size: number;
  color: string;
}) {
  const [rotation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1_000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [rotation]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={{ width: size, height: size }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [
            {
              rotate: rotation.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "360deg"],
              }),
            },
          ],
        }}
      >
        {APPLE_SPINNER_SEGMENTS.map((index) => (
          <View
            key={index}
            style={{
              position: "absolute",
              width: size,
              height: size,
              opacity: 1 - index * 0.065,
              transform: [{ rotate: `${index * 30}deg` }],
            }}
          >
            <View
              style={{
                position: "absolute",
                top: size * 0.04,
                left: size * 0.45,
                width: size * 0.1,
                height: size * 0.29,
                borderRadius: size,
                backgroundColor: color,
              }}
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
