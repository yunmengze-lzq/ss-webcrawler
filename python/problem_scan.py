"""
问题库扫描引擎
从 SQLite 读取历史数据，按规则判定重过载/低电压问题台区
通过 stdin/stdout 与 Electron 主进程通信

运行方式：
  echo '{}' | python problem_scan.py
  或由 Electron pythonBridge 调用
"""
import sys
import json
import sqlite3
import os
from datetime import datetime, timedelta

# ── 数据库路径（与 electron/db.ts 保持一致）────────────────────
def get_db_path():
    # 开发环境：从环境变量或默认路径读取
    env_path = os.environ.get('DB_PATH')
    if env_path:
        return env_path
    # 生产环境：userData/data/ts_agent.db
    # Windows: C:\Users\<user>\AppData\Roaming\ts-agent\data\ts_agent.db
    app_data = os.environ.get('APPDATA', os.path.expanduser('~'))
    return os.path.join(app_data, 'ts-agent', 'data', 'ts_agent.db')

# ── 配置（从 app_config 表读取，支持动态调整）────────────────────
def get_config(conn):
    rows = conn.execute("SELECT key, value FROM app_config").fetchall()
    cfg = {r[0]: r[1] for r in rows}
    return {
        'overload_threshold':      float(cfg.get('overload_threshold',      '80')),
        'overload_window_days':    int(cfg.get('overload_window_days',      '30')),
        'overload_min_events':     int(cfg.get('overload_min_events',       '5')),
        'voltage_deviation_limit': float(cfg.get('voltage_deviation_limit', '-7')),
        'voltage_rated':           220.0,
        'voltage_min_duration':    30,   # 分钟
        'voltage_window_days':     30,
        'voltage_min_events':      3,
    }

# ── 重过载判定 ──────────────────────────────────────────────────
def check_overload(ts_id, ts_name, feeder_name, capacity_kva, conn, cfg):
    window_start = (datetime.now() - timedelta(days=cfg['overload_window_days'])).strftime('%Y-%m-%d')

    rows = conn.execute("""
        SELECT record_date, load_rate_max
        FROM load_daily
        WHERE ts_id = ? AND record_date >= ?
        ORDER BY record_date DESC
    """, (ts_id, window_start)).fetchall()

    if not rows:
        return None

    over_threshold = [r for r in rows if (r[1] or 0) > cfg['overload_threshold']]
    if len(over_threshold) < cfg['overload_min_events']:
        return None

    max_rate = max(r[1] for r in over_threshold)
    severity = 'high' if max_rate > 90 else 'medium'
    occur_month = over_threshold[0][0][:7]

    return {
        'problem_id':   f"P_OL_{ts_id}_{occur_month.replace('-', '')}",
        'ts_id':        ts_id,
        'ts_name':      ts_name,
        'feeder_name':  feeder_name,
        'problem_type': 'overload',
        'severity':     severity,
        'problem_desc': (
            f"近{cfg['overload_window_days']}天内负载率超{cfg['overload_threshold']:.0f}%"
            f"共{len(over_threshold)}次，最高达{max_rate:.1f}%"
        ),
        'occur_month':  occur_month,
        'status':       'open',
        'created_at':   datetime.now().isoformat(),
    }

# ── 低电压判定 ──────────────────────────────────────────────────
def check_low_voltage(ts_id, ts_name, feeder_name, conn, cfg):
    voltage_threshold = cfg['voltage_rated'] * (1 + cfg['voltage_deviation_limit'] / 100)
    window_start = (datetime.now() - timedelta(days=cfg['voltage_window_days'])).strftime('%Y-%m-%d')

    rows = conn.execute("""
        SELECT event_id, start_time, duration_min, voltage_min
        FROM voltage_events
        WHERE ts_id = ?
          AND start_time >= ?
          AND voltage_min < ?
          AND duration_min >= ?
        ORDER BY start_time DESC
    """, (ts_id, window_start, voltage_threshold, cfg['voltage_min_duration'])).fetchall()

    if len(rows) < cfg['voltage_min_events']:
        return None

    min_voltage = min(r[3] for r in rows)
    deviation   = (min_voltage / cfg['voltage_rated'] - 1) * 100
    occur_month = rows[0][1][:7]

    return {
        'problem_id':   f"P_LV_{ts_id}_{occur_month.replace('-', '')}",
        'ts_id':        ts_id,
        'ts_name':      ts_name,
        'feeder_name':  feeder_name,
        'problem_type': 'low_voltage',
        'severity':     'high' if len(rows) > 5 else 'medium',
        'problem_desc': (
            f"近{cfg['voltage_window_days']}天内发生低电压事件{len(rows)}次，"
            f"最低电压{min_voltage:.1f}V（偏差{deviation:.1f}%）"
        ),
        'occur_month':  occur_month,
        'status':       'open',
        'created_at':   datetime.now().isoformat(),
    }

# ── 写入问题库（已存在则跳过）────────────────────────────────────
def upsert_problem(problem, conn):
    existing = conn.execute(
        "SELECT problem_id FROM problem_records WHERE problem_id = ?",
        (problem['problem_id'],)
    ).fetchone()

    if existing:
        return False   # 已存在，不重复写入

    conn.execute("""
        INSERT INTO problem_records
          (problem_id, ts_id, ts_name, feeder_name, problem_type, problem_desc,
           occur_month, severity, status, created_at)
        VALUES
          (:problem_id, :ts_id, :ts_name, :feeder_name, :problem_type, :problem_desc,
           :occur_month, :severity, :status, :created_at)
    """, problem)
    return True

# ── 主函数 ──────────────────────────────────────────────────────
def main():
    # 读取 Electron 传入的参数（当前脚本不需要参数，保留框架）
    try:
        _params = json.loads(sys.stdin.read().strip() or '{}')
    except Exception:
        _params = {}

    db_path = get_db_path()
    if not os.path.exists(db_path):
        print(json.dumps({'error': f'数据库不存在: {db_path}', 'new_count': 0}))
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    try:
        cfg = get_config(conn)

        # 获取所有台区
        ts_list = conn.execute(
            "SELECT ts_id, ts_name, feeder_name, capacity_kva FROM transformer_stations"
        ).fetchall()

        new_count = 0
        results = []

        for ts in ts_list:
            ts_id       = ts['ts_id']
            ts_name     = ts['ts_name']
            feeder_name = ts['feeder_name']
            capacity    = ts['capacity_kva']

            # 重过载检测
            problem = check_overload(ts_id, ts_name, feeder_name, capacity, conn, cfg)
            if problem:
                if upsert_problem(problem, conn):
                    new_count += 1
                results.append(problem)

            # 低电压检测
            problem = check_low_voltage(ts_id, ts_name, feeder_name, conn, cfg)
            if problem:
                if upsert_problem(problem, conn):
                    new_count += 1
                results.append(problem)

        conn.commit()
        print(json.dumps({
            'new_count':    new_count,
            'total_found':  len(results),
            'problems':     results,
        }, ensure_ascii=False))

    except Exception as e:
        conn.rollback()
        print(json.dumps({'error': str(e), 'new_count': 0}))
    finally:
        conn.close()


if __name__ == '__main__':
    main()
