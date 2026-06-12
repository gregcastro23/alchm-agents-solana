// lib/chart-generators/chart-styles.ts
// Cosmic design tokens for chart styling

export const CosmicChartTheme = {
  // Cosmic Color Palette
  colors: {
    background: {
      light: 'rgba(248, 249, 250, 0.95)',
      dark: 'rgba(10, 1, 24, 0.9)',
      glass: 'rgba(10, 1, 24, 0.6)',
    },
    border: {
      light: 'rgba(222, 226, 230, 0.8)',
      dark: 'rgba(124, 58, 237, 0.3)',
      glow: 'rgba(251, 191, 36, 0.3)',
    },
    // Planetary Colors with cosmic enhancements
    planets: {
      Sun: {
        primary: '#fbbf24', // cosmic-gold
        glow: '#fde68a',
        shadow: 'rgba(251, 191, 36, 0.5)',
      },
      Moon: {
        primary: '#e5e7eb', // cosmic-silver
        glow: '#f3f4f6',
        shadow: 'rgba(229, 231, 235, 0.5)',
      },
      Mercury: {
        primary: '#a855f7', // cosmic-celestial-purple
        glow: '#c4b5fd',
        shadow: 'rgba(168, 85, 247, 0.5)',
      },
      Venus: {
        primary: '#00a9d4', // elemental-water-glow
        glow: '#7dd3fc',
        shadow: 'rgba(0, 169, 212, 0.5)',
      },
      Mars: {
        primary: '#ff6b35', // elemental-fire
        glow: '#f7931e',
        shadow: 'rgba(255, 107, 53, 0.5)',
      },
      Jupiter: {
        primary: '#ffd700', // elemental-air
        glow: '#ffa500',
        shadow: 'rgba(255, 215, 0, 0.5)',
      },
      Saturn: {
        primary: '#8b4513', // elemental-earth
        glow: '#a0522d',
        shadow: 'rgba(139, 69, 19, 0.5)',
      },
      Uranus: {
        primary: '#7c3aed', // cosmic-ethereal-violet
        glow: '#a78bfa',
        shadow: 'rgba(124, 58, 237, 0.5)',
      },
      Neptune: {
        primary: '#2d1b69', // cosmic-stellar-blue
        glow: '#4c1d95',
        shadow: 'rgba(45, 27, 105, 0.5)',
      },
      Pluto: {
        primary: '#1a0b3d', // cosmic-nebula-purple
        glow: '#2d1b69',
        shadow: 'rgba(26, 11, 61, 0.5)',
      },
    },
    // Zodiac colors with elemental associations
    zodiac: {
      // Fire signs
      Aries: '#ff6b35',
      Leo: '#f7931e',
      Sagittarius: '#ffa500',
      // Earth signs
      Taurus: '#8b4513',
      Virgo: '#a0522d',
      Capricorn: '#654321',
      // Air signs
      Gemini: '#ffd700',
      Libra: '#ffed4e',
      Aquarius: '#fff59d',
      // Water signs
      Cancer: '#0077be',
      Scorpio: '#00a9d4',
      Pisces: '#7dd3fc',
    },
    // Aspect line colors
    aspects: {
      conjunction: {
        color: '#ff6b6b',
        glow: 'rgba(255, 107, 107, 0.8)',
      },
      opposition: {
        color: '#4ecdc4',
        glow: 'rgba(78, 205, 196, 0.8)',
      },
      trine: {
        color: '#45b7d1',
        glow: 'rgba(69, 183, 209, 0.8)',
      },
      square: {
        color: '#ffa07a',
        glow: 'rgba(255, 160, 122, 0.8)',
      },
      sextile: {
        color: '#98d8c8',
        glow: 'rgba(152, 216, 200, 0.8)',
      },
    },
    // Text colors
    text: {
      primary: {
        light: '#212529',
        dark: '#f3f4f6',
      },
      secondary: {
        light: '#6c757d',
        dark: '#c4b5fd',
      },
      muted: {
        light: '#adb5bd',
        dark: '#7c3aed',
      },
    },
  },
  // Typography
  fonts: {
    primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
  },
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    title: 20,
  },
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  // Animations
  animations: {
    shimmer: `
      @keyframes cosmic-shimmer {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(100%); }
        100% { transform: translateX(100%); }
      }
    `,
    glow: `
      @keyframes cosmic-glow {
        0% { opacity: 0.6; filter: drop-shadow(0 0 5px currentColor); }
        50% { opacity: 1; filter: drop-shadow(0 0 15px currentColor); }
        100% { opacity: 0.6; filter: drop-shadow(0 0 5px currentColor); }
      }
    `,
    pulse: `
      @keyframes cosmic-pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.9; }
        100% { transform: scale(1); opacity: 1; }
      }
    `,
    float: `
      @keyframes cosmic-float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
      }
    `,
  },
  // Effects
  effects: {
    glassMorphism: {
      background: 'rgba(10, 1, 24, 0.6)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(124, 58, 237, 0.2)',
      boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.25)',
    },
    etherealGlow: {
      boxShadow:
        '0 20px 40px -10px rgba(124, 58, 237, 0.4), 0 10px 20px -5px rgba(124, 58, 237, 0.1)',
      filter: 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.3))',
    },
    planetGlow: (color: string) => ({
      filter: `drop-shadow(0 0 10px ${color})`,
      animation: 'cosmic-glow 2s ease-in-out infinite',
    }),
  },
}

// Helper function to get theme-aware colors
export function getThemeColor(colorKey: string, isDarkMode: boolean): string {
  const keys = colorKey.split('.')
  let value: any = CosmicChartTheme.colors

  for (const key of keys) {
    value = value[key]
  }

  if (typeof value === 'object' && (value.light || value.dark)) {
    return isDarkMode ? value.dark : value.light
  }

  return value
}

// Generate complete chart styles for SVG
export function generateChartStyles(isDarkMode: boolean = false): string {
  const theme = CosmicChartTheme
  const bgColor = isDarkMode ? theme.colors.background.dark : theme.colors.background.light
  const borderColor = isDarkMode ? theme.colors.border.dark : theme.colors.border.light
  const textColor = isDarkMode ? theme.colors.text.primary.dark : theme.colors.text.primary.light
  const mutedColor = isDarkMode ? theme.colors.text.muted.dark : theme.colors.text.muted.light

  return `
    <style>
      .chart-container {
        font-family: ${theme.fonts.primary};
        background: ${bgColor};
        ${
          isDarkMode
            ? `
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: ${theme.effects.glassMorphism.boxShadow};
        `
            : ''
        }
      }

      .chart-title {
        font-size: ${theme.fontSize.title}px;
        font-weight: 700;
        fill: ${textColor};
        ${
          isDarkMode
            ? `
          filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.5));
        `
            : ''
        }
      }

      .chart-subtitle {
        font-size: ${theme.fontSize.sm}px;
        fill: ${mutedColor};
      }

      .planet-symbol {
        font-weight: bold;
        animation: cosmic-pulse 2s ease-in-out infinite;
      }

      .planet-glow {
        animation: cosmic-glow 2s ease-in-out infinite;
      }

      .zodiac-sector {
        transition: all 0.3s ease;
      }

      .zodiac-sector:hover {
        opacity: 0.8;
        filter: brightness(1.2);
      }

      .aspect-line {
        opacity: ${isDarkMode ? 0.8 : 0.7};
        transition: all 0.3s ease;
      }

      .aspect-line:hover {
        opacity: 1;
        stroke-width: 3;
      }

      ${theme.animations.glow}
      ${theme.animations.pulse}
      ${theme.animations.shimmer}
      ${theme.animations.float}
    </style>
  `
}

// Get zodiac sector colors
export function getZodiacColors(
  sign: string,
  isDarkMode: boolean
): { fill: string; stroke: string } {
  const baseColor =
    CosmicChartTheme.colors.zodiac[sign as keyof typeof CosmicChartTheme.colors.zodiac]

  if (isDarkMode) {
    return {
      fill: `${baseColor}20`, // 20% opacity
      stroke: `${baseColor}60`, // 60% opacity
    }
  } else {
    return {
      fill: `${baseColor}10`, // 10% opacity
      stroke: `${baseColor}40`, // 40% opacity
    }
  }
}

// Get planet styling
export function getPlanetStyle(planet: string, isDarkMode: boolean) {
  const planetColors =
    CosmicChartTheme.colors.planets[planet as keyof typeof CosmicChartTheme.colors.planets]

  if (!planetColors) {
    return {
      fill: isDarkMode ? '#f3f4f6' : '#495057',
      stroke: '#ffffff',
      glow: 'none',
    }
  }

  return {
    fill: planetColors.primary,
    stroke: isDarkMode ? planetColors.glow : '#ffffff',
    glow: isDarkMode ? planetColors.shadow : 'none',
    filter: isDarkMode ? `drop-shadow(0 0 10px ${planetColors.shadow})` : 'none',
  }
}

// Get aspect line styling
export function getAspectStyle(aspectType: string, isDarkMode: boolean) {
  const aspectColors =
    CosmicChartTheme.colors.aspects[aspectType as keyof typeof CosmicChartTheme.colors.aspects]

  if (!aspectColors) {
    return {
      stroke: '#999',
      strokeWidth: 1,
      opacity: 0.5,
    }
  }

  return {
    stroke: aspectColors.color,
    strokeWidth: aspectType === 'conjunction' || aspectType === 'opposition' ? 2 : 1.5,
    opacity: isDarkMode ? 0.8 : 0.7,
    filter: isDarkMode ? `drop-shadow(0 0 5px ${aspectColors.glow})` : 'none',
  }
}
