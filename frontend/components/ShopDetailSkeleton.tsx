import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

function SkeletonItem({ style }: { style: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[style, { opacity }]} />;
}

function ServiceCardSkeleton({ bg, cardBg, border }: { bg: string; cardBg: string; border: string }) {
  return (
    <View style={[styles.serviceCard, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.row}>
        <SkeletonItem style={{ flex: 1, height: 22, backgroundColor: bg, borderRadius: 6, marginRight: 12 }} />
        <SkeletonItem style={{ width: 56, height: 18, backgroundColor: bg, borderRadius: 6 }} />
      </View>
      <View style={[styles.row, { marginTop: 16 }]}>
        <SkeletonItem style={{ width: 88, height: 14, backgroundColor: bg, borderRadius: 6 }} />
        <SkeletonItem style={{ width: 72, height: 32, backgroundColor: bg, borderRadius: 16 }} />
      </View>
    </View>
  );
}

function ListRowSkeleton({ bg, cardBg, border }: { bg: string; cardBg: string; border: string }) {
  return (
    <View style={[styles.listRow, { backgroundColor: cardBg, borderColor: border }]}>
      <SkeletonItem style={{ width: 40, height: 40, backgroundColor: bg, borderRadius: 20 }} />
      <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
        <SkeletonItem style={{ width: '45%', height: 14, backgroundColor: bg, borderRadius: 6 }} />
        <SkeletonItem style={{ width: '70%', height: 12, backgroundColor: bg, borderRadius: 6 }} />
      </View>
    </View>
  );
}

export function ShopDetailTabSkeleton({ variant = 'services' }: { variant?: 'services' | 'combos' | 'reviews' | 'gallery' }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const bg = isDark ? '#1e293b' : '#e2e8f0';
  const cardBg = isDark ? '#000000' : '#ffffff';
  const border = isDark ? '#27272a' : '#e5e7eb';

  if (variant === 'gallery') {
    return (
      <View style={styles.galleryGrid}>
        {[0, 1, 2, 3].map((item) => (
          <SkeletonItem
            key={item}
            style={[styles.galleryItem, { backgroundColor: bg, borderColor: border }]}
          />
        ))}
      </View>
    );
  }

  if (variant === 'services' || variant === 'combos') {
    return (
      <View>
        {[0, 1, 2].map((item) => (
          <ServiceCardSkeleton key={item} bg={bg} cardBg={cardBg} border={border} />
        ))}
      </View>
    );
  }

  return (
    <View>
      {[0, 1, 2].map((item) => (
        <ListRowSkeleton key={item} bg={bg} cardBg={cardBg} border={border} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  serviceCard: {
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  galleryItem: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
  },
});
