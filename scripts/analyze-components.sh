#!/bin/bash

echo "=== COMPONENT ANALYSIS REPORT ==="
echo ""

# Count total files
TOTAL_FILES=$(find components -name "*.tsx" -o -name "*.ts" | wc -l)
echo "Total component files: $TOTAL_FILES"
echo ""

echo "POTENTIAL DUPLICATES:"
echo "===================="

# Find files with similar names
echo "Wizard components:"
find components -name "*wizard*" -type f | sort

echo ""
echo "Indicator components:"
find components -name "*indicator*" -type f | sort

echo ""
echo "Monitor components:"
find components -name "*monitor*" -type f | sort

echo ""
echo "Dashboard components:"
find components -name "*dashboard*" -type f | sort

echo ""
echo "Card components:"
find components -name "*card*" -type f | sort

echo ""
echo "Chart components:"
find components -name "*chart*" -type f | sort

echo ""
echo "Display components:"
find components -name "*display*" -type f | sort

echo ""
echo "RECOMMENDED ORGANIZATION:"
echo "========================"

echo "components/"
echo "├── ui/              # Basic UI components (buttons, cards, modals, etc.)"
echo "├── agents/          # Agent-related components"
echo "├── charts/          # Astrology charts and visualizations"
echo "├── tarot/           # Tarot and rune components"
echo "├── temporal/        # Time-based components (already exists)"
echo "├── sigil/           # Sigil generation (already exists)"
echo "├── profile/         # User profile components (already exists)"
echo "├── wizards/         # Creation and onboarding wizards"
echo "└── dashboards/      # Dashboard and monitoring components"

echo ""
echo "CURRENT STRUCTURE:"
echo "=================="

# Show current directory structure
find components -type d | sort | sed 's|components/|├── |' | sed 's|^|components/|'
