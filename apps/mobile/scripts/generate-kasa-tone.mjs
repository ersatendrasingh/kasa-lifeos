import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 44_100;
const duration = 1.35;
const samples = Math.floor(sampleRate * duration);
const notes = [
  { frequency: 659.25, start: 0, length: 0.42, volume: 0.26 },
  { frequency: 830.61, start: 0.2, length: 0.5, volume: 0.23 },
  { frequency: 987.77, start: 0.47, length: 0.68, volume: 0.2 },
];

function envelope(time, length) {
  const attack = Math.min(1, time / 0.025);
  const release = Math.exp((-5.2 * time) / length);
  return attack * release;
}

const pcm = Buffer.alloc(samples * 2);
for (let index = 0; index < samples; index += 1) {
  const time = index / sampleRate;
  let value = 0;
  for (const note of notes) {
    const localTime = time - note.start;
    if (localTime < 0 || localTime > note.length) continue;
    const wave =
      Math.sin(2 * Math.PI * note.frequency * localTime) +
      0.18 * Math.sin(2 * Math.PI * note.frequency * 2 * localTime);
    value += wave * note.volume * envelope(localTime, note.length);
  }
  const softened = Math.tanh(value * 1.15) * 0.72;
  pcm.writeInt16LE(
    Math.max(-32_768, Math.min(32_767, Math.round(softened * 32_767))),
    index * 2,
  );
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, "../assets/sounds/kasa-tone.wav");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.concat([header, pcm]));
console.log(`Generated ${output}`);
