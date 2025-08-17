#!/bin/bash

# CLI Usage Examples for @oxog/port-terminator
# Make sure the package is installed globally: npm install -g @oxog/port-terminator

echo "🚀 @oxog/port-terminator CLI Examples"
echo "======================================"

# Check if port-terminator is available
if ! command -v port-terminator &> /dev/null; then
    echo "❌ port-terminator not found. Please install globally:"
    echo "   npm install -g @oxog/port-terminator"
    exit 1
fi

echo

# Example 1: Basic usage
echo "1. Basic Usage Examples"
echo "----------------------"

echo "📍 Checking version:"
port-terminator --version

echo
echo "📍 Showing help:"
port-terminator --help | head -10

echo

# Example 2: Single port termination
echo "2. Single Port Operations"
echo "------------------------"

echo "📍 Dry run on port 3000 (safe preview):"
port-terminator 3000 --dry-run

echo
echo "📍 Kill process on port 3000:"
port-terminator 3000

echo

# Example 3: Multiple ports
echo "3. Multiple Port Operations"
echo "--------------------------"

echo "📍 Kill processes on multiple ports:"
port-terminator 3000 8080 9000

echo
echo "📍 Using port range:"
port-terminator --range 3000-3005

echo

# Example 4: Protocol-specific operations
echo "4. Protocol-Specific Operations"
echo "------------------------------"

echo "📍 Kill only TCP processes on port 3000:"
port-terminator 3000 --method tcp

echo
echo "📍 Kill only UDP processes on port 8080:"
port-terminator 8080 --method udp

echo

# Example 5: Force termination
echo "5. Force Termination"
echo "-------------------"

echo "📍 Force kill without graceful timeout:"
port-terminator 3000 --force

echo
echo "📍 Force kill with custom timeouts:"
port-terminator 3000 --force --timeout 5000 --graceful-timeout 1000

echo

# Example 6: JSON output
echo "6. JSON Output for Scripting"
echo "----------------------------"

echo "📍 JSON output for port 3000:"
port-terminator 3000 --json --dry-run

echo

# Example 7: Silent operation
echo "7. Silent Operations"
echo "-------------------"

echo "📍 Silent termination (no output unless error):"
port-terminator 3000 --silent
echo "Silent operation completed (no output means success)"

echo

# Example 8: Real-world scenarios
echo "8. Real-World Scenarios"
echo "----------------------"

echo "📍 Development environment cleanup:"
echo "Cleaning common dev ports..."
port-terminator 3000 3001 8080 8081 9000 --force --silent
echo "Development ports cleaned ✅"

echo
echo "📍 Docker port cleanup:"
echo "Cleaning Docker-related ports..."
port-terminator 80 443 5000 --dry-run

echo
echo "📍 Microservices port range cleanup:"
echo "Cleaning microservices port range..."
port-terminator --range 8000-8010 --method tcp

echo

# Example 9: Error handling demonstrations
echo "9. Error Handling Examples"
echo "-------------------------"

echo "📍 Invalid port number (should fail):"
port-terminator 70000 2>/dev/null || echo "❌ Correctly failed with invalid port"

echo
echo "📍 Invalid range (should fail):"
port-terminator --range 3000-70000 2>/dev/null || echo "❌ Correctly failed with invalid range"

echo

# Example 10: Using short alias
echo "10. Short Alias (pt) Examples"
echo "-----------------------------"

echo "📍 Using 'pt' alias:"
pt 3000 --dry-run

echo
echo "📍 Quick cleanup with pt:"
pt 3000 8080 --force

echo

# Example 11: Combining with other tools
echo "11. Integration with Other Tools"
echo "-------------------------------"

echo "📍 Pre-development cleanup script:"
cat << 'EOF'
#!/bin/bash
# cleanup-dev.sh - Clean development environment

echo "🧹 Cleaning development environment..."
pt --range 3000-3010 --force --silent
pt 8080 8081 9000 9001 --force --silent
echo "✅ Development ports cleaned"

echo "🚀 Starting development server..."
npm run dev
EOF

echo
echo "📍 CI/CD integration example:"
cat << 'EOF'
# In your CI/CD pipeline
- name: Clean up ports before tests
  run: |
    pt 3000 8080 --force --silent || true
    npm test
EOF

echo
echo "📍 Docker integration:"
cat << 'EOF'
# Before starting Docker containers
echo "Cleaning Docker ports..."
pt 80 443 3000 5432 6379 --force --silent
docker-compose up -d
EOF

echo

# Example 12: Advanced usage patterns
echo "12. Advanced Usage Patterns"
echo "--------------------------"

echo "📍 Find and kill with confirmation:"
cat << 'EOF'
#!/bin/bash
# find-and-kill.sh
PORT=${1:-3000}

echo "Processes on port $PORT:"
pt $PORT --dry-run

read -p "Kill these processes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    pt $PORT --force
    echo "✅ Processes terminated"
else
    echo "❌ Operation cancelled"
fi
EOF

echo
echo "📍 Batch processing with logging:"
cat << 'EOF'
#!/bin/bash
# batch-cleanup.sh
PORTS=(3000 3001 8080 8081 9000)
LOG_FILE="port-cleanup-$(date +%Y%m%d-%H%M%S).log"

echo "🧹 Batch port cleanup started at $(date)" | tee -a $LOG_FILE

for port in "${PORTS[@]}"; do
    echo "Processing port $port..." | tee -a $LOG_FILE
    pt $port --json >> $LOG_FILE 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Port $port: Success" | tee -a $LOG_FILE
    else
        echo "❌ Port $port: Failed" | tee -a $LOG_FILE
    fi
done

echo "📊 Cleanup completed. See $LOG_FILE for details"
EOF

echo

# Example 13: Platform-specific examples
echo "13. Platform-Specific Usage"
echo "--------------------------"

echo "📍 Windows (PowerShell):"
cat << 'EOF'
# Windows PowerShell script
$ports = @(3000, 8080, 9000)
foreach ($port in $ports) {
    Write-Host "Cleaning port $port..."
    pt $port --force --silent
}
Write-Host "✅ All ports cleaned"
EOF

echo
echo "📍 macOS/Linux with system integration:"
cat << 'EOF'
# Add to ~/.bashrc or ~/.zshrc
alias killdev="pt 3000 3001 8080 8081 --force --silent && echo '✅ Dev ports cleaned'"
alias killport="pt"
alias checkport="pt --dry-run"

# Function for smart port cleanup
cleanup_port() {
    local port=${1:-3000}
    echo "🔍 Checking port $port..."
    
    if pt $port --dry-run --silent; then
        echo "👻 No processes on port $port"
    else
        echo "🔄 Cleaning port $port..."
        pt $port --force
    fi
}
EOF

echo

echo "================================"
echo "✅ CLI Examples Demo Completed!"
echo "================================"
echo
echo "💡 Tips:"
echo "   - Use --dry-run to preview before actual termination"
echo "   - Use --json for scripting and automation"
echo "   - Use --silent in scripts to reduce noise"
echo "   - Use --force for stubborn processes"
echo "   - Use 'pt' as a shorter alias"
echo
echo "📚 For more information:"
echo "   - port-terminator --help"
echo "   - Visit: https://github.com/ersinkoc/port-terminator"