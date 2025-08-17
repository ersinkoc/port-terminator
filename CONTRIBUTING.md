# Contributing to @oxog/port-terminator

Thank you for your interest in contributing to @oxog/port-terminator! This document provides guidelines and information for contributors.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, please include as many details as possible:

**Bug Report Template:**
```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Run command '...'
2. See error '...'

**Expected behavior**
A clear and concise description of what you expected to happen.

**Environment:**
- OS: [e.g. Windows 10, macOS 12.0, Ubuntu 20.04]
- Node.js version: [e.g. 18.0.0]
- Package version: [e.g. 1.0.0]

**Additional context**
Add any other context about the problem here.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Clear description** of the enhancement
- **Use case** explaining why this would be useful
- **Proposed implementation** if you have ideas
- **Alternative solutions** you've considered

### Pull Requests

1. **Fork** the repository
2. **Create** a feature branch from `main`
3. **Make** your changes
4. **Add** tests for your changes
5. **Ensure** all tests pass
6. **Update** documentation if needed
7. **Submit** a pull request

## Development Setup

### Prerequisites

- Node.js 14+ (we recommend using the latest LTS version)
- npm or yarn
- Git

### Setup Steps

1. **Clone your fork:**
   ```bash
   git clone https://github.com/ersinkoc/port-terminator.git
   cd port-terminator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

5. **Run linting:**
   ```bash
   npm run lint
   ```

## Development Guidelines

### Code Style

We use ESLint and Prettier to maintain consistent code style:

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Check formatting
npm run format:check

# Fix formatting
npm run format
```

### TypeScript

- Use strict TypeScript configuration
- Provide explicit types for all public APIs
- Use type guards where appropriate
- Document complex types with JSDoc comments

### Testing

We maintain 100% test coverage. When adding new features:

1. **Write tests first** (TDD approach recommended)
2. **Test all code paths** including error conditions
3. **Mock external dependencies** appropriately
4. **Use descriptive test names** that explain the scenario

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:ci
```

### Commit Guidelines

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(cli): add --json output option
fix(windows): handle process names with spaces
docs(api): update PortTerminator examples
test(linux): add integration tests for lsof fallback
```

### Documentation

- Update the README.md if you change functionality
- Add JSDoc comments for new public APIs
- Update the API documentation in `docs/API.md`
- Include examples for new features

## Platform-Specific Development

### Testing on Different Platforms

We support Windows, macOS, and Linux. When developing:

1. **Test locally** on your platform
2. **Use GitHub Actions** for cross-platform testing
3. **Consider platform differences** in implementation
4. **Mock platform detection** in unit tests

### Platform Implementation Guidelines

Each platform implementation should:

- Follow the `IPlatformImplementation` interface
- Handle platform-specific commands and output parsing
- Provide appropriate error handling
- Include fallback mechanisms where possible

### Windows Development

```typescript
// Use spawn instead of exec for security
const child = spawn('netstat', ['-ano'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
```

### macOS/Linux Development

```typescript
// Prefer lsof, fallback to netstat
try {
  const lsofResult = await executeCommand('lsof', ['-i', `:${port}`]);
  // Process lsof output...
} catch (error) {
  const netstatResult = await executeCommand('netstat', ['-an']);
  // Process netstat output...
}
```

## Project Structure

```
port-terminator/
├── src/                    # Source code
│   ├── cli/               # CLI implementation
│   ├── core/              # Core classes
│   ├── platforms/         # Platform-specific implementations
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   ├── errors/            # Error classes
│   └── index.ts           # Main entry point
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── examples/              # Usage examples
├── docs/                  # Documentation
├── benchmarks/            # Performance benchmarks
└── .github/               # GitHub Actions workflows
```

## Release Process

1. **Update version** in `package.json`
2. **Update** `CHANGELOG.md` with new features/fixes
3. **Create** a git tag: `git tag v1.x.x`
4. **Push** the tag: `git push origin v1.x.x`
5. **GitHub Actions** will automatically publish to npm

## Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Email**: For security issues or private concerns

## Recognition

Contributors will be recognized in:
- The README.md contributors section
- Release notes for significant contributions
- Special recognition for first-time contributors

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to @oxog/port-terminator! 🎉