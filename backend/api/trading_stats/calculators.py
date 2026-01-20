"""
Калькуляторы метрик для trading stats

Функции расчёта различных торговых метрик
"""
from typing import List, Tuple
from models import models


def calculate_profit_factor(total_wins: float, total_losses: float) -> float:
    """Рассчитать Profit Factor"""
    if total_losses > 0:
        return total_wins / total_losses
    return 999.99 if total_wins > 0 else 0.0


def calculate_max_drawdown(closed_orders: List[models.MoonBotOrder]) -> float:
    """Рассчитать максимальную просадку"""
    cumulative_profit = 0.0
    peak_profit = 0.0
    max_drawdown = 0.0
    
    for order in closed_orders:
        cumulative_profit += (order.profit_btc or 0.0)
        if cumulative_profit > peak_profit:
            peak_profit = cumulative_profit
        drawdown = peak_profit - cumulative_profit
        if drawdown > max_drawdown:
            max_drawdown = drawdown
    
    return max_drawdown


def calculate_avg_duration(orders_with_times: List[models.MoonBotOrder]) -> float:
    """Рассчитать среднюю длительность сделок в часах"""
    if not orders_with_times:
        return 0.0
    
    total_duration_seconds = sum([
        (order.closed_at - order.opened_at).total_seconds()
        for order in orders_with_times
    ])
    return (total_duration_seconds / len(orders_with_times)) / 3600


def calculate_streaks(all_orders: List[models.MoonBotOrder]) -> Tuple[int, int]:
    """Рассчитать максимальные серии побед и поражений"""
    current_win_streak = 0
    current_loss_streak = 0
    max_win_streak = 0
    max_loss_streak = 0
    
    for order in all_orders:
        profit = order.profit_btc or 0.0
        if profit > 0:
            current_win_streak += 1
            current_loss_streak = 0
            if current_win_streak > max_win_streak:
                max_win_streak = current_win_streak
        elif profit < 0:
            current_loss_streak += 1
            current_win_streak = 0
            if current_loss_streak > max_loss_streak:
                max_loss_streak = current_loss_streak
    
    return max_win_streak, max_loss_streak


def calculate_cumulative_profit(profit_by_date: List) -> List[dict]:
    """Рассчитать накопительную прибыль по времени"""
    cumulative_profit = 0.0
    profit_timeline = []
    
    for item in profit_by_date:
        cumulative_profit += float(item.profit or 0.0)
        profit_timeline.append({
            "date": str(item.date),
            "daily_profit": round(float(item.profit or 0.0), 2),
            "cumulative_profit": round(cumulative_profit, 2)
        })
    
    return profit_timeline


def calculate_winrate_timeline(winrate_by_date: List) -> List[dict]:
    """Рассчитать винрейт по времени"""
    winrate_timeline = []
    
    for item in winrate_by_date:
        wins = int(item.wins or 0)
        total = int(item.total or 0)
        winrate_val = (wins / total * 100) if total > 0 else 0.0
        winrate_timeline.append({
            "date": str(item.date),
            "winrate": round(winrate_val, 2),
            "total_orders": total,
            "wins": wins
        })
    
    return winrate_timeline






