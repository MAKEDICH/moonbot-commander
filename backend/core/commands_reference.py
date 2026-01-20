"""
Справочник команд MoonBot

Полный список всех команд бота с описанием
"""

BOT_COMMANDS_REFERENCE = [
    {
        "command": "buy ...",
        "description": "Применяются стандартные правила для сигналов на покупку",
        "category": "Торговля",
        "example": "buy BTC"
    },
    {
        "command": "short ...",
        "description": "Применяются стандартные правила для сигналов на шорт (фьючерсы)",
        "category": "Торговля",
        "example": "short ETH"
    },
    {
        "command": "sell token",
        "description": "Включить Паник Селл на монете",
        "category": "Торговля",
        "example": "sell NEO"
    },
    {
        "command": "SellALL",
        "description": "Включить Паник Селл НА ВСЕХ активных ордерах и остановить бота",
        "category": "Торговля",
        "example": "SellALL"
    },
    {
        "command": "list",
        "description": "Список активных ордеров на продажу",
        "category": "Информация",
        "example": "list"
    },
    {
        "command": "lst",
        "description": "Список активных ордеров (короткий формат)",
        "category": "Информация",
        "example": "lst"
    },
    {
        "command": "silent",
        "description": "Отключить уведомления бота в чат о закрытых сделках",
        "category": "Настройки",
        "example": "silent"
    },
    {
        "command": "talk",
        "description": "Включить уведомления бота в чат о закрытых сделках",
        "category": "Настройки",
        "example": "talk"
    },
    {
        "command": "STOP",
        "description": "Нажать Стоп в боте (Не покупать новые сигналы)",
        "category": "Управление",
        "example": "STOP"
    },
    {
        "command": "START",
        "description": "Нажать Старт в боте, запустить стратегии",
        "category": "Управление",
        "example": "START"
    },
    {
        "command": "CancelBuy",
        "description": "Отменить все неисполненные BUY ордера",
        "category": "Торговля",
        "example": "CancelBuy"
    },
    {
        "command": "BL",
        "description": "Показать черный список монет",
        "category": "Списки",
        "example": "BL"
    },
    {
        "command": "BL + coin",
        "description": "Добавить монету в ЧС",
        "category": "Списки",
        "example": "BL + BTC"
    },
    {
        "command": "BL - coin",
        "description": "Убрать монету из ЧС",
        "category": "Списки",
        "example": "BL - BTC"
    },
    {
        "command": "SetParam Strategy Param Value",
        "description": "Поменять параметр в стратегии (\"empty\" для пустой строки)",
        "category": "Настройки",
        "example": "SetParam MyStrategy MaxOrders 5"
    },
    {
        "command": "SetBL+ Strategy coin",
        "description": "Добавить монету в ЧС стратегии или папки",
        "category": "Списки",
        "example": "SetBL+ MyStrategy BTC"
    },
    {
        "command": "SetBL- Strategy coin",
        "description": "Убрать монету из ЧС стратегии или папки",
        "category": "Списки",
        "example": "SetBL- MyStrategy BTC"
    },
    {
        "command": "SetWL+ Strategy coin",
        "description": "Добавить монету в БС стратегии или папки",
        "category": "Списки",
        "example": "SetWL+ MyStrategy ETH"
    },
    {
        "command": "SetWL- Strategy coin",
        "description": "Убрать монету из БС стратегии или папки",
        "category": "Списки",
        "example": "SetWL- MyStrategy ETH"
    },
    {
        "command": "sgStart Strategy",
        "description": "Запустить стратегию",
        "category": "Управление",
        "example": "sgStart MyStrategy"
    },
    {
        "command": "sgStop Strategy [время]",
        "description": "Остановить стратегию на заданное время (в минутах)",
        "category": "Управление",
        "example": "sgStop MyStrategy 60"
    },
    {
        "command": "ResetSession coin | ALL",
        "description": "Сбросить сессии на монете (coin) или на всех рынках (ALL)",
        "category": "Управление",
        "example": "ResetSession BTC"
    },
    {
        "command": "ResetLoss",
        "description": "Сбросить счетчик профита",
        "category": "Управление",
        "example": "ResetLoss"
    },
    {
        "command": "Leverage X [coin,coin]",
        "description": "Поменять плечо на монетах на X",
        "category": "Фьючерсы",
        "example": "Leverage 10 BTC,ETH"
    },
    {
        "command": "Margin [coin,coin | ALL] ISO|Cross",
        "description": "Поменять маржу на маркетах",
        "category": "Фьючерсы",
        "example": "Margin BTC,ETH ISO"
    },
    {
        "command": "ConvertBNB",
        "description": "Конвертировать пыль в BNB",
        "category": "Утилиты",
        "example": "ConvertBNB"
    },
    {
        "command": "report [N days | weeks] [coin] [hide]",
        "description": "Выслать отчет. По умолчанию за сегодня",
        "category": "Отчеты",
        "example": "report 7 days"
    },
    {
        "command": "SellPiece [coin|ALL]",
        "description": "Продать по кусочку от каждого ордера (если параметр в стратегии SellPiece не 0)",
        "category": "Торговля",
        "example": "SellPiece BTC"
    },
    {
        "command": "DoUpdate",
        "description": "Обновить версию бота",
        "category": "Утилиты",
        "example": "DoUpdate"
    },
    {
        "command": "InstallTestVersion Release",
        "description": "Обновить бота на последнюю релизную версию. ВАЖНО: Для работы этой команды должна быть включена галочка 'Accept beta version' в Настройках -> Специальные -> System",
        "category": "Утилиты",
        "example": "InstallTestVersion Release"
    },
    {
        "command": "AutoLevConfig [def_sum] def [sum] coin1 coin2 [sum] coin3",
        "description": "Автоматический подбор плеча на основе требуемой суммы ордеров. Бот подбирает плечо на котором разрешена указанная сумма. 'def' - для всех остальных монет не указанных явно",
        "category": "Фьючерсы",
        "example": "AutoLevConfig 1000 def 50k alice glm 100k btc eth"
    }
]






