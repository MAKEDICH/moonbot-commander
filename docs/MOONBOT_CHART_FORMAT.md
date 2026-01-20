# MoonBot Chart Binary Format Specification

Документация по бинарному формату данных графиков MoonBot.

## Обзор

Бинарный формат состоит из двух частей:
1. **TMoonCmdHeader** - 8-байтный заголовок пакета (для UDP передачи)
2. **TMarket.SaveToStreamShort** - Данные графика переменной длины (формат Delphi)

## TMoonCmdHeader (8 байт)

| Смещение | Размер | Тип | Поле | Описание |
|----------|--------|-----|------|----------|
| 0 | 1 | uint8 | flag | Должен быть 0 для пакетов графиков |
| 1 | 1 | uint8 | kind | Должен быть 1 для пакетов графиков |
| 2 | 4 | int32 | order_id | Идентификатор ордера |
| 6 | 1 | uint8 | block_num | Номер фрагмента (начиная с 0) |
| 7 | 1 | uint8 | blocks_count | Общее количество фрагментов |

### Фрагментация

Когда `blocks_count > 1`, данные графика разбиты на несколько UDP пакетов:
- Каждый пакет имеет одинаковый `order_id`
- `block_num` идёт от 0 до `blocks_count - 1`
- Фрагменты должны быть собраны по порядку перед парсингом

### Определение типа пакета

Пакет является графиком если:
```
flag == 0 AND kind == 1 AND NOT starts with GZIP magic (0x1F 0x8B)
```

## TMarket.SaveToStreamShort (Тело графика)

Тело графика начинается со смещения 8 (после заголовка). Может быть сжато GZIP.

### Типы данных

| Тип | Размер | Описание |
|-----|--------|----------|
| Byte | 1 | Беззнаковое 8-битное целое |
| Word | 2 | Беззнаковое 16-битное целое (little-endian) |
| Integer | 4 | Знаковое 32-битное целое (little-endian) |
| Double | 8 | 64-битное IEEE 754 с плавающей точкой (little-endian) |
| TDateTime | 8 | Delphi TDateTime (Double, дни с 1899-12-30) |
| UTF8String | 2+N | Word-префикс длины + UTF-8 байты |
| ShortString | 1+N | Byte-префикс длины + Windows-1251 байты |
| String[40] | 41 | Строка фиксированного размера (1 байт длины + 40 байт данных) |

### Структура графика

```
Chart {
    // Заголовок
    Word        version;          // Версия формата (сейчас 30)
    UTF8String  market_name;      // напр., "USDT-BTC"
    UTF8String  market_currency;  // напр., "BTC"
    UTF8String  pump_channel;     // Название канала
    UTF8String  bn_market_name;   // Название на бирже
    TDateTime   start_time;       // Начало графика
    TDateTime   end_time;         // Конец графика

    // Исторические цены (Price, Time пары)
    Integer     prices_count;
    PriceTime   historical_prices[prices_count];

    // Ордера
    Integer     orders_count;
    Order       orders[orders_count];

    // Сделки (Time, Price пары - обратите внимание на другой порядок!)
    Integer     trades_count;
    TimePrice   trades[trades_count];

    // Блок статистики
    Stats       stats;

    // Ближайшие (средние) цены
    Integer     closest_count;
    PriceTime   closest_prices[closest_count];

    // Бары (OHLCV-подобные)
    Integer     bars_count;
    Bar         bars[bars_count];
}
```

### Подструктуры

#### PriceTime (16 байт)
```
PriceTime {
    Double    price;    // 8 байт
    TDateTime time;     // 8 байт
}
```

#### TimePrice (16 байт)
```
TimePrice {
    TDateTime time;     // 8 байт
    Double    price;    // 8 байт (отрицательное = SELL)
}
```

#### Order (89 байт)
```
Order {
    String[40] order_id;     // 41 байт (фиксированный размер)
    Double     mean_price;   // 8 байт
    TDateTime  create_time;  // 8 байт
    TDateTime  open_time;    // 8 байт
    TDateTime  close_time;   // 8 байт
}
```

#### Stats (105 байт)
```
Stats {
    Double  last_1m_delta;    // 8 байт
    Double  last_5m_delta;    // 8 байт
    Double  last_1h_delta;    // 8 байт
    Double  last_3h_delta;    // 8 байт
    Double  last_24h_delta;   // 8 байт
    Double  pump_delta_1h;    // 8 байт
    Double  dump_delta_1h;    // 8 байт
    Double  hvol;             // 8 байт
    Double  hvol_fast;        // 8 байт
    Double  test_price_down;  // 8 байт
    Double  test_price_up;    // 8 байт
    Byte    is_moonshot;      // 1 байт (0 или 1)
    Double  session_profit;   // 8 байт
}
```

#### Bar (48 байт)
```
Bar {
    TDateTime time;         // 8 байт
    Integer   count;        // 4 байта
    Double    min_price;    // 8 байт
    Double    max_price;    // 8 байт
    Double    buy_volume;   // 8 байт
    Double    sell_volume;  // 8 байт
}
```

## Конвертация TDateTime

Delphi TDateTime - это Double, представляющий дни с 30 декабря 1899:

```python
from datetime import datetime, timedelta

DELPHI_EPOCH = datetime(1899, 12, 30)

def delphi_to_python(delphi_time: float) -> datetime:
    return DELPHI_EPOCH + timedelta(days=delphi_time)

def python_to_delphi(dt: datetime) -> float:
    delta = dt - DELPHI_EPOCH
    return delta.total_seconds() / 86400.0
```

## GZIP сжатие

Данные графика могут быть сжаты GZIP. Определение:
```python
is_gzip = data[0] == 0x1F and data[1] == 0x8B
```

Если сжато, распаковать перед парсингом:
```python
import gzip
decompressed = gzip.decompress(data)
```

## Порядок байтов

Все многобайтовые целые числа в формате **little-endian** (стандарт для x86/Delphi).

## Примечания

1. `order_id` в TMoonCmdHeader идентифицирует график для сборки фрагментов
2. Цены сделок: положительные = BUY, отрицательные = SELL (абсолютное значение - фактическая цена)
3. Пустые строки имеют длину 0 (только префикс длины, без байтов данных)
4. Массивы с количеством 0 имеют только поле количества (4 байта нулей)



