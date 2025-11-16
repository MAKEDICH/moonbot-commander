import sqlite3
import sys

# Подключаемся к БД
conn = sqlite3.connect('moonbot_commander.db')
cursor = conn.cursor()

# Серверы
print("=" * 80)
print("СЕРВЕРЫ В БД:")
print("=" * 80)
cursor.execute('SELECT id, name, host, port, is_active FROM servers')
servers = cursor.fetchall()
if not servers:
    print("  (пусто)")
else:
    for row in servers:
        print(f"  ID={row[0]:3d} | Name={row[1]:20s} | Host={row[2]:15s} | Port={row[3]:5d} | Active={row[4]}")

# Listener Status
print("\n" + "=" * 80)
print("СТАТУС UDP LISTENERS:")
print("=" * 80)
cursor.execute('SELECT server_id, is_running, messages_received, last_error FROM udp_listener_status')
listeners = cursor.fetchall()
if not listeners:
    print("  (пусто - listeners не запускались)")
else:
    for row in listeners:
        error = row[3] if row[3] else "None"
        print(f"  ServerID={row[0]:3d} | Running={row[1]} | Messages={row[2]:5d} | Error={error[:50]}")

# Ордера по серверам
print("\n" + "=" * 80)
print("ОРДЕРА ПО СЕРВЕРАМ (количество):")
print("=" * 80)
cursor.execute('SELECT server_id, COUNT(*) as cnt FROM moonbot_orders GROUP BY server_id')
orders = cursor.fetchall()
if not orders:
    print("  (пусто - нет ордеров)")
else:
    for row in orders:
        print(f"  ServerID={row[0]:3d} | Orders={row[1]:5d}")

conn.close()

print("\n" + "=" * 80)
print("ДИАГНОСТИКА ЗАВЕРШЕНА")
print("=" * 80)





