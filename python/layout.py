"""
智能体2：布点方案生成（空间算法部分）
GIS 空间筛选 + 综合评分排序 → 输出 Top3 候选点
LLM 解读文字由 Electron 主进程单独调用
"""
import sys
import json
import sqlite3
import os
import math

def get_db_path():
    env_path = os.environ.get('DB_PATH')
    if env_path:
        return env_path
    app_data = os.environ.get('APPDATA', os.path.expanduser('~'))
    return os.path.join(app_data, 'ts-agent', 'data', 'ts_agent.db')

# ── 距离计算（Haversine 公式，返回米）────────────────────────────
def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371000  # 地球半径（米）
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

# ── 硬约束 ────────────────────────────────────────────────────────
HARD = {
    'max_dist_m': 500,
    'min_dist_m': 50,
    'min_dist_from_existing_m': 100,
}

# ── 软约束权重 ────────────────────────────────────────────────────
WEIGHTS = {
    'distance': 0.40,
    'balance':  0.30,
    'cost':     0.30,
}

def score_candidate(cand_lat, cand_lng, problem_ts, existing_ts_list, forecast_kw, split_ratio=0.5) -> float:
    dist = haversine(cand_lat, cand_lng, problem_ts['lat'], problem_ts['lng'])

    # 1. 距离分（越近越好）
    dist_score = max(0, 1 - dist / HARD['max_dist_m'])

    # 2. 负载均衡分（split_ratio 越接近 0.5 越好）
    balance_score = 1 - abs(split_ratio - 0.5) * 2

    # 3. 建设费用估算分（距离越近，线路越短，费用越低）
    # TODO: 接入实际定额后替换此公式
    line_cost_normalized = dist / HARD['max_dist_m']
    cost_score = 1 - line_cost_normalized

    return (dist_score  * WEIGHTS['distance'] +
            balance_score * WEIGHTS['balance'] +
            cost_score    * WEIGHTS['cost'])

def generate_direction_candidates(problem_ts, count=3):
    """
    无拿地清单时，按方向生成候选点（东/南/西/北/东南 等）
    距离取最优范围 200m
    """
    lat, lng = problem_ts['lat'], problem_ts['lng']
    directions = [
        (0,    200, '北侧 200m'),
        (90,   200, '东侧 200m'),
        (180,  200, '南侧 200m'),
        (270,  200, '西侧 200m'),
        (45,   250, '东北侧 250m'),
        (135,  250, '东南侧 250m'),
    ]
    candidates = []
    for bearing, dist_m, label in directions[:count]:
        # 近似：1度纬度 ≈ 111km
        dlat = dist_m * math.cos(math.radians(bearing)) / 111000
        dlng = dist_m * math.sin(math.radians(bearing)) / (111000 * math.cos(math.radians(lat)))
        candidates.append({
            'lat': round(lat + dlat, 6),
            'lng': round(lng + dlng, 6),
            'source': 'direction',
            'location_desc': label,
        })
    return candidates

def recommend_conn_type(problem_ts, dist_m, forecast_kw) -> str:
    """
    简单规则判断接线方式（供 LLM 参考，不强制）
    详细语义判断由 LLM 完成
    """
    current_load_rate = problem_ts.get('current_load_rate', 50)
    if current_load_rate > 70:
        return 'pi'   # 原线路重载，π接卸载
    if dist_m > 300:
        return 't'    # 距离远，T接减少施工量
    return 'pi'       # 默认建议 π接

def main():
    try:
        params = json.loads(sys.stdin.read().strip() or '{}')
    except Exception:
        params = {}

    ts_id         = params.get('ts_id')
    forecast_kw   = params.get('forecast_kw', 0)
    land_list     = params.get('land_list', [])    # 拿地清单（前端传入或从配置读取）

    if not ts_id:
        print(json.dumps({'error': 'ts_id 不能为空'}))
        return

    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row

    try:
        # 获取问题台区信息
        ts = conn.execute(
            "SELECT * FROM transformer_stations WHERE ts_id = ?", (ts_id,)
        ).fetchone()
        if not ts:
            print(json.dumps({'error': f'台区不存在: {ts_id}'}))
            return

        problem_ts = dict(ts)
        # 附加负荷预测数据（由上游传入）
        problem_ts['current_load_rate'] = params.get('current_load_rate', 50)

        # 获取周边台区（用于硬约束检查）
        nearby_ts = conn.execute("""
            SELECT ts_id, ts_name, lat, lng FROM transformer_stations
            WHERE ts_id != ? AND lat IS NOT NULL
        """, (ts_id,)).fetchall()

        # ── 生成候选点 ──────────────────────────────────────────
        raw_candidates = list(land_list)  # 拿地清单优先

        if len(raw_candidates) < 3:
            raw_candidates += generate_direction_candidates(problem_ts, count=6)

        # ── 硬约束过滤 ──────────────────────────────────────────
        filtered = []
        for cand in raw_candidates:
            lat, lng = cand.get('lat'), cand.get('lng')
            if lat is None or lng is None:
                continue

            dist = haversine(lat, lng, problem_ts['lat'], problem_ts['lng'])

            # 距离问题台区的范围约束
            if not (HARD['min_dist_m'] <= dist <= HARD['max_dist_m']):
                continue

            # 距现有台区最近距离约束
            too_close = any(
                haversine(lat, lng, float(ts2['lat']), float(ts2['lng'])) < HARD['min_dist_from_existing_m']
                for ts2 in nearby_ts
                if ts2['lat'] and ts2['lng']
            )
            if too_close:
                continue

            # 软约束评分
            score = score_candidate(lat, lng, problem_ts, nearby_ts, forecast_kw)
            conn_type = recommend_conn_type(problem_ts, dist, forecast_kw)

            filtered.append({
                **cand,
                'distance_m':  round(dist, 0),
                'score':        round(score, 3),
                'conn_type':   conn_type,
            })

        # 按评分排序，取 Top3
        top3 = sorted(filtered, key=lambda x: x['score'], reverse=True)[:3]

        # 为每个候选点补充周边台区摘要（供 LLM 使用）
        for i, cand in enumerate(top3):
            cand['rank'] = i + 1
            # 最近的 3 个现有台区
            nearby_summary = []
            for ts2 in nearby_ts:
                if ts2['lat'] and ts2['lng']:
                    d = haversine(cand['lat'], cand['lng'], float(ts2['lat']), float(ts2['lng']))
                    nearby_summary.append({'ts_name': ts2['ts_name'], 'distance_m': round(d)})
            cand['nearby_ts'] = sorted(nearby_summary, key=lambda x: x['distance_m'])[:3]

        print(json.dumps({
            'ts_id':      ts_id,
            'ts_name':    problem_ts['ts_name'],
            'candidates': top3,
            'total_before_filter': len(raw_candidates),
            'total_after_filter':  len(filtered),
        }, ensure_ascii=False))

    except Exception as e:
        import traceback
        print(json.dumps({'error': str(e), 'trace': traceback.format_exc()}))
    finally:
        conn.close()

if __name__ == '__main__':
    main()
