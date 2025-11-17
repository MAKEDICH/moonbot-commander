# Changelog

## [2.0.5] - 2025-11-17

### Fixed
- 🐛 **Critical: Fixed UDP loopback issue for local bots with external IP** 
  - Bots running on same server as Commander now work correctly
  - Added intelligent fallback routing for localhost responses
  - Fixed balance reporting and command execution for co-located bots
  - IP normalization handles all localhost variants (127.0.0.1, ::1, ::ffff:127.0.0.1)
- 🔧 **Fixed TypeError in TradingStats** - Cannot assign to read only property
  - Replaced spread operator with `.slice()` for proper array copying
  - Fixed frozen array mutations in sortTableData, problemSymbol, mostActiveServer
  - Stats page now works correctly with long-term usage
- ✅ **Fixed Strategy Commander buttons** - All copy/clear buttons now functional
  - Added proper button types and disabled states
  - Fixed CSS pointer events and z-index issues
  - Improved visual feedback for button interactions
- 🔄 **Fixed Dashboard auto-ping** - Now persists across tab switches
  - Auto-ping continues running when switching to other tabs
  - State saved to localStorage for persistence across sessions
  - Added visibilitychange event listener to resume on tab activation
- 🎨 **Fixed 2FA input field styling** - Consistent theme application
  - Applied correct CSS module classes to all 2FA input fields
  - Fixed TwoFactorSetup, TwoFactorSetupRegister, TwoFactorVerify, Recover2FAPassword
  - Removed conflicting inline styles that overrode theme

### Changed
- 🏗️ Enhanced UDP packet routing with smart localhost detection
- 📡 Improved GlobalUDPSocket listener registration with dual-mapping fallback
- 🔄 Better array immutability handling in React components

### Technical Details
- **UDP Loopback Solution**: When bot registers with external IP but runs locally, OS routes responses through 127.0.0.1. Fallback logic now checks for single listener on port when exact IP match fails
- **Frozen Array Fix**: React may freeze arrays from fetch(). Using `Array.slice()` instead of spread operator creates truly independent copy that can be mutated
- **Dashboard Persistence**: Auto-ping state stored in localStorage key `dashboardAutoPingEnabled`
- Both TradingStats.jsx and TradingStatsV2.jsx updated for consistency

---

## [2.0.4] - 2025-11-16

### Fixed
- 🐛 **Improved error handling for GlobalUDPSocket** - Fixed edge case with occupied ports
  - When port 2500 is occupied, properly cleanup failed socket object
  - Prevent "broken" socket objects from being used by other listeners
  - Added comprehensive socket state validation before registration
  - Better error messages for socket initialization failures
- 🔧 Enhanced `send_command_with_response` validation checks
- 🛡️ More robust GlobalUDPSocket lifecycle management

### Technical Details
- If global socket fails to start, object is now properly nullified
- Next server startup will attempt to recreate the socket
- Added triple-check for socket state (object exists, running, sock initialized)
- Prevents cascading WinError 10038 errors from initial WinError 10013

---

## [2.0.3] - 2025-11-16

### Fixed
- 🐛 **Critical: Fixed WinError 10038 in SERVER mode** - Implemented GlobalUDPSocket
  - Multiple servers can now run simultaneously on the same machine
  - One shared UDP socket (port 2500) for all MoonBot servers
  - Automatic packet routing by IP address
  - Eliminates "socket is not a socket" errors
- 🔧 Fixed UDP listener initialization in SERVER mode
- 🚀 Improved performance with single socket architecture

### Changed
- 🏗️ Refactored UDPListener to support both LOCAL and SERVER modes
- 📡 Added GlobalUDPSocket class for centralized UDP management
- 🔄 Updated start_listener/stop_listener functions for dual-mode support

### Technical Details
- LOCAL mode: Each server uses ephemeral ports with keep-alive (for NAT traversal)
- SERVER mode: All servers share one socket on port 2500 (no keep-alive needed)
- Automatic mode detection via MOONBOT_MODE environment variable

---

## [1.1.0] - 2024-11-11

### Added
- ✨ **WebSocket Support** - Real-time updates without polling
- 🔄 **Backup Service** - Automatic database backups
- 📊 **Database Status Checker** - Monitor DB health
- 🏗️ **Migration Manager** - Better migration handling
- 🔧 **Config System** - Centralized configuration
- 🌐 **Multi-Database Support** - Prepare for scaling
- 📡 **WebSocket Manager** - Handle real-time connections
- 🔄 **Auto-Update System** - UPDATE.bat/update.sh for easy updates
- ↩️ **Rollback System** - ROLLBACK.bat/rollback.sh to revert updates

### Changed
- 🔄 Updated main.py with WebSocket endpoints (+301 lines)
- 🐧 Added Linux support (shell scripts)
- 🐳 Added Docker support
- 📚 Updated README with cross-platform instructions
- 🔧 **All batch files now use unified logic:**
  - SERVER-START.bat now auto-detects version (v1.0/v2.0)
  - SERVER-START.bat runs correct main file (main.py or main_v2.py)
  - LOCAL-SETUP.bat uses correct migrations
  - SERVER-SETUP.bat uses correct migrations
  - START.bat (smart start with auto version detection)

### Fixed
- 🐛 Removed non-existent migration `migrate_add_2fa_attempts.py` from all scripts
- 🔧 Fixed batch files to use correct migrations
- 🔧 SERVER-START.bat now properly detects and runs correct version
- 🔧 Fixed security keys validation in all scripts
- 🔧 Unified migration list across all setup scripts

### Migration Notes
- No database schema changes
- No breaking changes in API
- WebSocket is optional (frontend works without it)
- All user data preserved during update

---

## [1.0.0] - 2024-11-08

### Initial Release
- 🎮 Real-time Control - Send commands to Moonbot instances
- 📊 Statistics Dashboard
- 🔐 Secure Authentication (JWT + 2FA)
- 📡 UDP Listeners
- ⏰ Scheduled Commands
- 👥 Group Management
- 📝 SQL Query Interface

