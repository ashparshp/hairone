import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Heart, Star, MapPin, Clock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ScalePress } from './ScalePress';

const { width } = Dimensions.get('window');

interface ShopCardProps {
  shop: any;
  onPress: () => void;
  index: number;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

export const ShopCard: React.FC<ShopCardProps> = ({ shop, onPress, index, isFavorite, onToggleFavorite }) => {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <ScalePress
      onPress={onPress}
      style={[
        styles.card,
          {
            // UPDATED: Use colors.card and colors.border
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
            <Heart size={16} color={isFavorite ? colors.error : "white"} fill={isFavorite ? colors.error : "transparent"} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.ratingBadge}>
            <Star size={12} color={colors.tint} fill={colors.tint} />
            <Text style={styles.ratingText}>{shop.rating || 'New'}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              {/* UPDATED: Use colors.text */}
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {shop.name}
              </Text>
              <View style={styles.locationRow}>
                <MapPin size={12} color={colors.primary} />
                {/* UPDATED: Use colors.textMuted */}
                <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                  {shop.address} • {shop.distance ? `${shop.distance.toFixed(1)} km` : 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.tagsRow}>
            {/* UPDATED: Background logic */}
            <View style={[styles.tag, { backgroundColor: isDark ? colors.border : colors.background }]}>
                <Text style={[styles.tagText, { color: colors.textMuted }]}>{shop.type || 'Unisex'}</Text>
            </View>
          </View>

          {/* Footer */}
          {/* UPDATED: Border logic */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={styles.slotInfo}>
              <View style={[styles.clockIcon, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb' }]}>
                <Clock size={16} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.slotLabel, { color: colors.textMuted }]}>Earliest</Text>
                <Text style={[styles.slotValue, { color: colors.text }]}>
                  {shop.nextAvailableSlot || 'No slots'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.bookBtn, { backgroundColor: isDark ? colors.tint : '#0f172a' }]}
              onPress={onPress}
            >
              <Text style={[styles.bookBtnText, { color: isDark ? '#000' : 'white' }]}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScalePress>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24, 
    marginHorizontal: 24, 
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  imageContainer: {
    height: 160,
    borderRadius: 16, 
    overflow: 'hidden',
    marginTop: 12,
    marginHorizontal: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ratingBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
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
  content: {
    padding: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'System', 
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
    marginTop: 12,
    marginBottom: 16,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
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
    paddingTop: 16,
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
    borderRadius: 18,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  bookBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
