# Changelog

## [2.0.8] - 2025-11-17

### Fixed
- 🔧 **CRITICAL: Fixed UPDATE.bat frontend build detection**
  - Now detects server mode by checking for SERVER-START-PRODUCTION.bat
  - Previously only checked for nssm.exe (not always present)
  - Ensures frontend is ALWAYS rebuilt on servers
  - Fixes Strategy Commander buttons not working after update
  - Fixes all UI issues caused by old frontend with new backend

### Technical Details
- **The Problem**: UPDATE.bat only rebuilt frontend if `nssm.exe` was found, but many servers don't have it
- **The Solution**: Added check for `SERVER-START-PRODUCTION.bat` to detect server installations
- **Impact**: All UI components now update correctly, buttons work, new features visible

---

## [2.0.7] - 2025-11-17

### Fixed
- 🔧 **CRITICAL: Fixed UPDATE.bat migrations not running**
  - Changed from hardcoded list to automatic discovery of all `migrate_*.py` files
  - Migrations now show output (errors are visible)
  - Fixes "no such column" errors when updating from older versions
  - Solves "chicken-and-egg" problem with new migrations

### Technical Details
- **The Problem**: UPDATE.bat had hardcoded list of migrations. New migrations weren't executed when updating from old versions.
- **The Solution**: Use `for %%f in (migrate_*.py)` to automatically run ALL migrations in backend folder
- **Why**: When user updates from v2.0.3 → v2.0.6, the old UPDATE.bat doesn't know about new migrations
- **Impact**: Critical - without this, database schema doesn't update correctly

---

## [2.0.6] - 2025-11-17

### Fixed
- 🔧 **CRITICAL: Fixed .bat files line endings for Windows compatibility**
  - Converted all .bat files from LF (Unix) to CRLF (Windows) line endings
  - UTF-8 without BOM encoding (supports Russian text + cmd.exe compatible)
  - Fixes all "is not recognized as an internal or external command" errors

### Technical Details
- **The Problem**: .bat files had LF line endings instead of CRLF
- **The Solution**: Converted to CRLF (`\r\n`) with UTF-8 no BOM
- **Why**: cmd.exe requires CRLF line endings, `chcp 65001` in files enables UTF-8

---

## [2.0.5] - 2025-11-17

### Fixed
- 🔧 **Critical: Fixed UDP loopback issue for bots on same server**
  - Added IP normalization (`127.0.0.1`, `::1`, `localhost` → `127.0.0.1`)
  - Implemented fallback matching for loopback connections
  - Fixes incorrect online/offline status when bot is on same server as Commander
  - Fixes unreliable command execution and balance reporting
  
- 🐛 **Fixed TypeError in TradingStats component**
  - Replaced spread operator with `Array.slice()` to prevent mutation of frozen arrays
  - Added safety checks for array operations
  - Fixes crash when staying on "Статистика" tab for extended periods
  - Applied same fix to TradingStatsV2 for consistency

- 🎨 **Fixed 2FA input field styling**
  - Applied correct theme styles to 2FA registration/verification inputs
  - Removed conflicting inline styles
  - Consistent appearance across all authentication flows

- ⚙️ **Fixed SERVER-START-PRODUCTION.bat production mode**
  - Removed `--reload` flag from uvicorn command
  - Backend now runs in true production mode
  - Improved stability and performance

- 🔄 **Fixed UPDATE.bat batch file copying**
  - Added `/Y` flag to force overwrite existing .bat files
  - Ensures all scripts are updated correctly
  - Added new migration to update list

### Technical Details

**UDP Loopback Fix:**
- When MoonBot runs on same server as Commander, UDP responses come from `127.0.0.1` but listener expects external IP
- Solution: Normalize localhost variants and implement smart fallback matching
- Maintains backward compatibility with remote bots

**TradingStats Fix:**
- `fetch()` returns frozen objects that can't be mutated
- Spread operator `[...arr]` creates shallow copy that still shares frozen internals
- `Array.slice()` creates true deep copy that can be safely sorted
- Error: `TypeError: Cannot assign to read only property '0' of object '[object Array]'`

**Production Mode:**
- `--reload` flag causes uvicorn to watch for file changes (dev feature)
- In production this wastes resources and can cause instability
- Removed for better performance

---

## [2.0.4] - 2025-11-16

### Added
- ✨ **New Feature: Auto-ping persistence across tab switches**
  - Auto-ping continues running when switching tabs
  - State persists across browser sessions via localStorage
  - Automatically restarts when tab becomes visible again
  
### Fixed
- 🐛 **Fixed Strategy Commander button interactions**
  - All buttons now properly clickable and responsive
  - Added proper `type="button"` attributes
  - Fixed z-index and pointer-events for button icons
  - Improved visual feedback (cursor: pointer)

### Technical Details
- Implemented `visibilitychange` event listener for tab state management
- Browser throttles `setInterval` on inactive tabs (to 1 call per second or less)
- Solution: detect tab activation and restart auto-ping if it was enabled

---

## [2.0.3] - 2025-11-15

### Added
- 📊 Enhanced trading statistics with server-side aggregation
- 🔄 Real-time balance updates via WebSocket
- 📈 Improved performance for large datasets

### Fixed
- 🐛 Various UI improvements and bug fixes
- ⚡ Optimized database queries for better performance

---

## [2.0.2] - 2025-11-14

### Added
- 🎯 Advanced filtering in trading history
- 📉 New chart visualizations
- 🔐 Enhanced security for API endpoints

### Fixed
- 🐛 Fixed WebSocket connection stability
- 🔧 Improved error handling in UDP communication

---

## [2.0.1] - 2025-11-13

### Fixed
- 🐛 Critical hotfixes for v2.0.0 release
- 🔧 Database migration improvements
- ⚡ Performance optimizations

---

## [2.0.0] - 2025-11-12

### Added
- 🚀 **Major Version Release**
- 🎨 Completely redesigned UI
- 📊 New analytics dashboard
- 🔄 WebSocket-based real-time updates
- 🗄️ Improved database schema (v2)
- 🔐 Enhanced security features
- 📱 Mobile-responsive design

### Changed
- ♻️ Refactored backend architecture
- 🔄 Migrated to FastAPI lifespan events
- 📦 Updated all dependencies
- 🎯 Improved error handling and logging

### Fixed
- 🐛 Numerous bug fixes from v1.x
- ⚡ Performance improvements across the board
- 🔧 Better error recovery mechanisms

---

## [1.0.0] - 2025-11-01

### Added
- 🎉 Initial stable release
- 📊 Basic trading statistics
- 🤖 MoonBot UDP command interface
- 💼 Balance tracking
- 📈 Strategy management
- 🔐 User authentication
- 🌐 Multi-server support

---

*For detailed technical information, see the README.md file.*
