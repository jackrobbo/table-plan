// Publishes the trolley script at /app/morrisons.js so the Android app can fetch the latest version each time it opens the
// Morrisons screen (the copy bundled in the APK is the fallback). Runs before every build; keep the two in step.
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('public/app', { recursive: true });
copyFileSync('extension/morrisons.js', 'public/app/morrisons.js');
console.log('Published public/app/morrisons.js');
