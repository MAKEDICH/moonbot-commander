"""
🧰 Process Logging Helpers
"""

import sys
import logging
import subprocess
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional, Sequence

from .handlers import DailyLogStreamWriter


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_LOG_DIR = PROJECT_ROOT / "logs"
DEFAULT_LOG_DIR.mkdir(parents=True, exist_ok=True)


def check_and_manage_all_logs(log_dir: Optional[str] = None,
                              max_total_bytes: int = 1024*1024*1024,  # 1GB
                              cleanup_bytes: int = 100*1024*1024):    # 100MB
    """
    Check total size of ALL log files in directory and cleanup if needed.
    This includes logs not managed by RotatingFileHandler.
    """
    log_path = Path(log_dir) if log_dir else DEFAULT_LOG_DIR
    if not log_path.exists():
        return

    # Find all log files
    log_files = []
    total_size = 0

    for log_file in log_path.glob("*.log*"):
        if log_file.is_file():
            size = log_file.stat().st_size
            total_size += size
            log_files.append(
                (log_file, log_file.stat().st_mtime, size))

    # If total size exceeds limit, remove oldest files
    if total_size > max_total_bytes:
        logging.warning(
            f"Total log size ({total_size/1024/1024:.1f}MB) exceeds limit ({max_total_bytes/1024/1024:.1f}MB)")

        # Sort by modification time (oldest first)
        log_files.sort(key=lambda x: x[1])

        bytes_to_free = cleanup_bytes
        freed_bytes = 0

        current_day_prefix = datetime.now().strftime("%Y-%m-%d_")

        for filepath, mtime, size in log_files:
            # Skip recently modified files (less than 1 hour old)
            if datetime.now().timestamp() - mtime < 3600:
                continue

            # Skip активные файлы текущего дня с индексом _1
            if filepath.name.startswith(current_day_prefix) and filepath.name.endswith("_1.log"):
                continue

            try:
                filepath.unlink()
                freed_bytes += size
                logging.info(
                    f"Auto-removed old log: {filepath.name} (freed {size/1024/1024:.1f}MB)")

                if freed_bytes >= bytes_to_free:
                    break
            except Exception as e:
                logging.warning(f"Failed to remove log file {filepath}: {e}")

        if freed_bytes > 0:
            logging.info(
                f"Auto-cleanup complete: freed {freed_bytes/1024/1024:.1f}MB")
            new_total = total_size - freed_bytes
            logging.info(f"New total log size: {new_total/1024/1024:.1f}MB")


def run_command_with_logging(
    log_name: str,
    command: Sequence[str],
    log_dir: Optional[str] = None,
    max_bytes: int = 50 * 1024 * 1024,
    pid_file: Optional[str] = None,
    print_child_pid: bool = False
) -> int:
    """
    Запускает команду и пишет stdout/stderr в управляемый суточный лог.
    """
    if not command:
        raise ValueError("command must not be empty")

    log_path = Path(log_dir) if log_dir else DEFAULT_LOG_DIR
    writer = DailyLogStreamWriter(log_name=log_name, log_dir=log_path, max_bytes=max_bytes)

    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True
    )

    if pid_file:
        pid_path = Path(pid_file)
        pid_path.parent.mkdir(parents=True, exist_ok=True)
        pid_path.write_text(str(process.pid))

    if print_child_pid:
        print(process.pid, flush=True)

    try:
        if process.stdout:
            for line in process.stdout:
                writer.write(line)
    finally:
        writer.close()
        if process.stdout:
            process.stdout.close()

    return process.wait()


def _build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Pipe stdout/stderr of any command into daily rotated log files"
    )
    parser.add_argument(
        "--log-name",
        required=True,
        help="Имя лог-файла (без даты и индекса), например backend"
    )
    parser.add_argument(
        "--log-dir",
        default=None,
        help="Директория для логов (по умолчанию ./logs)"
    )
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=50 * 1024 * 1024,
        help="Максимальный размер одного файла перед переключением"
    )
    parser.add_argument(
        "--pid-file",
        help="Путь до файла, куда записать PID дочернего процесса"
    )
    parser.add_argument(
        "--print-child-pid",
        action="store_true",
        help="Вывести PID дочернего процесса в stdout"
    )
    parser.add_argument(
        "command",
        nargs=argparse.REMAINDER,
        help="Команда для запуска (обязательно отделить параметром --)"
    )
    return parser


if __name__ == "__main__":
    cli_parser = _build_cli_parser()
    args = cli_parser.parse_args()
    command = args.command
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        cli_parser.error("Нужно указать команду после разделителя --")

    exit_code = run_command_with_logging(
        log_name=args.log_name,
        command=command,
        log_dir=args.log_dir,
        max_bytes=args.max_bytes,
        pid_file=args.pid_file,
        print_child_pid=args.print_child_pid
    )
    sys.exit(exit_code)



