import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const SkeletonItem = ({ style }: { style: any }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return <Animated.View style={[style, { opacity }]} />;
};

export const ShopCardSkeleton = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const bg = isDark ? '#1e293b' : '#e2e8f0';
  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '#334155' : '#e2e8f0';

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      {/* Image Skeleton */}
      <SkeletonItem style={[styles.image, { backgroundColor: bg }]} />

      <View style={styles.content}>
        {/* Title & Badge */}
        <View style={styles.row}>
           <View style={{flex: 1}}>
              <SkeletonItem style={{ width: '60%', height: 20, backgroundColor: bg, borderRadius: 4, marginBottom: 8 }} />
              <SkeletonItem style={{ width: '40%', height: 14, backgroundColor: bg, borderRadius: 4 }} />
           </View>
        </View>

        {/* Tags */}
        <View style={styles.tagsRow}>
           <SkeletonItem style={{ width: 60, height: 24, backgroundColor: bg, borderRadius: 8 }} />
           <SkeletonItem style={{ width: 60, height: 24, backgroundColor: bg, borderRadius: 8 }} />
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: border }]}>
           <SkeletonItem style={{ width: 100, height: 30, backgroundColor: bg, borderRadius: 8 }} />
           <SkeletonItem style={{ width: 80, height: 36, backgroundColor: bg, borderRadius: 12 }} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    marginHorizontal: 24,
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    height: 160,
    borderRadius: 16,
    marginTop: 12,
    marginHorizontal: 12,
  },
  content: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  }
});
