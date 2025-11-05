# Claude Code Configuration

This directory contains configuration for Claude Code, including Model Context Protocol (MCP) server setups.

## MCP Servers

### Playwright MCP Server

The Playwright MCP server enables browser automation and end-to-end testing capabilities within Claude Code.

**Features:**
- Browser automation (Chromium, Firefox, WebKit)
- End-to-end testing
- Screenshot capture
- Web scraping
- Form automation
- Network interception

**Configuration:**
The server is configured in `mcp_config.json` and will automatically start when Claude Code is launched.

**Usage:**
When working with Claude Code, you can request:
- "Test the scoring terminal UI"
- "Take a screenshot of the tournament display"
- "Automate player registration flow"
- "Test the mobile app PWA"

## Setup

The MCP configuration is automatically loaded by Claude Code. To manually verify:

```bash
# Check the configuration
cat .claude/mcp_config.json

# Test Playwright installation
npx -y @modelcontextprotocol/server-playwright --version
```

## Testing with Playwright

For this dart tournament project, Playwright can be used to:

1. **UI Testing**: Test scoring terminal touch interactions
2. **Integration Testing**: Verify WebSocket real-time updates
3. **PWA Testing**: Test mobile app installation and offline capabilities
4. **Display Testing**: Verify bracket and leaderboard displays
5. **Cross-browser Testing**: Test on Chromium, Firefox, and WebKit

## Additional MCP Servers

You can add more MCP servers to `mcp_config.json` as needed. Common options:
- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-github` - GitHub integration
- `@modelcontextprotocol/server-postgres` - Database operations
