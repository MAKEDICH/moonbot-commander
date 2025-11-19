import React, { useState, useEffect, useRef } from 'react';
import { FiClock, FiServer, FiTrash2, FiCheckCircle, FiXCircle, FiSearch } from 'react-icons/fi';
import { commandsAPI, serversAPI, botCommandsAPI } from '../api/api';
import styles from './History.module.css';
import commonStyles from '../styles/common.module.css';
import { useNotification } from '../context/NotificationContext';

// Параметры стратегий для автокомплита (из CommandsNew.jsx)
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

const History = () => {
  const { confirm, showError } = useNotification();
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState('all');
  const [loading, setLoading] = useState(true);
  
  // Поиск
  const [searchCommand, setSearchCommand] = useState('');
  const [searchParams, setSearchParams] = useState('');
  const [commandSuggestions, setCommandSuggestions] = useState([]);
  const [paramSuggestions, setParamSuggestions] = useState([]);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [showParamSuggestions, setShowParamSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [activeParamSuggestionIndex, setActiveParamSuggestionIndex] = useState(-1);
  const [allCommands, setAllCommands] = useState([]);
  
  const commandInputRef = useRef(null);
  const paramInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const paramSuggestionsRef = useRef(null);

  useEffect(() => {
    loadData();
    loadCommands();
  }, [selectedServer]);
  
  // Фильтрация истории при изменении поисковых запросов
  useEffect(() => {
    filterHistory();
  }, [searchCommand, searchParams, history]);
  
  // Автоподсказки при вводе команды
  useEffect(() => {
    if (searchCommand.trim() === '') {
      setCommandSuggestions([]);
      setShowCommandSuggestions(false);
      return;
    }
    
    const filtered = allCommands.filter(cmd => 
      cmd.command.toLowerCase().includes(searchCommand.toLowerCase())
    );
    
    setCommandSuggestions(filtered);
    setShowCommandSuggestions(filtered.length > 0);
    setActiveSuggestionIndex(-1);
  }, [searchCommand, allCommands]);
  
  // Автоподсказки при вводе параметра
  useEffect(() => {
    if (searchParams.trim() === '') {
      setParamSuggestions([]);
      setShowParamSuggestions(false);
      return;
    }
    
    const filtered = STRATEGY_PARAMS.filter(param => 
      param.toLowerCase().includes(searchParams.toLowerCase())
    );
    
    setParamSuggestions(filtered);
    setShowParamSuggestions(filtered.length > 0);
    setActiveParamSuggestionIndex(-1);
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [historyResponse, serversResponse] = await Promise.all([
        commandsAPI.getHistory(selectedServer === 'all' ? null : Number(selectedServer), 100),
        serversAPI.getAll()
      ]);
      setHistory(historyResponse.data);
      setFilteredHistory(historyResponse.data);
      setServers(serversResponse.data);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadCommands = async () => {
    try {
      const response = await botCommandsAPI.getAll();
      setAllCommands(response.data);
    } catch (error) {
      console.error('Error loading commands:', error);
    }
  };
  
  const filterHistory = () => {
    let filtered = [...history];
    
    // Фильтр по команде
    if (searchCommand.trim()) {
      filtered = filtered.filter(item => 
        item.command.toLowerCase().includes(searchCommand.toLowerCase())
      );
    }
    
    // Фильтр по параметрам (поиск внутри текста команды)
    if (searchParams.trim()) {
      filtered = filtered.filter(item => 
        item.command.toLowerCase().includes(searchParams.toLowerCase())
      );
    }
    
    setFilteredHistory(filtered);
  };
  
  const handleCommandSelect = (command) => {
    setSearchCommand(command);
    setShowCommandSuggestions(false);
    setActiveSuggestionIndex(-1);
  };
  
  const handleParamSelect = (param) => {
    setSearchParams(param);
    setShowParamSuggestions(false);
    setActiveParamSuggestionIndex(-1);
  };
  
  const handleCommandKeyDown = (e) => {
    if (!showCommandSuggestions) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev < commandSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault();
      handleCommandSelect(commandSuggestions[activeSuggestionIndex].command);
    } else if (e.key === 'Escape') {
      setShowCommandSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };
  
  const handleParamKeyDown = (e) => {
    if (!showParamSuggestions) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveParamSuggestionIndex(prev => 
        prev < paramSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveParamSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && activeParamSuggestionIndex >= 0) {
      e.preventDefault();
      handleParamSelect(paramSuggestions[activeParamSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowParamSuggestions(false);
      setActiveParamSuggestionIndex(-1);
    }
  };
  
  const handleClearSearch = () => {
    setSearchCommand('');
    setSearchParams('');
  };

  const handleClearHistory = async () => {
    const confirmed = await confirm('Вы уверены, что хотите очистить историю команд?');
    if (!confirmed) return;
    
    try {
      await commandsAPI.clearHistory(selectedServer === 'all' ? null : Number(selectedServer));
      await loadData();
    } catch (error) {
      showError('Ошибка очистки истории');
    }
  };

  const getServerName = (serverId) => {
    const server = servers.find(s => s.id === serverId);
    return server ? server.name : 'Неизвестный сервер';
  };

  return (
    <div className={styles.history}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>История команд</h1>
          <p className={styles.subtitle}>Просмотр всех отправленных команд и ответов</p>
        </div>
        <button className={styles.clearBtn} onClick={handleClearHistory}>
          <FiTrash2 />
          Очистить историю
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <FiServer />
          <select 
            value={selectedServer} 
            onChange={(e) => setSelectedServer(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">Все серверы</option>
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Поиск по командам */}
        <div className={styles.searchGroup}>
          <div className={styles.searchWrapper}>
            <input
              ref={commandInputRef}
              type="text"
              placeholder="Поиск по команде (например: start, stop, report)"
              value={searchCommand}
              onChange={(e) => setSearchCommand(e.target.value)}
              onKeyDown={handleCommandKeyDown}
              onFocus={() => searchCommand && setShowCommandSuggestions(true)}
              onBlur={() => setTimeout(() => setShowCommandSuggestions(false), 200)}
              className={styles.searchInput}
            />
            <FiSearch className={styles.searchIcon} />
            {searchCommand && (
              <button 
                onClick={() => setSearchCommand('')} 
                className={styles.clearSearchBtn}
                title="Очистить"
              >
                ×
              </button>
            )}
            
            {/* Автоподсказки для команд */}
            {showCommandSuggestions && commandSuggestions.length > 0 && (
              <div ref={suggestionsRef} className={styles.suggestions}>
                {commandSuggestions.map((cmd, index) => (
                  <div
                    key={cmd.id}
                    className={`${styles.suggestionItem} ${index === activeSuggestionIndex ? styles.active : ''}`}
                    onClick={() => handleCommandSelect(cmd.command)}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                  >
                    <div className={styles.suggestionCommand}>{cmd.command}</div>
                    {cmd.description && (
                      <div className={styles.suggestionDesc}>{cmd.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Поиск по параметрам */}
        <div className={styles.searchGroup}>
          <div className={styles.searchWrapper}>
            <input
              ref={paramInputRef}
              type="text"
              placeholder="Поиск по параметрам (например: OrderSize, StopLoss, BuyDelay)"
              value={searchParams}
              onChange={(e) => setSearchParams(e.target.value)}
              onKeyDown={handleParamKeyDown}
              onFocus={() => searchParams && setShowParamSuggestions(true)}
              onBlur={() => setTimeout(() => setShowParamSuggestions(false), 200)}
              className={styles.searchInput}
            />
            <FiSearch className={styles.searchIcon} />
            {searchParams && (
              <button 
                onClick={() => setSearchParams('')} 
                className={styles.clearSearchBtn}
                title="Очистить"
              >
                ×
              </button>
            )}
            
            {/* Автоподсказки для параметров */}
            {showParamSuggestions && paramSuggestions.length > 0 && (
              <div ref={paramSuggestionsRef} className={styles.suggestions}>
                {paramSuggestions.map((param, index) => (
                  <div
                    key={index}
                    className={`${styles.suggestionItem} ${index === activeParamSuggestionIndex ? styles.active : ''}`}
                    onClick={() => handleParamSelect(param)}
                    onMouseEnter={() => setActiveParamSuggestionIndex(index)}
                  >
                    <div className={styles.suggestionCommand}>{param}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.totalCount}>
          {searchCommand || searchParams ? (
            <>Найдено: {filteredHistory.length} из {history.length}</>
          ) : (
            <>Всего записей: {history.length}</>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : filteredHistory.length === 0 ? (
        <div className={styles.emptyState}>
          <FiClock />
          {searchCommand || searchParams ? (
            <>
              <p>Ничего не найдено</p>
              <p className={styles.emptySubtext}>
                Попробуйте изменить условия поиска
              </p>
              <button onClick={handleClearSearch} className={styles.clearSearchButton}>
                Очистить поиск
              </button>
            </>
          ) : (
            <>
              <p>История команд пуста</p>
              <p className={styles.emptySubtext}>
                Отправьте команду в разделе "Команды" для начала работы
              </p>
            </>
          )}
        </div>
      ) : (
        <div className={styles.historyList}>
          {filteredHistory.map((item) => (
            <div key={item.id} className={styles.historyItem}>
              <div className={styles.itemHeader}>
                <div className={styles.itemServer}>
                  <FiServer />
                  {getServerName(item.server_id)}
                </div>
                <div className={styles.itemTime}>
                  {new Date(item.execution_time).toLocaleString('ru-RU')}
                </div>
                <div className={`${styles.itemStatus} ${item.status === 'success' ? styles.success : styles.error}`}>
                  {item.status === 'success' ? <FiCheckCircle /> : <FiXCircle />}
                  {item.status === 'success' ? 'Успешно' : 'Ошибка'}
                </div>
              </div>

              <div className={styles.itemCommand}>
                <div className={styles.commandLabel}>Команда:</div>
                <div className={styles.commandText}>{item.command}</div>
              </div>

              {item.response && (
                <div className={styles.itemResponse}>
                  <div className={styles.responseLabel}>Ответ:</div>
                  <div className={styles.responseText}>{item.response}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;



