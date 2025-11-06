import { PortScanner } from '../../src/core/port-scanner';
import { ProcessFinder } from '../../src/core/process-finder';
import { IProcessInfo } from '../../src/types';

jest.mock('../../src/core/process-finder');

const mockProcessFinder = ProcessFinder as jest.MockedClass<typeof ProcessFinder>;

describe('PortScanner', () => {
  let portScanner: PortScanner;
  let mockProcessFinderInstance: jest.Mocked<ProcessFinder>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProcessFinderInstance = {
      findByPort: jest.fn(),
      findByPorts: jest.fn(),
      isPortAvailable: jest.fn(),
      waitForPortToBeAvailable: jest.fn(),
      waitForPortToBeBusy: jest.fn(),
    } as any;

    mockProcessFinder.mockImplementation(() => mockProcessFinderInstance);

    portScanner = new PortScanner();
  });

  describe('scanPort', () => {
    const mockProcesses: IProcessInfo[] = [
      { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
    ];

    it('should scan a port and return available status', async () => {
      mockProcessFinderInstance.findByPort.mockResolvedValue([]);

      const result = await portScanner.scanPort(3000);

      expect(result).toEqual({
        port: 3000,
        available: true,
        processes: [],
      });
      expect(mockProcessFinderInstance.findByPort).toHaveBeenCalledWith(3000, undefined);
    });

    it('should scan a port and return busy status', async () => {
      mockProcessFinderInstance.findByPort.mockResolvedValue(mockProcesses);

      const result = await portScanner.scanPort(3000);

      expect(result).toEqual({
        port: 3000,
        available: false,
        processes: mockProcesses,
      });
    });

    it('should scan a port with specific protocol', async () => {
      mockProcessFinderInstance.findByPort.mockResolvedValue([]);

      const result = await portScanner.scanPort(3000, 'tcp');

      expect(result.available).toBe(true);
      expect(mockProcessFinderInstance.findByPort).toHaveBeenCalledWith(3000, 'tcp');
    });
  });

  describe('scanPorts', () => {
    it('should scan multiple ports', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];

      mockProcessFinderInstance.findByPort
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockProcesses);

      const result = await portScanner.scanPorts([3000, 8080]);

      expect(result.get(3000)).toEqual({
        port: 3000,
        available: true,
        processes: [],
      });
      expect(result.get(8080)).toEqual({
        port: 8080,
        available: false,
        processes: mockProcesses,
      });
    });
  });

  describe('scanPortRange', () => {
    it('should scan a range of ports', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3001, protocol: 'tcp' },
      ];

      mockProcessFinderInstance.findByPort
        .mockResolvedValueOnce([]) // 3000
        .mockResolvedValueOnce(mockProcesses) // 3001
        .mockResolvedValueOnce([]); // 3002

      const result = await portScanner.scanPortRange(3000, 3002);

      expect(result).toEqual({
        range: '3000-3002',
        availablePorts: [3000, 3002],
        busyPorts: new Map([[3001, mockProcesses]]),
      });
    });

    it('should handle single port range', async () => {
      mockProcessFinderInstance.findByPort.mockResolvedValue([]);

      const result = await portScanner.scanPortRange(3000, 3000);

      expect(result.range).toBe('3000-3000');
      expect(result.availablePorts).toEqual([3000]);
      expect(result.busyPorts.size).toBe(0);
    });
  });

  describe('findAvailablePort', () => {
    it('should find the first available port', async () => {
      mockProcessFinderInstance.isPortAvailable
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await portScanner.findAvailablePort(3000, 10);

      expect(result).toBe(3002);
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenCalledTimes(3);
    });

    it('should return null when no available ports found', async () => {
      mockProcessFinderInstance.isPortAvailable.mockResolvedValue(false);

      const result = await portScanner.findAvailablePort(3000, 3);

      expect(result).toBeNull();
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenCalledTimes(3);
    });

    it('should use default parameters', async () => {
      mockProcessFinderInstance.isPortAvailable.mockResolvedValue(true);

      const result = await portScanner.findAvailablePort();

      expect(result).toBe(3000);
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenCalledWith(3000, undefined);
    });

    it('should not exceed maximum port number 65535', async () => {
      mockProcessFinderInstance.isPortAvailable.mockResolvedValue(false);

      // Try to scan from 65500 with 100 attempts (would go to 65599 without validation)
      const result = await portScanner.findAvailablePort(65500, 100);

      expect(result).toBeNull();
      // Should only check ports 65500-65535 (36 ports)
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenCalledTimes(36);
      // Verify the last port checked was 65535
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenLastCalledWith(
        65535,
        undefined
      );
    });

    it('should return port when found before exceeding max port', async () => {
      // Make port 65530 available
      mockProcessFinderInstance.isPortAvailable.mockImplementation(async (port) => port === 65530);

      const result = await portScanner.findAvailablePort(65520, 100);

      expect(result).toBe(65530);
    });
  });

  describe('findAvailablePorts', () => {
    it('should find multiple available ports', async () => {
      mockProcessFinderInstance.isPortAvailable
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const result = await portScanner.findAvailablePorts(3, 3000, 10);

      expect(result).toEqual([3001, 3003, 3004]);
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenCalledTimes(5);
    });

    it('should stop when reaching max attempts', async () => {
      mockProcessFinderInstance.isPortAvailable.mockResolvedValue(false);

      const result = await portScanner.findAvailablePorts(3, 3000, 5);

      expect(result).toEqual([]);
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenCalledTimes(5);
    });

    it('should stop when finding required count', async () => {
      mockProcessFinderInstance.isPortAvailable.mockResolvedValue(true);

      const result = await portScanner.findAvailablePorts(2, 3000, 100);

      expect(result).toEqual([3000, 3001]);
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenCalledTimes(2);
    });

    it('should not exceed maximum port number 65535', async () => {
      mockProcessFinderInstance.isPortAvailable.mockResolvedValue(true);

      // Try to find 10 ports starting from 65530 (would go to 65539 without validation)
      const result = await portScanner.findAvailablePorts(10, 65530, 100);

      // Should only return ports 65530-65535 (6 ports)
      expect(result).toEqual([65530, 65531, 65532, 65533, 65534, 65535]);
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenCalledTimes(6);
    });

    it('should stop at port 65535 even with max attempts remaining', async () => {
      mockProcessFinderInstance.isPortAvailable.mockResolvedValue(false);

      const result = await portScanner.findAvailablePorts(10, 65530, 1000);

      // Should check ports 65530-65535 (6 ports) then stop
      expect(result).toEqual([]);
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenCalledTimes(6);
      // Verify the last port checked was 65535
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenLastCalledWith(
        65535,
        undefined
      );
    });
  });
});
