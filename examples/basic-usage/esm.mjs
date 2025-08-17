// ES Modules example for @oxog/port-terminator
import { killPort, killPorts, getProcessOnPort, isPortAvailable, PortTerminator } from '@oxog/port-terminator';

async function basicUsageExample() {
  console.log('🚀 @oxog/port-terminator - Basic Usage Example (ESM)\n');

  try {
    // Example 1: Simple port termination
    console.log('1. Simple port termination...');
    const result1 = await killPort(3000);
    console.log(`   Port 3000: ${result1 ? '✅ Terminated' : '❌ No process found'}\n`);

    // Example 2: Multiple ports with options
    console.log('2. Multiple ports with force option...');
    const result2 = await killPorts([8080, 9000, 3001], { force: true });
    console.log('   Results:');
    result2.forEach((success, port) => {
      console.log(`   - Port ${port}: ${success ? '✅ Success' : '❌ Failed'}`);
    });
    console.log();

    // Example 3: Using PortTerminator class with options
    console.log('3. Using PortTerminator class with custom options...');
    const terminator = new PortTerminator({
      method: 'tcp',           // Only TCP processes
      gracefulTimeout: 3000,   // 3 second graceful timeout
      force: false,            // Try graceful first
      silent: false            // Show logs
    });

    const processes = await terminator.getProcesses(3000);
    if (processes.length > 0) {
      console.log(`   Found ${processes.length} process(es) on port 3000:`);
      processes.forEach(proc => {
        console.log(`   - PID ${proc.pid}: ${proc.name} (${proc.protocol})`);
        if (proc.user) console.log(`     User: ${proc.user}`);
      });

      const terminated = await terminator.terminate(3000);
      console.log(`   Termination: ${terminated ? '✅ Success' : '❌ Failed'}`);
    } else {
      console.log('   No TCP processes found on port 3000');
    }
    console.log();

    // Example 4: Check port availability
    console.log('4. Port availability check...');
    const portsToCheck = [3000, 8080, 9000, 1234];
    
    for (const port of portsToCheck) {
      const available = await isPortAvailable(port);
      console.log(`   Port ${port}: ${available ? '🟢 Available' : '🔴 Busy'}`);
    }

  } catch (error) {
    console.error('❌ Error occurred:', error.message);
    
    if (error.name === 'InvalidPortError') {
      console.error('   Invalid port number provided');
    } else if (error.name === 'PermissionError') {
      console.error('   Insufficient permissions - try running with elevated privileges');
    } else if (error.name === 'PlatformError') {
      console.error('   Platform not supported');
    }
  }
}

// Run the example
basicUsageExample().catch(console.error);