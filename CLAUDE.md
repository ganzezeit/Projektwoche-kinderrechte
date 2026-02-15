# Mission: Weltverbinder

Gamified teacher screen app for Andersen Grundschule (Berlin Wedding) project week about children's rights (Kinderrechte). Projected on classroom whiteboard, NOT used on student devices. Target: immigrant children with limited German.

## Quick Start

```bash
npm install
npm run dev    # http://localhost:3000
```

## Architecture

### Core Concept
Linear, map-based journey through 5 days (Tag 1–5). Each day has sequential steps. Complete step → next unlocks. Complete all steps → next day unlocks. Character moves between stops on the map.

Schedule: Tag 1=Mi 18.02 | Tag 2=Do 19.02 | Tag 3=Fr 20.02 | Tag 4=Mo 23.02 | Tag 5=Di 24.02
(Dates not shown to students — app says "Tag 1" etc.)

### Tech Stack
- Vite + React 18 (inline styles, no CSS framework)
- pdfjs-dist (PDF slides rendering)
- localStorage (persistence)
- Web Audio API (SFX)
- CSS animations (no animation library)

## Project Structure

```
src/
├── main.jsx                          # Entry point
├── components/
│   ├── App.jsx                       # Main state management & screen routing
│   ├── SplashScreen.jsx              # Start screen — "Mission starten!" button
│   ├── WochenplanScreen.jsx          # 5-day overview cards
│   ├── ProjektregelnScreen.jsx       # 4 flip cards with project rules
│   ├── EnergizerIchStimmeZu.jsx      # Fixed energizer with 10 statements
│   ├── LernkartenGame.jsx            # Memory matching game (9 word pairs)
│   ├── MapScreen.jsx                 # 5-day map with character + path
│   ├── DayScreen.jsx                 # Vertical timeline of steps
│   ├── DayIntroScreen.jsx            # Recap + energizer for Tag 2+
│   ├── StepViewer.jsx                # Routes step to viewer by type
│   ├── ActivityScreen.jsx            # Activity text + timer + glossary
│   ├── SlideViewer.jsx               # PDF slideshow (pdfjs-dist)
│   ├── VideoPlayer.jsx               # MP4 player with startTime/endTime
│   ├── MultiStepViewer.jsx           # Sub-step cards with progress dots
│   ├── LandeskundeViewer.jsx         # Tanzania slides + quiz (app-built)
│   ├── EnergizerScreen.jsx           # Pick 3, timer, music
│   ├── GlossaryTooltip.jsx           # Inline clickable term tooltips
│   ├── EnergyBar.jsx                 # Animated energy bar
│   ├── TopBar.jsx                    # Energy + volume + teacher trigger
│   ├── TeacherPanel.jsx              # Hidden admin (triple-click logo)
│   └── Confetti.jsx                  # Celebration particles
├── data/
│   ├── days.js                       # 5 days, all steps, full content
│   ├── energizers.js                 # 16 energizer activities
│   ├── glossary.js                   # 34 German terms + definitions
│   ├── lernkarten.js                 # 9 word-definition pairs
│   ├── landeskunde.js                # 10 Tanzania slides + 5 quiz questions
│   └── projektregeln.js              # 4 project rules (flip cards)
├── utils/
│   ├── audio.js                      # Music + SFX (AudioContext)
│   ├── persistence.js                # localStorage save/load/reset
│   └── constants.js                  # Energy values, character emoji, etc.
└── styles/
    ├── global.css                    # Base styles, fonts, reset
    └── animations.css                # All @keyframes + utility classes
```

## Screen Flow

```
First launch:
  splash → wochenplan → projektregeln → ichStimmeZu → lernkarten → map

Subsequent launches (introCompleted=true):
  splash → map

Map navigation:
  map → dayIntro (Tag 2+ first visit) → day → step
  day ↔ energizer (when energy < 40%)
  day → map (back button)
```

## Step Types

| Type        | Component         | Behavior                                         |
|-------------|-------------------|--------------------------------------------------|
| `activity`  | ActivityScreen    | Text + bullets + optional timer + glossary        |
| `slides`    | SlideViewer       | PDF via pdfjs-dist, arrow/keyboard nav            |
| `video`     | VideoPlayer       | HTML5 video with startTime/endTime support        |
| `multi-step`| MultiStepViewer   | Sub-cards with Weiter button, progress dots       |
| `kahoot`    | ExternalLink      | Opens URL in new tab, "Zurück" overlay            |
| `meet`      | ExternalLink      | Opens URL in new tab, "Zurück" overlay            |

MultiStepViewer sub-steps can have `subType: "landeskunde"` or `subType: "quiz"` to render LandeskundeViewer.

## Energy System
- Start: 100, Max: 100
- Each step costs `energyCost` (5–20)
- Below 40%: force energizer before next step
- Energizer restores 30–40 energy (random)
- Display: TopBar animated gradient bar

## State (localStorage)
```
currentDay, energy, completedSteps, completedDays,
usedEnergizers, introCompleted, dayIntroSeen, volume
```

## Visual Design
- WARM theme (coral/blue gradients), NOT dark/space
- White/cream cards, soft shadows, 16px+ border-radius
- Fonts: Fredoka (body), Lilita One (headings), Baloo 2 (numbers)
- Large text for whiteboard projection (body 18px+, headings 28px+)
- Day accent colors: Tag1=#FF6B35, Tag2=#00B4D8, Tag3=#9B5DE5, Tag4=#00F5D4, Tag5=#FFD166

## Teacher Panel
Triple-click logo in TopBar. Actions: go back step, reset day, +30 energy, jump to any day.

## Adding Content

**Days/Steps**: Edit `src/data/days.js`
**Slides**: Add PDF to `public/slides/`, reference in step content
**Videos**: Add MP4 to `public/videos/`, reference in step content (supports startTime/endTime)
**Landeskunde**: Edit `src/data/landeskunde.js`, images in `public/images/landeskunde/`
**Energizers**: Edit `src/data/energizers.js`
**Glossary**: Edit `src/data/glossary.js` — terms auto-highlighted in ActivityScreen

## Media Files (user adds later)
```
public/menu-music.mp3
public/energizer-music.mp3
public/videos/kinderrechte.mp4
public/slides/tag1-rechte.pdf
public/slides/tag1-lebenswelt.pdf
public/images/landeskunde/lk-01-*.png through lk-10-*.png
```
Missing files show friendly "Datei wird noch hinzugefügt..." placeholder.
