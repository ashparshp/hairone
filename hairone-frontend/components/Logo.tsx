import React from 'react';
import Svg, { G, Circle, Path, Rect, Text, TSpan } from 'react-native-svg';

interface LogoProps {
  width?: number;
  height?: number;
}

export default function Logo({ width = 256, height = 100 }: LogoProps) {
  return (
    <Svg viewBox="0 0 512 200" width={width} height={height}>
      <G transform="translate(80, 100)">
        {/* Icon Circle */}
        <Circle cx="0" cy="0" r="70" fill="#D4AF37" />

        {/* Icon Details (Comb/Scissors) - White for Dark Mode */}
        <G fill="#FFFFFF">
          <Path d="M-35,10 C-35,-20 -20,-40 0,-40 C20,-40 35,-20 35,10 L25,10 C25,-10 15,-25 0,-25 C-15,-25 -25,-10 -25,10 Z" />
          <Rect x="-10" y="-15" width="6" height="40" rx="3" />
          <Rect x="4" y="-15" width="6" height="40" rx="3" />
          <Rect x="-24" y="-5" width="6" height="30" rx="3" />
          <Rect x="18" y="-5" width="6" height="30" rx="3" />
        </G>
      </G>

      <G transform="translate(180, 125)">
        <Text
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="80"
          fontWeight="bold"
          fill="#FFFFFF" // "hair" text - White for Dark Mode
        >
          hair
          <TSpan fill="#D4AF37">one</TSpan> {/* "one" text - Gold */}
        </Text>
      </G>
    </Svg>
  );
}
