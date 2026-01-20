"""
Chart Storage - Хранилище графиков на диске.

Сохраняет графики в структурированном виде:
data/charts/{год}/{месяц}/{день}/{source_id}/order_{id}_{timestamp}.{ext}

Поддерживает:
- Сохранение в JSON и бинарном формате
- Автоочистка старых графиков
- Статистика хранилища

Основано на решении от второго разработчика.
"""

import json
import shutil
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# =============================================================================
# КОНСТАНТЫ
# =============================================================================

DEFAULT_CHARTS_DIR = Path("data/charts")
DATE_FORMAT = "%Y%m%d_%H%M%S"


# =============================================================================
# ХРАНИЛИЩЕ
# =============================================================================

class ChartStorage:
    """Менеджер хранилища графиков на диске."""

    def __init__(self, base_dir: Optional[Path] = None) -> None:
        """
        Инициализация хранилища.
        
        Args:
            base_dir: Базовая директория для хранения графиков
        """
        self.base_dir = base_dir or DEFAULT_CHARTS_DIR
        self.base_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"[CHART-STORAGE] Инициализировано: {self.base_dir.absolute()}")

    def save_json(
        self,
        source_id: str,
        order_id: int,
        chart_data: Dict[str, Any],
        timestamp: Optional[datetime] = None
    ) -> Optional[Path]:
        """
        Сохранить график в JSON формате.
        
        Args:
            source_id: Идентификатор источника (сервер, терминал)
            order_id: ID ордера
            chart_data: Данные графика
            timestamp: Время (по умолчанию - текущее)
            
        Returns:
            Path к сохранённому файлу или None при ошибке
        """
        ts = timestamp or datetime.now()
        filepath = self._get_filepath(source_id, order_id, ts, "json")

        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(chart_data, f, indent=2, ensure_ascii=False, default=str)

            logger.info(f"[CHART-STORAGE] Сохранён: {filepath.name}")
            return filepath
        except Exception as e:
            logger.error(f"[CHART-STORAGE] Ошибка сохранения JSON: {e}")
            return None

    def save_binary(
        self,
        source_id: str,
        order_id: int,
        binary_data: bytes,
        timestamp: Optional[datetime] = None
    ) -> Optional[Path]:
        """
        Сохранить бинарные данные графика.
        
        Args:
            source_id: Идентификатор источника
            order_id: ID ордера
            binary_data: Бинарные данные
            timestamp: Время (по умолчанию - текущее)
            
        Returns:
            Path к сохранённому файлу или None при ошибке
        """
        ts = timestamp or datetime.now()
        filepath = self._get_filepath(source_id, order_id, ts, "bin")

        try:
            with open(filepath, 'wb') as f:
                f.write(binary_data)

            logger.info(f"[CHART-STORAGE] Сохранён бинарный: {filepath.name} ({len(binary_data)} bytes)")
            return filepath
        except Exception as e:
            logger.error(f"[CHART-STORAGE] Ошибка сохранения бинарного: {e}")
            return None

    def save_both(
        self,
        source_id: str,
        order_id: int,
        chart_data: Dict[str, Any],
        binary_data: Optional[bytes] = None,
        timestamp: Optional[datetime] = None
    ) -> Tuple[Optional[Path], Optional[Path]]:
        """
        Сохранить график в обоих форматах.
        
        Args:
            source_id: Идентификатор источника
            order_id: ID ордера
            chart_data: Данные графика
            binary_data: Бинарные данные (опционально)
            timestamp: Время
            
        Returns:
            Tuple из путей (json_path, bin_path)
        """
        ts = timestamp or datetime.now()

        json_path = self.save_json(source_id, order_id, chart_data, ts)
        bin_path = self.save_binary(source_id, order_id, binary_data, ts) if binary_data else None

        return json_path, bin_path

    def get_stats(self) -> Dict[str, Any]:
        """
        Получить статистику хранилища.
        
        Returns:
            Словарь со статистикой
        """
        if not self.base_dir.exists():
            return {'total_charts': 0, 'total_size_bytes': 0, 'sources': []}

        total_charts = 0
        total_size = 0
        sources = set()

        for file in self.base_dir.rglob('*.json'):
            total_charts += 1
            total_size += file.stat().st_size
            # Извлекаем source_id из пути
            if len(file.parts) >= 2:
                sources.add(file.parts[-2])

        for file in self.base_dir.rglob('*.bin'):
            total_size += file.stat().st_size

        return {
            'total_charts': total_charts,
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'sources_count': len(sources),
            'sources': sorted(sources),
        }

    def cleanup_old(self, days_to_keep: int = 30) -> int:
        """
        Удалить старые графики (старше N дней).
        
        Удаляет целые папки дней для эффективности.
        
        Args:
            days_to_keep: Количество дней для хранения
            
        Returns:
            Количество удалённых файлов
        """
        if not self.base_dir.exists():
            return 0

        cutoff_date = datetime.now() - timedelta(days=days_to_keep)
        deleted_count = 0

        # Обходим по годам/месяцам/дням
        for year_dir in self.base_dir.iterdir():
            if not year_dir.is_dir() or not year_dir.name.isdigit():
                continue

            for month_dir in year_dir.iterdir():
                if not month_dir.is_dir() or not month_dir.name.isdigit():
                    continue

                for day_dir in month_dir.iterdir():
                    if not day_dir.is_dir() or not day_dir.name.isdigit():
                        continue

                    try:
                        folder_date = datetime(
                            int(year_dir.name),
                            int(month_dir.name),
                            int(day_dir.name)
                        )

                        if folder_date < cutoff_date:
                            # Считаем файлы перед удалением
                            files_count = sum(1 for _ in day_dir.rglob('*') if _.is_file())
                            shutil.rmtree(day_dir)
                            deleted_count += files_count
                            logger.info(f"[CHART-STORAGE] Удалена папка: {day_dir} ({files_count} файлов)")

                    except (ValueError, OSError) as e:
                        logger.warning(f"[CHART-STORAGE] Пропуск папки {day_dir}: {e}")

        if deleted_count > 0:
            logger.info(f"[CHART-STORAGE] Очистка завершена: {deleted_count} файлов удалено")

        return deleted_count

    def list_charts(
        self,
        source_id: Optional[str] = None,
        days: int = 7,
        limit: int = 100
    ) -> list:
        """
        Получить список графиков.
        
        Args:
            source_id: Фильтр по источнику
            days: За сколько дней
            limit: Максимальное количество
            
        Returns:
            Список информации о графиках
        """
        if not self.base_dir.exists():
            return []

        cutoff_date = datetime.now() - timedelta(days=days)
        charts = []

        pattern = f"**/{source_id}/*.json" if source_id else "**/*.json"
        
        for file in sorted(self.base_dir.glob(pattern), key=lambda f: f.stat().st_mtime, reverse=True):
            if len(charts) >= limit:
                break
                
            try:
                mtime = datetime.fromtimestamp(file.stat().st_mtime)
                if mtime < cutoff_date:
                    continue
                    
                charts.append({
                    'path': str(file),
                    'filename': file.name,
                    'source_id': file.parent.name,
                    'size_bytes': file.stat().st_size,
                    'modified': mtime.isoformat(),
                })
            except Exception:
                continue

        return charts

    def load_chart(self, filepath: str) -> Optional[Dict[str, Any]]:
        """
        Загрузить график из файла.
        
        Args:
            filepath: Путь к файлу
            
        Returns:
            Данные графика или None
        """
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"[CHART-STORAGE] Ошибка загрузки {filepath}: {e}")
            return None

    def _get_filepath(
        self,
        source_id: str,
        order_id: int,
        timestamp: datetime,
        ext: str
    ) -> Path:
        """
        Построить путь к файлу.
        
        Args:
            source_id: Идентификатор источника
            order_id: ID ордера
            timestamp: Время
            ext: Расширение файла
            
        Returns:
            Path к файлу
        """
        chart_dir = (
            self.base_dir
            / f"{timestamp.year}"
            / f"{timestamp.month:02d}"
            / f"{timestamp.day:02d}"
            / source_id
        )
        chart_dir.mkdir(parents=True, exist_ok=True)

        filename = f"order_{order_id}_{timestamp.strftime(DATE_FORMAT)}.{ext}"
        return chart_dir / filename


# =============================================================================
# ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР
# =============================================================================

_default_storage: Optional[ChartStorage] = None


def get_storage() -> ChartStorage:
    """Получить глобальный экземпляр хранилища."""
    global _default_storage
    if _default_storage is None:
        _default_storage = ChartStorage()
    return _default_storage


def save_chart(
    source_id: str,
    order_id: int,
    chart_data: Dict[str, Any],
    binary_data: Optional[bytes] = None
) -> Tuple[Optional[Path], Optional[Path]]:
    """
    Сохранить график используя глобальное хранилище.
    
    Args:
        source_id: Идентификатор источника
        order_id: ID ордера
        chart_data: Данные графика
        binary_data: Бинарные данные (опционально)
        
    Returns:
        Tuple из путей (json_path, bin_path)
    """
    return get_storage().save_both(source_id, order_id, chart_data, binary_data)



