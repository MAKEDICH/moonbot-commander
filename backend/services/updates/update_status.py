"""
Статусы процесса обновления
"""


class UpdateStatus:
    """Статусы процесса обновления"""
    IDLE = "idle"
    CHECKING = "checking"
    DOWNLOADING = "downloading"
    PREPARING = "preparing"
    BACKING_UP = "backing_up"
    READY_TO_UPDATE = "ready_to_update"
    UPDATING = "updating"
    RESTARTING = "restarting"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"

