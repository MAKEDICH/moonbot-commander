"""
Utility to fix .env file encoding issues on Windows.

Windows uses cp1252 encoding by default, which cannot handle Russian characters.
This script transliterates Russian comments to ASCII.

Usage:
    python utils/fix_env_encoding.py
"""
from pathlib import Path
import sys


def transliterate_russian(text: str) -> str:
    """Replace Russian characters with ASCII equivalents."""
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
    return ''.join(translit_map.get(c, c) for c in text)


def fix_env_encoding() -> bool:
    """
    Fix .env file encoding by removing non-ASCII characters.
    
    Returns:
        bool: True if file was modified
    """
    env_path = Path(__file__).parent.parent / '.env'
    
    if not env_path.exists():
        print(f"[ERROR] .env file not found: {env_path}")
        return False
    
    # Try reading with UTF-8 first
    try:
        content = env_path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        # Fallback to latin-1 which can read any byte sequence
        try:
            content = env_path.read_text(encoding='latin-1')
        except Exception as e:
            print(f"[ERROR] Cannot read .env file: {e}")
            return False
    
    lines = content.split('\n')
    fixed_lines = []
    fixed_count = 0
    
    for i, line in enumerate(lines, 1):
        original = line
        
        # Check if line has non-ASCII characters
        if any(ord(c) > 127 for c in line):
            # Transliterate Russian characters
            line = transliterate_russian(line)
            
            # Remove any remaining non-ASCII characters
            line = ''.join(c if ord(c) < 128 else '?' for c in line)
            
            if line != original:
                fixed_count += 1
                print(f"  Line {i}: Fixed non-ASCII characters")
        
        fixed_lines.append(line)
    
    if fixed_count > 0:
        # Write back with UTF-8 encoding
        env_path.write_text('\n'.join(fixed_lines), encoding='utf-8')
        print(f"\n[OK] Fixed {fixed_count} lines in {env_path}")
        return True
    else:
        print(f"[OK] No encoding issues found in {env_path}")
        return False


if __name__ == '__main__':
    print("=" * 50)
    print("  Fix .env Encoding for Windows")
    print("=" * 50)
    print()
    
    success = fix_env_encoding()
    
    print()
    sys.exit(0 if success else 1)




