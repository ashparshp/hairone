import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Logo from './Logo';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      {/*
        We use a larger logo for the splash screen.
        Width 300 is a safe size for most mobile screens.
      */}
      <Logo width={300} height={120} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // True Black to match theme
    alignItems: 'center',
    justifyContent: 'center',
  },
});
