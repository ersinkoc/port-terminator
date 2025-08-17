// CommonJS example for @oxog/port-terminator
const { killPort, killPorts, getProcessOnPort, isPortAvailable } = require('@oxog/port-terminator');

async function basicUsageExample() {
  console.log('🚀 @oxog/port-terminator - Basic Usage Example (CommonJS)\n');

  try {
    // Example 1: Kill a single port
    console.log('1. Killing process on port 3000...');
    const result1 = await killPort(3000);
    console.log(`   Result: ${result1 ? '✅ Success' : '❌ Failed'}\n`);

    // Example 2: Kill multiple ports
    console.log('2. Killing processes on multiple ports...');
    const result2 = await killPorts([8080, 9000, 3001]);
    console.log('   Results:');
    for (const [port, success] of result2) {
      console.log(`   - Port ${port}: ${success ? '✅ Success' : '❌ Failed'}`);
    }
    console.log();

    // Example 3: Get process information
    console.log('3. Getting process information for port 3000...');
    const process = await getProcessOnPort(3000);
    if (process) {
      console.log(`   Found process: PID ${process.pid}, Name: ${process.name}`);
      if (process.command) {
        console.log(`   Command: ${process.command}`);
      }
    } else {
      console.log('   No process found on port 3000');
    }
    console.log();

    // Example 4: Check port availability
    console.log('4. Checking port availability...');
    const ports = [3000, 8080, 9000];
    for (const port of ports) {
      const available = await isPortAvailable(port);
      console.log(`   Port ${port}: ${available ? '✅ Available' : '❌ Busy'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
  }
}

// Run the example
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

module.exports = { basicUsageExample };