import { MacOSPlatform } from '../../../src/platforms/macos';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { CommandExecutionError } from '../../../src/errors';

jest.mock('child_process');

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('Bug #1 Fix: macOS Fallback Protocol Handling', () => {
  let platform: MacOSPlatform;

  beforeEach(() => {
    jest.clearAllMocks();
    platform = new MacOSPlatform();
  });

  it('should check BOTH TCP and UDP before throwing when protocol="both" and port is found', async () => {
    let callCount = 0;
    const commandCalls: string[] = [];

    mockSpawn.mockImplementation((command: string, args: readonly string[]) => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.kill = jest.fn();

      setImmediate(() => {
        callCount++;
        commandCalls.push(`${command} ${args.join(' ')}`);

        // First call: lsof fails
        if (callCount === 1 && command === 'lsof') {
          mockChild.stderr.emit('data', 'lsof: No such file or directory\n');
          mockChild.emit('close', 1);
        }
        // Second call: netstat for TCP finds the port
        else if (callCount === 2 && command === 'netstat' && args.includes('tcp')) {
          // Return TCP result showing port 3000 is in use
          mockChild.stdout.emit('data', 'Active Internet connections\n');
          mockChild.stdout.emit('data', 'Proto Recv-Q Send-Q Local Address Foreign Address State\n');
          mockChild.stdout.emit('data', 'tcp4       0      0  127.0.0.1.3000     *.*                    LISTEN\n');
          mockChild.emit('close', 0);
        }
        // Third call: netstat for UDP (should happen after the fix)
        else if (callCount === 3 && command === 'netstat' && args.includes('udp')) {
          // Return empty UDP result
          mockChild.stdout.emit('data', 'Active Internet connections\n');
          mockChild.stdout.emit('data', 'Proto Recv-Q Send-Q Local Address Foreign Address\n');
          mockChild.emit('close', 0);
        }
        else {
          mockChild.emit('close', 0);
        }
      });

      return mockChild;
    });

    // Should throw because port is found, but only after checking both protocols
    await expect(platform.findProcessesByPort(3000, 'both')).rejects.toThrow(CommandExecutionError);

    // CRITICAL: Verify that BOTH TCP and UDP were checked
    // Before fix: only 2 calls (lsof + tcp netstat)
    // After fix: 3 calls (lsof + tcp netstat + udp netstat)
    expect(callCount).toBe(3);

    // Verify the sequence of calls
    expect(commandCalls[0]).toContain('lsof');
    expect(commandCalls[1]).toContain('netstat');
    expect(commandCalls[1]).toContain('tcp');
    expect(commandCalls[2]).toContain('netstat');
    expect(commandCalls[2]).toContain('udp');
  });

  it('should check only TCP when protocol="tcp" and port is found', async () => {
    let callCount = 0;
    const commandCalls: string[] = [];

    mockSpawn.mockImplementation((command: string, args: readonly string[]) => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.kill = jest.fn();

      setImmediate(() => {
        callCount++;
        commandCalls.push(`${command} ${args.join(' ')}`);

        if (callCount === 1 && command === 'lsof') {
          mockChild.stderr.emit('data', 'lsof: No such file or directory\n');
          mockChild.emit('close', 1);
        } else if (callCount === 2 && command === 'netstat' && args.includes('tcp')) {
          mockChild.stdout.emit('data', 'tcp4       0      0  127.0.0.1.3000     *.*                    LISTEN\n');
          mockChild.emit('close', 0);
        } else {
          mockChild.emit('close', 0);
        }
      });

      return mockChild;
    });

    await expect(platform.findProcessesByPort(3000, 'tcp')).rejects.toThrow(CommandExecutionError);

    // Should only check TCP, not UDP
    expect(callCount).toBe(2);
    expect(commandCalls[1]).toContain('tcp');
    expect(commandCalls[1]).not.toContain('udp');
  });

  it('should return empty array when port is not found in any protocol', async () => {
    let callCount = 0;

    mockSpawn.mockImplementation((command: string, args: readonly string[]) => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.kill = jest.fn();

      setImmediate(() => {
        callCount++;

        if (callCount === 1 && command === 'lsof') {
          mockChild.stderr.emit('data', 'lsof: No such file or directory\n');
          mockChild.emit('close', 1);
        } else if (command === 'netstat') {
          // Return empty results - no port match
          mockChild.stdout.emit('data', 'Active Internet connections\n');
          mockChild.stdout.emit('data', 'Proto Recv-Q Send-Q Local Address Foreign Address\n');
          mockChild.emit('close', 0);
        } else {
          mockChild.emit('close', 0);
        }
      });

      return mockChild;
    });

    const result = await platform.findProcessesByPort(3000, 'both');

    // Should check both protocols and return empty array
    expect(result).toEqual([]);
    expect(callCount).toBe(3); // lsof + tcp + udp
  });
});
