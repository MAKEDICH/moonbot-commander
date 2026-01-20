/**
 * Константы для страницы CommandsNew
 */

// Параметры стратегий для автокомплита
export const STRATEGY_PARAMS = [
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
export const CONSTRUCTOR_COMMANDS = [
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
  }
];

// Команды по умолчанию (только разовые, без параметров)
export const DEFAULT_QUICK_COMMANDS = [
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
  { label: 'Сбросить профит', command: 'ResetLoss' }
];





