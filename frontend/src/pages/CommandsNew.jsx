import React, { useState, useEffect } from 'react';
import { FiSend, FiServer, FiSearch, FiCheckSquare, FiSquare, FiPlus, FiTrash2, FiEdit2, FiBook, FiSave, FiX, FiTool, FiPlayCircle, FiInfo, FiSettings } from 'react-icons/fi';
import { serversAPI, commandsAPI, groupsAPI, quickCommandsAPI, presetsAPI, botCommandsAPI } from '../api/api';
import styles from './CommandsNew.module.css';
import StrategyCommander from './StrategyCommander';

// Параметры стратегий для автокомплита
const STRATEGY_PARAMS = [
  'StrategyName', 'Comment', 'LastEditDate', 'SignalType', 'ChannelName', 'ChannelKey', 'AcceptCommands',
  'OnlyEncryptedCommands', 'SilentNoCharts', 'ReportToTelegram', 'ReportTradesToTelegram', 'SoundAlert',
  'SoundKind', 'KeepAlert', 'AddToChart', 'KeepInChart', 'EmulatorMode', 'DebugLog', 'IndependentSignals',
  'DontWriteLog', 'DontKeepOrdersOnChart', 'UseCustomColors', 'OrderLineKind', 'SellOrderColor', 'BuyOrderColor',
  'DynWL_SortBy', 'DynWL_SortDesc', 'DynWL_Count', 'DynBL_SortBy', 'DynBL_SortDesc', 'DynBL_Count',
  'Dyn_Refresh', 'IgnoreFilters', 'IgnoreGatePenalty', 'CoinsWhiteList', 'CoinsBlackList', 'OnlyNewListing',
  'DontTradeListing', 'LeveragedTokens', 'ListedType', 'CheckAfterBuy', 'DontCheckBeforeBuy', 'NextDetectPenalty',
  'PreventWorkingUntil', 'IgnoreBase', 'BinanceTokenTags', 'MinLeverage', 'MaxLeverage', 'CustomEMA',
  'MoonIntRiskLevel', 'MoonIntStopLevel', 'MarkPriceMin', 'MarkPriceMax', 'IgnoreTime', 'WorkingTime',
  'PenaltyTime', 'TradePenaltyTime', 'GlobalDetectPenalty', 'FundingBefore', 'FundingAfter', 'IgnorePrice',
  'MaxBalance', 'SamePosition', 'MaxPosition', 'SessionProfitMin', 'SessionProfitMax', 'TotalLoss',
  'WorkingPriceMax', 'WorkingPriceMin', 'PriceStepMin', 'PriceStepMax', 'UseBTCPriceStep', 'IgnorePing',
  'MaxPing', 'MinPing', 'MaxLatency', 'BinancePriceBug', 'BinancePriceBugMin', 'IgnoreVolume', 'MinVolume',
  'MaxVolume', 'MinHourlyVolume', 'MaxHourlyVolume', 'MinHourlyVolFast', 'MaxHourlyVolFast', 'MinuteVolDeltaMin',
  'MinuteVolDeltaMax', 'UseBV_SV_Filter', 'BV_SV_FilterRatio', 'IgnoreDelta', 'Delta_3h_Min', 'Delta_3h_Max',
  'Delta_24h_Min', 'Delta_24h_Max', 'Delta2_Type', 'Delta2_Min', 'Delta2_Max', 'Delta3_Type', 'Delta3_Min',
  'Delta3_Max', 'Delta_BTC_Min', 'Delta_BTC_Max', 'Delta_BTC_24_Min', 'Delta_BTC_24_Max', 'Delta_BTC_5m_Min',
  'Delta_BTC_5m_Max', 'Delta_BTC_1m_Min', 'Delta_BTC_1m_Max', 'Delta_Market_Min', 'Delta_Market_Max',
  'Delta_Market_24_Min', 'Delta_Market_24_Max', 'FilterBy', 'FilterMin', 'FilterMax', 'GlobalFilterPenalty',
  'DeltaSwitch', 'TriggerKey', 'TriggerKeyBuy', 'TriggerKeyProfit', 'TriggerKeyLoss', 'ActiveTrigger',
  'ClearTriggersBelow', 'ClearTriggersAbove', 'ClearTriggerKeys', 'TriggerAllMarkets', 'TriggerByKey',
  'TriggerByAllKeys', 'TriggerSeconds', 'TriggerKeysBL', 'TriggerSecondsBL', 'SellByTriggerBL', 'CancelByTriggerBL',
  'IgnoreSession', 'SessionLevelsUSDT', 'SessionStratMax', 'SessionStratIncreaseMax', 'SessionStratMin',
  'SessionStratReduceMin', 'SessionResetOnMinus', 'SessionPenaltyTime', 'SessionPlusCount', 'SessionMinusCount',
  'SessionIncreaseOrder', 'SessionIncreaseOrderMax', 'SessionReduceOrder', 'SessionReduceOrderMin', 'SessionResetTime',
  'AutoBuy', 'BuyDelay', 'Short', 'HFT', 'MaxActiveOrders', 'MaxOrdersPerMarket', 'MaxMarkets', 'AutoCancelBuy',
  'AutoCancelLowerBuy', 'CancelBuyAfterSell', 'BuyType', 'PendingOrderSpread', 'OrderSize', 'MinFreeBalance',
  'buyPrice', 'buyPriceLastTrade', 'Use30SecOldASK', 'UseOldPrice', 'buyPriceAbsolute', 'TlgUseBuyDipWords',
  'TlgBuyDipPrice', 'BuyModifier', 'SellModifier', 'DetectModifier', 'StopLossModifier', 'MaxModifier',
  'Add24hDelta', 'Add3hDelta', 'AddHourlyDelta', 'Add15minDelta', 'Add5minDelta', 'Add1minDelta', 'AddMarketDelta',
  'AddBTCDelta', 'AddBTC5mDelta', 'AddBTC1mDelta', 'AddMarkDelta', 'AddPump1h', 'AddDump1h', 'AddPriceBug',
  'OrdersCount', 'CheckFreeBalance', 'BuyPriceStep', 'BuyStepKind', 'OrderSizeStep', 'OrderSizeKind',
  'CancelBuyStep', 'JoinSellKey', 'JoinPriceFixed', 'IgnoreCancelBuy', 'AutoSell', 'SellPrice', 'SellDelay',
  'SplitPiece', 'UseMarketStop', 'MarketStopLevel', 'SellPriceAbsolute', 'SellFromAssets', 'SellQuantity',
  'PriceDownTimer', 'PriceDownDelay', 'PriceDownPercent', 'PriceDownRelative', 'PriceDownAllowedDrop',
  'UseScalpingMode', 'SellByFilters', 'SellByCustomEMA', 'SellEMADelay', 'SellEMACheckEnter', 'SellLevelDelay',
  'SellLevelDelayNext', 'SellLevelWorkTime', 'SellLevelTime', 'SellLevelCount', 'SellLevelAdjust', 'SellLevelRelative',
  'SellLevelAllowedDrop', 'IgnoreSellShot', 'SellShotDelay', 'SellShotDistance', 'SellShotCorridor', 'SellShotCalcInterval',
  'SellShotRaiseWait', 'SellShotReplaceDelay', 'SellShotPriceDown', 'SellShotPriceDownDelay', 'SellShotAllowedUp',
  'SellShotAllowedDown', 'IgnoreSellSpread', 'SellSpreadReplaceCount', 'SellSpreadMinSpread', 'SellSpreadDelay',
  'SellSpreadDistance', 'SellSpreadAllowedDrop', 'UseSignalStops', 'UseStopLoss', 'FastStopLoss', 'StopLossEMA',
  'StopLossDelay', 'StopLoss', 'StopLossSpread', 'StopSpreadAdd1mDelta', 'AllowedDrop', 'DontSellBelowLiq',
  'StopAboveLiq', 'StopLossFixed', 'UseSecondStop', 'TimeToSwitch2Stop', 'PriceToSwitch2Stop', 'SecondStopLoss',
  'UseStopLoss3', 'TimeToSwitchStop3', 'PriceToSwitchStop3', 'StopLoss3', 'AllowedDrop3', 'UseTrailing',
  'TrailingPercent', 'TrailingSpread', 'Trailing EMA', 'UseTakeProfit', 'TakeProfit', 'UseBV_SV_Stop', 'BV_SV_Kind',
  'BV_SV_TradesN', 'BV_SV_Ratio', 'BV_SV_Reverse', 'BV_SV_TakeProfit', 'PanicSellDelisted', 'MultiTokens',
  'DropsMaxTime', 'DropsPriceMA', 'DropsLastPriceMA', 'DropsPriceDelta', 'DropsPriceIsLow', 'DropsUseLastPrice',
  'WallsMaxTime', 'WallsPriceDelta', 'WallBuyVolDeep', 'WallBuyVolume', 'WallBuyVolToDailyVol', 'WallSellVolToBuy',
  'WallSellVolDeep', 'PumpPriceInterval', 'PumpPriceRaise', 'PumpBuysPerSec', 'PumpVolPerSec', 'PumpBuyersPerSecMin',
  'PumpBuyersPerSecMax', 'PumpVolEMA', 'PumpBuyersInterval', 'PumpMoveTimer', 'PumpMovePersent', 'PumpUsePrevBuyPrice',
  'MShotPriceMin', 'MShotPrice', 'MShotMinusSatoshi', 'MShotAdd24hDelta', 'MShotAdd3hDelta', 'MShotAddHourlyDelta',
  'MShotAdd15minDelta', 'MShotAdd5minDelta', 'MShotAdd1minDelta', 'MShotAddMarketDelta', 'MShotAddBTCDelta',
  'MShotAddBTC5mDelta', 'MShotAddDistance', 'MShotAddPriceBug', 'MShotSellAtLastPrice', 'MShotSellPriceAdjust',
  'MShotReplaceDelay', 'MShotRaiseWait', 'MShotSortBy', 'MShotSortDesc', 'MShotUsePrice', 'MShotRepeatAfterBuy',
  'MShotRepeatIfProfit', 'MShotRepeatWait', 'MShotRepeatDelay', 'FastShotAlgo', 'MStrikeDepth', 'MStrikeVolume',
  'MStrikeAddHourlyDelta', 'MStrikeAdd15minDelta', 'MStrikeAddMarketDelta', 'MStrikeAddBTCDelta', 'MStrikeBuyDelay',
  'MStrikeBuyLevel', 'MStrikeBuyRelative', 'MStrikeSellLevel', 'MStrikeSellAdjust', 'MStrikeDirection', 'MStrikeWaitDip',
  'VolShortInterval', 'VolShortPriseRaise', 'VolLongInterval', 'VolBvShortToLong', 'VolBvLongToHourlyMin',
  'VolBvLongToHourlyMax', 'VolBvLongToDailyMin', 'VolBvLongToDailyMax', 'VolBvToSvShort', 'VolBvShort',
  'VolBuyersShort', 'VolSvLong', 'VolTakeLongMaxP', 'VolAtMinP', 'VolAtMaxP', 'VolDeltaAtMaxP', 'VolDeltaAtMinP',
  'volBidsDeep', 'volBids', 'volAsksDeep', 'volBidsToAsks', 'VLiteT0', 'VLiteT1', 'VLiteT2', 'VLiteT3',
  'VLiteP1', 'VLiteP2', 'VLiteP3', 'VLiteMaxP', 'VLitePDelta1', 'VLitePDelta2', 'VLiteDelta0', 'VLiteMaxSpike',
  'VLiteV1', 'VLiteV2', 'VLiteV3', 'VLiteWeightedAvg', 'VLiteReducedVolumes', 'WavesT0', 'WavesT1', 'WavesT2',
  'WavesT3', 'WavesP1', 'WavesP2', 'WavesP3', 'WavesDelta0', 'WavesMaxSpike', 'WavesV1', 'WavesV2', 'WavesV3',
  'WavesWeightedAvg', 'WavesReducedVolumes', 'DeltaInterval', 'DeltaShortInterval', 'DeltaPrice', 'DeltaVol',
  'DeltaVolRaise', 'DeltaVolSec', 'DeltaBuyers', 'DeltaLastPrice', 'TMBuyPriceLimit', 'UseHookStrategy',
  'ComboStart', 'ComboEnd', 'ComboDelayMin', 'ComboDelayMax', 'DeltaMin', 'TMSameDirection', 'StrategyPenalty',
  'TimeInterval', 'TradesDensity', 'TradesDensityPrev', 'TradesCountMin', 'PriceIntervals', 'PriceIntervalShift',
  'PriceSpread', 'PriceSpreadMax', 'IntervalsForBuySpread', 'BuyPriceInSpread', 'SellPriceInSpread', 'BuyOrderReduce',
  'MinReducedSize', 'SpreadRepeatIfProfit', 'SpreadFlat', 'Spread_BV_SV_Time', 'Spread_BV_SV_Max', 'Spread_BV_SV_Min',
  'SpreadPolarityMin', 'SpreadPolarityMax', 'HookTimeFrame', 'HookDetectDepth', 'HookDetectDepthMax', 'HookAntiPump',
  'HookPriceRollBack', 'HookPriceRollBackMax', 'HookRollBackWait', 'HookDropMin', 'HookDropMax', 'HookDirection',
  'HookOppositeOrder', 'HookInterpolate', 'HookInitialPrice', 'HookPriceDistance', 'HookPartFilledDelay',
  'HookSellLevel', 'HookSellFixed', 'HookReplaceDelay', 'HookRaiseWait', 'HookRepeatAfterSell', 'HookRepeatIfProfit',
  'MMTimeFrame', 'MMOrderMin', 'MMOrderMax', 'MMOrderStep', 'AlertByTrades', 'WatchAddress', 'WatchDirection',
  'WatchMinVolume', 'WatchMinPosition', 'LiqTime', 'LiqCount', 'LiqVolumeMin', 'LiqVolumeMax', 'LiqWaitTime',
  'LiqWithinTime', 'LiqDirection', 'LiqSameDirection', 'Liq_BV_SV_Time', 'Liq_BV_SV_Filter'
];

// Конструктор команд (ПОЛНЫЙ СПИСОК)
const CONSTRUCTOR_COMMANDS = [
  {
    id: 'SetParam',
    name: 'SetParam',
    desc: 'Поменять параметр в стратегии',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'param', label: 'Param', placeholder: 'Название параметра' },
      { name: 'value', label: 'Value', placeholder: 'Значение (empty для пустой строки)' }
    ]
  },
  {
    id: 'SetBL+',
    name: 'SetBL+',
    desc: 'Добавить монету в ЧС стратегии',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'SetBL-',
    name: 'SetBL-',
    desc: 'Убрать монету из ЧС стратегии',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'SetWL+',
    name: 'SetWL+',
    desc: 'Добавить монету в БС стратегии',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'SetWL-',
    name: 'SetWL-',
    desc: 'Убрать монету из БС стратегии',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'sgStart',
    name: 'sgStart',
    desc: 'Запустить стратегию',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'time', label: 'Time (мин)', placeholder: 'Время в минутах (опционально)', optional: true }
    ]
  },
  {
    id: 'sgStop',
    name: 'sgStop',
    desc: 'Остановить стратегию',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'time', label: 'Time (мин)', placeholder: 'Время в минутах (опционально)', optional: true }
    ]
  },
  {
    id: 'Leverage',
    name: 'Leverage',
    desc: 'Поменять плечо на монетах',
    fields: [
      { name: 'x', label: 'X', placeholder: 'Плечо (например: 10)' },
      { name: 'coins', label: 'Coins', placeholder: 'Монеты через запятую (BTC,ETH)' }
    ]
  },
  {
    id: 'Margin',
    name: 'Margin',
    desc: 'Поменять маржу на маркетах',
    fields: [
      { name: 'coins', label: 'Coins', placeholder: 'Монеты или ALL' },
      { name: 'type', label: 'Type', placeholder: 'ISO или Cross' }
    ]
  },
  {
    id: 'TempBL',
    name: 'TempBL',
    desc: 'Временный ЧС на N часов',
    fields: [
      { name: 'hours', label: 'Hours', placeholder: 'Часы (например: +24)' },
      { name: 'coins', label: 'Coins', placeholder: 'Монеты через пробел (BTC ETH)' }
    ]
  },
  {
    id: 'sell',
    name: 'sell',
    desc: 'Паник селл на монете',
    fields: [
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'SellPiece',
    name: 'SellPiece',
    desc: 'Продать по кусочку от ордера',
    fields: [
      { name: 'coin', label: 'Coin', placeholder: 'Монета или ALL' }
    ]
  },
  {
    id: 'ResetSession',
    name: 'ResetSession',
    desc: 'Сбросить сессии',
    fields: [
      { name: 'coin', label: 'Coin', placeholder: 'Монета или ALL' }
    ]
  },
  {
    id: 'report',
    name: 'report',
    desc: 'Отчет',
    fields: [
      { name: 'period', label: 'Period', placeholder: '7 days / 2 weeks (опционально)', optional: true },
      { name: 'coin', label: 'Coin', placeholder: 'Монета (опционально)', optional: true },
      { name: 'hide', label: 'Hide', placeholder: 'hide (опционально)', optional: true }
    ]
  },
  {
    id: 'buy',
    name: 'buy',
    desc: 'Применить стандартные правила для покупки',
    fields: [
      { name: 'params', label: 'Params', placeholder: 'Параметры покупки' }
    ]
  },
  {
    id: 'short',
    name: 'short',
    desc: 'Применить стандартные правила для шорта (фьючерсы)',
    fields: [
      { name: 'params', label: 'Params', placeholder: 'Параметры шорта' }
    ]
  },
  {
    id: 'BL+',
    name: 'BL +',
    desc: 'Добавить монету в черный список',
    fields: [
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'BL-',
    name: 'BL -',
    desc: 'Убрать монету из черного списка',
    fields: [
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'AutoLevConfig',
    name: 'AutoLevConfig',
    desc: 'Автоподбор плеча по сумме ордеров',
    fields: [
      { name: 'config', label: 'Config', placeholder: '1000 def 50k alice glm 100k btc eth' }
    ]
  },
];

const CommandsNew = () => {
  const [servers, setServers] = useState([]);
  const [selectedServers, setSelectedServers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [commands, setCommands] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeout, setTimeout] = useState(5); // Таймаут ожидания ответа от бота
  const [delayBetweenBots, setDelayBetweenBots] = useState(0); // Задержка между ботами в секундах
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [useBotname, setUseBotname] = useState(false);
  const [clearAfterSend, setClearAfterSend] = useState(false);

  // Пользовательские быстрые команды
  const [quickCommands, setQuickCommands] = useState([]);
  const [showAddQuickCmd, setShowAddQuickCmd] = useState(false);
  const [newQuickCmd, setNewQuickCmd] = useState({ label: '', command: '' });
  const [editingQuickCmd, setEditingQuickCmd] = useState(null);
  const [showPresetHint, setShowPresetHint] = useState(false);

  // Пресеты
  const [presets, setPresets] = useState([]);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [presetValidationError, setPresetValidationError] = useState('');

  // Справочник команд
  const [botCommands, setBotCommands] = useState([]);
  const [showCommandsReference, setShowCommandsReference] = useState(false);
  
  // Strategy Commander
  const [showStrategyCommander, setShowStrategyCommander] = useState(false);
  const [commandsFilter, setCommandsFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCommandsFromReference, setSelectedCommandsFromReference] = useState([]);
  
  // Конструктор команд
  const [selectedConstructor, setSelectedConstructor] = useState(null);
  const [constructorValues, setConstructorValues] = useState({});
  
  // Автокомплит для параметров
  const [showParamAutocomplete, setShowParamAutocomplete] = useState(false);
  const [filteredParams, setFilteredParams] = useState([]);
  
  // Состояние развернутых групп
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Автоподстановка для команд
  const [commandSuggestions, setCommandSuggestions] = useState([]);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState(null); // 'new' или 'edit'
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  useEffect(() => {
    loadServers();
    loadGroups();
    loadQuickCommands();
    loadPresets();
    loadBotCommands();
    
    // Восстанавливаем состояние чекбокса "Очищать после отправки"
    const savedClearAfterSend = localStorage.getItem('clearAfterSend');
    if (savedClearAfterSend !== null) {
      setClearAfterSend(savedClearAfterSend === 'true');
    }
  }, []);
  
  // Закрытие автокомплита при клике вне его
  useEffect(() => {
    // Если нет активных модальных окон - не вешаем listener
    if (!showParamAutocomplete && !showCommandSuggestions) {
      return;
    }

    const handleClickOutside = (e) => {
      if (showParamAutocomplete && !e.target.closest('.'+styles.autocompleteWrapper)) {
        setShowParamAutocomplete(false);
      }
      // Не закрываем подсказки команд при клике на них
      if (showCommandSuggestions && !e.target.closest('input') && !e.target.closest('.'+styles.suggestionsDropdown)) {
        setShowCommandSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showParamAutocomplete, showCommandSuggestions]);

  const loadServers = async () => {
    try {
      const response = await serversAPI.getAll();
      const activeServers = response.data.filter(s => s.is_active);
      setServers(activeServers);
    } catch (error) {
      console.error('Error loading servers:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await groupsAPI.getAll();
      setGroups(response.data.groups || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  // Команды по умолчанию (только разовые, без параметров)
  const DEFAULT_QUICK_COMMANDS = [
    { label: 'START', command: 'START' },
    { label: 'STOP', command: 'STOP' },
    { label: 'Список ордеров', command: 'list' },
    { label: 'Список (короткий)', command: 'lst' },
    { label: 'Черный список', command: 'BL' },
    { label: 'Отключить уведомления', command: 'silent' },
    { label: 'Включить уведомления', command: 'talk' },
    { label: 'Отмена ордеров', command: 'CancelBuy' },
    { label: 'Продать всё', command: 'SellALL' },
    { label: 'Конвертировать пыль', command: 'ConvertBNB' },
    { label: 'Обновить бота', command: 'DoUpdate' },
    { label: 'Обновить на Release', command: 'InstallTestVersion Release' },
    { label: 'Сбросить профит', command: 'ResetLoss' },
  ];

  const loadQuickCommands = async () => {
    try {
      const response = await quickCommandsAPI.getAll();
      const userCommands = response.data;
      
      // Если у пользователя нет команд, создаём дефолтные
      if (userCommands.length === 0) {
        await createDefaultCommands();
        // Загружаем снова после создания
        const newResponse = await quickCommandsAPI.getAll();
        setQuickCommands(newResponse.data);
      } else {
        setQuickCommands(userCommands);
      }
    } catch (error) {
      console.error('Error loading quick commands:', error);
    }
  };

  const createDefaultCommands = async () => {
    try {
      for (let i = 0; i < DEFAULT_QUICK_COMMANDS.length; i++) {
        const cmd = DEFAULT_QUICK_COMMANDS[i];
        try {
          await quickCommandsAPI.create({
            label: cmd.label,
            command: cmd.command,
            order: i
          });
        } catch (error) {
          // Игнорируем ошибки дубликатов (UNIQUE constraint)
          // Это нормально если команды уже существуют
          if (!error.response?.status === 400) {
            console.error(`Error creating command ${cmd.label}:`, error);
          }
        }
      }
      console.log('Default commands created successfully');
    } catch (error) {
      console.error('Error creating default commands:', error);
    }
  };

  const loadPresets = async () => {
    try {
      const response = await presetsAPI.getAll();
      setPresets(response.data);
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  const loadBotCommands = async () => {
    try {
      const response = await botCommandsAPI.getAll();
      setBotCommands(response.data);
    } catch (error) {
      console.error('Error loading bot commands:', error);
    }
  };

  // === CRUD для быстрых команд ===
  const handleAddQuickCommand = async () => {
    if (!newQuickCmd.label || !newQuickCmd.command) {
      return;
    }

    try {
      await quickCommandsAPI.create(newQuickCmd);
      await loadQuickCommands();
      setNewQuickCmd({ label: '', command: '' });
      setShowAddQuickCmd(false);
    } catch (error) {
      console.error('Ошибка добавления команды:', error);
    }
  };

  const handleUpdateQuickCommand = async () => {
    if (!editingQuickCmd || !editingQuickCmd.label || !editingQuickCmd.command) return;
    
    try {
      await quickCommandsAPI.update(editingQuickCmd.id, {
        label: editingQuickCmd.label,
        command: editingQuickCmd.command
      });
      await loadQuickCommands();
      setEditingQuickCmd(null);
    } catch (error) {
      console.error('Ошибка обновления команды:', error);
    }
  };

  const handleDeleteQuickCommand = async (id) => {
    try {
      await quickCommandsAPI.delete(id);
      await loadQuickCommands();
    } catch (error) {
      console.error('Ошибка удаления команды:', error);
    }
  };

  // === CRUD для пресетов ===
  const handleSavePreset = async () => {
    if (!newPresetName.trim() || !commands.trim()) {
      return;
    }

    try {
      const usedNumbers = presets.map(p => p.button_number).filter(n => n !== null);
      const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
      
      // Проверяем, что номер не превышает максимум
      if (nextNumber > 50) {
        alert('Достигнут максимум кнопок (50). Удалите или измените номер существующей кнопки.');
        return;
      }
      
      await presetsAPI.create({
        name: newPresetName,
        commands: commands,
        button_number: nextNumber
      });
      
      await loadPresets();
      setNewPresetName('');
    } catch (error) {
      console.error('Ошибка сохранения пресета:', error);
    }
  };

  const handleUpdatePreset = async (id, data) => {
    try {
      await presetsAPI.update(id, data);
      await loadPresets();
      setEditingPreset(null);
    } catch (error) {
      console.error('Ошибка обновления пресета:', error);
    }
  };

  const handleDeletePreset = async (id) => {
    try {
      await presetsAPI.delete(id);
      await loadPresets();
    } catch (error) {
      console.error('Ошибка удаления пресета:', error);
    }
  };

  const handleExecutePreset = async (preset) => {
    if (selectedServers.length === 0) {
      return;
    }
    
    if (selectedServers.length > 1) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await presetsAPI.execute(preset.id, selectedServers[0]);
      setResponse({
        status: 'success',
        bulk: true,
        results: result.data.results,
        summary: {
          successful: result.data.results.filter(r => r.status === 'success').length,
          failed: result.data.results.filter(r => r.status === 'error').length,
          total: result.data.results.length,
          servers: 1,
          commands: result.data.total_commands
        },
        time: new Date().toLocaleString('ru-RU'),
        presetName: preset.name
      });
      
      // Очистить редактор команд если включена галка
      if (clearAfterSend) {
        setCommands('');
      }
    } catch (error) {
      console.error('Ошибка выполнения пресета:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPresetToEditor = (preset) => {
    setCommands(preset.commands);
  };

  // === Автоподстановка команд ===
  const handleCommandInput = (value, field) => {
    if (field === 'new') {
      setNewQuickCmd({...newQuickCmd, command: value});
    } else if (field === 'edit') {
      setEditingQuickCmd({...editingQuickCmd, command: value});
    }

    // Фильтруем команды из справочника
    if (value.length > 0) {
      const filtered = botCommands
        .filter(cmd => 
          cmd.command.toLowerCase().includes(value.toLowerCase()) ||
          cmd.description.toLowerCase().includes(value.toLowerCase())
        )
        .slice(0, 8); // Показываем первые 8 совпадений
      
      setCommandSuggestions(filtered);
      setShowCommandSuggestions(true);
      setActiveSuggestionField(field);
      setSelectedSuggestionIndex(0); // Сброс выбранного индекса
    } else {
      setShowCommandSuggestions(false);
      setCommandSuggestions([]);
    }
  };

  const selectCommandSuggestion = (command) => {
    if (activeSuggestionField === 'new') {
      setNewQuickCmd({...newQuickCmd, command: command});
    } else if (activeSuggestionField === 'edit') {
      setEditingQuickCmd({...editingQuickCmd, command: command});
    }
    setShowCommandSuggestions(false);
    setCommandSuggestions([]);
    setSelectedSuggestionIndex(0);
  };

  const handleCommandKeyDown = (e, field) => {
    if (!showCommandSuggestions || commandSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < commandSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && showCommandSuggestions) {
      e.preventDefault();
      selectCommandSuggestion(commandSuggestions[selectedSuggestionIndex].command);
    } else if (e.key === 'Escape') {
      setShowCommandSuggestions(false);
      setCommandSuggestions([]);
    }
  };

  // === Конструктор команд ===
  const handleConstructorSelect = (constructor) => {
    setSelectedConstructor(constructor);
    setConstructorValues({});
  };

  const handleConstructorValueChange = (fieldName, value) => {
    setConstructorValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Показать автокомплит для поля 'param' в SetParam
    if (fieldName === 'param' && selectedConstructor?.id === 'SetParam') {
      if (value.length > 0) {
        const filtered = STRATEGY_PARAMS.filter(param => 
          param.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 10); // Показываем первые 10 совпадений
        setFilteredParams(filtered);
        setShowParamAutocomplete(true);
      } else {
        setShowParamAutocomplete(false);
        setFilteredParams([]);
      }
    } else {
      setShowParamAutocomplete(false);
    }
  };
  
  const selectParam = (param) => {
    setConstructorValues(prev => ({
      ...prev,
      param: param
    }));
    setShowParamAutocomplete(false);
    setFilteredParams([]);
  };

  const buildCommandFromConstructor = () => {
    if (!selectedConstructor) return;

    const parts = [selectedConstructor.name];
    
    selectedConstructor.fields.forEach(field => {
      const value = constructorValues[field.name];
      if (value || !field.optional) {
        parts.push(value || '');
      }
    });

    const newCommand = parts.join(' ').trim();
    
    if (commands.trim()) {
      setCommands(commands + '\n' + newCommand);
    } else {
      setCommands(newCommand);
    }

    setConstructorValues({});
  };

  // === Выбор серверов ===
  const filteredServers = servers.filter(server => {
    const matchesSearch = 
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (server.group_name && server.group_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesGroup = selectedGroup === 'all' || 
                        (!selectedGroup && !server.group_name) ||
                        (server.group_name && server.group_name.split(',').map(g => g.trim()).includes(selectedGroup));
    
    return matchesSearch && matchesGroup;
  });

  const toggleServerSelection = (serverId) => {
    setSelectedServers(prev => {
      if (prev.includes(serverId)) {
        return prev.filter(id => id !== serverId);
      } else {
        return [...prev, serverId];
      }
    });
  };

  const selectAll = () => {
    const allIds = filteredServers.map(s => s.id);
    setSelectedServers(allIds);
  };

  const deselectAll = () => {
    setSelectedServers([]);
  };
  
  const selectAllInGroup = (groupName) => {
    const groupServers = servers.filter(s => 
      s.group_name && s.group_name.split(',').map(g => g.trim()).includes(groupName)
    ).map(s => s.id);
    setSelectedServers(prev => [...new Set([...prev, ...groupServers])]);
  };
  
  const getSelectedServersNames = () => {
    if (selectedServers.length === 0) return 'Не выбрано';
    if (selectedServers.length === servers.length) return 'Все серверы';
    if (selectedServers.length <= 3) {
      return servers.filter(s => selectedServers.includes(s.id)).map(s => s.name).join(', ');
    }
    return `${selectedServers.length} серверов`;
  };
  
  const toggleGroup = (groupName) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };
  
  const isGroupFullySelected = (groupName) => {
    // ИСПРАВЛЕНО: Правильная фильтрация для "БЕЗ ГРУППЫ"
    const groupServers = groupName === ''
      ? servers.filter(s => !s.group_name)
      : servers.filter(s => s.group_name && s.group_name.split(',').map(g => g.trim()).includes(groupName));
    return groupServers.length > 0 && groupServers.every(s => selectedServers.includes(s.id));
  };
  
  const isGroupPartiallySelected = (groupName) => {
    // ИСПРАВЛЕНО: Правильная фильтрация для "БЕЗ ГРУППЫ"
    const groupServers = groupName === ''
      ? servers.filter(s => !s.group_name)
      : servers.filter(s => s.group_name && s.group_name.split(',').map(g => g.trim()).includes(groupName));
    const selectedInGroup = groupServers.filter(s => selectedServers.includes(s.id));
    return selectedInGroup.length > 0 && selectedInGroup.length < groupServers.length;
  };
  
  const toggleGroupSelection = (groupName) => {
    // ИСПРАВЛЕНО: Правильная фильтрация для "БЕЗ ГРУППЫ" (пустая строка)
    const groupServers = groupName === '' 
      ? servers.filter(s => !s.group_name).map(s => s.id)
      : servers.filter(s => s.group_name && s.group_name.split(',').map(g => g.trim()).includes(groupName)).map(s => s.id);
    
    const allSelected = groupServers.length > 0 && groupServers.every(id => selectedServers.includes(id));
    
    if (allSelected) {
      // Убрать все серверы группы
      setSelectedServers(prev => prev.filter(id => !groupServers.includes(id)));
    } else {
      // Добавить все серверы группы
      setSelectedServers(prev => [...new Set([...prev, ...groupServers])]);
    }
  };
  
  const removeServer = (serverId) => {
    setSelectedServers(prev => prev.filter(id => id !== serverId));
  };
  
  const addServer = (serverId) => {
    setSelectedServers(prev => [...new Set([...prev, serverId])]);
  };
  
  // Группировка серверов
  const getGroupedServers = () => {
    const grouped = {};
    
    filteredServers.forEach(server => {
      // ИСПРАВЛЕНО: Используем пустую строку вместо текста "Без группы"
      const group = server.group_name || '';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(server);
    });
    
    return grouped;
  };

  // === Отправка команд ===
  const handleSendCommand = async (e) => {
    e.preventDefault();
    if (selectedServers.length === 0 || !commands.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const commandList = commands.split('\n')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0);

      if (commandList.length === 0) {
        throw new Error('Нет команд для отправки');
      }

      const selectedServersData = servers.filter(s => selectedServers.includes(s.id));
      const allResults = [];
      let totalSuccess = 0;
      let totalFailed = 0;

      for (let serverIndex = 0; serverIndex < selectedServersData.length; serverIndex++) {
        const server = selectedServersData[serverIndex];
        
        // Задержка перед отправкой на следующий бот (кроме первого)
        if (serverIndex > 0 && delayBetweenBots > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBots * 1000));
        }

        for (const cmd of commandList) {
          try {
            let finalCommand = cmd;
            if (useBotname && server.name) {
              finalCommand = `botname:${server.name} ${cmd}`;
            }

            const result = await commandsAPI.send({
              server_id: server.id,
              command: finalCommand,
              timeout: timeout
            });

            allResults.push({
              server_name: server.name,
              command: finalCommand,
              status: 'success',
              response: result.data.response
            });
            totalSuccess++;
          } catch (error) {
            allResults.push({
              server_name: server.name,
              command: useBotname ? `botname:${server.name} ${cmd}` : cmd,
              status: 'error',
              response: error.response?.data?.detail || 'Ошибка отправки'
            });
            totalFailed++;
          }
        }
      }

      setResponse({
        status: 'success',
        results: allResults,
        summary: {
          successful: totalSuccess,
          failed: totalFailed,
          total: allResults.length,
          servers: selectedServersData.length,
          commands: commandList.length
        },
        time: new Date().toLocaleString('ru-RU'),
        bulk: true
      });
      
      // Очистить редактор команд если включена галка
      if (clearAfterSend) {
        setCommands('');
      }
      
    } catch (error) {
      setResponse({
        status: 'error',
        text: error.message || error.response?.data?.detail || 'Ошибка отправки команд',
        time: new Date().toLocaleString('ru-RU')
      });
    } finally {
      setLoading(false);
    }
  };

  // === Быстрая отправка команды (без редактора) ===
  const handleQuickSend = async (command) => {
    if (selectedServers.length === 0) {
      alert('Выберите хотя бы один сервер');
      return;
    }

    setLoading(true);
    setResponse(null);
    
    try {
      const selectedServersData = servers.filter(s => selectedServers.includes(s.id));
      const allResults = [];
      
      for (let serverIndex = 0; serverIndex < selectedServersData.length; serverIndex++) {
        const server = selectedServersData[serverIndex];
        
        // Задержка между ботами
        if (serverIndex > 0 && delayBetweenBots > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBots * 1000));
        }

        let finalCommand = command;
        if (useBotname && server.name) {
          finalCommand = `botname:${server.name} ${command}`;
        }

        try {
          const result = await commandsAPI.send({
            server_id: server.id,
            command: finalCommand,
            timeout: timeout
          });

          allResults.push({
            server_name: server.name,
            command: finalCommand,
            status: 'success',
            response: result.data.response
          });
        } catch (error) {
          allResults.push({
            server_name: server.name,
            command: finalCommand,
            status: 'error',
            response: error.response?.data?.detail || 'Ошибка отправки'
          });
        }
      }
      
      // Формируем детальный ответ как в основной отправке
      let responseText = '';
      let successCount = allResults.filter(r => r.status === 'success').length;
      let errorCount = allResults.filter(r => r.status === 'error').length;
      
      responseText += `✅ Успешно: ${successCount} | ❌ Ошибок: ${errorCount}\n\n`;
      
      allResults.forEach(result => {
        const statusIcon = result.status === 'success' ? '✅' : '❌';
        responseText += `${statusIcon} [${result.server_name}] ${result.command}\n`;
        responseText += `${result.response}\n\n`;
      });
      
      setResponse({
        status: errorCount === 0 ? 'success' : (successCount === 0 ? 'error' : 'partial'),
        text: responseText.trim(),
        time: new Date().toLocaleString('ru-RU')
      });
      
    } catch (error) {
      setResponse({
        status: 'error',
        text: error.message || 'Ошибка отправки команды',
        time: new Date().toLocaleString('ru-RU')
      });
    } finally {
      setLoading(false);
    }
  };

  // === Справочник команд ===
  const filteredBotCommands = botCommands.filter(cmd => {
    const matchesFilter = 
    cmd.command.toLowerCase().includes(commandsFilter.toLowerCase()) ||
      cmd.description.toLowerCase().includes(commandsFilter.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || cmd.category === selectedCategory;
    
    return matchesFilter && matchesCategory;
  });

  const categories = ['all', ...new Set(botCommands.map(cmd => cmd.category))];

  // Функция закрытия справочника с применением выбранных команд
  const closeCommandsReference = () => {
    if (selectedCommandsFromReference.length > 0) {
      const newCommands = selectedCommandsFromReference.join('\n');
      if (commands.trim()) {
        setCommands(commands + '\n' + newCommands);
      } else {
        setCommands(newCommands);
      }
      setSelectedCommandsFromReference([]);
    }
    setShowCommandsReference(false);
  };

  return (
    <div className={styles.container}>
      {/* Условный рендеринг: показываем либо StrategyCommander, либо обычные команды */}
      {showStrategyCommander ? (
        <StrategyCommander onClose={() => setShowStrategyCommander(false)} />
      ) : (
        <>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <FiSend className={styles.icon} />
              <h1>Отправка команд</h1>
            </div>
            <div className={styles.headerActions}>
              <button 
                className={styles.strategyCommanderButton}
                onClick={() => setShowStrategyCommander(true)}
                title="Открыть MoonBot Commander Pro"
              >
                <FiSettings /> Strategy Commander
              </button>
              <button 
                onClick={() => setShowCommandsReference(!showCommandsReference)}
                className={styles.headerBtn}
              >
                <FiBook /> Справочник команд
              </button>
            </div>
          </div>

      {/* КОМПАКТНЫЙ ВЫБОР СЕРВЕРОВ С ЧЕКБОКСАМИ */}
      <div className={styles.serverSelectorCompact}>
        <div className={styles.selectorHeader}>
          <h3><FiServer /> Выбор серверов</h3>
          <div className={styles.selectorStats}>
            Выбрано: <strong>{selectedServers.length}</strong> из {servers.length}
          </div>
        </div>

        <div className={styles.selectorControls}>
          <div className={styles.searchBox}>
            <FiSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Поиск по имени, IP, группе..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select 
            value={selectedGroup} 
            onChange={(e) => setSelectedGroup(e.target.value)}
            className={styles.select}
          >
            <option value="all">Все группы</option>
            <option value="">Без группы</option>
            {groups.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>

          <div className={styles.quickActions}>
            <button onClick={selectAll} className={styles.miniBtn}>✓ Все</button>
            <button onClick={deselectAll} className={styles.miniBtn}>✗ Сбросить</button>
          </div>
        </div>

        <div className={styles.serverCheckboxList}>
          {Object.entries(getGroupedServers()).map(([groupName, groupServers]) => {
            const isFullySelected = isGroupFullySelected(groupName);
            const isPartiallySelected = isGroupPartiallySelected(groupName);
            const selectedCount = groupServers.filter(s => selectedServers.includes(s.id)).length;

            return (
              <div key={groupName} className={styles.checkboxGroup}>
                {/* Чекбокс группы */}
                <label className={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={isFullySelected}
                    ref={el => {
                      if (el) el.indeterminate = isPartiallySelected && !isFullySelected;
                    }}
                    onChange={() => toggleGroupSelection(groupName)}
                    className={styles.checkboxInput}
                  />
                  <span className={styles.checkboxLabel}>
                    <strong>{groupName === '' ? 'БЕЗ ГРУППЫ' : groupName}</strong> <span className={styles.checkboxCount}>({selectedCount}/{groupServers.length})</span>
                  </span>
                </label>

                {/* Чекбоксы серверов */}
                <div className={styles.checkboxServers}>
                  {groupServers.map(server => {
                    const isSelected = selectedServers.includes(server.id);
                    return (
                      <label key={server.id} className={styles.checkboxItem}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleServerSelection(server.id)}
                          className={styles.checkboxInput}
                        />
                        <span className={styles.checkboxLabel}>
                          {server.name} <span className={styles.checkboxDetails}>({server.host}:{server.port})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.content}>
        {/* ЛЕВАЯ ПАНЕЛЬ - ТОЛЬКО Пресеты */}
        <div className={styles.leftPanel}>
          {/* Пресеты */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3>🎯 Пресеты команд</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setShowPresetHint(!showPresetHint)}
                  className={styles.addBtn}
                  title={showPresetHint ? "Скрыть подсказку" : "Показать подсказку"}
                >
                  <FiInfo />
                </button>
                <button 
                  onClick={() => setShowPresetManager(!showPresetManager)}
                  className={styles.addBtn}
                  title="Управление пресетами"
                >
                  <FiEdit2 />
                </button>
              </div>
            </div>

            {showPresetHint && (
              <div className={styles.presetHint}>
                <strong>Как использовать:</strong><br/>
                1. Наберите команды в редакторе команд<br/>
                2. Введите название и нажмите "Сохранить"<br/>
                3. Нажмите на кнопку пресета чтобы загрузить команды<br/>
                4. Выберите серверы и отправьте
              </div>
            )}

            <div className={styles.savePresetForm}>
              <input
                type="text"
                placeholder="Название пресета"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className={styles.input}
              />
              <button 
                onClick={handleSavePreset}
                className={styles.savePresetBtn}
                disabled={!commands.trim() || !newPresetName.trim()}
              >
                <FiSave /> Сохранить как пресет
              </button>
            </div>

            <div className={styles.presetButtons}>
              {presets.map(preset => (
                <div key={preset.id} className={styles.presetWrapper}>
                  <button
                    onClick={() => handleLoadPresetToEditor(preset)}
                    className={styles.presetBtn}
                    disabled={loading}
                    title={`${preset.name}\n\nНажмите чтобы загрузить команды:\n${preset.commands}`}
                  >
                    {preset.button_number}
                  </button>
                  <div className={styles.presetLabel}>{preset.name}</div>
                </div>
              ))}
            </div>

            {showPresetManager && (
              <div className={styles.presetManager}>
                <h4>Управление пресетами</h4>
                {presets.map(preset => (
                  <div key={preset.id} className={styles.presetManagerItem}>
                    <div className={styles.presetInfo}>
                      <strong>{preset.button_number}. {preset.name}</strong>
                      <pre className={styles.presetCommands}>{preset.commands}</pre>
                    </div>
                    <div className={styles.presetActions}>
                      <button 
                        onClick={() => handleLoadPresetToEditor(preset)}
                        className={styles.loadBtn}
                        title="Загрузить в редактор"
                      >
                        Загрузить
                      </button>
                      <button 
                        onClick={() => {
                          setEditingPreset(preset);
                          setPresetValidationError('');
                        }}
                        className={styles.editBtn}
                        title="Редактировать"
                      >
                        <FiEdit2 />
                      </button>
                      <button 
                        onClick={() => handleDeletePreset(preset.id)}
                        className={styles.deleteBtn}
                        title="Удалить"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>

        {/* ПРАВО - Редактор команд + Результаты */}
        <div className={styles.commandPanel}>
          <div className={styles.topControlsRow}>
            <label className={styles.botnameCheckbox}>
              <input
                type="checkbox"
                checked={useBotname}
                onChange={(e) => setUseBotname(e.target.checked)}
              />
              <span>Префикс <code>botname:</code></span>
            </label>

            <div className={styles.delayInputWrapper}>
              <label 
                title="Задержка между отправкой команд на разные боты (применяется только если выбрано больше 1 бота)"
                style={{ cursor: 'help' }}
              >
                Задержка отправки команд (сек):
              </label>
              <input
                type="text"
                value={delayBetweenBots}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, ''); // Только цифры
                  if (value === '') {
                    setDelayBetweenBots(0); // Пустое поле = 0
                  } else {
                    const numValue = parseInt(value);
                    if (numValue >= 0 && numValue <= 9999) {
                      setDelayBetweenBots(numValue);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  // Запрещаем ввод минуса и других специальных символов
                  if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E' || e.key === '.' || e.key === ',') {
                    e.preventDefault();
                  }
                }}
                maxLength="4"
                className={styles.delayInput}
                disabled={loading}
                placeholder="0"
                title="Задержка между отправкой команд на разные боты"
              />
            </div>
          </div>

          <form onSubmit={handleSendCommand} className={styles.form}>

          <div className={styles.formGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label>Редактор команд (каждая с новой строки)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={clearAfterSend}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setClearAfterSend(newValue);
                        localStorage.setItem('clearAfterSend', newValue.toString());
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Очищать после отправки</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCommands('')}
                    className={styles.clearBtn}
                    title="Очистить редактор"
                    disabled={loading || !commands.trim()}
                  >
                    <FiX /> Очистить
                  </button>
                </div>
              </div>
            <textarea
                value={commands}
                onChange={(e) => {
                  // Ограничение: максимум 100,000 символов (защита от DoS)
                  if (e.target.value.length <= 100000) {
                    setCommands(e.target.value);
                  }
                }}
                placeholder="list&#10;report&#10;START"
                className={styles.textarea}
                disabled={loading}
              rows={6}
            />
          </div>

            <button
              type="submit"
              className={styles.sendButton}
              disabled={loading || selectedServers.length === 0 || !commands.trim()}
            >
              {loading ? 'Отправка...' : `Отправить (${selectedServers.length * commands.split('\n').filter(c => c.trim()).length})`}
            </button>
          </form>

          {/* Результаты */}
          {response && (
            <div className={`${styles.response} ${styles[response.status]}`}>
              <div className={styles.responseHeader}>
                <strong>{response.presetName ? `Пресет: ${response.presetName}` : 'Результат'}</strong>
                <span className={styles.responseTime}>{response.time}</span>
              </div>

              {response.bulk && response.results ? (
                <>
                  <div className={styles.summary}>
                    <div>✓ Успешно: {response.summary.successful}</div>
                    <div>✗ Ошибок: {response.summary.failed}</div>
                    <div>Всего: {response.summary.total}</div>
                  </div>

                  <div className={styles.bulkResults}>
                    {response.results.map((result, index) => (
                      <div key={index} className={`${styles.bulkResult} ${styles[result.status]}`}>
                        <div className={styles.bulkResultHeader}>
                          <div>
                            <strong>{result.server_name}</strong>
                            <div><code>{result.command}</code></div>
                          </div>
                          <span>{result.status === 'success' ? '✓' : '✗'}</span>
                        </div>
                        <pre className={styles.bulkResultText}>{result.response}</pre>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <pre className={styles.responseText}>{response.text}</pre>
              )}
            </div>
          )}
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ - Конструктор + Быстрые команды */}
        <div className={styles.rightPanel}>
          {/* Конструктор команд */}
          <div className={styles.constructor}>
            <h4><FiTool /> Конструктор команд</h4>
            
            <div className={styles.constructorButtons}>
              {CONSTRUCTOR_COMMANDS.map((cmd) => (
              <button
                  key={cmd.id}
                  onClick={() => handleConstructorSelect(cmd)}
                  className={`${styles.constructorBtn} ${selectedConstructor?.id === cmd.id ? styles.active : ''}`}
                  title={cmd.desc}
                >
                  {cmd.name}
              </button>
              ))}
            </div>

            {selectedConstructor && (
              <div className={styles.constructorForm}>
                <div className={styles.constructorHeader}>
                  <strong>{selectedConstructor.name}</strong>
                  <span>{selectedConstructor.desc}</span>
                  </div>

                <div className={styles.constructorFields}>
                  {selectedConstructor.fields.map((field) => (
                    <div key={field.name} className={styles.constructorField}>
                      <label>
                        {field.label}
                        {field.optional && <span className={styles.optional}> (опционально)</span>}
                      </label>
                      <div className={styles.autocompleteWrapper}>
                        <input
                          type="text"
                          value={constructorValues[field.name] || ''}
                          onChange={(e) => handleConstructorValueChange(field.name, e.target.value)}
                          onFocus={() => {
                            if (field.name === 'param' && selectedConstructor?.id === 'SetParam' && constructorValues[field.name]) {
                              const filtered = STRATEGY_PARAMS.filter(param => 
                                param.toLowerCase().includes(constructorValues[field.name].toLowerCase())
                              ).slice(0, 10);
                              if (filtered.length > 0) {
                                setFilteredParams(filtered);
                                setShowParamAutocomplete(true);
                              }
                            }
                          }}
                          placeholder={field.placeholder}
                          className={styles.input}
                        />
                        {field.name === 'param' && selectedConstructor?.id === 'SetParam' && showParamAutocomplete && filteredParams.length > 0 && (
                          <div className={styles.autocompleteDropdown}>
                            {filteredParams.map((param, index) => (
                              <div
                                key={index}
                                className={styles.autocompleteItem}
                                onClick={() => selectParam(param)}
                              >
                                {param}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={buildCommandFromConstructor}
                  className={styles.constructorAddBtn}
                >
                  ➕ Добавить команду
                </button>
              </div>
            )}
          </div>

          {/* Быстрые команды */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3>⚡ Быстрые команды</h3>
                  <button
                onClick={() => setShowAddQuickCmd(!showAddQuickCmd)}
                className={styles.addBtn}
                title="Добавить команду"
              >
                <FiPlus />
                    </button>
      </div>

            {showAddQuickCmd && (
              <div className={styles.addForm}>
              <input
                type="text"
                  placeholder="Название (START, REPORT...)"
                  value={newQuickCmd.label}
                  onChange={(e) => setNewQuickCmd({...newQuickCmd, label: e.target.value})}
                className={styles.input}
              />
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Команда"
                  value={newQuickCmd.command}
                  onChange={(e) => handleCommandInput(e.target.value, 'new')}
                  onKeyDown={(e) => handleCommandKeyDown(e, 'new')}
                  className={styles.input}
                  autoComplete="off"
                />
                {showCommandSuggestions && activeSuggestionField === 'new' && commandSuggestions.length > 0 && (
                  <div className={styles.suggestionsDropdown}>
                    {commandSuggestions.map((cmd, index) => (
                      <div
                        key={index}
                        className={`${styles.suggestionItem} ${index === selectedSuggestionIndex ? styles.suggestionItemActive : ''}`}
                        onClick={() => selectCommandSuggestion(cmd.command)}
                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      >
                        <strong>{cmd.command}</strong>
                        <small>{cmd.description}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
                <div className={styles.formButtons}>
                  <button onClick={handleAddQuickCommand} className={styles.saveBtn}>
                <FiSave /> Сохранить
              </button>
                  <button onClick={() => {
                    setShowAddQuickCmd(false);
                    setShowCommandSuggestions(false);
                  }} className={styles.cancelBtn}>
                <FiX /> Отмена
              </button>
          </div>
        </div>
      )}

            <div className={styles.quickCommandsList}>
              {quickCommands.length === 0 ? (
                <div className={styles.emptyState}>Нет сохраненных команд</div>
              ) : (
                quickCommands.map(qc => (
                  <div key={qc.id} className={styles.quickCommandItem}>
                    {editingQuickCmd?.id === qc.id ? (
                      <div className={styles.editForm}>
              <input
                type="text"
                          value={editingQuickCmd.label}
                          onChange={(e) => setEditingQuickCmd({...editingQuickCmd, label: e.target.value})}
                className={styles.input}
              />
              <div style={{ position: 'relative' }}>
                <input
                          type="text"
                          value={editingQuickCmd.command}
                          onChange={(e) => handleCommandInput(e.target.value, 'edit')}
                          onKeyDown={(e) => handleCommandKeyDown(e, 'edit')}
                className={styles.input}
                          autoComplete="off"
              />
                        {showCommandSuggestions && activeSuggestionField === 'edit' && commandSuggestions.length > 0 && (
                          <div className={styles.suggestionsDropdown}>
                            {commandSuggestions.map((cmd, index) => (
                              <div
                                key={index}
                                className={`${styles.suggestionItem} ${index === selectedSuggestionIndex ? styles.suggestionItemActive : ''}`}
                                onClick={() => selectCommandSuggestion(cmd.command)}
                                onMouseEnter={() => setSelectedSuggestionIndex(index)}
                              >
                                <strong>{cmd.command}</strong>
                                <small>{cmd.description}</small>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                        <div className={styles.formButtons}>
                          <button onClick={handleUpdateQuickCommand} className={styles.saveBtn}>
                            <FiSave />
                          </button>
                          <button onClick={() => {
                            setEditingQuickCmd(null);
                            setShowCommandSuggestions(false);
                          }} className={styles.cancelBtn}>
                            <FiX />
                          </button>
            </div>
            </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleQuickSend(qc.command)}
                          className={styles.quickCmdBtn}
                          title={qc.command}
                        >
                          {qc.label}
              </button>
                        <div className={styles.quickCmdActions}>
                          <button onClick={() => setEditingQuickCmd(qc)} className={styles.iconBtn}>
                            <FiEdit2 />
                          </button>
                          <button onClick={() => handleDeleteQuickCommand(qc.id)} className={styles.iconBtn}>
                            <FiTrash2 />
              </button>
            </div>
                      </>
                    )}
          </div>
                ))
      )}
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно справочника */}
      {showCommandsReference && (
        <div 
          className={styles.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              closeCommandsReference();
            }
          }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>
                📚 Справочник команд MoonBot
                {selectedCommandsFromReference.length > 0 && (
                  <span style={{ 
                    marginLeft: '10px', 
                    fontSize: '0.9rem', 
                    color: '#00ff88',
                    fontWeight: 'normal'
                  }}>
                    (Выбрано: {selectedCommandsFromReference.length})
                  </span>
                )}
              </h2>
              <button onClick={closeCommandsReference} className={styles.closeBtn}>
                <FiX />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.referenceFilters}>
              <input
                type="text"
                  placeholder="Поиск..."
                value={commandsFilter}
                onChange={(e) => setCommandsFilter(e.target.value)}
                className={styles.input}
              />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={styles.select}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'Все категории' : cat}
                    </option>
                  ))}
                </select>
            </div>

            <div className={styles.commandsReference}>
                {filteredBotCommands.length === 0 ? (
                  <div className={styles.emptyState}>Команды не найдены</div>
                ) : (
                  filteredBotCommands.map((cmd, index) => (
                    <div key={index} className={styles.referenceItem}>
                      <div className={styles.referenceHeader}>
                        <code className={styles.referenceCommand}>{cmd.command}</code>
                        <span className={styles.referenceCategory}>{cmd.category}</span>
                      </div>
                      <div className={styles.referenceDescription}>{cmd.description}</div>
                      {cmd.example && (
                        <div className={styles.referenceExample}>
                          <small>Пример: <code>{cmd.example}</code></small>
                        </div>
                      )}
                      <div className={styles.referenceActions}>
                        <button
                          onClick={() => {
                            const commandToUse = cmd.example || cmd.command;
                            // Добавляем/удаляем команду из выбранных
                            if (selectedCommandsFromReference.includes(commandToUse)) {
                              setSelectedCommandsFromReference(
                                selectedCommandsFromReference.filter(c => c !== commandToUse)
                              );
                            } else {
                              setSelectedCommandsFromReference([...selectedCommandsFromReference, commandToUse]);
                            }
                          }}
                          className={`${styles.useExampleBtn} ${
                            selectedCommandsFromReference.includes(cmd.example || cmd.command) 
                              ? styles.useExampleBtnSelected 
                              : ''
                          }`}
                        >
                          {selectedCommandsFromReference.includes(cmd.example || cmd.command) 
                            ? '✓ Выбрана' 
                            : 'Использовать'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
                  </div>
                </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования пресета */}
      {editingPreset && (
        <div 
          className={styles.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setEditingPreset(null);
            }
          }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>✏️ Редактировать пресет</h2>
              <button onClick={() => {
                setEditingPreset(null);
                setPresetValidationError('');
              }} className={styles.closeBtn}>
                <FiX />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Название пресета</label>
                <input
                  type="text"
                  value={editingPreset.name}
                  onChange={(e) => setEditingPreset({...editingPreset, name: e.target.value})}
                  className={styles.input}
                  placeholder="Название"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Редактор команд (каждая с новой строки)</label>
                <textarea
                  value={editingPreset.commands}
                  onChange={(e) => setEditingPreset({...editingPreset, commands: e.target.value})}
                  className={styles.textarea}
                  placeholder="START&#10;list&#10;report"
                  rows={8}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Номер кнопки *</label>
                <input
                  type="number"
                  value={editingPreset.button_number || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setEditingPreset({...editingPreset, button_number: ''});
                    } else {
                      const num = parseInt(value);
                      if (num > 0 && num <= 50) {
                        setEditingPreset({...editingPreset, button_number: num});
                        setPresetValidationError('');
                      }
                    }
                  }}
                  className={styles.input}
                  placeholder="От 1 до 50"
                  min="1"
                  max="50"
                  required
                />
                <small style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Обязательное поле. Введите число от 1 до 50
                </small>
              </div>

              {presetValidationError && (
                <div style={{ 
                  padding: '12px', 
                  background: 'rgba(255, 68, 68, 0.1)', 
                  border: '1px solid rgba(255, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#ff4444',
                  marginBottom: '15px'
                }}>
                  ⚠️ {presetValidationError}
                </div>
              )}

              <div className={styles.modalActions}>
                <button 
                  onClick={() => {
                    // Валидация названия
                    if (!editingPreset.name.trim()) {
                      setPresetValidationError('Название пресета не может быть пустым');
                      return;
                    }
                    
                    // Валидация команд
                    if (!editingPreset.commands.trim()) {
                      setPresetValidationError('Редактор команд не может быть пустым');
                      return;
                    }
                    
                    // Валидация номера кнопки
                    const buttonNum = parseInt(editingPreset.button_number);
                    if (!editingPreset.button_number || isNaN(buttonNum) || buttonNum < 1 || buttonNum > 50) {
                      setPresetValidationError('Номер кнопки должен быть числом от 1 до 50');
                      return;
                    }
                    
                    // Все проверки пройдены - сохраняем
                    setPresetValidationError('');
                    handleUpdatePreset(editingPreset.id, {
                      name: editingPreset.name,
                      commands: editingPreset.commands,
                      button_number: buttonNum
                    });
                  }}
                  className={styles.saveBtn}
                >
                  <FiSave /> Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default CommandsNew;
