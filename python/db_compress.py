"""
历史数据压缩：把 2 年前的日粒度负荷数据聚合为月均值，然后删除
每月执行一次（由 schedule.ts 触发）
依赖：仅 Python 标准库
"""
import sys, json, sqlite3

def main():
    params = json.loads(sys.stdin.read().strip() or '{}')
    db_path = params.get('db_path')
    if not db_path:
        print(json.dumps({'error': 'db_path 必填'})); return

    conn = sqlite3.connect(db_path)
    try:
        # 1. 聚合到月均值
        conn.execute("""
            INSERT OR REPLACE INTO load_monthly
              (ts_id, year_month, load_rate_max, load_rate_avg, load_kw_max)
            SELECT
              ts_id,
              substr(record_date, 1, 7)  AS year_month,
              MAX(load_rate_max),
              ROUND(AVG(load_rate_avg), 2),
              MAX(load_kw_max)
            FROM load_daily
            WHERE record_date < date('now', '-2 years')
            GROUP BY ts_id, substr(record_date, 1, 7)
        """)
        # 2. 删除已聚合的细粒度数据
        cur = conn.execute(
            "DELETE FROM load_daily WHERE record_date < date('now', '-2 years')"
        )
        deleted = cur.rowcount
        conn.execute('PRAGMA vacuum')
        conn.commit()
        print(json.dumps({'ok': True, 'deleted_rows': deleted}))
    except Exception as e:
        conn.rollback()
        print(json.dumps({'error': str(e)}))
    finally:
        conn.close()

if __name__ == '__main__':
    main()
