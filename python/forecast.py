"""
智能体1：负荷预测计算引擎
计算逻辑完全在此处，结果以 JSON 返回给 Electron
Electron 拿到结果后再调用 LLM 生成解读文字
"""
import sys
import json
import sqlite3
import os
from datetime import datetime, timedelta

def get_db_path():
    env_path = os.environ.get('DB_PATH')
    if env_path:
        return env_path
    app_data = os.environ.get('APPDATA', os.path.expanduser('~'))
    return os.path.join(app_data, 'ts-agent', 'data', 'ts_agent.db')

def get_config(conn):
    rows = conn.execute("SELECT key, value FROM app_config").fetchall()
    cfg = {r[0]: r[1] for r in rows}
    return {
        'growth_rate': float(cfg.get('growth_rate_default', '0.02')),
        'forecast_years': int(cfg.get('forecast_years', '5')),
        'intent_factor': 0.7,   # 意向报装折算系数
        'power_factor': 0.85,   # 功率因数
    }

def get_current_max_load(ts_id, conn, days=90) -> float:
    """近 N 天最大负荷（kW）"""
    since = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    row = conn.execute("""
        SELECT MAX(load_kw_max) FROM load_daily
        WHERE ts_id = ? AND record_date >= ?
    """, (ts_id, since)).fetchone()
    return float(row[0] or 0)

def get_declared_load(ts_id, conn) -> tuple[float, float]:
    """已确认报装（kW），意向报装（kW）"""
    rows = conn.execute("""
        SELECT status, SUM(capacity_kw) FROM declared_load
        WHERE ts_id = ?
        GROUP BY status
    """, (ts_id,)).fetchall()
    confirmed = intent = 0.0
    for status, total in rows:
        if status == 'confirmed': confirmed = float(total or 0)
        elif status == 'intent':  intent    = float(total or 0)
    return confirmed, intent

def forecast(ts_id: str, conn, cfg: dict) -> dict:
    ts = conn.execute(
        "SELECT ts_id, ts_name, capacity_kva FROM transformer_stations WHERE ts_id = ?",
        (ts_id,)
    ).fetchone()

    if not ts:
        return {'error': f'台区不存在: {ts_id}'}

    capacity_kva  = float(ts['capacity_kva'] or 0)
    current_kw    = get_current_max_load(ts_id, conn)
    confirmed, intent = get_declared_load(ts_id, conn)

    # 报装负荷（意向折算）
    declared_kw = confirmed + intent * cfg['intent_factor']

    # 自然增长
    years = cfg['forecast_years']
    growth_kw = current_kw * ((1 + cfg['growth_rate']) ** years - 1)

    # 预测总负荷
    forecast_kw = current_kw + growth_kw + declared_kw

    # 预测负载率
    rated_kw = capacity_kva * cfg['power_factor']
    current_load_rate  = (current_kw  / rated_kw * 100) if rated_kw > 0 else 0
    forecast_load_rate = (forecast_kw / rated_kw * 100) if rated_kw > 0 else 0

    # 3年预测（用于中期参考）
    growth_kw_3yr = current_kw * ((1 + cfg['growth_rate']) ** 3 - 1)
    forecast_kw_3yr = current_kw + growth_kw_3yr + declared_kw * 0.6  # 3年内报装完成率 60%

    return {
        'ts_id':               ts_id,
        'ts_name':             ts['ts_name'],
        'capacity_kva':        capacity_kva,
        'current_kw':          round(current_kw, 1),
        'current_load_rate':   round(current_load_rate, 1),
        'declared_confirmed':  round(confirmed, 1),
        'declared_intent':     round(intent, 1),
        'declared_total_kw':   round(declared_kw, 1),
        'growth_kw':           round(growth_kw, 1),
        'growth_rate_pct':     round(cfg['growth_rate'] * 100, 1),
        'forecast_3yr_kw':     round(forecast_kw_3yr, 1),
        'forecast_5yr_kw':     round(forecast_kw, 1),
        'forecast_load_rate':  round(forecast_load_rate, 1),
        'need_new_ts':         forecast_load_rate > 80,
        'suggest_split_ratio': 0.5,      # 默认对半，布点智能体可调整
        'forecast_years':      years,
    }

def main():
    try:
        params = json.loads(sys.stdin.read().strip() or '{}')
    except Exception:
        params = {}

    ts_id = params.get('ts_id')
    if not ts_id:
        # 批量模式：扫描所有问题台区
        batch_mode = True
    else:
        batch_mode = False

    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row

    try:
        cfg = get_config(conn)

        if batch_mode:
            # 只对有问题记录的台区预测
            ts_ids = [r[0] for r in conn.execute(
                "SELECT DISTINCT ts_id FROM problem_records WHERE status='open'"
            ).fetchall()]
            results = [forecast(tid, conn, cfg) for tid in ts_ids]
            print(json.dumps({'results': results, 'count': len(results)}, ensure_ascii=False))
        else:
            result = forecast(ts_id, conn, cfg)
            print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({'error': str(e)}))
    finally:
        conn.close()

if __name__ == '__main__':
    main()
