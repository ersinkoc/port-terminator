import { LinuxPlatform } from '../../../src/platforms/linux';
import { MacOSPlatform } from '../../../src/platforms/macos';
import { WindowsPlatform } from '../../../src/platforms/windows';
import { InvalidPortError } from '../../../src/errors';

describe('Platform Defense-in-Depth Validation', () => {
  const platforms = [
    { name: 'LinuxPlatform', PlatformClass: LinuxPlatform },
    { name: 'MacOSPlatform', PlatformClass: MacOSPlatform },
    { name: 'WindowsPlatform', PlatformClass: WindowsPlatform },
  ];

  platforms.forEach(({ name, PlatformClass }) => {
    describe(name, () => {
      let platform: any;

      beforeEach(() => {
        platform = new PlatformClass();
      });

      describe('findProcessesByPort', () => {
        it('should validate protocol and throw for invalid string', async () => {
          await expect(
            platform.findProcessesByPort(3000, 'invalid-protocol; rm -rf /')
          ).rejects.toThrow();
        });

        it('should validate port and throw for invalid port number', async () => {
          await expect(platform.findProcessesByPort(-1, 'tcp')).rejects.toThrow(InvalidPortError);
        });
      });

      describe('isPortAvailable', () => {
        it('should validate protocol and throw for invalid string', async () => {
          await expect(platform.isPortAvailable(3000, 'invalid')).rejects.toThrow();
        });

        it('should validate port and throw for invalid port number', async () => {
          await expect(platform.isPortAvailable(-1, 'tcp')).rejects.toThrow(InvalidPortError);
        });
      });

      describe('killProcess', () => {
        it('should validate PID and throw for invalid PID number', async () => {
          await expect(platform.killProcess(-1)).rejects.toThrow();
          await expect(platform.killProcess(0)).rejects.toThrow();
        });
      });

      describe('isProcessRunning', () => {
        it('should validate PID and throw for invalid PID number', async () => {
          await expect(platform.isProcessRunning(-1)).rejects.toThrow();
          await expect(platform.isProcessRunning(0)).rejects.toThrow();
        });
      });
    });
  });
});
