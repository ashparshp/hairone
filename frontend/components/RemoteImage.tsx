import React, { useState, useEffect } from 'react';
import { Image, ImageProps, ImageStyle, StyleProp } from 'react-native';
import { FALLBACK_SHOP_IMAGE } from '../constants/Images';

interface RemoteImageProps extends Omit<ImageProps, 'source'> {
  uri?: string | null;
  fallbackUri?: string;
  style?: StyleProp<ImageStyle>;
}

export function RemoteImage({
  uri,
  fallbackUri = FALLBACK_SHOP_IMAGE,
  style,
  onError,
  ...props
}: RemoteImageProps) {
  const resolvedUri = uri || fallbackUri;
  const [currentUri, setCurrentUri] = useState(resolvedUri);

  useEffect(() => {
    setCurrentUri(uri || fallbackUri);
  }, [uri, fallbackUri]);

  return (
    <Image
      {...props}
      source={{ uri: currentUri }}
      style={style}
      onError={(event) => {
        if (currentUri !== fallbackUri) {
          setCurrentUri(fallbackUri);
        }
        onError?.(event);
      }}
    />
  );
}
