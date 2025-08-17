import {
  getPlatform,
  isWindows,
  isMacOS,
  isLinux,
  isUnix,
  getShell,
  getShellFlag,
} from '../../../src/utils/platform';
import { PlatformError } from '../../../src/errors';

// Mock process.platform
const mockPlatform = jest.fn();
Object.defineProperty(process, 'platform', {
  get: mockPlatform,
});

// Mock process.env
const mockEnv = {
  COMSPEC: undefined as string | undefined,
  SHELL: undefined as string | undefined,
};

Object.defineProperty(process, 'env', {
  get: () => mockEnv,
});

describe('Platform Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.COMSPEC = undefined;
    mockEnv.SHELL = undefined;
  });

  describe('getPlatform', () => {
    it('should return win32 for Windows', () => {
      mockPlatform.mockReturnValue('win32');

      const result = getPlatform();
      expect(result).toBe('win32');
    });

    it('should return darwin for macOS', () => {
      mockPlatform.mockReturnValue('darwin');

      const result = getPlatform();
      expect(result).toBe('darwin');
    });

    it('should return linux for Linux', () => {
      mockPlatform.mockReturnValue('linux');

      const result = getPlatform();
      expect(result).toBe('linux');
    });

    it('should throw PlatformError for unsupported platform', () => {
      mockPlatform.mockReturnValue('freebsd');

      expect(() => getPlatform()).toThrow(PlatformError);
      expect(() => getPlatform()).toThrow('Unsupported platform: freebsd');
    });

    it('should throw PlatformError for unknown platform', () => {
      mockPlatform.mockReturnValue('unknown');

      expect(() => getPlatform()).toThrow(PlatformError);
    });

    it('should handle other unsupported platforms', () => {
      const unsupportedPlatforms = ['aix', 'android', 'cygwin', 'netbsd', 'openbsd', 'sunos'];

      unsupportedPlatforms.forEach((platform) => {
        mockPlatform.mockReturnValue(platform);
        expect(() => getPlatform()).toThrow(PlatformError);
        expect(() => getPlatform()).toThrow(`Unsupported platform: ${platform}`);
      });
    });
  });

  describe('isWindows', () => {
    it('should return true for win32', () => {
      mockPlatform.mockReturnValue('win32');

      const result = isWindows();
      expect(result).toBe(true);
    });

    it('should return false for darwin', () => {
      mockPlatform.mockReturnValue('darwin');

      const result = isWindows();
      expect(result).toBe(false);
    });

    it('should return false for linux', () => {
      mockPlatform.mockReturnValue('linux');

      const result = isWindows();
      expect(result).toBe(false);
    });

    it('should throw for unsupported platform', () => {
      mockPlatform.mockReturnValue('freebsd');

      expect(() => isWindows()).toThrow(PlatformError);
    });
  });

  describe('isMacOS', () => {
    it('should return true for darwin', () => {
      mockPlatform.mockReturnValue('darwin');

      const result = isMacOS();
      expect(result).toBe(true);
    });

    it('should return false for win32', () => {
      mockPlatform.mockReturnValue('win32');

      const result = isMacOS();
      expect(result).toBe(false);
    });

    it('should return false for linux', () => {
      mockPlatform.mockReturnValue('linux');

      const result = isMacOS();
      expect(result).toBe(false);
    });

    it('should throw for unsupported platform', () => {
      mockPlatform.mockReturnValue('freebsd');

      expect(() => isMacOS()).toThrow(PlatformError);
    });
  });

  describe('isLinux', () => {
    it('should return true for linux', () => {
      mockPlatform.mockReturnValue('linux');

      const result = isLinux();
      expect(result).toBe(true);
    });

    it('should return false for win32', () => {
      mockPlatform.mockReturnValue('win32');

      const result = isLinux();
      expect(result).toBe(false);
    });

    it('should return false for darwin', () => {
      mockPlatform.mockReturnValue('darwin');

      const result = isLinux();
      expect(result).toBe(false);
    });

    it('should throw for unsupported platform', () => {
      mockPlatform.mockReturnValue('freebsd');

      expect(() => isLinux()).toThrow(PlatformError);
    });
  });

  describe('isUnix', () => {
    it('should return true for darwin', () => {
      mockPlatform.mockReturnValue('darwin');

      const result = isUnix();
      expect(result).toBe(true);
    });

    it('should return true for linux', () => {
      mockPlatform.mockReturnValue('linux');

      const result = isUnix();
      expect(result).toBe(true);
    });

    it('should return false for win32', () => {
      mockPlatform.mockReturnValue('win32');

      const result = isUnix();
      expect(result).toBe(false);
    });

    it('should throw for unsupported platform', () => {
      mockPlatform.mockReturnValue('freebsd');

      expect(() => isUnix()).toThrow(PlatformError);
    });
  });

  describe('getShell', () => {
    it('should return COMSPEC for Windows when set', () => {
      mockPlatform.mockReturnValue('win32');
      mockEnv.COMSPEC = 'C:\\Windows\\System32\\cmd.exe';

      const result = getShell();
      expect(result).toBe('C:\\Windows\\System32\\cmd.exe');
    });

    it('should return default cmd.exe for Windows when COMSPEC not set', () => {
      mockPlatform.mockReturnValue('win32');
      mockEnv.COMSPEC = undefined;

      const result = getShell();
      expect(result).toBe('cmd.exe');
    });

    it('should return SHELL for Unix when set', () => {
      mockPlatform.mockReturnValue('linux');
      mockEnv.SHELL = '/bin/bash';

      const result = getShell();
      expect(result).toBe('/bin/bash');
    });

    it('should return default /bin/sh for Unix when SHELL not set', () => {
      mockPlatform.mockReturnValue('linux');
      mockEnv.SHELL = undefined;

      const result = getShell();
      expect(result).toBe('/bin/sh');
    });

    it('should return SHELL for macOS when set', () => {
      mockPlatform.mockReturnValue('darwin');
      mockEnv.SHELL = '/bin/zsh';

      const result = getShell();
      expect(result).toBe('/bin/zsh');
    });

    it('should return default /bin/sh for macOS when SHELL not set', () => {
      mockPlatform.mockReturnValue('darwin');
      mockEnv.SHELL = undefined;

      const result = getShell();
      expect(result).toBe('/bin/sh');
    });

    it('should handle empty COMSPEC', () => {
      mockPlatform.mockReturnValue('win32');
      mockEnv.COMSPEC = '';

      const result = getShell();
      expect(result).toBe('cmd.exe');
    });

    it('should handle empty SHELL', () => {
      mockPlatform.mockReturnValue('linux');
      mockEnv.SHELL = '';

      const result = getShell();
      expect(result).toBe('/bin/sh');
    });

    it('should throw for unsupported platform', () => {
      mockPlatform.mockReturnValue('freebsd');

      expect(() => getShell()).toThrow(PlatformError);
    });
  });

  describe('getShellFlag', () => {
    it('should return /c for Windows', () => {
      mockPlatform.mockReturnValue('win32');

      const result = getShellFlag();
      expect(result).toBe('/c');
    });

    it('should return -c for Linux', () => {
      mockPlatform.mockReturnValue('linux');

      const result = getShellFlag();
      expect(result).toBe('-c');
    });

    it('should return -c for macOS', () => {
      mockPlatform.mockReturnValue('darwin');

      const result = getShellFlag();
      expect(result).toBe('-c');
    });

    it('should throw for unsupported platform', () => {
      mockPlatform.mockReturnValue('freebsd');

      expect(() => getShellFlag()).toThrow(PlatformError);
    });
  });

  describe('consistency across functions', () => {
    it('should be consistent for Windows', () => {
      mockPlatform.mockReturnValue('win32');

      expect(getPlatform()).toBe('win32');
      expect(isWindows()).toBe(true);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(false);
      expect(isUnix()).toBe(false);
      expect(getShellFlag()).toBe('/c');
    });

    it('should be consistent for macOS', () => {
      mockPlatform.mockReturnValue('darwin');

      expect(getPlatform()).toBe('darwin');
      expect(isWindows()).toBe(false);
      expect(isMacOS()).toBe(true);
      expect(isLinux()).toBe(false);
      expect(isUnix()).toBe(true);
      expect(getShellFlag()).toBe('-c');
    });

    it('should be consistent for Linux', () => {
      mockPlatform.mockReturnValue('linux');

      expect(getPlatform()).toBe('linux');
      expect(isWindows()).toBe(false);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(true);
      expect(isUnix()).toBe(true);
      expect(getShellFlag()).toBe('-c');
    });
  });

  describe('error handling', () => {
    it('should throw PlatformError with correct error code', () => {
      mockPlatform.mockReturnValue('unsupported');

      try {
        getPlatform();
        fail('Should have thrown PlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformError);
        expect((error as PlatformError).code).toBe('PLATFORM_UNSUPPORTED');
        expect((error as PlatformError).message).toBe('Unsupported platform: unsupported');
      }
    });

    it('should propagate PlatformError through all functions', () => {
      mockPlatform.mockReturnValue('aix');

      expect(() => getPlatform()).toThrow(PlatformError);
      expect(() => isWindows()).toThrow(PlatformError);
      expect(() => isMacOS()).toThrow(PlatformError);
      expect(() => isLinux()).toThrow(PlatformError);
      expect(() => isUnix()).toThrow(PlatformError);
      expect(() => getShell()).toThrow(PlatformError);
      expect(() => getShellFlag()).toThrow(PlatformError);
    });
  });

  describe('environment variable edge cases', () => {
    it('should handle various COMSPEC values', () => {
      mockPlatform.mockReturnValue('win32');

      const comspecValues = [
        'C:\\Windows\\System32\\cmd.exe',
        'cmd.exe',
        'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
        'powershell.exe',
      ];

      comspecValues.forEach((comspec) => {
        mockEnv.COMSPEC = comspec;
        expect(getShell()).toBe(comspec);
      });
    });

    it('should handle various SHELL values', () => {
      mockPlatform.mockReturnValue('linux');

      const shellValues = ['/bin/bash', '/bin/zsh', '/bin/fish', '/usr/bin/tcsh', '/bin/sh'];

      shellValues.forEach((shell) => {
        mockEnv.SHELL = shell;
        expect(getShell()).toBe(shell);
      });
    });

    it('should handle whitespace in environment variables', () => {
      mockPlatform.mockReturnValue('win32');
      mockEnv.COMSPEC = '  C:\\Windows\\System32\\cmd.exe  ';

      // Should return the value as-is (including whitespace)
      const result = getShell();
      expect(result).toBe('  C:\\Windows\\System32\\cmd.exe  ');
    });
  });

  describe('type safety', () => {
    it('should return correct types', () => {
      mockPlatform.mockReturnValue('win32');

      expect(typeof getPlatform()).toBe('string');
      expect(typeof isWindows()).toBe('boolean');
      expect(typeof isMacOS()).toBe('boolean');
      expect(typeof isLinux()).toBe('boolean');
      expect(typeof isUnix()).toBe('boolean');
      expect(typeof getShell()).toBe('string');
      expect(typeof getShellFlag()).toBe('string');
    });

    it('should return Platform type for getPlatform', () => {
      mockPlatform.mockReturnValue('win32');
      const platform = getPlatform();

      // TypeScript should enforce this is a Platform type
      const validPlatforms: Array<'win32' | 'darwin' | 'linux'> = ['win32', 'darwin', 'linux'];
      expect(validPlatforms).toContain(platform);
    });
  });
});
