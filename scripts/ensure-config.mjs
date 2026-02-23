import { copyFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const configPath = join(root, 'config.ts');
const examplePath = join(root, 'config.example.ts');

if (!existsSync(configPath) && existsSync(examplePath)) {
  copyFileSync(examplePath, configPath);
  console.log('Created config.ts from config.example.ts. Please add your API keys in config.ts.');
}
