# RavenHUD Website Assets

Assets for the RavenHUD landing page.

## Current Status

### Available
- `logo.png` - App logo (from companion app)
- `favicon.png` - Browser favicon (64x64)
- `og-image.png` - Social sharing preview
- `gifs/hero-preview.gif` - Land placement demo
- `gifs/land-simulator.gif` - NFT land simulator demo

### Still Needed
- `gifs/cosmetics.gif` - Cosmetics tracker demo
- `gifs/trophies.gif` - Trophy tracker demo
- `gifs/tradepacks.gif` - Tradepack calculator demo
- `gifs/farming.gif` - Farming cards demo
- `gifs/overlay.gif` - Overlay mode demo

## Automated Recording with Playwright

Use Playwright to automate demo recordings:

```bash
npm install playwright electron-playwright-helpers fluent-ffmpeg @ffmpeg-installer/ffmpeg
```

```javascript
const { _electron: electron } = require('playwright');
const ffmpeg = require('fluent-ffmpeg');

// Launch and record
const app = await electron.launch({
  args: ['main.js'],
  recordVideo: { dir: 'videos/', size: { width: 800, height: 600 } }
});

// Perform demo actions...
await app.close();

// Convert WebM to GIF
ffmpeg('videos/demo.webm')
  .outputOptions(['-vf', 'fps=15,scale=600:-1:flags=lanczos'])
  .output('gifs/demo.gif')
  .run();
```

## Manual Recording Tips

1. Use [ScreenToGif](https://www.screentogif.com/) or [LICEcap](https://www.cockos.com/licecap/)
2. Keep GIFs under 5MB for fast loading
3. Dimensions: 600-800px wide
4. Frame rate: 15 FPS is sufficient
5. Optimize at [ezgif.com](https://ezgif.com/optimize)
