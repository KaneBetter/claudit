import type { ITheme } from '@xterm/xterm';

export const lightTerminalTheme: ITheme = {
  background: '#f8f8f8',
  foreground: '#1e1e1e',
  cursor: '#d97756',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(217,119,86,0.2)',
  black: '#1e1e1e',
  red: '#cd3131',
  green: '#008000',
  yellow: '#795e26',
  blue: '#0451a5',
  magenta: '#af00db',
  cyan: '#0598bc',
  white: '#6a737d',
  brightBlack: '#6a737d',
  brightRed: '#cd3131',
  brightGreen: '#008000',
  brightYellow: '#795e26',
  brightBlue: '#0451a5',
  brightMagenta: '#af00db',
  brightCyan: '#0598bc',
  brightWhite: '#1e1e1e',
};

export const darkTerminalTheme: ITheme = {
  background: '#161819',
  foreground: '#d4d4d4',
  cursor: '#d97756',
  cursorAccent: '#161819',
  selectionBackground: 'rgba(217,119,86,0.3)',
  black: '#1e1e1e',
  red: '#f44747',
  green: '#6a9955',
  yellow: '#dcdcaa',
  blue: '#569cd6',
  magenta: '#c586c0',
  cyan: '#4ec9b0',
  white: '#d4d4d4',
  brightBlack: '#808080',
  brightRed: '#f44747',
  brightGreen: '#6a9955',
  brightYellow: '#dcdcaa',
  brightBlue: '#569cd6',
  brightMagenta: '#c586c0',
  brightCyan: '#4ec9b0',
  brightWhite: '#ffffff',
};

export function getTerminalTheme(resolved: 'light' | 'dark'): ITheme {
  return resolved === 'dark' ? darkTerminalTheme : lightTerminalTheme;
}
