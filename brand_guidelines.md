# Hotogram Brand Guidelines

This document outlines the visual identity and brand elements for Hotogram. You can provide this file to Antigravity when starting new projects to maintain a consistent aesthetic.

## 1. Typography
Hotogram uses a modern, clean typography stack:
- **Headings**: `Manrope`, sans-serif (Weights: 500, 600, 700)
- **Body / Sans**: `Inter`, sans-serif (Weights: 400, 500, 600, 700)

## 2. Color Palette
The application supports both Light and Dark modes.

### Light Mode
- **Primary (Deep teal)**: `#085041` - Used for primary text and main structural elements.
- **Primary Mid (Teal)**: `#0F6E56` - Used for buttons and interactive elements.
- **Accent (Coral)**: `#D85A30` - Used for highlights, accents, and call-to-actions.
- **Background**: `#F1EFE8` - A warm off-white for the main app background.
- **Surface**: `#FFFFFF` - Crisp white for cards and floating containers.
- **Text Secondary**: `#5F5E5A` - Used for subtitles and less prominent text.

### Dark Mode
- **Primary (Light off-white)**: `#F1EFE8` - Used for primary text and headings.
- **Primary Mid (Glowing emerald)**: `#10B981` - Bright interactive elements.
- **Accent (Vibrant coral)**: `#E26A40` - Highlights and call-to-actions.
- **Background**: `#031411` - Dark cyber teal for the main app background.
- **Surface**: `#06211B` - Dark teal for cards and floating containers.
- **Text Secondary**: `#8AA496` - Muted teal-gray.

## 3. Visual Effects & Aesthetics
- **Premium Tech Grid**: A subtle background grid pattern (`48px by 48px`) created using linear gradients.
- **Shadows (Neon Effect)**:
  - Light mode: Subtle colored shadows (`rgba(8, 80, 65, 0.05)` for primary, `rgba(216, 90, 48, 0.08)` for accent).
  - Dark mode: Intense glowing neon shadows (`rgba(16, 185, 129, 0.2)` for primary, `rgba(226, 106, 64, 0.3)` for accent).
- **Glassmorphism**: Headers and sticky elements use a backdrop blur (`backdrop-blur-md`) combined with a slightly transparent background.

## 4. Logo Design
- The Hotogram logo icon is a **3x3 dot grid** enclosed in a rounded square container.
- The top-middle and bottom-middle dots are missing, giving it a unique tech/QR-code inspired look.
- All dots use the `Primary Mid` color, except for the **bottom-right dot**, which uses the `Accent` (Coral) color to create a pop of visual interest.
- The text logo is written as **"hotogram."** (all lowercase), with the period `.` colored in the `Accent` coral color.

## How to use this with Antigravity
When creating your new Hotogram software project, place this `brand_guidelines.md` file in the root of the new project folder. When you start a chat with Antigravity, you can say:

> *"Hey Antigravity, I'm building the Hotogram app here. Please read `brand_guidelines.md` and make sure all the UI and components you build strictly follow these colors, fonts, and aesthetics."*
