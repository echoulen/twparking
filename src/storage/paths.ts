import { homedir } from 'node:os';
import { join } from 'node:path';

const APP = 'twparking';

function xdg(envName: 'XDG_CONFIG_HOME' | 'XDG_CACHE_HOME', fallback: string): string {
  return process.env[envName] ?? join(homedir(), fallback);
}

export function configDir(): string {
  return join(xdg('XDG_CONFIG_HOME', '.config'), APP);
}

export function cacheDir(): string {
  return join(xdg('XDG_CACHE_HOME', '.cache'), APP);
}

export function favouritesPath(): string {
  return join(configDir(), 'favourites.json');
}

export function catalogCachePath(city: string): string {
  return join(cacheDir(), `lots-${city}.json`);
}
