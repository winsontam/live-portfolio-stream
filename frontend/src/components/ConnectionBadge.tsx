import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { ConnectionStatus } from '../store/marketStore';

interface Props {
  status: ConnectionStatus;
}

const CONFIG: Record<ConnectionStatus, { label: string | null; color: string }> = {
  [ConnectionStatus.CONNECTED]:    { label: 'Live',           color: '#22c55e' },
  [ConnectionStatus.CONNECTING]:   { label: 'Connecting…',   color: '#f59e0b' },
  [ConnectionStatus.RECONNECTING]: { label: 'Reconnecting…', color: '#f59e0b' },
  [ConnectionStatus.STALE]:        { label: '⚠ Stale',       color: '#ef4444' },
  [ConnectionStatus.DISCONNECTED]: { label: 'Disconnected',  color: '#6b7280' },
};

export const ConnectionBadge = React.memo(({ status }: Props) => {
  const { label, color } = CONFIG[status];
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === ConnectionStatus.CONNECTED) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulse.setValue(1);
    }
  }, [status, pulse]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: pulse }]} />
      {label && <Text style={[styles.text, { color }]}>{label}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:  { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
});
