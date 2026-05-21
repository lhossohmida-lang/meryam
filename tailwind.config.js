/** @type {import('tailwindcss').Config} */
// =============================================================================
//  WALIDA — Tailwind Theme
// -----------------------------------------------------------------------------
//  Custom palette for the iridescent pearl / pastel-rose / baby-blue aesthetic.
//  Adds custom font families (Outfit / Poppins / Tajawal for Arabic) and
//  glassmorphism-friendly shadows + blur tokens.
// =============================================================================
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Soft client palette — every value tuned for the mockup.
        pearl: '#FFF6F0',
        cream: '#FFE7D9',
        lavender: '#E7D9FF',
        rose: '#FFD5DC',
        baby: '#D9ECFF',
        coral: '#FF8B7A',
        peach: '#FFB4A2',
        ink: '#1B1530',
        mist: 'rgba(255,255,255,0.55)',
        // Admin (dark) tokens
        graphite: '#0F1117',
        slate950: '#0B0D14',
        slate900: '#12151F'
      },
      fontFamily: {
        sans: ['"Outfit"', '"Poppins"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
        arabic: ['"Tajawal"', '"Outfit"', 'sans-serif']
      },
      boxShadow: {
        // Soft, diffused floating shadow used on every storefront card.
        float: '0 20px 50px -20px rgba(255, 139, 122, 0.35), 0 8px 24px -12px rgba(186, 156, 255, 0.25)',
        glow: '0 0 40px rgba(255, 180, 162, 0.55)',
        admin: '0 25px 60px -30px rgba(0,0,0,0.65)'
      },
      backdropBlur: {
        xs: '2px',
        '4xl': '72px'
      },
      backgroundImage: {
        'coral-peach': 'linear-gradient(135deg, #FF8B7A 0%, #FFB4A2 100%)',
        'pearl-sheen': 'linear-gradient(180deg, #FFF6F0 0%, #FFE7D9 45%, #D9ECFF 100%)',
        'aurora': 'radial-gradient(60% 60% at 20% 10%, rgba(255,213,220,0.85) 0%, transparent 60%), radial-gradient(50% 50% at 85% 30%, rgba(217,236,255,0.9) 0%, transparent 65%), radial-gradient(60% 60% at 50% 110%, rgba(231,217,255,0.8) 0%, transparent 60%)',
        'admin-aurora': 'radial-gradient(40% 50% at 10% 0%, rgba(255,139,122,0.18) 0%, transparent 60%), radial-gradient(50% 60% at 100% 100%, rgba(99,102,241,0.18) 0%, transparent 60%)'
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        glow: {
          '0%,100%': { boxShadow: '0 0 30px rgba(255,180,162,0.4)' },
          '50%': { boxShadow: '0 0 70px rgba(255,180,162,0.8)' }
        }
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
        glow: 'glow 2.4s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
