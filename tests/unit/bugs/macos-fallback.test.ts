import { MacOSPlatform } from '../../../src/platforms/macos';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('Bug #3: macOS Fallback Protocol Handling', () => {
  let platform: MacOSPlatform;

  beforeEach(() => {
    jest.clearAllMocks();
    platform = new MacOSPlatform();
  });

  describe('fallbackFindProcesses with protocol="both"', () => {
    it('should check both TCP and UDP when protocol is "both"', async () => {
      // We need to test the fallback behavior
      // First lsof fails, then netstat is called

      let callCount = 0;
      mockSpawn.mockImplementation((command: string, args: readonly string[]) => {
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockChild.kill = jest.fn();

        setImmediate(() => {
          callCount++;

          // First call is lsof (which should fail)
          if (callCount === 1) {
            mockChild.stderr.emit('data', 'lsof: No such file or directory\n');
            mockChild.emit('close', 1);
          }
          // Second call should be netstat for TCP
          else if (callCount === 2 && args.includes('tcp')) {
            // Empty result for TCP
            mockChild.stdout.emit('data', 'Active Internet connections\n');
            mockChild.stdout.emit('data', 'Proto Recv-Q Send-Q Local Address Foreign Address State\n');
            mockChild.emit('close', 0);
          }
          // Third call should be netstat for UDP (if bug is fixed)
          else if (callCount === 3 && args.includes('udp')) {
            // Empty result for UDP
            mockChild.stdout.emit('data', 'Active Internet connections\n');
            mockChild.stdout.emit('data', 'Proto Recv-Q Send-Q Local Address Foreign Address\n');
            mockChild.emit('close', 0);
          }
          // If only TCP is checked (bug exists), there won't be a third call
          else {
            mockChild.emit('close', 0);
          }
        });

        return mockChild;
      });

      try {
        await platform.findProcessesByPort(3000, 'both');
      } catch (error) {
        // May throw if process is found
      }

      // BUG: Currently only calls netstat once with TCP
      // FIX: Should call netstat twice, once for TCP and once for UDP
      // After fix, callCount should be 3 (lsof + tcp netstat + udp netstat)

      // With the bug, callCount will be 2 (lsof + tcp netstat only)
      // After the fix, callCount should be 3
      expect(callCount).toBeGreaterThanOrEqual(2);

      // Verify netstat was called with tcp
      const tcpCall = mockSpawn.mock.calls.find(
        call => call[0] === 'netstat' && call[1].includes('tcp')
      );
      expect(tcpCall).toBeDefined();

      // BUG: This will fail because UDP netstat is never called
      // After fix, this should pass
      const udpCall = mockSpawn.mock.calls.find(
        call => call[0] === 'netstat' && call[1].includes('udp')
      );
      expect(udpCall).toBeDefined(); // This will FAIL with the bug
    });

    it('should only check TCP when protocol is "tcp"', async () => {
      let callCount = 0;
      mockSpawn.mockImplementation((command: string, args: readonly string[]) => {
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockChild.kill = jest.fn();

        setImmediate(() => {
          callCount++;

          if (callCount === 1) {
            // lsof fails
            mockChild.stderr.emit('data', 'lsof: No such file or directory\n');
            mockChild.emit('close', 1);
          } else if (callCount === 2) {
            // netstat for tcp
            mockChild.stdout.emit('data', 'Active Internet connections\n');
            mockChild.emit('close', 0);
          }
        });

        return mockChild;
      });

      try {
        await platform.findProcessesByPort(3000, 'tcp');
      } catch (error) {
        // May throw
      }

      // Should only call netstat once for TCP
      const netstatCalls = mockSpawn.mock.calls.filter(
        call => call[0] === 'netstat'
      );
      expect(netstatCalls.length).toBe(1);
      expect(netstatCalls[0][1]).toContain('tcp');
    });

    it('should only check UDP when protocol is "udp"', async () => {
      let callCount = 0;
      mockSpawn.mockImplementation((command: string, args: readonly string[]) => {
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockChild.kill = jest.fn();

        setImmediate(() => {
          callCount++;

          if (callCount === 1) {
            // lsof fails
            mockChild.stderr.emit('data', 'lsof: No such file or directory\n');
            mockChild.emit('close', 1);
          } else if (callCount === 2) {
            // netstat for udp
            mockChild.stdout.emit('data', 'Active Internet connections\n');
            mockChild.emit('close', 0);
          }
        });

        return mockChild;
      });

      try {
        await platform.findProcessesByPort(3000, 'udp');
      } catch (error) {
        // May throw
      }

      // Should only call netstat once for UDP
      const netstatCalls = mockSpawn.mock.calls.filter(
        call => call[0] === 'netstat'
      );
      expect(netstatCalls.length).toBe(1);
      expect(netstatCalls[0][1]).toContain('udp');
    });
  });
});
