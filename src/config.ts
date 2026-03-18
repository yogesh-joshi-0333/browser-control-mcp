import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface IConfig {
  wsPort: number;
  extensionOrigin: string;
}

function loadConfig(): IConfig {
  const configPath = join(__dirname, '..', 'config.json');
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as IConfig;
}

const config = loadConfig();

export const WS_PORT: number = config.wsPort;
export const EXTENSION_ORIGIN: string = config.extensionOrigin;
export default config;
