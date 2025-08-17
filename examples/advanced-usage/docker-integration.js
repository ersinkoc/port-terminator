// Advanced example: Docker container port management
const { PortTerminator, getProcessesOnPort, killPorts } = require('@oxog/port-terminator');

class DockerPortManager {
  constructor() {
    this.terminator = new PortTerminator({
      force: true, // Docker containers may need force termination
      gracefulTimeout: 2000,
      timeout: 10000,
      method: 'both'
    });

    this.commonDockerPorts = {
      web: [80, 8080, 3000, 5000],
      database: [3306, 5432, 27017, 6379],
      cache: [6379, 11211],
      monitoring: [9090, 3000, 8080],
      development: [3000, 3001, 8080, 8081, 9000]
    };
  }

  async findDockerProcesses(ports) {
    console.log('🐳 Scanning for Docker-related processes...\n');

    const dockerProcesses = new Map();
    
    for (const port of ports) {
      try {
        const processes = await getProcessesOnPort(port);
        
        const dockerProcs = processes.filter(proc => 
          this.isDockerRelated(proc)
        );
        
        if (dockerProcs.length > 0) {
          dockerProcesses.set(port, dockerProcs);
          
          console.log(`🐳 Port ${port}: Found ${dockerProcs.length} Docker process(es)`);
          dockerProcs.forEach(proc => {
            console.log(`   - ${proc.name} (PID: ${proc.pid})`);
            if (proc.command) {
              const shortCommand = proc.command.length > 60 
                ? proc.command.substring(0, 60) + '...'
                : proc.command;
              console.log(`     Command: ${shortCommand}`);
            }
          });
        }
      } catch (error) {
        console.log(`❌ Error checking port ${port}: ${error.message}`);
      }
    }
    
    return dockerProcesses;
  }

  isDockerRelated(process) {
    const dockerIndicators = [
      'docker',
      'containerd',
      'dockerd',
      'docker-proxy',
      'com.docker',
      'moby',
      'runc'
    ];

    const name = (process.name || '').toLowerCase();
    const command = (process.command || '').toLowerCase();
    
    return dockerIndicators.some(indicator => 
      name.includes(indicator) || command.includes(indicator)
    );
  }

  async cleanupDockerPorts(category = 'development') {
    console.log(`🧹 Cleaning up Docker ports for: ${category}\n`);

    const ports = this.commonDockerPorts[category] || [];
    if (ports.length === 0) {
      console.log('❌ Unknown category or no ports defined');
      return;
    }

    console.log(`Targeting ports: [${ports.join(', ')}]`);

    const dockerProcesses = await this.findDockerProcesses(ports);
    
    if (dockerProcesses.size === 0) {
      console.log('✅ No Docker processes found on specified ports');
      return;
    }

    console.log(`\n🔄 Terminating Docker processes...`);
    
    const portsToKill = Array.from(dockerProcesses.keys());
    const results = await killPorts(portsToKill, { 
      force: true, 
      timeout: 15000 
    });

    let successCount = 0;
    let failCount = 0;

    results.forEach((success, port) => {
      if (success) {
        successCount++;
        console.log(`✅ Port ${port}: Successfully terminated Docker processes`);
      } else {
        failCount++;
        console.log(`❌ Port ${port}: Failed to terminate processes`);
      }
    });

    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   - Ports processed: ${portsToKill.length}`);
    console.log(`   - Successful: ${successCount}`);
    console.log(`   - Failed: ${failCount}`);

    return { successCount, failCount, total: portsToKill.length };
  }

  async prepareForDockerCompose(composeConfig) {
    console.log('🐳 Preparing environment for Docker Compose...\n');

    // Extract ports from docker-compose configuration
    const ports = this.extractPortsFromConfig(composeConfig);
    
    if (ports.length === 0) {
      console.log('ℹ️  No ports found in configuration');
      return;
    }

    console.log(`Found ports in configuration: [${ports.join(', ')}]`);

    // Check for conflicts
    const conflicts = [];
    
    for (const port of ports) {
      const processes = await getProcessesOnPort(port);
      if (processes.length > 0) {
        conflicts.push({
          port,
          processes: processes.length,
          details: processes
        });
      }
    }

    if (conflicts.length === 0) {
      console.log('✅ All ports are available for Docker Compose');
      return { conflicts: false, ports };
    }

    console.log(`⚠️  Found conflicts on ${conflicts.length} port(s):`);
    conflicts.forEach(conflict => {
      console.log(`   - Port ${conflict.port}: ${conflict.processes} process(es) running`);
      conflict.details.forEach(proc => {
        console.log(`     * ${proc.name} (PID: ${proc.pid})`);
      });
    });

    // Offer to clean up conflicts
    console.log('\n🔄 Attempting to resolve conflicts...');
    
    const conflictPorts = conflicts.map(c => c.port);
    const results = await killPorts(conflictPorts, { force: true });
    
    let resolved = 0;
    results.forEach((success, port) => {
      if (success) {
        resolved++;
        console.log(`✅ Port ${port}: Conflict resolved`);
      } else {
        console.log(`❌ Port ${port}: Could not resolve conflict`);
      }
    });

    console.log(`\n📊 Conflict Resolution:`);
    console.log(`   - Conflicts found: ${conflicts.length}`);
    console.log(`   - Resolved: ${resolved}`);
    console.log(`   - Remaining: ${conflicts.length - resolved}`);

    return { 
      conflicts: conflicts.length > resolved,
      resolved,
      remaining: conflicts.length - resolved,
      ports 
    };
  }

  extractPortsFromConfig(config) {
    // Simple port extraction from docker-compose-like config
    const ports = [];
    const portRegex = /(\d+):\d+/g;
    
    const configStr = JSON.stringify(config);
    let match;
    
    while ((match = portRegex.exec(configStr)) !== null) {
      const port = parseInt(match[1], 10);
      if (port >= 1 && port <= 65535 && !ports.includes(port)) {
        ports.push(port);
      }
    }
    
    return ports.sort((a, b) => a - b);
  }

  async monitorDockerPorts(duration = 30000) {
    console.log(`👀 Monitoring Docker ports for ${duration/1000} seconds...\n`);
    
    const allPorts = [...new Set(Object.values(this.commonDockerPorts).flat())];
    const startTime = Date.now();
    const interval = 5000; // Check every 5 seconds

    while (Date.now() - startTime < duration) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`⏰ ${timestamp} - Docker Port Status:`);

      const dockerProcesses = await this.findDockerProcesses(allPorts);
      
      if (dockerProcesses.size === 0) {
        console.log('   🟢 No Docker processes detected');
      } else {
        console.log(`   🔴 Docker processes on ${dockerProcesses.size} port(s)`);
        dockerProcesses.forEach((procs, port) => {
          console.log(`   - Port ${port}: ${procs.length} process(es)`);
        });
      }

      console.log(''); // Empty line
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    console.log('📊 Docker monitoring completed.');
  }

  async generateDockerPortReport() {
    console.log('📋 Generating Docker Port Usage Report...\n');

    const allPorts = [...new Set(Object.values(this.commonDockerPorts).flat())];
    const report = {
      timestamp: new Date().toISOString(),
      totalPortsScanned: allPorts.length,
      dockerProcesses: 0,
      nonDockerProcesses: 0,
      availablePorts: 0,
      details: {}
    };

    for (const port of allPorts) {
      try {
        const processes = await getProcessesOnPort(port);
        
        if (processes.length === 0) {
          report.availablePorts++;
          report.details[port] = { status: 'available', processes: [] };
        } else {
          const dockerProcs = processes.filter(p => this.isDockerRelated(p));
          const nonDockerProcs = processes.filter(p => !this.isDockerRelated(p));
          
          if (dockerProcs.length > 0) {
            report.dockerProcesses++;
          }
          if (nonDockerProcs.length > 0) {
            report.nonDockerProcesses++;
          }
          
          report.details[port] = {
            status: 'busy',
            processes,
            dockerProcesses: dockerProcs.length,
            nonDockerProcesses: nonDockerProcs.length
          };
        }
      } catch (error) {
        report.details[port] = { 
          status: 'error', 
          error: error.message 
        };
      }
    }

    // Display report
    console.log('📊 Docker Port Report:');
    console.log(`   - Total ports scanned: ${report.totalPortsScanned}`);
    console.log(`   - Available ports: ${report.availablePorts}`);
    console.log(`   - Ports with Docker processes: ${report.dockerProcesses}`);
    console.log(`   - Ports with non-Docker processes: ${report.nonDockerProcesses}`);

    // Show busy ports
    const busyPorts = Object.entries(report.details)
      .filter(([_, data]) => data.status === 'busy')
      .map(([port, _]) => port);

    if (busyPorts.length > 0) {
      console.log(`\n🔴 Busy ports: [${busyPorts.join(', ')}]`);
    }

    // Show available ports  
    const availablePorts = Object.entries(report.details)
      .filter(([_, data]) => data.status === 'available')
      .map(([port, _]) => port);

    if (availablePorts.length > 0) {
      console.log(`🟢 Available ports: [${availablePorts.join(', ')}]`);
    }

    return report;
  }
}

// Example usage
async function runDockerIntegrationExample() {
  console.log('🐳 Docker Integration Example\n');
  console.log('=' .repeat(50));

  const manager = new DockerPortManager();

  try {
    // 1. Generate port report
    await manager.generateDockerPortReport();

    console.log('\n' + '='.repeat(50));

    // 2. Example docker-compose configuration
    const exampleComposeConfig = {
      version: '3.8',
      services: {
        web: {
          image: 'nginx',
          ports: ['80:80', '443:443']
        },
        api: {
          image: 'node:18',
          ports: ['3000:3000']
        },
        database: {
          image: 'postgres:14',
          ports: ['5432:5432']
        },
        redis: {
          image: 'redis:7',
          ports: ['6379:6379']
        }
      }
    };

    // 3. Prepare for docker-compose
    await manager.prepareForDockerCompose(exampleComposeConfig);

    console.log('\n' + '='.repeat(50));

    // 4. Clean up development ports
    await manager.cleanupDockerPorts('development');

    console.log('\n' + '='.repeat(50));
    console.log('✅ Docker integration example completed!');

  } catch (error) {
    console.error('❌ Error in Docker integration:', error.message);
    
    if (error.name === 'PermissionError') {
      console.error('\n💡 Docker processes may require elevated privileges:');
      console.error('   - Linux/Mac: sudo node docker-integration.js');
      console.error('   - Windows: Run as Administrator');
    }
  }
}

// Run if executed directly
if (require.main === module) {
  runDockerIntegrationExample().catch(console.error);
}

module.exports = { DockerPortManager, runDockerIntegrationExample };