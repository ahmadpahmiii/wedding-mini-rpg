/** Tokens mirror the Wedding Quest design system. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wood: { 900: '#1b110d', 800: '#2d1e18', 700: '#4a2e18', 600: '#734d2e', 400: '#c4a482' },
        parchment: { 100: '#fffdf7', 200: '#fdf6e2', 300: '#f4e9ce', 400: '#ead9be' },
        ink: { 900: '#2d1e18', 600: '#6b4f3a', muted: '#7a5f3a', onwood: '#fdf6e2' },
        gold: { 300: '#fde68a', 400: '#f4e07b', 500: '#d4af37', 700: '#aa8022', 900: '#7a5c14' },
        emerald: { 500: '#2d4a3e', 300: '#4f7a66', 100: '#ddeae2' },
        maroon: { 900: '#240508' },
        wax: { 500: '#b91c1c', 400: '#ef4444' },
        rose: { 100: '#f7e0e4', 700: '#9f1239' },
        sky: { 400: '#7ec8e3' },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', '"Courier New"', 'monospace'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        arabic: ['Amiri', '"Scheherazade New"', '"Geeza Pro"', 'serif'],
      },
      borderRadius: { sm: '4px', md: '8px', lg: '14px', xl: '22px' },
      boxShadow: {
        raised: '0 4px 0 0 #4a2e18',
        'raised-gold': '0 4px 0 0 #7a5c14',
        pressed: 'inset 0 3px 0 0 #4a2e18',
        card: '0 2px 0 0 #ead9be',
        modal: '0 18px 44px #1b110d80',
        focus: '0 0 0 3px #f4e07b',
      },
      maxWidth: { stage: '480px' },
      minHeight: { tap: '44px' },
    },
  },
  plugins: [],
};
