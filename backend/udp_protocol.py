"""
Utilities for decoding MoonBot UDP packets and extracting payload data.

MoonBot now responds to UDP commands with gzip-compressed JSON payloads.
This module centralises decompression, parsing and helper utilities so the
listener, API clients and background tasks can share the same logic.
"""

from __future__ import annotations

import gzip
import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

GZIP_MAGIC_PREFIX = b"\x1f\x8b"

SQL_COMMAND_PATTERN = re.compile(
    r"\[SQLCommand \d+\].*?(?=\[SQLCommand \d+\]|$)", re.DOTALL
)


@dataclass(slots=True)
class DecodedPacket:
    """
    Result of decoding a raw UDP response packet.

    Attributes:
        raw_text: UTF-8 decoded text (after decompression when applicable).
        payload: Parsed JSON dictionary if available, otherwise None.
        is_gzip: Whether the original payload was gzip-compressed.
        raw_bytes: Original bytes returned by the socket.
        decompress_error: Error message if gzip decompression failed.
    """

    raw_text: str
    payload: Optional[Dict[str, Any]]
    is_gzip: bool
    raw_bytes: bytes
    decompress_error: Optional[str] = None


def decode_udp_packet(data: bytes) -> DecodedPacket:
    """
    Decode a UDP packet coming from MoonBot.

    Args:
        data: Raw bytes received from the UDP socket.

    Returns:
        DecodedPacket with decoded text, parsed JSON (if any) and metadata.
    """

    is_gzip = len(data) >= 2 and data.startswith(GZIP_MAGIC_PREFIX)
    decoded_bytes = data
    decompress_error: Optional[str] = None

    if is_gzip:
        try:
            decoded_bytes = gzip.decompress(data)
        except EOFError as exc:
            # Фрагментированный/неполный gzip пакет - скорее всего UDP фрагментация
            # Moonbot должен разбить большие данные на несколько пакетов с разными N
            # Игнорируем этот пакет и ждём следующий
            decompress_error = f"Incomplete gzip packet (fragmented UDP?): {exc}"
            decoded_bytes = data
        except OSError as exc:
            # Другие ошибки gzip (повреждённые данные и т.д.)
            decompress_error = str(exc)
            decoded_bytes = data

    raw_text = decoded_bytes.decode("utf-8", errors="replace")

    payload: Optional[Dict[str, Any]]
    try:
        parsed = json.loads(raw_text)
        if isinstance(parsed, dict):
            payload = parsed
        else:
            payload = None
    except json.JSONDecodeError:
        payload = None

    return DecodedPacket(
        raw_text=raw_text,
        payload=payload,
        is_gzip=is_gzip,
        raw_bytes=data,
        decompress_error=decompress_error,
    )


def get_packet_command(packet: DecodedPacket) -> Optional[str]:
    """
    Extract command type from a decoded packet.

    Returns the command in lower-case if present.
    """
    if not packet.payload:
        return None
    cmd = packet.payload.get("cmd")
    return cmd.lower() if isinstance(cmd, str) else None


def extract_preferred_text(packet: DecodedPacket) -> str:
    """
    Return the most user-friendly text representation for a packet.

    Preference order:
      1. payload["data"] when it is a string (used for most replies)
      2. payload["sql"] when available (order updates)
      3. raw JSON text (packet.raw_text)
    """
    if packet.payload:
        data_field = packet.payload.get("data")
        if isinstance(data_field, str):
            return data_field

        sql_field = packet.payload.get("sql")
        if isinstance(sql_field, str):
            return sql_field

    return packet.raw_text


def is_error_packet(packet: DecodedPacket) -> bool:
    """
    Determine whether the packet represents an error response.
    """
    if packet.decompress_error:
        return True

    if packet.payload:
        cmd = packet.payload.get("cmd")
        if isinstance(cmd, str) and cmd.lower() in {"error", "err", "failed", "fail"}:
            return True

        status = packet.payload.get("status")
        if isinstance(status, str) and status.lower() in {"error", "err", "failed"}:
            return True

        for key in ("data", "message", "error"):
            value = packet.payload.get(key)
            if isinstance(value, str) and value.upper().startswith("ERR"):
                return True

    return packet.raw_text.startswith("ERR")


def extract_sql_commands(packet: DecodedPacket) -> List[str]:
    """
    Extract individual SQL command strings from a packet.

    Returns:
        List of SQL command strings (each still contains the [SQLCommand xxxx] prefix).
    """
    candidate_texts: List[str] = []

    if packet.payload:
        sql_field = packet.payload.get("sql")
        if isinstance(sql_field, str):
            candidate_texts.append(sql_field)

        data_field = packet.payload.get("data")
        if isinstance(data_field, str):
            candidate_texts.append(data_field)
    else:
        candidate_texts.append(packet.raw_text)

    commands: List[str] = []
    for text in candidate_texts:
        for match in SQL_COMMAND_PATTERN.finditer(text):
            command = match.group(0).strip()
            if command:
                commands.append(command)

    return commands


def packet_to_json_line(packet: DecodedPacket) -> Optional[str]:
    """
    Serialise packet payload back to a compact JSON string.

    Returns:
        JSON string or None if payload is missing.
    """
    if not packet.payload:
        return None

    try:
        return json.dumps(packet.payload, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError):
        return None


__all__ = [
    "DecodedPacket",
    "decode_udp_packet",
    "extract_preferred_text",
    "extract_sql_commands",
    "get_packet_command",
    "is_error_packet",
    "packet_to_json_line",
]

