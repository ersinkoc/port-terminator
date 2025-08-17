// Advanced example: Development workflow automation
const { PortTerminator, killPorts, getProcessesOnPort } = require('@oxog/port-terminator');

class DevelopmentPortManager {
  constructor() {
    this.terminator = new PortTerminator({
      force: false,
      gracefulTimeout: 3000,
      timeout: 15000,
      silent: false
    });

    // Common development ports
    this.commonPorts = {
      react: [3000, 3001],
      nextjs: [3000, 3001],
      vue: [8080, 8081],
      angular: [4200, 4201],
      express: [3000, 5000, 8000],
      webpack: [8080, 8081, 9000, 9001],
      storybook: [6006, 6007],
      jest: [9229],
      docker: [80, 443, 5000, 8080]
    };
  }

  async cleanupDevEnvironment() {
    console.log('🧹 Cleaning up development environment...\n');

    // Get all unique ports
    const allPorts = [...new Set(Object.values(this.commonPorts).flat())];
    
    console.log(`Checking ${allPorts.length} common development ports...`);
    
    const results = await this.terminator.terminateWithDetails(allPorts);
    
    let totalProcesses = 0;
    let successfulPorts = 0;
    
    for (const result of results) {
      if (result.processes.length > 0) {
        totalProcesses += result.processes.length;
        
        if (result.success) {
          successfulPorts++;
          console.log(`✅ Port ${result.port}: Terminated ${result.processes.length} process(es)`);
          
          result.processes.forEach(proc => {
            console.log(`   - ${proc.name} (PID: ${proc.pid})`);
          });
        } else {
          console.log(`❌ Port ${result.port}: Failed to terminate processes`);
          if (result.error) {
            console.log(`   Error: ${result.error}`);
          }
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Ports checked: ${allPorts.length}`);
    console.log(`   - Processes found: ${totalProcesses}`);
    console.log(`   - Successfully cleaned: ${successfulPorts}`);
    
    return { totalProcesses, successfulPorts };
  }

  async setupCleanEnvironment(framework = 'react') {
    console.log(`🚀 Setting up clean environment for ${framework}...\n`);

    const frameworkPorts = this.commonPorts[framework] || [3000];
    
    // Kill any existing processes on framework ports
    await killPorts(frameworkPorts, { force: true, silent: true });
    
    // Wait a moment for processes to fully terminate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify ports are available
    const portStatus = {};
    for (const port of frameworkPorts) {
      const available = await this.terminator.isPortAvailable(port);
      portStatus[port] = available;
      console.log(`Port ${port}: ${available ? '✅ Available' : '❌ Still busy'}`);
    }
    
    const allAvailable = Object.values(portStatus).every(available => available);
    
    if (allAvailable) {
      console.log(`\n🎉 Environment ready for ${framework} development!`);
    } else {
      console.log(`\n⚠️  Some ports are still busy. You may need to wait or use different ports.`);
    }
    
    return portStatus;
  }

  async monitorPorts(ports, duration = 30000) {
    console.log(`👀 Monitoring ports [${ports.join(', ')}] for ${duration/1000} seconds...\n`);

    const startTime = Date.now();
    const interval = 2000; // Check every 2 seconds
    
    while (Date.now() - startTime < duration) {
      console.log(`⏰ ${new Date().toLocaleTimeString()}`);
      
      for (const port of ports) {
        const processes = await getProcessesOnPort(port);
        
        if (processes.length > 0) {
          console.log(`  Port ${port}: ${processes.length} process(es)`);
          processes.forEach(proc => {
            console.log(`    - ${proc.name} (PID: ${proc.pid}) ${proc.protocol}`);
          });
        } else {
          console.log(`  Port ${port}: Available`);
        }
      }
      
      console.log(''); // Empty line
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    console.log('📊 Monitoring completed.');
  }

  async handlePortConflict(port, preferredAlternatives = []) {
    console.log(`🔍 Handling port conflict on ${port}...\n`);

    // Check if port is actually busy
    const processes = await getProcessesOnPort(port); 
    
    if (processes.length === 0) {
      console.log(`✅ Port ${port} is actually available`);
      return { available: true, port };
    }
    
    console.log(`❌ Port ${port} is busy with ${processes.length} process(es):`);
    processes.forEach(proc => {
      console.log(`   - ${proc.name} (PID: ${proc.pid}) - ${proc.command || 'No command info'}`);
    });
    
    // Ask user what to do (in a real app, you might use inquirer.js)
    console.log('\nOptions:');
    console.log('1. Kill existing processes and use this port');
    console.log('2. Find alternative port');
    console.log('3. Manual resolution required');
    
    // For demo purposes, let's try to find an alternative port
    const alternatives = preferredAlternatives.length > 0 
      ? preferredAlternatives 
      : [port + 1, port + 2, port + 3, port + 10];
    
    console.log(`\n🔍 Checking alternative ports: [${alternatives.join(', ')}]`);
    
    for (const altPort of alternatives) {
      const available = await this.terminator.isPortAvailable(altPort);
      if (available) {
        console.log(`✅ Found available alternative: Port ${altPort}`);
        return { available: true, port: altPort, alternative: true };
      } else {
        console.log(`❌ Port ${altPort} is also busy`);
      }
    }
    
    console.log(`\n⚠️  No available alternatives found. Manual resolution required.`);
    return { available: false, port, processes };
  }
}

// Example usage
async function runDevelopmentWorkflowExample() {
  console.log('🔧 Development Workflow Example\n');
  console.log('=' .repeat(50));
  
  const manager = new DevelopmentPortManager();
  
  try {
    // 1. Clean up development environment
    await manager.cleanupDevEnvironment();
    
    console.log('\n' + '='.repeat(50));
    
    // 2. Setup environment for React development
    await manager.setupCleanEnvironment('react');
    
    console.log('\n' + '='.repeat(50));
    
    // 3. Simulate port conflict scenario
    console.log('\n🎭 Simulating port conflict scenario...');
    
    // Start a simple server to create a conflict
    const http = require('http');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Test server for port conflict demo');
    });
    
    server.listen(3000, () => {
      console.log('Started test server on port 3000 for conflict demo');
    });
    
    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Handle the conflict
    const resolution = await manager.handlePortConflict(3000, [3001, 3002, 3003]);
    console.log('\nConflict resolution result:', resolution);
    
    // Clean up test server
    server.close();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Development workflow example completed!');
    
  } catch (error) {
    console.error('❌ Error in development workflow:', error.message);
    
    if (error.name === 'PermissionError') {
      console.error('\n💡 Try running with elevated privileges:');
      console.error('   - Linux/Mac: sudo node development-workflow.js');
      console.error('   - Windows: Run as Administrator');
    }
  }
}

// Run if executed directly
if (require.main === module) {
  runDevelopmentWorkflowExample().catch(console.error);
}

module.exports = { DevelopmentPortManager, runDevelopmentWorkflowExample };