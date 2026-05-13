"""
数据库初始化脚本
依赖：仅 Python 标准库（sqlite3 内置，零额外安装）
"""
import sys, json, sqlite3, os

def main():
    params = json.loads(sys.stdin.read().strip() or '{}')
    db_path = params.get('db_path')
    if not db_path:
        print(json.dumps({'error': 'db_path 必填'})); return

    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS transformer_stations (
            ts_id         TEXT PRIMARY KEY,
            ts_name       TEXT NOT NULL,
            feeder_name   TEXT,
            lat           REAL,
            lng           REAL,
            capacity_kva  REAL,
            wire_type     TEXT,
            wire_length_m REAL,
            install_year  INTEGER,
            supply_area   TEXT,
            updated_at    TEXT
        );

        CREATE TABLE IF NOT EXISTS load_daily (
            ts_id          TEXT NOT NULL,
            record_date    TEXT NOT NULL,
            load_rate_max  REAL,
            load_rate_avg  REAL,
            load_kw_max    REAL,
            PRIMARY KEY (ts_id, record_date)
        );

        CREATE TABLE IF NOT EXISTS load_monthly (
            ts_id          TEXT NOT NULL,
            year_month     TEXT NOT NULL,
            load_rate_max  REAL,
            load_rate_avg  REAL,
            load_kw_max    REAL,
            PRIMARY KEY (ts_id, year_month)
        );

        CREATE TABLE IF NOT EXISTS voltage_events (
            event_id      TEXT PRIMARY KEY,
            ts_id         TEXT NOT NULL,
            start_time    TEXT,
            duration_min  INTEGER,
            voltage_min   REAL,
            node_desc     TEXT
        );

        CREATE TABLE IF NOT EXISTS declared_load (
            declare_id    TEXT PRIMARY KEY,
            ts_id         TEXT NOT NULL,
            user_name     TEXT,
            capacity_kw   REAL,
            status        TEXT,
            expected_date TEXT,
            updated_at    TEXT
        );

        CREATE TABLE IF NOT EXISTS problem_records (
            problem_id    TEXT PRIMARY KEY,
            ts_id         TEXT NOT NULL,
            ts_name       TEXT,
            feeder_name   TEXT,
            problem_type  TEXT NOT NULL,
            problem_desc  TEXT,
            occur_month   TEXT,
            strategy_ref  TEXT,
            severity      TEXT,
            status        TEXT DEFAULT 'open',
            created_at    TEXT
        );

        CREATE TABLE IF NOT EXISTS planning_schemes (
            scheme_id     TEXT PRIMARY KEY,
            problem_id    TEXT NOT NULL,
            scheme_name   TEXT,
            new_ts_lat    REAL,
            new_ts_lng    REAL,
            conn_type     TEXT,
            topology_json TEXT,
            sim_result    TEXT,
            invest_score  REAL,
            llm_summary   TEXT,
            status        TEXT DEFAULT 'draft',
            created_at    TEXT,
            confirmed_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS crawl_log (
            log_id        TEXT PRIMARY KEY,
            system_name   TEXT NOT NULL,
            start_time    TEXT,
            end_time      TEXT,
            status        TEXT,
            records_count INTEGER,
            error_msg     TEXT
        );

        CREATE TABLE IF NOT EXISTS app_config (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
    """)

    # 默认配置（INSERT OR IGNORE，不覆盖已有值）
    defaults = [
        ('overload_threshold',      '80'),
        ('overload_window_days',    '30'),
        ('overload_min_events',     '5'),
        ('voltage_deviation_limit', '-7'),
        ('growth_rate_default',     '0.02'),
        ('forecast_years',          '5'),
    ]
    conn.executemany(
        'INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)', defaults
    )
    conn.commit()
    conn.close()
    print(json.dumps({'ok': True, 'db_path': db_path}))

if __name__ == '__main__':
    main()
