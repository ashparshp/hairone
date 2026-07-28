import React, { useRef } from 'react';
import { Pressable, Animated, ViewStyle, StyleProp } from 'react-native';

interface ScalePressProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  disabled?: boolean;
}

/**
 * A wrapper component that scales down when pressed.
 */
export const ScalePress = ({
  children,
  onPress,
  style,
  scaleTo = 0.96,
  disabled = false
}: ScalePressProps) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleValue, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  return (
    <Pressable
      onPressIn={!disabled ? onPressIn : undefined}
      onPressOut={!disabled ? onPressOut : undefined}
      onPress={!disabled ? onPress : undefined}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleValue }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};
