import sys
sys.path.insert(0, r'C:\QQQQQQQQQQQQQQQQQ\backend')

from main import app

# Проверяем роуты
routes = [r for r in app.routes if hasattr(r, 'path')]
print(f"Total routes: {len(routes)}")

system_routes = [r for r in routes if 'system' in r.path.lower()]
print(f"System routes: {[r.path for r in system_routes]}")

# Запускаем uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)






