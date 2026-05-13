"""
智能体3：仿真校验
当前版本：静态查表法（过渡方案）
后续版本：前推回代法（待 GIS 拓扑数据格式确认后实现）
"""
import sys
import json
import math

# ── 导线参数表（电阻率 Ω/km，额定载流量 A）──────────────────────
WIRE_PARAMS = {
    'LGJ-16':  {'r_ohm_per_km': 1.910, 'rated_a': 80},
    'LGJ-25':  {'r_ohm_per_km': 1.200, 'rated_a': 105},
    'LGJ-35':  {'r_ohm_per_km': 0.850, 'rated_a': 130},
    'LGJ-50':  {'r_ohm_per_km': 0.590, 'rated_a': 165},
    'LGJ-70':  {'r_ohm_per_km': 0.430, 'rated_a': 210},
    'LGJ-95':  {'r_ohm_per_km': 0.310, 'rated_a': 260},
    'LGJ-120': {'r_ohm_per_km': 0.250, 'rated_a': 305},
    'LGJ-150': {'r_ohm_per_km': 0.200, 'rated_a': 350},
    'LGJ-185': {'r_ohm_per_km': 0.160, 'rated_a': 400},
    # 电缆（YJV22 系列）
    'YJV22-70':  {'r_ohm_per_km': 0.268, 'rated_a': 220},
    'YJV22-95':  {'r_ohm_per_km': 0.193, 'rated_a': 265},
    'YJV22-120': {'r_ohm_per_km': 0.153, 'rated_a': 305},
    'YJV22-150': {'r_ohm_per_km': 0.124, 'rated_a': 345},
    # 默认（型号未知时使用）
    'DEFAULT':   {'r_ohm_per_km': 0.430, 'rated_a': 210},
}

RATED_VOLTAGE = 220      # V（单相）
POWER_FACTOR  = 0.85
VOLTAGE_LIMIT = 0.07     # ±7%

def get_wire_params(wire_type: str) -> dict:
    return WIRE_PARAMS.get(wire_type, WIRE_PARAMS['DEFAULT'])

# ── 静态查表法（过渡方案）────────────────────────────────────────
def simple_check(params: dict) -> dict:
    """
    基于额定载流量做粗略可行性判断
    不计算精确电压，只判断线路是否会过载
    """
    wire_type    = params.get('wire_type', 'LGJ-70')
    wire_len_m   = params.get('wire_length_m', 300)
    current_kw   = params.get('current_kw', 0)
    forecast_kw  = params.get('forecast_kw', 0)
    capacity_kva = params.get('capacity_kva', 200)
    split_ratio  = params.get('split_ratio', 0.5)

    wire = get_wire_params(wire_type)
    rated_a = wire['rated_a']
    r_ohm   = wire['r_ohm_per_km'] * wire_len_m / 1000

    # 新台区承担的负荷
    new_ts_kw = forecast_kw * split_ratio
    # 原台区剩余负荷
    remain_kw = forecast_kw * (1 - split_ratio)

    # 电流估算（kW / 电压 / 功率因数）
    new_ts_current_a  = new_ts_kw  * 1000 / (RATED_VOLTAGE * POWER_FACTOR)
    remain_current_a  = remain_kw  * 1000 / (RATED_VOLTAGE * POWER_FACTOR)

    # 负载率
    new_ts_load_rate  = new_ts_current_a  / rated_a * 100
    remain_load_rate  = remain_current_a  / rated_a * 100

    # 简化电压降估算（不考虑无功，仅有功部分）
    # ΔU = I × R × cosφ / U_rated × 100%
    voltage_drop_new  = new_ts_current_a  * r_ohm * POWER_FACTOR / RATED_VOLTAGE * 100
    voltage_drop_rem  = remain_current_a  * r_ohm * POWER_FACTOR / RATED_VOLTAGE * 100

    def check_ok(load_rate, v_drop):
        return load_rate <= 80 and abs(v_drop) <= VOLTAGE_LIMIT * 100

    results = {}

    # π接方案：原线路切断，两段独立供电
    results['pi'] = {
        'conn_type':         'pi',
        'new_ts_load_rate':  round(new_ts_load_rate, 1),
        'remain_load_rate':  round(remain_load_rate, 1),
        'new_ts_volt_drop':  round(-voltage_drop_new, 2),   # 负数表示压降
        'remain_volt_drop':  round(-voltage_drop_rem, 2),
        'new_ts_ok':         check_ok(new_ts_load_rate, voltage_drop_new),
        'remain_ok':         check_ok(remain_load_rate, voltage_drop_rem),
        'overall_ok':        check_ok(new_ts_load_rate, voltage_drop_new) and check_ok(remain_load_rate, voltage_drop_rem),
        'note':              '静态估算，待完整潮流仿真验证',
    }

    # T接方案：原线路不断，新台以分支接入
    # 原线路电流不变（仍承担全部负荷），新台分支电流 = 新台负荷电流
    original_current_a = forecast_kw * 1000 / (RATED_VOLTAGE * POWER_FACTOR)
    original_load_rate = original_current_a / rated_a * 100  # T接时原线路不卸载
    t_branch_current   = new_ts_current_a   # 分支段电流 = 新台负荷电流

    results['t'] = {
        'conn_type':            't',
        'new_ts_load_rate':     round(new_ts_load_rate, 1),    # 新台自身
        'main_line_load_rate':  round(original_load_rate, 1),  # 原主线路（T接不卸载）
        'new_ts_volt_drop':     round(-voltage_drop_new, 2),
        'main_line_volt_drop':  round(-(original_current_a * r_ohm * POWER_FACTOR / RATED_VOLTAGE * 100), 2),
        'new_ts_ok':            new_ts_load_rate <= 80,
        'main_line_ok':         original_load_rate <= 80,
        'overall_ok':           new_ts_load_rate <= 80 and original_load_rate <= 80,
        'note':                 'T接不卸载原线路，原线路仍承担全部负荷；静态估算',
    }

    # 推荐方案（规则层）
    pi_score = (
        (1 if results['pi']['overall_ok']    else 0) * 2 +
        (1 if results['pi']['new_ts_load_rate'] < 70 else 0) +
        (1 if abs(results['pi']['new_ts_volt_drop']) < 5 else 0)
    )
    t_score = (
        (1 if results['t']['overall_ok']     else 0) * 2 +
        (1 if results['t']['new_ts_load_rate'] < 70 else 0) +
        (1 if abs(results['t']['new_ts_volt_drop']) < 5 else 0)
    )
    recommended = 'pi' if pi_score >= t_score else 't'

    return {
        'ts_id':           params.get('ts_id', ''),
        'scheme_name':     params.get('scheme_name', ''),
        'sim_method':      'simple_check',   # 标记为静态估算
        'wire_type':       wire_type,
        'wire_length_m':   wire_len_m,
        'forecast_kw':     forecast_kw,
        'split_ratio':     split_ratio,
        'pi_result':       results['pi'],
        't_result':        results['t'],
        'recommended':     recommended,
    }

# ── 前推回代法（TODO：待 GIS 拓扑数据格式确认后实现）────────────
def forward_backward_sweep(topology: dict) -> dict:
    """
    完整潮流计算（辐射状配网前推回代法）
    topology: {
        nodes: [{id, load_kw, load_kvar}],
        branches: [{from, to, length_m, wire_type}],
        root_node_id: str,
        root_voltage: float  (V)
    }

    TODO: 实现以下步骤：
    1. 构建树形结构（从 branches 建邻接表）
    2. BFS/DFS 确定节点遍历顺序
    3. 回代：从叶节点向根节点累加支路电流
    4. 前推：从根节点向叶节点逐段计算电压
    5. 迭代直到收敛（配网辐射状拓扑通常 3-5 次迭代即可）
    """
    return {'status': 'not_implemented', 'note': '待 GIS 数据格式确认后实现'}

def main():
    try:
        params = json.loads(sys.stdin.read().strip() or '{}')
    except Exception:
        params = {}

    mode = params.get('mode', 'simple')

    if mode == 'full' and params.get('topology'):
        result = forward_backward_sweep(params['topology'])
    else:
        result = simple_check(params)

    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
