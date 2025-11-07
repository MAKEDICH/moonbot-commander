"""
Test script for HMAC-SHA256 UDP commands
"""
import asyncio
import sys
sys.path.insert(0, '.')

from udp_client import UDPClient

async def test_hmac():
    client = UDPClient(timeout=5)
    
    # Тестовые данные
    command = "list"
    password = "mypassword123"
    
    print("=" * 60)
    print("  HMAC-SHA256 UDP Command Test")
    print("=" * 60)
    print()
    
    # Генерируем HMAC
    hmac_hash = client.generate_hmac(command, password)
    
    print(f"Command:  {command}")
    print(f"Password: {password}")
    print(f"HMAC-SHA256: {hmac_hash}")
    print()
    print(f"Final message format: {hmac_hash} {command}")
    print()
    
    # Без пароля
    print("Testing WITHOUT password:")
    print(f"  Message: {command}")
    print()
    
    # С паролем
    print("Testing WITH password:")
    print(f"  Message: {hmac_hash} {command}")
    print()
    
    print("=" * 60)
    print()
    print("To test with real MoonBot:")
    print("1. Set UDP password in MoonBot: Settings -> Special -> Remote")
    print("2. Use the same password in server settings")
    print("3. Send command through the web interface")
    print()

if __name__ == "__main__":
    asyncio.run(test_hmac())




