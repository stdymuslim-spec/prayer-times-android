// Adds the notification sounds to the build only when the audio files are present.
// The repository does not ship them (see README): without them the app uses Android's
// default notification sound, and users can pick their own in the app.
const fs = require('fs');
const path = require('path');

const SOUNDS = ['call_to_prayer', 'reminder'];

module.exports = ({ config }) => {
  const present = SOUNDS.filter((name) => fs.existsSync(path.join(__dirname, 'assets', 'audio', `${name}.mp3`)));

  const plugins = (config.plugins || []).map((plugin) =>
    Array.isArray(plugin) && plugin[0] === 'expo-notifications'
      ? [
          plugin[0],
          {
            ...plugin[1],
            defaultChannel: present.includes('reminder') ? 'reminder-chime-v1' : 'reminder-default-v1',
            sounds: present.map((name) => `./assets/audio/${name}.mp3`),
          },
        ]
      : plugin,
  );

  return {
    ...config,
    plugins,
    // Read at runtime to choose between the bundled sound and the default one.
    extra: { ...config.extra, sounds: Object.fromEntries(present.map((name) => [name, true])) },
  };
};
