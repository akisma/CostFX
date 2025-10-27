import { StyleSheet, Text, View } from 'react-native';

const ACCENT_COLOR = '#38bdf8';
const BACKGROUND_COLOR = '#0f172a';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>CostFX Mobile</Text>
      <Text style={styles.subtitle}>Hello world! 👋</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Getting Started</Text>
        <Text style={styles.cardText}>Mobile workspace is ready for testing!</Text>
      </View>
      <Text style={styles.meta}>✓ Expo Go workflow</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 20,
    color: '#cbd5f5',
    marginBottom: 24
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    alignItems: 'center'
  },
  cardLabel: {
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    fontSize: 12
  },
  cardText: {
    color: '#e2e8f0',
    fontSize: 18,
    textAlign: 'center'
  },
  meta: {
    marginTop: 40,
    color: ACCENT_COLOR,
    fontSize: 14
  }
});
