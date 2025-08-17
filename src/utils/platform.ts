import type { Platform } from '../types';
import { PlatformError } from '../errors';

export function getPlatform(): Platform {
  const platform = process.platform;

  switch (platform) {
    case 'win32':
      return 'win32';
    case 'darwin':
      return 'darwin';
    case 'linux':
      return 'linux';
    default:
      throw new PlatformError(platform);
  }
}

export function isWindows(): boolean {
  return getPlatform() === 'win32';
}

export function isMacOS(): boolean {
  return getPlatform() === 'darwin';
}

export function isLinux(): boolean {
  return getPlatform() === 'linux';
}

export function isUnix(): boolean {
  return isMacOS() || isLinux();
}

export function getShell(): string {
  if (isWindows()) {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/sh';
}

export function getShellFlag(): string {
  if (isWindows()) {
    return '/c';
  }
  return '-c';
}
