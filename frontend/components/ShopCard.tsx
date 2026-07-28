import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Heart, Star, MapPin, Clock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ScalePress } from './ScalePress';
import { Spacing } from '../constants/Spacing';

const { width } = Dimensions.get('window');

interface ShopCardProps {
  shop: any;
  onPress: () => void;
  index: number;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

export const ShopCard: React.FC<ShopCardProps> = ({ shop, onPress, index, isFavorite, onToggleFavorite }) => {
  const { colors } = useTheme();

  return (
    <ScalePress
      onPress={onPress}
      style={[
        styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          }
        ]}
      >
        {/* Compact Shop Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: shop.image || 'https://via.placeholder.com/400' }}
            style={styles.image}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.heartButton}
            onPress={() => onToggleFavorite && onToggleFavorite(shop._id)}
          >
            <Heart size={16} color={isFavorite ? colors.error : colors.white} fill={isFavorite ? colors.error : colors.transparent} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.ratingBadge}>
            <Star size={12} color={colors.ratingStar} fill={colors.ratingStar} />
            <Text style={styles.ratingText}>{shop.rating || 'New'}</Text>
            {/* <Text style={styles.reviewText}>({shop.reviews || 0})</Text> */}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {shop.name}
              </Text>
              <View style={styles.locationRow}>
                <MapPin size={12} color={colors.primary} />
                <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                  {shop.address} • {shop.distance ? `${shop.distance.toFixed(1)} km` : 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.tagsRow}>
            <View style={[styles.tag, { backgroundColor: colors.tagBackground }]}>
                <Text style={[styles.tagText, { color: colors.tagText }]}>{shop.type || 'Unisex'}</Text>
            </View>
             {/* Add more tags if available in future */}
          </View>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={styles.slotInfo}>
              <View style={[styles.clockIcon, { backgroundColor: colors.slotIconBackground }]}>
                <Clock size={16} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.slotLabel, { color: colors.textMuted }]}>Earliest</Text>
                <Text style={[styles.slotValue, { color: colors.slotText }]}>
                  {shop.nextAvailableSlot || 'No slots'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.bookBtn, { backgroundColor: colors.buttonBackground }]}
              onPress={onPress}
            >
              <Text style={[styles.bookBtnText, { color: colors.buttonText }]}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScalePress>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.round.xl,
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    overflow: 'hidden',
    // Shadow logic handled by parent or elevation
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  imageContainer: {
    height: 160,
    borderRadius: Spacing.round.lg,
    overflow: 'hidden',
    marginTop: Spacing.md,
    marginHorizontal: Spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: Spacing.round.full, // 18 is half of 36, so full circle
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ratingBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Spacing.round.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  ratingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reviewText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '500',
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'System', // 'Poppins' if available
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Spacing.round.sm,
  },
  tagText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  slotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clockIcon: {
    width: 36,
    height: 36,
    borderRadius: Spacing.round.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  slotValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  bookBtn: {
    // backgroundColor handled in component via colors
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Spacing.round.md,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  bookBtnText: {
    // color handled in component
    fontSize: 12,
    fontWeight: 'bold',
  },
});
