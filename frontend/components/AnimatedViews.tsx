import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: ViewStyle;
}

export const FadeInView = ({ children, delay = 0, duration = 500, style }: FadeInProps) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: duration,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: duration,
        delay: delay,
        useNativeDriver: true,
      })
    ]).start();
  }, [delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export const SlideInView = ({ children, from = 'right', delay = 0, duration = 300, style }: FadeInProps & { from?: 'left' | 'right' | 'bottom' }) => {
  const slideAnim = useRef(new Animated.Value(from === 'right' ? 50 : from === 'left' ? -50 : 50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
       Animated.timing(slideAnim, {
          toValue: 0,
          duration: duration,
          delay: delay,
          useNativeDriver: true
       }),
       Animated.timing(fadeAnim, {
          toValue: 1,
          duration: duration,
          delay: delay,
          useNativeDriver: true
       })
    ]).start();
  }, []);

  const transform = from === 'bottom' ? [{ translateY: slideAnim }] : [{ translateX: slideAnim }];

  return (
      <Animated.View style={[style, { transform, opacity: fadeAnim }]}>
          {children}
      </Animated.View>
  );
};
