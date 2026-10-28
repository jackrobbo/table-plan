// Builds the Android debug APK: copies the Morrisons script from the extension into the app, syncs Capacitor, runs Gradle,
// and drops the APK at public/app/table-plan.apk so the site can offer it for sideloading.
// Needs JDK 17+ and the Android SDK (ANDROID_HOME). See android-app/README.md.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const app = 'android-app';
mkdirSync(`${app}/android/app/src/main/assets`, { recursive: true });
mkdirSync('public/app', { recursive: true });
copyFileSync('extension/morrisons.js', `${app}/android/app/src/main/assets/morrisons.js`);
copyFileSync('extension/morrisons.js', 'public/app/morrisons.js');   // the site serves the same script; the app fetches it first and falls back to this bundled copy
if (!existsSync(`${app}/node_modules`)) run('npm install --no-audit --no-fund', app);
run('npx cap sync android', app);
run('./gradlew assembleDebug --console=plain', `${app}/android`);
mkdirSync('public/app', { recursive: true });
copyFileSync(`${app}/android/app/build/outputs/apk/debug/app-debug.apk`, 'public/app/table-plan.apk');
console.log('Built public/app/table-plan.apk');
