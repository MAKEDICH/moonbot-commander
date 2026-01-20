/**
 * Секция справочника команд MoonBot
 */
import React from 'react';
import { FiList } from 'react-icons/fi';
import styles from '../Documentation.module.css';
import { SectionHeader, CommandCategory } from '../components/DocComponents';

const CommandsRefSection = () => (
  <div className={styles.section}>
    <SectionHeader icon={<FiList />} title="Справочник команд MoonBot" subtitle="Полный список всех доступных команд" />
    
    <div className={styles.commandCategories}>
      <CommandCategory 
        title="🛒 Торговля" 
        commands={[
          { cmd: 'buy BTC', desc: 'Купить монету по правилам стратегии' },
          { cmd: 'short ETH', desc: 'Открыть шорт (фьючерсы)' },
          { cmd: 'sell NEO', desc: 'Паник Селл на указанной монете' },
          { cmd: 'SellALL', desc: 'Паник Селл на ВСЕХ ордерах + STOP' },
          { cmd: 'CancelBuy', desc: 'Отменить все неисполненные BUY ордера' },
          { cmd: 'SellPiece BTC', desc: 'Продать часть позиции (если SellPiece ≠ 0)' },
        ]}
      />

      <CommandCategory 
        title="📊 Информация" 
        commands={[
          { cmd: 'list', desc: 'Список активных ордеров на продажу' },
          { cmd: 'lst', desc: 'Список ордеров (короткий формат)' },
          { cmd: 'BL', desc: 'Показать чёрный список монет' },
          { cmd: 'report', desc: 'Отчёт за сегодня' },
          { cmd: 'report 7 days', desc: 'Отчёт за последние 7 дней' },
        ]}
      />

      <CommandCategory 
        title="⚙️ Управление" 
        commands={[
          { cmd: 'START', desc: 'Запустить стратегии (кнопка Старт)' },
          { cmd: 'STOP', desc: 'Остановить покупки (кнопка Стоп)' },
          { cmd: 'sgStart MyStrategy', desc: 'Запустить конкретную стратегию' },
          { cmd: 'sgStop MyStrategy 60', desc: 'Остановить стратегию на 60 минут' },
          { cmd: 'ResetSession BTC', desc: 'Сбросить сессию на монете' },
          { cmd: 'ResetLoss', desc: 'Сбросить счётчик профита' },
        ]}
      />

      <CommandCategory 
        title="📝 Настройки" 
        commands={[
          { cmd: 'SetParam Strategy Param Value', desc: 'Изменить параметр стратегии' },
          { cmd: 'silent', desc: 'Отключить уведомления в чат' },
          { cmd: 'talk', desc: 'Включить уведомления в чат' },
        ]}
      />

      <CommandCategory 
        title="📋 Списки (БС/ЧС)" 
        commands={[
          { cmd: 'BL + BTC', desc: 'Добавить BTC в чёрный список' },
          { cmd: 'BL - BTC', desc: 'Убрать BTC из чёрного списка' },
          { cmd: 'SetBL+ MyStrategy BTC', desc: 'Добавить в ЧС стратегии' },
          { cmd: 'SetBL- MyStrategy BTC', desc: 'Убрать из ЧС стратегии' },
          { cmd: 'SetWL+ MyStrategy ETH', desc: 'Добавить в БС стратегии' },
          { cmd: 'SetWL- MyStrategy ETH', desc: 'Убрать из БС стратегии' },
        ]}
      />

      <CommandCategory 
        title="📈 Фьючерсы" 
        commands={[
          { cmd: 'Leverage 10 BTC,ETH', desc: 'Установить плечо 10x на BTC и ETH' },
          { cmd: 'Margin BTC,ETH ISO', desc: 'Изолированная маржа' },
          { cmd: 'Margin ALL Cross', desc: 'Кросс-маржа на всех' },
          { cmd: 'AutoLevConfig 1000 def', desc: 'Автоподбор плеча под сумму 1000$' },
        ]}
      />

      <CommandCategory 
        title="🔧 Утилиты" 
        commands={[
          { cmd: 'ConvertBNB', desc: 'Конвертировать пыль в BNB' },
          { cmd: 'DoUpdate', desc: 'Обновить MoonBot' },
          { cmd: 'InstallTestVersion Release', desc: 'Установить последнюю релизную версию' },
        ]}
      />
    </div>
  </div>
);

export default CommandsRefSection;

