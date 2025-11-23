# Design Guidelines: AI Music Translation & Phonetic Learning App

## Design Approach

**Selected Framework**: Hybrid approach combining Spotify's music player patterns with Material Design's structured information hierarchy

**Core Principle**: Balance immersive music experience with dense educational content through clear spatial organization and typographic hierarchy.

---

## Typography System

**Primary Font**: Inter (Google Fonts) - excellent readability for multilingual text
**Secondary Font**: JetBrains Mono (Google Fonts) - for phonetic transcriptions

**Hierarchy**:
- Song titles: 2xl/3xl, semibold
- Artist names: lg, medium
- Original lyrics: base/lg, regular
- Translations: base, regular
- Phonetics: sm/base, mono, medium
- UI labels: sm, medium
- Buttons/CTAs: sm/base, semibold

---

## Layout System

**Spacing Scale**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
**Standard padding**: p-4 (mobile), p-6 to p-8 (desktop)
**Section spacing**: space-y-4 to space-y-8
**Component gaps**: gap-4 to gap-6

**Container Structure**: max-w-7xl for main content, responsive breakpoints at md and lg

---

## Core Layout Architecture

### Three-Panel Layout (Desktop)

**Left Sidebar** (w-64 to w-80):
- Song recognition button (prominent, full-width)
- Language selector dropdown
- Recently recognized songs list
- Settings/preferences

**Center Panel** (flex-1):
- Playback controls (top, sticky)
- Waveform visualization
- Synchronized lyrics display with 3-column grid:
  - Column 1: Original lyrics (w-1/3)
  - Column 2: Translation (w-1/3)
  - Column 3: Phonetic guide (w-1/3)
- Auto-scroll with current line highlighting

**Right Panel** (w-72 to w-96):
- Song metadata card (album art, title, artist)
- Language learning tips
- Pronunciation difficulty indicators
- Save/bookmark options

**Mobile**: Stack vertically with tabs to switch between original/translation/phonetics

---

## Component Library

### 1. Song Recognition Module
- Large circular button with microphone icon (120px diameter)
- Pulsing animation during listening
- Recognition status indicator
- Confidence score display

### 2. Music Player Controls
- Playback bar with progress indicator
- Play/pause, skip, repeat controls
- Volume slider
- Time stamps (current/total)
- Compact header design (h-16 to h-20)

### 3. Lyrics Display Cards
- Card-based design with subtle borders
- Active line: highlighted background with scale transform
- Inactive lines: reduced opacity (60-70%)
- Smooth scroll behavior following playback
- Generous line-height (1.8 to 2) for readability

### 4. Language Selector
- Dropdown with flag icons
- Support 15+ languages prominently displayed
- Quick-switch favorites
- Search functionality for extensive list

### 5. Waveform Visualization
- Full-width audio waveform (h-20 to h-24)
- Interactive scrubbing
- Intensity bars showing vocal presence
- Subtle gradient overlay

### 6. Phonetic Guide Display
- Monospace font for alignment
- Syllable breaks with visual separators
- Stress markers (bold or underline)
- Tooltip hover for pronunciation audio snippets

### 7. Song Metadata Card
- Album artwork (square, 200px to 300px)
- Title/artist stacked layout
- Genre tags as pills
- Release year, album name
- External links (Spotify, Apple Music) as icon buttons

---

## Interaction Patterns

**Lyric Synchronization**:
- Auto-scroll maintains current line in center third of viewport
- 300ms transition between lines
- Click any line to jump to that timestamp

**Song Recognition**:
- Tap microphone → listening state (3-10 seconds)
- Success: slide-in animation showing match
- Failure: shake animation with retry prompt

**Translation Switching**:
- Instant language swap without page reload
- Smooth opacity fade (200ms) during content swap
- Maintain scroll position

---

## Navigation Structure

**Top Bar** (sticky, h-16):
- App logo/name (left)
- Global search (center, hidden on mobile)
- User profile/settings (right)

**Bottom Bar** (mobile only, fixed):
- Recognition, Library, Settings tabs
- Icon-based navigation

---

## Special UI Elements

**Recognition Status Badge**:
- Floating indicator showing "Listening...", "Processing...", "Matched!"
- Toast-style with auto-dismiss

**Learning Progress Indicators**:
- Small icons showing pronunciation difficulty per line
- Color-coded complexity (but implemented via icon variations)

**Offline Mode Indicator**:
- Banner notification when offline
- Show cached songs available

---

## Images

**Required Images**:
1. **Album Artwork**: Square images (300x300px minimum) displayed in song metadata card and recognition results
2. **Flag Icons**: For language selector (32x32px)
3. **Empty State Illustrations**: Custom SVG for "No song recognized yet" and "Start listening to music"

**No Hero Section**: This is a utility app, not a marketing page. Launch directly into the functional interface.

---

## Accessibility Standards

- Minimum touch target: 44x44px
- Keyboard navigation for all controls
- ARIA labels for playback controls
- Focus indicators with 2px offset
- Screen reader announcements for song recognition status
- High contrast text ratios (WCAG AA minimum)

---

## Mobile Adaptations

- Collapsible sidebar → hamburger menu
- Tabs for original/translation/phonetic views
- Floating action button for song recognition
- Bottom sheet for language selection
- Simplified waveform (h-12)
- Stack metadata card above lyrics

---

## Performance Considerations

- Virtual scrolling for long lyric lists
- Lazy load album artwork
- Debounce waveform rendering
- Cache translations locally
- Progressive loading of phonetic data