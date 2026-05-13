"""
智能体4：投资评估计算引擎
输入：多个候选方案的仿真结果
输出：技术经济综合评分 + 排名
依赖：仅 Python 标准库
"""
import sys, json, sqlite3, os

# ── 权重配置 ─────────────────────────────────────────────────────
TECH_WEIGHTS = {
    'voltage_improve':   0.30,  # 电压合格率提升
    'load_improve':      0.25,  # 负载率改善
    'reliability':       0.20,  # 供电可靠性（用负载率余量估算）
    'balance':           0.25,  # 治理后两台区负载均衡度
}
ECON_WEIGHTS = {
    'construction_cost': 0.40,  # 建设投资额
    'payback_period':    0.35,  # 静态回收期
    'cost_per_kw':       0.25,  # 单位容量费用
}
WEIGHT_TECH = 0.6
WEIGHT_ECON = 0.4

# ── 建设费用估算（TODO：接入实际定额后替换）──────────────────────
UNIT_COST = {
    'transformer_per_kva':  800,   # 元/kVA
    'line_per_meter':       150,   # 元/m（含土建）
    'foundation':           15000, # 元/台（台架基础）
}

def estimate_cost(capacity_kva: float, line_length_m: float) -> float:
    return (capacity_kva * UNIT_COST['transformer_per_kva']
            + line_length_m * UNIT_COST['line_per_meter']
            + UNIT_COST['foundation'])

def evaluate_scheme(scheme: dict) -> dict:
    sim = scheme.get('sim_result', {})
    conn_type = scheme.get('conn_type', 'pi')

    # 取对应接线方式的仿真结果
    result = sim.get(f'{conn_type}_result', sim)

    # ── 技术指标（当前值 vs 治理前）──────────────────────────────
    before_load_rate   = scheme.get('before_load_rate', 80)
    after_load_rate    = result.get('remain_load_rate', 60)
    new_ts_load_rate   = result.get('new_ts_load_rate', 60)
    after_volt_drop    = abs(result.get('remain_volt_drop', -5))
    new_ts_volt_drop   = abs(result.get('new_ts_volt_drop', -5))

    # 电压改善（偏差绝对值越小越好）
    before_volt = scheme.get('before_volt_drop_abs', 6.5)
    volt_improve = max(0, (before_volt - max(after_volt_drop, new_ts_volt_drop)) / before_volt)

    # 负载率改善（下降越多越好）
    load_improve = max(0, (before_load_rate - max(after_load_rate, new_ts_load_rate)) / before_load_rate)

    # 供电可靠性（负载率余量：离 80% 越远越好）
    reliability = max(0, 1 - max(after_load_rate, new_ts_load_rate) / 80)

    # 负载均衡（两台区负载率差越小越好）
    balance = 1 - abs(after_load_rate - new_ts_load_rate) / 100

    tech_score = (
        volt_improve * TECH_WEIGHTS['voltage_improve'] +
        load_improve * TECH_WEIGHTS['load_improve'] +
        reliability  * TECH_WEIGHTS['reliability'] +
        balance      * TECH_WEIGHTS['balance']
    )

    # ── 经济指标 ──────────────────────────────────────────────────
    capacity_kva  = scheme.get('new_ts_capacity_kva', 200)
    line_length_m = scheme.get('distance_m', 300)
    cost          = estimate_cost(capacity_kva, line_length_m)

    # 年均净收益估算（增供电量 × 电价）
    annual_kwh    = scheme.get('annual_benefit_kwh', 0)
    electricity_price = 0.65  # 元/kWh（TODO 替换为实际电价）
    annual_revenue = annual_kwh * electricity_price
    payback = cost / annual_revenue if annual_revenue > 0 else 999
    cost_per_kw = cost / (capacity_kva * 0.85) if capacity_kva > 0 else 999

    return {
        'scheme_id':       scheme.get('scheme_id', ''),
        'conn_type':       conn_type,
        'cost_yuan':       round(cost),
        'cost_wan':        round(cost / 10000, 2),
        'payback_years':   round(payback, 1),
        'cost_per_kw':     round(cost_per_kw, 0),
        'tech_detail': {
            'volt_improve':  round(volt_improve,  3),
            'load_improve':  round(load_improve,  3),
            'reliability':   round(reliability,   3),
            'balance':       round(balance,        3),
        },
        'tech_score':      round(tech_score, 4),
        # 经济分归一化（需要多方案对比后才能归一化，先存原始值）
        'econ_raw': {
            'construction_cost': cost,
            'payback_period':    payback,
            'cost_per_kw':       cost_per_kw,
        },
    }

def normalize_and_rank(schemes: list) -> list:
    """多方案归一化评分，rank 越小越优"""
    if not schemes: return []

    # 经济指标：值越小越好，归一化后取补数
    for key in ['construction_cost', 'payback_period', 'cost_per_kw']:
        vals = [s['econ_raw'][key] for s in schemes if s['econ_raw'][key] < 999]
        if not vals: continue
        mn, mx = min(vals), max(vals)
        rng = mx - mn if mx != mn else 1
        for s in schemes:
            raw = s['econ_raw'][key]
            s.setdefault('econ_norm', {})[key] = 1 - (raw - mn) / rng if raw < 999 else 0

    for s in schemes:
        en = s.get('econ_norm', {})
        econ_score = (
            en.get('construction_cost', 0) * ECON_WEIGHTS['construction_cost'] +
            en.get('payback_period',    0) * ECON_WEIGHTS['payback_period']    +
            en.get('cost_per_kw',       0) * ECON_WEIGHTS['cost_per_kw']
        )
        s['econ_score']  = round(econ_score, 4)
        s['final_score'] = round(s['tech_score'] * WEIGHT_TECH + econ_score * WEIGHT_ECON, 4)

    ranked = sorted(schemes, key=lambda x: x['final_score'], reverse=True)
    for i, s in enumerate(ranked):
        s['rank'] = i + 1
        s['is_optimal'] = (i == 0)
    return ranked

def main():
    params = json.loads(sys.stdin.read().strip() or '{}')
    schemes = params.get('schemes', [])

    if not schemes:
        print(json.dumps({'error': 'schemes 不能为空'})); return

    evaluated = [evaluate_scheme(s) for s in schemes]
    ranked    = normalize_and_rank(evaluated)

    print(json.dumps({
        'schemes':        ranked,
        'optimal_scheme': next((s for s in ranked if s['is_optimal']), None),
        'count':          len(ranked),
    }, ensure_ascii=False))

if __name__ == '__main__':
    main()
