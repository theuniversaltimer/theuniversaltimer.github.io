# The Universal Timer

A flexible, visual timer and alarm application built with React and TypeScript.

🔗 **Live Demo**: [https://theuniversaltimer.github.io](https://theuniversaltimer.github.io)

## Features

- **Visual Timer Builder**: Drag-and-drop interface to create custom timers
- **Multiple Block Types**:
  - Wait: Pause for a duration
  - Wait Until: Pause until a specific time
  - Play Sound: Play audio
  - Play Sound Until: Play audio and wait until it finishes
  - Notify: Show desktop notifications
  - Notify Until: Show notifications with timeout and repeat interval
  - Loop: Repeat blocks multiple times or forever
- **Theme Support**: Multiple color themes
- **Stopwatch & Alarm Modes**: Different timer modes for various use cases

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

- GitHub Pages is deployed via Actions using `.github/workflows/deploy.yml`.
- Any push to `main` triggers a fresh build and publish from `dist/`.
- You can also trigger it manually from the Actions tab (`Deploy to GitHub Pages`).
- In the repository settings, set GitHub Pages source to "GitHub Actions".

## Tech Stack

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **@dnd-kit** - Drag and drop functionality
- **Howler.js** - Audio playback

## License

- Version: 1.0.0
- This project is licensed under the MIT License. See `LICENSE` for details.
