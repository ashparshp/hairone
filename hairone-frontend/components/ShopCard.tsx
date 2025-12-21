import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Heart, Star, MapPin, Clock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { FadeInView } from './AnimatedViews';
import { ScalePress } from './ScalePress';

const { width } = Dimensions.get('window');

interface ShopCardProps {
  shop: any;
  onPress: () => void;
  index: number;
}

export const ShopCard: React.FC<ShopCardProps> = ({ shop, onPress, index }) => {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <FadeInView delay={index * 100}>
      <ScalePress
        onPress={onPress}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#0f172a' : '#ffffff', // Slate-900 or White
            borderColor: isDark ? '#1e293b' : '#f8fafc', // Slate-800 or Slate-50
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
          <TouchableOpacity style={styles.heartButton}>
            <Heart size={16} color="white" strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.ratingBadge}>
            <Star size={11} color="#fbbf24" fill="#fbbf24" />
            <Text style={styles.ratingText}>{shop.rating || 'New'}</Text>
            {/* <Text style={styles.reviewText}>({shop.reviews || 0})</Text> */}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]} numberOfLines={1}>
                {shop.name}
              </Text>
              <View style={styles.locationRow}>
                <MapPin size={11} color="#f59e0b" />
                <Text style={[styles.locationText, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>
                  {shop.address} • {shop.distance ? `${shop.distance.toFixed(1)} km` : 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.tagsRow}>
            <View style={[styles.tag, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                <Text style={[styles.tagText, { color: isDark ? '#94a3b8' : '#64748b' }]}>{shop.type || 'Unisex'}</Text>
            </View>
             {/* Add more tags if available in future */}
          </View>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
            <View style={styles.slotInfo}>
              <View style={[styles.clockIcon, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb' }]}>
                <Clock size={16} color="#f59e0b" />
              </View>
              <View>
                <Text style={[styles.slotLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>Earliest</Text>
                <Text style={[styles.slotValue, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  {shop.nextAvailableSlot || 'No slots'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.bookBtn}>
              <Text style={styles.bookBtnText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScalePress>
    </FadeInView>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 35, // 2.2rem approx
    marginBottom: 20,
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
    borderRadius: 25, // 1.6rem approx
    overflow: 'hidden',
    marginTop: 12,
    marginHorizontal: 12,
    alignSelf: 'center',
    width: width - 64, // adjusting for padding
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartButton: {
    position: 'absolute',
    top: 16,
    right: 16,
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
    bottom: 16,
    left: 16,
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
    fontSize: 11,
    fontWeight: 'bold',
  },
  reviewText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '500',
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
    fontFamily: 'System', // 'Poppins' if available
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 10,
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
    fontSize: 8,
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
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  slotValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  bookBtn: {
    backgroundColor: '#0f172a', // Slate-900 (Dark mode differs?)
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  bookBtnText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
