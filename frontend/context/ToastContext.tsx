import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react-native';
import { useTheme } from './ThemeContext';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextData {
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('success');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
    });
  }, [fadeAnim]);

  const showToast = useCallback((msg: string, t: ToastType = 'success') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setMessage(msg);
    setType(t);
    setVisible(true);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, 3000);
  }, [fadeAnim, hideToast]);

  const iconColor = colors.white;
  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle size={24} color={iconColor} />;
      case 'error': return <AlertCircle size={24} color={iconColor} />;
      default: return <Info size={24} color={iconColor} />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success': return colors.statusSuccess;
      case 'error': return colors.statusDanger;
      default: return colors.statusInfo;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {visible && (
        <Animated.View style={[styles.toastContainer, { opacity: fadeAnim, backgroundColor: getBgColor() }]}>
          <View style={styles.content}>
             {getIcon()}
             <Text style={[styles.text, { color: colors.white }]}>{message}</Text>
          </View>
          <TouchableOpacity
            onPress={hideToast}
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
          >
            <X size={20} color={colors.white} style={{opacity: 0.8}} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  text: {
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  }
});
