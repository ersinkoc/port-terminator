// Performance benchmarks for @oxog/port-terminator
const { PortTerminator, killPort, killPorts, getProcessesOnPort, isPortAvailable } = require('../dist/index.js');
const { performance } = require('perf_hooks');

class PerformanceBenchmark {
  constructor() {
    this.results = [];
    this.terminator = new PortTerminator({ silent: true });
  }

  async benchmark(name, fn, iterations = 10) {
    console.log(`🏃 Running benchmark: ${name} (${iterations} iterations)`);
    
    const times = [];
    let errors = 0;
    
    for (let i = 0; i < iterations; i++) {
      try {
        const start = performance.now();
        await fn();
        const end = performance.now();
        times.push(end - start);
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (error) {
        errors++;
        console.log(`   ❌ Error in iteration ${i + 1}: ${error.message}`);
      }
    }
    
    if (times.length === 0) {
      console.log(`   ❌ All iterations failed`);
      return null;
    }
    
    const avg = times.reduce((a, b) => a + b) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
    
    const result = {
      name,
      iterations: times.length,
      errors,
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      median: Math.round(median * 100) / 100,
      times
    };
    
    this.results.push(result);
    
    console.log(`   ✅ Avg: ${result.avg}ms | Min: ${result.min}ms | Max: ${result.max}ms | Median: ${result.median}ms`);
    if (errors > 0) {
      console.log(`   ⚠️  Errors: ${errors}/${iterations}`);
    }
    
    return result;
  }

  async runAllBenchmarks() {
    console.log('🏁 Starting Performance Benchmarks');
    console.log('=' .repeat(60));
    
    // Benchmark 1: Port availability checking
    await this.benchmark(
      'isPortAvailable() - single port',
      async () => {
        await isPortAvailable(9999); // Use unlikely port
      },
      20
    );
    
    // Benchmark 2: Multiple port availability checking
    await this.benchmark(
      'isPortAvailable() - multiple ports',
      async () => {
        const ports = [9991, 9992, 9993, 9994, 9995];
        await Promise.all(ports.map(port => isPortAvailable(port)));
      },
      15
    );
    
    // Benchmark 3: Process finding on empty port
    await this.benchmark(
      'getProcessesOnPort() - empty port',
      async () => {
        await getProcessesOnPort(9999);
      },
      20
    );
    
    // Benchmark 4: Process termination on empty port
    await this.benchmark(
      'killPort() - empty port',
      async () => {
        await killPort(9999);
      },
      15
    );
    
    // Benchmark 5: Multiple empty ports termination
    await this.benchmark(
      'killPorts() - multiple empty ports',
      async () => {
        await killPorts([9991, 9992, 9993]);
      },
      10
    );
    
    // Benchmark 6: PortTerminator class operations
    await this.benchmark(
      'PortTerminator.terminate() - single port',
      async () => {
        await this.terminator.terminate(9999);
      },
      15
    );
    
    // Benchmark 7: Range of ports
    await this.benchmark(
      'PortTerminator.terminateMultiple() - port range',
      async () => {
        const ports = Array.from({length: 10}, (_, i) => 9990 + i);
        await this.terminator.terminateMultiple(ports);
      },
      8
    );
    
    console.log();
    this.printSummary();
    
    // Memory usage benchmark
    await this.memoryBenchmark();
    
    // Concurrency benchmark
    await this.concurrencyBenchmark();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ All benchmarks completed!');
  }
  
  printSummary() {
    console.log('📊 Performance Summary');
    console.log('-'.repeat(60));
    console.log('Operation'.padEnd(35) + 'Avg (ms)'.padStart(10) + 'Min (ms)'.padStart(10) + 'Max (ms)'.padStart(10));
    console.log('-'.repeat(60));
    
    this.results.forEach(result => {
      const name = result.name.length > 33 ? result.name.substring(0, 30) + '...' : result.name;
      console.log(
        name.padEnd(35) + 
        result.avg.toString().padStart(10) + 
        result.min.toString().padStart(10) + 
        result.max.toString().padStart(10)
      );
    });
    
    console.log('-'.repeat(60));
    
    // Find fastest and slowest operations
    const sortedByAvg = [...this.results].sort((a, b) => a.avg - b.avg);
    console.log(`🚀 Fastest: ${sortedByAvg[0].name} (${sortedByAvg[0].avg}ms avg)`);
    console.log(`🐌 Slowest: ${sortedByAvg[sortedByAvg.length - 1].name} (${sortedByAvg[sortedByAvg.length - 1].avg}ms avg)`);
  }
  
  async memoryBenchmark() {
    console.log('\n🧠 Memory Usage Benchmark');
    console.log('-'.repeat(30));
    
    const getMemoryUsage = () => {
      const usage = process.memoryUsage();
      return {
        rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(usage.external / 1024 / 1024 * 100) / 100
      };
    };
    
    const before = getMemoryUsage();
    console.log('Memory before operations:');
    console.log(`   RSS: ${before.rss}MB | Heap Used: ${before.heapUsed}MB | Heap Total: ${before.heapTotal}MB`);
    
    // Perform memory-intensive operations
    const operations = [];
    for (let i = 0; i < 100; i++) {
      operations.push(isPortAvailable(9000 + i));
    }
    
    await Promise.all(operations);
    
    const after = getMemoryUsage();
    console.log('Memory after 100 concurrent operations:');
    console.log(`   RSS: ${after.rss}MB | Heap Used: ${after.heapUsed}MB | Heap Total: ${after.heapTotal}MB`);
    
    const diff = {
      rss: Math.round((after.rss - before.rss) * 100) / 100,
      heapUsed: Math.round((after.heapUsed - before.heapUsed) * 100) / 100,
      heapTotal: Math.round((after.heapTotal - before.heapTotal) * 100) / 100
    };
    
    console.log('Memory difference:');
    console.log(`   RSS: ${diff.rss >= 0 ? '+' : ''}${diff.rss}MB | Heap Used: ${diff.heapUsed >= 0 ? '+' : ''}${diff.heapUsed}MB | Heap Total: ${diff.heapTotal >= 0 ? '+' : ''}${diff.heapTotal}MB`);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      const afterGC = getMemoryUsage();
      console.log('Memory after garbage collection:');
      console.log(`   RSS: ${afterGC.rss}MB | Heap Used: ${afterGC.heapUsed}MB | Heap Total: ${afterGC.heapTotal}MB`);
    }
  }
  
  async concurrencyBenchmark() {
    console.log('\n⚡ Concurrency Benchmark');
    console.log('-'.repeat(25));
    
    const concurrencyLevels = [1, 5, 10, 20, 50];
    
    for (const level of concurrencyLevels) {
      const start = performance.now();
      
      const operations = Array.from({length: level}, (_, i) => 
        isPortAvailable(9000 + i)
      );
      
      await Promise.all(operations);
      
      const end = performance.now();
      const duration = Math.round((end - start) * 100) / 100;
      const avgPerOp = Math.round((duration / level) * 100) / 100;
      
      console.log(`Concurrency ${level.toString().padStart(2)}: ${duration.toString().padStart(8)}ms total | ${avgPerOp.toString().padStart(6)}ms per operation`);
    }
  }
  
  async stressTest() {
    console.log('\n💪 Stress Test');
    console.log('-'.repeat(15));
    
    const stressOperations = 500;
    const batchSize = 50;
    
    console.log(`Running ${stressOperations} operations in batches of ${batchSize}...`);
    
    const start = performance.now();
    let completed = 0;
    let errors = 0;
    
    for (let i = 0; i < stressOperations; i += batchSize) {
      const batch = [];
      
      for (let j = 0; j < batchSize && i + j < stressOperations; j++) {
        batch.push(
          isPortAvailable(9000 + (i + j) % 1000).catch(() => {
            errors++;
          })
        );
      }
      
      await Promise.all(batch);
      completed += batch.length;
      
      if (completed % 100 === 0) {
        console.log(`   Progress: ${completed}/${stressOperations} (${Math.round(completed/stressOperations*100)}%)`);
      }
    }
    
    const end = performance.now();
    const duration = Math.round((end - start) * 100) / 100;
    const opsPerSecond = Math.round((stressOperations / (duration / 1000)) * 100) / 100;
    
    console.log(`✅ Completed ${completed} operations in ${duration}ms`);
    console.log(`   Operations per second: ${opsPerSecond}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Success rate: ${Math.round((completed - errors) / completed * 100)}%`);
  }
  
  async compareWithAlternatives() {
    console.log('\n🆚 Comparison with Alternative Methods');
    console.log('-'.repeat(40));
    
    // Compare our implementation with direct command execution
    const { spawn } = require('child_process');
    
    const executeCommand = (command, args) => {
      return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'pipe' });
        let output = '';
        
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve(output);
          } else {
            reject(new Error(`Command failed: ${command} ${args.join(' ')}`));
          }
        });
        
        child.on('error', reject);
      });
    };
    
    // Test direct netstat vs our implementation
    const isWindows = process.platform === 'win32';
    const isMacOS = process.platform === 'darwin';
    
    if (isWindows) {
      await this.benchmark(
        'Direct netstat (Windows)',
        async () => {
          await executeCommand('netstat', ['-ano']);
        },
        5
      );
    } else if (isMacOS) {
      await this.benchmark(
        'Direct lsof (macOS)',
        async () => {
          await executeCommand('lsof', ['-i', ':9999']).catch(() => {});
        },
        5
      );
    } else {
      await this.benchmark(
        'Direct lsof (Linux)',
        async () => {
          await executeCommand('lsof', ['-i', ':9999']).catch(() => {});
        },
        5
      );
    }
    
    console.log('📈 Our implementation includes:');
    console.log('   - Cross-platform abstraction');
    console.log('   - Error handling and retries');
    console.log('   - Process information parsing');
    console.log('   - Graceful/force termination logic');
    console.log('   - Input validation');
  }
  
  exportResults() {
    const report = {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      cpuInfo: require('os').cpus()[0],
      memoryTotal: Math.round(require('os').totalmem() / 1024 / 1024),
      results: this.results
    };
    
    const fs = require('fs');
    const filename = `benchmark-results-${Date.now()}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\n📁 Results exported to: ${filename}`);
    
    return report;
  }
}

// CLI execution
async function runBenchmarks() {
  const benchmark = new PerformanceBenchmark();
  
  try {
    await benchmark.runAllBenchmarks();
    
    // Optional stress test (uncomment to run)
    // await benchmark.stressTest();
    
    // Optional comparison (uncomment to run)
    // await benchmark.compareWithAlternatives();
    
    benchmark.exportResults();
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    process.exit(1);
  }
}

// Run benchmarks if executed directly
if (require.main === module) {
  console.log('⚡ @oxog/port-terminator Performance Benchmarks');
  console.log(`Platform: ${process.platform} | Node: ${process.version}`);
  console.log(`CPU: ${require('os').cpus()[0].model}`);
  console.log(`Memory: ${Math.round(require('os').totalmem() / 1024 / 1024 / 1024)}GB`);
  console.log();
  
  runBenchmarks().catch(console.error);
}

module.exports = { PerformanceBenchmark };