import type { ICliOptions } from '../types';
import { validatePort, parsePortRange, normalizeProtocol } from './validators';

interface IArgument {
  name: string;
  value: string | boolean | number;
  hasValue: boolean;
}

export class CommandParser {
  private args: string[];
  private parsed: IArgument[] = [];

  constructor(args: string[] = process.argv.slice(2)) {
    this.args = args;
  }

  public parse(): ICliOptions {
    this.parsed = this.parseArguments();

    const options: ICliOptions = {};
    const ports: number[] = [];

    for (const arg of this.parsed) {
      switch (arg.name) {
        case 'help':
        case 'h':
          options.help = true;
          break;
        case 'version':
        case 'v':
          options.version = true;
          break;
        case 'force':
        case 'f':
          options.force = true;
          break;
        case 'silent':
        case 's':
          options.silent = true;
          break;
        case 'dry-run':
        case 'n':
          options.dryRun = true;
          break;
        case 'json':
        case 'j':
          options.json = true;
          break;
        case 'timeout':
        case 't':
          if (typeof arg.value === 'number') {
            options.timeout = arg.value;
          }
          break;
        case 'graceful-timeout':
        case 'g':
          if (typeof arg.value === 'number') {
            options.gracefulTimeout = arg.value;
          }
          break;
        case 'method':
        case 'm':
          if (typeof arg.value === 'string') {
            // Validate and normalize the protocol value
            options.method = normalizeProtocol(arg.value);
          }
          break;
        case 'range':
        case 'r':
          if (typeof arg.value === 'string') {
            options.range = arg.value;
            const rangePorts = parsePortRange(arg.value);
            ports.push(...rangePorts);
          }
          break;
        case 'port':
          if (typeof arg.value === 'number') {
            ports.push(arg.value);
          }
          break;
      }
    }

    if (ports.length > 0) {
      options.ports = ports;
    }

    return options;
  }

  private parseArguments(): IArgument[] {
    const parsed: IArgument[] = [];

    for (let i = 0; i < this.args.length; i++) {
      const arg = this.args[i];

      if (arg.startsWith('--')) {
        const longArg = this.parseLongArgument(arg, i);
        parsed.push(longArg.argument);
        if (longArg.skipNext) {
          i++;
        }
      } else if (arg.startsWith('-') && arg.length > 1) {
        const shortArgs = this.parseShortArguments(arg, i);
        parsed.push(...shortArgs.arguments);
        if (shortArgs.skipNext) {
          i++;
        }
      } else {
        const portValue = this.parsePortValue(arg);
        if (portValue !== null) {
          parsed.push({
            name: 'port',
            value: portValue,
            hasValue: true,
          });
        }
      }
    }

    return parsed;
  }

  private parseLongArgument(
    arg: string,
    index: number
  ): { argument: IArgument; skipNext: boolean } {
    const name = arg.substring(2);
    const equalIndex = name.indexOf('=');

    if (equalIndex !== -1) {
      const argName = name.substring(0, equalIndex);
      const argValue = name.substring(equalIndex + 1);
      return {
        argument: {
          name: argName,
          value: this.parseValue(argValue),
          hasValue: true,
        },
        skipNext: false,
      };
    }

    if (this.isBooleanFlag(name)) {
      return {
        argument: {
          name,
          value: true,
          hasValue: false,
        },
        skipNext: false,
      };
    }

    const nextArg = this.args[index + 1];
    if (nextArg && !nextArg.startsWith('-')) {
      return {
        argument: {
          name,
          value: this.parseValue(nextArg),
          hasValue: true,
        },
        skipNext: true,
      };
    }

    return {
      argument: {
        name,
        value: true,
        hasValue: false,
      },
      skipNext: false,
    };
  }

  private parseShortArguments(
    arg: string,
    index: number
  ): { arguments: IArgument[]; skipNext: boolean } {
    const flags = arg.substring(1);
    const parsedArgs: IArgument[] = [];
    let skipNext = false;

    for (let i = 0; i < flags.length; i++) {
      const flag = flags[i];
      const flagName = this.getShortFlagName(flag);

      if (i === flags.length - 1 && !this.isBooleanFlag(flagName)) {
        const nextArg = this.args[index + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          parsedArgs.push({
            name: flagName,
            value: this.parseValue(nextArg),
            hasValue: true,
          });
          skipNext = true;
        } else {
          parsedArgs.push({
            name: flagName,
            value: true,
            hasValue: false,
          });
        }
      } else {
        parsedArgs.push({
          name: flagName,
          value: true,
          hasValue: false,
        });
      }
    }

    return { arguments: parsedArgs, skipNext };
  }

  private parseValue(value: string): string | number | boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;

    const numValue = Number(value);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }

    return value;
  }

  private parsePortValue(value: string): number | null {
    try {
      return validatePort(value);
    } catch {
      return null;
    }
  }

  private isBooleanFlag(name: string): boolean {
    const booleanFlags = [
      'help',
      'h',
      'version',
      'v',
      'force',
      'f',
      'silent',
      's',
      'dry-run',
      'n',
      'json',
      'j',
    ];
    return booleanFlags.includes(name);
  }

  private getShortFlagName(flag: string): string {
    const shortFlagMap: Record<string, string> = {
      h: 'help',
      v: 'version',
      f: 'force',
      s: 'silent',
      n: 'dry-run',
      j: 'json',
      t: 'timeout',
      g: 'graceful-timeout',
      m: 'method',
      r: 'range',
    };

    return shortFlagMap[flag] || flag;
  }

  public static parseArgs(args?: string[]): ICliOptions {
    const parser = new CommandParser(args);
    return parser.parse();
  }
}
