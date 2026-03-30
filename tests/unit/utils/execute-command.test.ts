import { executeCommand } from '../../../src/utils/execute-command';

describe('executeCommand', () => {
  it('should run a command successfully', async () => {
    const res = await executeCommand('echo', ['hello']);
    expect(res.stdout).toContain('hello');
  });

  it('should throw an error when stdout exceeds maxBuffer', async () => {
    // Attempt to print 200 bytes, but set maxBuffer to 50
    // We use a small node script to output reliable bytes across platforms
    const script = `console.log('x'.repeat(200))`;
    await expect(executeCommand('node', ['-e', script], { maxBuffer: 50 }))
      .rejects.toMatchObject({
        stderr: 'Command exceeded maximum stdout buffer limit of 50 bytes'
      });
  });

  it('should throw an error when stderr exceeds maxBuffer', async () => {
    // Attempt to print 200 bytes to stderr, but set maxBuffer to 50
    const script = `console.error('y'.repeat(200))`;
    await expect(executeCommand('node', ['-e', script], { maxBuffer: 50 }))
      .rejects.toMatchObject({
        stderr: 'Command exceeded maximum stderr buffer limit of 50 bytes'
      });
  });
});
