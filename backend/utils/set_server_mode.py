"""
Utility to set MOONBOT_MODE in .env file and fix encoding issues.

Usage:
    python utils/set_server_mode.py          # Set server mode
    python utils/set_server_mode.py local    # Set local mode
"""
from pathlib import Path
import sys


def transliterate_russian(text: str) -> str:
    """
    Replace Russian characters with ASCII equivalents.
    This fixes Windows cp1252 encoding issues.
    """
    translit_map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
        'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    }
    result = []
    for char in text:
        result.append(translit_map.get(char, char))
    return ''.join(result)


def fix_env_encoding(env_path: Path) -> bool:
    """
    Fix .env file encoding by removing non-ASCII characters from comments.
    This prevents UnicodeDecodeError on Windows.
    """
    try:
        content = env_path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        # Try reading with latin-1 as fallback
        content = env_path.read_text(encoding='latin-1')
    
    lines = content.split('\n')
    fixed_lines = []
    fixed = False
    
    for line in lines:
        # Only fix comments (lines starting with #)
        if line.strip().startswith('#'):
            # Check if line has non-ASCII characters
            if any(ord(c) > 127 for c in line):
                new_line = transliterate_russian(line)
                if new_line != line:
                    fixed = True
                    line = new_line
        fixed_lines.append(line)
    
    if fixed:
        env_path.write_text('\n'.join(fixed_lines), encoding='utf-8')
        print("[FIX] Removed non-ASCII characters from .env comments")
    
    return fixed


def set_moonbot_mode(mode: str = 'server') -> bool:
    """
    Set MOONBOT_MODE in .env file.
    
    Args:
        mode: 'server' or 'local'
    
    Returns:
        bool: True if successful
    """
    env_path = Path(__file__).parent.parent / '.env'
    target_line = f'MOONBOT_MODE={mode}'
    
    if not env_path.exists():
        print(f"[ERROR] .env file not found: {env_path}")
        return False
    
    # Fix encoding issues first
    fix_env_encoding(env_path)
    
    content = env_path.read_text(encoding='utf-8')
    lines = content.split('\n')
    found = False
    updated = False
    new_lines = []
    
    for line in lines:
        stripped = line.strip()
        
        # Find any line with MOONBOT_MODE (commented or not)
        if 'MOONBOT_MODE' in stripped:
            found = True
            if stripped != target_line:
                print(f"[UPDATE] {stripped} -> {target_line}")
                new_lines.append(target_line)
                updated = True
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
    
    # Add MOONBOT_MODE if not found
    if not found:
        new_lines.append('')
        new_lines.append('# Mode: server (production) or local (development)')
        new_lines.append(target_line)
        updated = True
        print(f"[ADD] {target_line}")
    
    if updated:
        env_path.write_text('\n'.join(new_lines), encoding='utf-8')
        print(f"[OK] {env_path}")
    else:
        print(f"[OK] {target_line} already set")
    
    return True


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'server'
    if mode not in ('server', 'local'):
        print(f"[ERROR] Unknown mode: {mode}")
        print("Use: server or local")
        sys.exit(1)
    
    print(f"Setting MOONBOT_MODE={mode}")
    set_moonbot_mode(mode)

