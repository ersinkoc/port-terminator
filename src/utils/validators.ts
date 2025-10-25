import { InvalidPortError } from '../errors';

export function validatePort(port: number | string): number {
  let portNum: number;

  if (typeof port === 'string') {
    // Check for decimal numbers in string
    if (port.includes('.')) {
      throw new InvalidPortError(port);
    }
    portNum = parseInt(port, 10);
  } else {
    portNum = port;
  }

  if (isNaN(portNum) || !isFinite(portNum)) {
    throw new InvalidPortError(port);
  }

  // Ensure port is an integer (no floating point)
  if (!Number.isInteger(portNum)) {
    throw new InvalidPortError(port);
  }

  if (portNum < 1 || portNum > 65535) {
    throw new InvalidPortError(port);
  }

  return portNum;
}

export function validatePorts(ports: (number | string)[]): number[] {
  return ports.map(validatePort);
}

export function validateTimeout(timeout: number): number {
  if (timeout < 0 || !isFinite(timeout)) {
    throw new Error(`Invalid timeout: ${timeout}. Timeout must be a positive number`);
  }
  return timeout;
}

export function parsePortRange(range: string, maxRangeSize = 1000): number[] {
  const rangeParts = range.split('-');
  if (rangeParts.length !== 2) {
    throw new Error(`Invalid port range: ${range}. Expected format: start-end`);
  }

  const start = validatePort(rangeParts[0].trim());
  const end = validatePort(rangeParts[1].trim());

  if (start > end) {
    throw new Error(
      `Invalid port range: ${range}. Start port must be less than or equal to end port`
    );
  }

  const rangeSize = end - start + 1;
  if (rangeSize > maxRangeSize) {
    throw new Error(
      `Port range too large: ${rangeSize} ports. Maximum allowed: ${maxRangeSize}`
    );
  }

  const ports: number[] = [];
  for (let port = start; port <= end; port++) {
    ports.push(port);
  }

  return ports;
}

export function isValidProtocol(protocol: string): boolean {
  return ['tcp', 'udp', 'both'].includes(protocol.toLowerCase());
}

export function normalizeProtocol(protocol?: string): 'tcp' | 'udp' | 'both' {
  if (protocol === undefined || protocol === null) {
    return 'both';
  }

  const normalized = protocol.toLowerCase();
  if (!isValidProtocol(normalized)) {
    throw new Error(`Invalid protocol: ${protocol}. Must be 'tcp', 'udp', or 'both'`);
  }

  return normalized as 'tcp' | 'udp' | 'both';
}

export function validatePID(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Invalid PID: ${pid}. Must be a positive integer.`);
  }
}
