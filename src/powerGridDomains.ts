export type PowerGridSystemOption = {
  key: string
  name: string
}

export type PowerGridSystemGroup = {
  label: string
  options: PowerGridSystemOption[]
}

export const powerGridSystemGroups: PowerGridSystemGroup[] = [
  {
    label: '通用',
    options: [
      { key: 'custom', name: '自定义 / 其他' },
      { key: 'data_governance', name: '数据治理 / 数据质量' },
      { key: 'digital_platform', name: '数字化平台 / 数据中台' },
    ],
  },
  {
    label: '规划建设',
    options: [
      { key: 'grid_planning', name: '电网规划' },
      { key: 'project_construction', name: '基建工程' },
      { key: 'technical_reform', name: '技改修理' },
      { key: 'investment_plan', name: '投资计划' },
    ],
  },
  {
    label: '生产运行',
    options: [
      { key: 'dispatch_control', name: '调度运行' },
      { key: 'transmission', name: '输电运检' },
      { key: 'substation', name: '变电运维' },
      { key: 'distribution', name: '配电运维' },
      { key: 'distribution_automation', name: '配网自动化' },
      { key: 'low_voltage_area', name: '台区治理' },
      { key: 'outage_repair', name: '停电抢修' },
      { key: 'power_quality', name: '电能质量' },
      { key: 'voltage', name: '电压监测' },
      { key: 'load_meter', name: '负载率 / 负荷监测' },
    ],
  },
  {
    label: '营销服务',
    options: [
      { key: 'marketing', name: '营销报装' },
      { key: 'customer_service', name: '客户服务' },
      { key: 'metering', name: '计量采集' },
      { key: 'electricity_fee', name: '电费电价' },
      { key: 'demand_response', name: '负荷管理 / 需求响应' },
      { key: 'market_trading', name: '电力交易' },
    ],
  },
  {
    label: '资产点位',
    options: [
      { key: 'asset', name: '设备资产台账' },
      { key: 'gis', name: 'GIS / 点位坐标' },
      { key: 'station_line_transformer_user', name: '站线变户关系' },
      { key: 'inspection_point', name: '巡检点位' },
      { key: 'defect_hazard', name: '缺陷隐患' },
    ],
  },
  {
    label: '新型业务',
    options: [
      { key: 'new_energy', name: '新能源并网' },
      { key: 'distributed_pv', name: '分布式光伏' },
      { key: 'energy_storage', name: '储能业务' },
      { key: 'ev_charging', name: '充换电 / 综合能源' },
    ],
  },
  {
    label: '经营支撑',
    options: [
      { key: 'safety_emergency', name: '安全监管 / 应急' },
      { key: 'material_supply', name: '物资供应链' },
      { key: 'finance_operation', name: '财务经营' },
      { key: 'communication_automation', name: '通信自动化' },
    ],
  },
]

export const powerGridSystems = powerGridSystemGroups.flatMap(group => group.options)

export const powerGridSystemName = (key: string) =>
  powerGridSystems.find(item => item.key === key)?.name || key
