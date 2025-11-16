# Changelog

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

