export const Colors = {
  primary: '#2196F3',
  primaryLight: '#64B5F6',
  primaryDark: '#1976D2',
  secondary: '#FF9800',
  secondaryLight: '#FFB74D',
  background: '#F5F9FF',
  surface: '#FFFFFF',
  error: '#F44336',
  success: '#4CAF50',
  warning: '#FFC107',
  text: '#212121',
  textSecondary: '#757575',
  border: '#E3F2FD',
  gradientStart: '#2196F3',
  gradientEnd: '#21CBF3',
  kidAccent: '#4FC3F7',
  parentAccent: '#7986CB',
  communityAccent: '#4DB6AC',
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
};

export const Shadows = {
  small: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const Gradients = {
  primary: [Colors.gradientStart, Colors.gradientEnd],
  secondary: [Colors.secondary, Colors.secondaryLight],
  success: ['#4CAF50', '#8BC34A'],
  warning: ['#FF9800', '#FFC107'],
};