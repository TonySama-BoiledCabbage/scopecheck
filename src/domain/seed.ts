import type { ProjectState, Item } from './model.ts'

const item = (id: string, title: string, phase: Item['phase'], start: string | null, end: string | null, remainingDays: number | null, status: Item['status'] = 'planned', kind: Item['kind'] = 'task'): Item => ({id, title, phase, start, end, remainingDays, status, kind, goal: '', scopeRisk: false})
export function createSeed(): ProjectState {
  return {
    schemaVersion: 2, revision: 0, dataRevision: 0, sources: [], blocks: [],
    project: {id: 'arc-demo', name: 'ARC · 桌面照明系统', client: 'North Objects', start: '2026-10-05', manualDurationDays: null, demo: true, archived: false},
    items: [
      item('research', '使用场景与竞品研究', 'research', '2026-10-05', '2026-10-09', 0, 'done'),
      {...item('brief', '设计定义与产品方向', 'research', '2026-10-08', '2026-10-12', 0, 'done', 'stage'), goal: '紧凑桌面场景；可调节光源；保留可拆解结构。'},
      item('sketch', '形态探索与草图', 'concept', '2026-10-13', '2026-10-19', 4, 'active'),
      item('concept-review', '概念方案评审', 'concept', '2026-10-20', '2026-10-20', 0, 'planned', 'milestone'),
      item('cad', '结构与 CAD 建模', 'development', '2026-10-21', '2026-10-29', 7),
      item('cmf', 'CMF 材质与表面处理', 'development', '2026-10-22', '2026-10-28', 4),
      item('prototype', '样机制作与测试', 'development', '2026-10-30', '2026-11-05', null),
      item('design-freeze', '设计冻结', 'development', '2026-11-06', '2026-11-06', 0, 'planned', 'milestone'),
      item('handoff', '生产文件与交付说明', 'delivery', '2026-11-09', '2026-11-12', 4),
      item('delivery', '最终设计交付', 'delivery', '2026-11-13', '2026-11-13', 0, 'planned', 'milestone'),
      item('packaging', '包装运输约束核对', 'delivery', null, null, null),
    ],
    relations: [
      {id: 'r1', source: 'research', target: 'brief', type: 'derivation'},
      {id: 'r2', source: 'brief', target: 'sketch', type: 'dependency'},
      {id: 'r3', source: 'sketch', target: 'concept-review', type: 'dependency'},
      {id: 'r4', source: 'concept-review', target: 'cad', type: 'dependency'},
      {id: 'r5', source: 'cad', target: 'prototype', type: 'dependency'},
      {id: 'r6', source: 'prototype', target: 'design-freeze', type: 'dependency'},
      {id: 'r7', source: 'design-freeze', target: 'handoff', type: 'dependency'},
      {id: 'r8', source: 'handoff', target: 'delivery', type: 'dependency'},
      {id: 'r9', source: 'cmf', target: 'prototype', type: 'impact'},
    ],
    baselines: [{id: 'baseline-1', version: 1, createdAt: '2026-10-05T14:00:00.000Z', deliveryDate: '2026-11-13',
      milestones: {'concept-review': '2026-10-20', 'design-freeze': '2026-11-06', delivery: '2026-11-13'},
      stageGoals: {brief: '紧凑桌面场景；可调节光源；保留可拆解结构。'}, scopeItems: {},
      allowance: {type: 'per_round', included: 3, rule: '虚构演示条款：包含 3 轮设计修改。同一轮评审的多条反馈合并计为一轮。新增功能需单独确认范围。'},
      constraints: '虚构演示条款：交付 CAD、CMF 方案及设计说明；新增功能、交付范围或正式期限需书面确认。',
      evidence: '仅用于演示的虚构合同及批准记录，不对应真实客户。', approvedBy: '示例客户（虚构）', approvedAt: '2026-10-05'}],
    allowanceUses: [{key: 'per_round:DEMO-R01', units: 1, changeId: 'seed-revision'}],
    events: [{id: 'seed-event', at: '2026-10-05T14:00:00.000Z', actor: '演示数据', type: 'demo_initialized',
      summary: '载入虚构示例项目：基线 v1，已使用 1 轮修改；日期和批准记录仅供演示。',
      before: null, after: {baselineVersion: 1, consumed: 1}, change: null}],
  }
}
