import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface IConfig {
  debugPort: number;
}

const DEFAULTS: IConfig = {
  debugPort: 9222,
};

function loadConfig(): IConfig {
  const configPath = join(__dirname, '..', 'config.json');
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<IConfig>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

const config = loadConfig();

export const DEBUG_PORT: number = config.debugPort;
export default config;
