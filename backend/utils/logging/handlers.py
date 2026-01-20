"""
📁 Custom Log Handlers with Daily Rotation (Thread-Safe)
"""

import logging
import threading
from logging.handlers import RotatingFileHandler
from datetime import datetime
from pathlib import Path
from typing import Optional


DEFAULT_LOG_DIR = Path(__file__).resolve().parent.parent.parent.parent / "logs"
DEFAULT_LOG_DIR.mkdir(parents=True, exist_ok=True)


class DailySizedRotatingFileHandler(RotatingFileHandler):
    """
    Потокобезопасный rotating handler:
    - Создает отдельный лог на каждый день: YYYY-MM-DD_<name>_1.log
    - При достижении maxBytes добавляет суффикс _2, _3, ...
    - Поддерживает автоматическую очистку по общему размеру
    """

    def __init__(
        self,
        log_dir: Path,
        log_name: str,
        maxBytes: int = 50 * 1024 * 1024,
        backupCount: int = 20,
        encoding: Optional[str] = "utf-8",
        delay: bool = False,
        max_total_bytes: int = 1024 * 1024 * 1024,  # 1GB
        cleanup_bytes: int = 100 * 1024 * 1024      # 100MB
    ):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_name = log_name
        self.current_date = datetime.now().strftime("%Y-%m-%d")
        self.max_total_bytes = max_total_bytes
        self.cleanup_bytes = cleanup_bytes
        self._lock = threading.RLock()  # Потокобезопасность
        filename = self._build_filename(1, self.current_date)
        super().__init__(
            filename,
            mode='a',
            maxBytes=maxBytes,
            backupCount=backupCount,
            encoding=encoding,
            delay=delay
        )

    def _build_filename(self, index: int, date_str: Optional[str] = None) -> str:
        date_str = date_str or self.current_date
        return str(self.log_dir / f"{date_str}_{self.log_name}_{index}.log")

    def emit(self, record):
        """Потокобезопасная запись с проверкой смены даты"""
        with self._lock:
            try:
                date_str = datetime.now().strftime("%Y-%m-%d")
                if date_str != self.current_date:
                    self._switch_date(date_str)
                super().emit(record)
            except (ValueError, OSError):
                # Игнорируем ошибки записи в закрытый файл
                pass
            except Exception:
                # Любые другие ошибки тоже игнорируем
                pass

    def _switch_date(self, new_date: str):
        """Начинаем новый файл при смене даты"""
        try:
            if self.stream:
                self.stream.close()
                self.stream = None
        except Exception:
            pass
        self.current_date = new_date
        self.baseFilename = self._build_filename(1, self.current_date)
        self.mode = 'a'
        try:
            self.stream = self._open()
        except Exception:
            pass

    def doRollover(self):
        """Перекладываем файлы по схеме _1 -> _2 -> ..."""
        with self._lock:
            try:
                if self.stream:
                    self.stream.close()
                    self.stream = None
            except Exception:
                pass

            if self.backupCount > 0:
                for i in range(self.backupCount, 0, -1):
                    source = Path(self._build_filename(i))
                    target = Path(self._build_filename(i + 1))
                    if source.exists():
                        if i == self.backupCount:
                            try:
                                source.unlink()
                            except Exception:
                                pass
                        else:
                            try:
                                source.rename(target)
                            except Exception:
                                pass

            self.baseFilename = self._build_filename(1)
            try:
                self.stream = self._open()
            except Exception:
                pass
            self._check_and_cleanup_total_size()

    def _check_and_cleanup_total_size(self):
        """Контроль общего размера всех логов"""
        try:
            log_files = []
            total_size = 0

            for log_file in self.log_dir.glob("*.log"):
                if log_file.is_file():
                    try:
                        size = log_file.stat().st_size
                        total_size += size
                        log_files.append((log_file, log_file.stat().st_mtime, size))
                    except Exception:
                        pass

            if total_size > self.max_total_bytes:
                log_files.sort(key=lambda x: x[1])
                bytes_to_free = self.cleanup_bytes
                freed_bytes = 0

                for filepath, mtime, size in log_files:
                    if filepath.name == Path(self._build_filename(1)).name:
                        continue

                    try:
                        filepath.unlink()
                        freed_bytes += size
                        if freed_bytes >= bytes_to_free:
                            break
                    except Exception:
                        pass
        except Exception:
            pass


class DailyLogStreamWriter:
    """Пишет произвольный поток в файлы формата YYYY-MM-DD_name_index.log"""

    def __init__(self, log_name: str, log_dir: Optional[Path] = None,
                 max_bytes: int = 50 * 1024 * 1024):
        self.log_name = log_name
        self.log_dir = Path(log_dir) if log_dir else DEFAULT_LOG_DIR
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.max_bytes = max_bytes
        self.current_date: Optional[str] = None
        self.current_index = 1
        self.current_path: Optional[Path] = None
        self.stream = None
        self._lock = threading.RLock()

    def _build_path(self, index: int) -> Path:
        return self.log_dir / f"{self.current_date}_{self.log_name}_{index}.log"

    def _open_stream(self):
        try:
            if self.stream:
                self.stream.close()
        except Exception:
            pass
        self.current_path = self._build_path(self.current_index)
        self.current_path.parent.mkdir(parents=True, exist_ok=True)
        self.stream = open(self.current_path, 'a', encoding='utf-8', buffering=1)

    def _ensure_stream(self):
        date_now = datetime.now().strftime("%Y-%m-%d")
        if self.current_date != date_now:
            self.current_date = date_now
            self.current_index = 1
            self._open_stream()
        elif self.stream is None:
            self._open_stream()

    def write(self, data: str):
        if not data:
            return
        with self._lock:
            try:
                self._ensure_stream()
                if not self.stream:
                    return
                self.stream.write(data)
                self.stream.flush()
                if self.current_path and self.current_path.stat().st_size >= self.max_bytes:
                    self.current_index += 1
                    self._open_stream()
            except Exception:
                pass

    def close(self):
        with self._lock:
            try:
                if self.stream:
                    self.stream.close()
                    self.stream = None
            except Exception:
                pass
