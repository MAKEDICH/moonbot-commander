import React from 'react';
import { FaFire, FaExclamationTriangle, FaBolt, FaTrophy, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import styles from '../../pages/TradingStats.module.css';
import AnimatedCounter from './AnimatedCounter';
import Sparkline from './Sparkline';

/**
 * Индикатор изменения (стрелка вверх/вниз)
 */
export const ChangeIndicator = ({ value, showPercent = true, invertColors = false }) => {
  if (!value || value === 0) return null;
  
  const isPositive = value > 0;
  const displayPositive = invertColors ? !isPositive : isPositive;
  const icon = isPositive ? <FaArrowUp /> : <FaArrowDown />;
  const className = displayPositive ? styles.changePositive : styles.changeNegative;
  
  return (
    <span className={`${styles.changeIndicator} ${className}`}>
      {icon} {Math.abs(value).toFixed(showPercent ? 1 : 2)}{showPercent ? '%' : ''}
    </span>
  );
};

/**
 * Горячие индикаторы
 */
export const HotIndicators = ({ by_strategy, by_symbol, by_server, winrateGrowth }) => {
  const hotStrategy = by_strategy.length > 0 ? by_strategy[0] : null;
  const problemSymbol = by_symbol.filter(s => s.total_profit < 0).slice().sort((a, b) => a.total_profit - b.total_profit)[0];
  const mostActiveServer = by_server.slice().sort((a, b) => b.total_orders - a.total_orders)[0];
  
  if (!hotStrategy && !problemSymbol && !mostActiveServer) return null;
  
  return (
    <div className={styles.hotIndicators}>
      {hotStrategy && (
        <div className={`${styles.hotCard} ${styles.hotSuccess}`}>
          <FaFire className={styles.hotIcon} />
          <div>
            <div className={styles.hotLabel}>Горячая стратегия</div>
            <div className={styles.hotValue}>{hotStrategy.strategy}</div>
            <div className={styles.hotSubtext}>
              {hotStrategy.total_profit > 0 ? '+' : ''}{hotStrategy.total_profit.toFixed(2)} USDT
            </div>
          </div>
        </div>
      )}
      
      {problemSymbol && (
        <div className={`${styles.hotCard} ${styles.hotWarning}`}>
          <FaExclamationTriangle className={styles.hotIcon} />
          <div>
            <div className={styles.hotLabel}>Проблемная монета</div>
            <div className={styles.hotValue}>{problemSymbol.symbol}</div>
            <div className={styles.hotSubtext}>
              {problemSymbol.total_profit.toFixed(2)} USDT
            </div>
          </div>
        </div>
      )}
      
      {mostActiveServer && (
        <div className={`${styles.hotCard} ${styles.hotInfo}`}>
          <FaBolt className={styles.hotIcon} />
          <div>
            <div className={styles.hotLabel}>Активный бот</div>
            <div className={styles.hotValue}>{mostActiveServer.server_name}</div>
            <div className={styles.hotSubtext}>
              {mostActiveServer.total_orders} сделок
            </div>
          </div>
        </div>
      )}
      
      {winrateGrowth && Math.abs(winrateGrowth.change) > 1 && (
        <div className={`${styles.hotCard} ${winrateGrowth.change > 0 ? styles.hotSuccess : styles.hotWarning}`}>
          <FaTrophy className={styles.hotIcon} />
          <div>
            <div className={styles.hotLabel}>Рост винрейта</div>
            <div className={styles.hotValue}>
              {winrateGrowth.change > 0 ? '+' : ''}{winrateGrowth.change.toFixed(1)}%
            </div>
            <div className={styles.hotSubtext}>
              За последнюю неделю
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Основные метрики
 */
export const MainMetrics = ({ overall, sparklineData }) => {
  return (
    <div className={styles.statsGrid}>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>📊 Сделок</div>
        <div className={styles.statValue}>
          <AnimatedCounter value={overall.total_orders || 0} decimals={0} />
        </div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>🟢 Открыто</div>
        <div className={styles.statValue}>
          <AnimatedCounter value={overall.open_orders || 0} decimals={0} />
        </div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>🔴 Закрыто</div>
        <div className={styles.statValue}>
          <AnimatedCounter value={overall.closed_orders || 0} decimals={0} />
        </div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>💰 Прибыль</div>
        <div className={`${styles.statValue} ${(overall.total_profit || 0) >= 0 ? styles.positive : styles.negative}`}>
          <AnimatedCounter value={overall.total_profit || 0} decimals={2} suffix=" USDT" />
        </div>
        {sparklineData.length > 0 && <Sparkline data={sparklineData} height={20} />}
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>📈 Средняя</div>
        <div className={`${styles.statValue} ${(overall.avg_profit || 0) >= 0 ? styles.positive : styles.negative}`}>
          <AnimatedCounter value={overall.avg_profit || 0} decimals={2} suffix=" USDT" />
        </div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>✅ Прибыль</div>
        <div className={`${styles.statValue} ${styles.positive}`}>
          <AnimatedCounter value={overall.profitable_count || 0} decimals={0} />
        </div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>❌ Убыток</div>
        <div className={`${styles.statValue} ${styles.negative}`}>
          <AnimatedCounter value={overall.losing_count || 0} decimals={0} />
        </div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>🎯 Винрейт</div>
        <div className={`${styles.statValue} ${(overall.winrate || 0) >= 50 ? styles.positive : styles.negative}`}>
          <AnimatedCounter value={overall.winrate || 0} decimals={1} suffix="%" />
        </div>
      </div>
    </div>
  );
};

/**
 * Расширенные метрики
 */
export const ExtendedMetrics = ({ overall }) => {
  return (
    <div className={styles.section}>
      <h2>📊 Расширенные метрики</h2>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>⚖️ Profit Factor</div>
          <div className={`${styles.statValue} ${(overall.profit_factor || 0) > 1 ? styles.positive : styles.negative}`}>
            <AnimatedCounter value={overall.profit_factor || 0} decimals={2} />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>📉 Drawdown</div>
          <div className={`${styles.statValue} ${styles.negative}`}>
            <AnimatedCounter value={overall.max_drawdown || 0} decimals={2} suffix=" USDT" />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>⏱️ Длительность</div>
          <div className={styles.statValue}>
            <AnimatedCounter value={overall.avg_duration_hours || 0} decimals={1} suffix="ч" />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>💎 ROI</div>
          <div className={`${styles.statValue} ${(overall.roi || 0) >= 0 ? styles.positive : styles.negative}`}>
            <AnimatedCounter value={overall.roi || 0} decimals={1} suffix="%" />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>🔥 Серия побед</div>
          <div className={`${styles.statValue} ${styles.positive}`}>
            <AnimatedCounter value={overall.max_win_streak || 0} decimals={0} />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>❄️ Серия потерь</div>
          <div className={`${styles.statValue} ${styles.negative}`}>
            <AnimatedCounter value={overall.max_loss_streak || 0} decimals={0} />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * AI Инсайты
 */
export const AIInsights = ({ overall, by_strategy, by_symbol, by_server }) => {
  if (overall.total_orders === 0) return null;
  
  return (
    <div className={styles.section}>
      <h2>💡 Автоматические инсайты</h2>
      <div className={styles.insightsGrid}>
        {by_strategy.length > 0 && by_strategy[0].winrate > 0 && (
          <div className={styles.insightCard}>
            <div className={styles.insightIcon}>🎯</div>
            <div className={styles.insightText}>
              Стратегия <strong>{by_strategy[0].strategy}</strong> показывает лучший винрейт <strong>{by_strategy[0].winrate.toFixed(1)}%</strong>
            </div>
          </div>
        )}
        
        {by_symbol.length > 0 && overall.total_profit !== 0 && (
          <div className={styles.insightCard}>
            <div className={styles.insightIcon}>💰</div>
            <div className={styles.insightText}>
              <strong>{by_symbol[0].symbol}</strong> принесла {Math.abs((by_symbol[0].total_profit / overall.total_profit) * 100).toFixed(0)}% 
              {by_symbol[0].total_profit >= 0 ? ' прибыли' : ' убытков'}
            </div>
          </div>
        )}
        
        {by_server.length > 0 && (
          <div className={styles.insightCard}>
            <div className={styles.insightIcon}>🤖</div>
            <div className={styles.insightText}>
              Бот <strong>{by_server[0].server_name}</strong> имеет самую высокую активность с <strong>{by_server[0].total_orders}</strong> сделками
            </div>
          </div>
        )}
        
        {overall.avg_duration_hours > 0 && (
          <div className={styles.insightCard}>
            <div className={styles.insightIcon}>⏱️</div>
            <div className={styles.insightText}>
              Средняя прибыльная сделка длится <strong>{overall.avg_duration_hours.toFixed(1)} часов</strong>
            </div>
          </div>
        )}
        
        {overall.profit_factor > 0 && (
          <div className={styles.insightCard}>
            <div className={styles.insightIcon}>
              {overall.profit_factor > 2 ? '🏆' : overall.profit_factor > 1 ? '✅' : '⚠️'}
            </div>
            <div className={styles.insightText}>
              Profit Factor <strong>{overall.profit_factor.toFixed(2)}</strong> - 
              {overall.profit_factor > 2 ? ' отличный результат!' : 
               overall.profit_factor > 1 ? ' хороший результат' : 
               ' требуется оптимизация'}
            </div>
          </div>
        )}
        
        {overall.max_win_streak > 3 && (
          <div className={styles.insightCard}>
            <div className={styles.insightIcon}>🔥</div>
            <div className={styles.insightText}>
              Лучшая серия: <strong>{overall.max_win_streak}</strong> прибыльных сделок подряд
            </div>
          </div>
        )}
      </div>
    </div>
  );
};




