import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F4EE',
  card: '#FFFFFF',
  text: '#1B2420',
  muted: '#6B7570',
  accent: '#1F7A5C',
  accentText: '#FFFFFF',
  line: '#E3DFD3',
  warn: '#A15C00',
};
const dark: typeof light = {
  bg: '#0F1512',
  card: '#18211C',
  text: '#EAF1EC',
  muted: '#93A39A',
  accent: '#4CC09A',
  accentText: '#0B1A14',
  line: '#26332C',
  warn: '#E0A04A',
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
