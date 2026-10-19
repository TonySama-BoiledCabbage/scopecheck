import { z } from 'zod'
import { SourceSchema, BlockSchema } from './capture-model.ts'

export const DateSchema = z.iso.date()
const Id = z.string().min(1).max(160)
const Text = z.string().trim().min(1).max(5000)
export const ItemSchema = z.object({
  id: Id, title: z.string().trim().min(1).max(160),
  kind: z.enum(['task', 'milestone', 'stage']),
  phase: z.enum(['research', 'concept', 'development', 'delivery']),
  status: z.enum(['planned', 'active', 'done']),
  start: DateSchema.nullable(), end: DateSchema.nullable(),
  remainingDays: z.number().int().min(0).max(3650).nullable(),
  goal: z.string().max(5000), scopeRisk: z.boolean(),
}).refine(x => !x.start || !x.end || x.start <= x.end, {message: '结束日期不能早于开始日期', path: ['end']})
  .refine(x => x.kind !== 'milestone' || x.start === x.end, {message: '里程碑是单一日期，开始与结束必须一致', path: ['end']})
export type Item = z.infer<typeof ItemSchema>

export const RelationSchema = z.object({
  id: Id, source: Id, target: Id,
  type: z.enum(['dependency', 'derivation', 'impact']),
})
export type Relation = z.infer<typeof RelationSchema>
export const AllowanceSchema = z.object({
  type: z.enum(['per_round', 'per_request', 'custom']),
  included: z.number().int().min(0).max(10000).nullable(),
  rule: z.string().max(5000),
})
export type Allowance = z.infer<typeof AllowanceSchema>
export const BaselineSchema = z.object({
  id: Id, version: z.number().int().positive(), createdAt: z.iso.datetime(),
  deliveryDate: DateSchema.nullable(), milestones: z.record(Id, DateSchema.nullable()),
  stageGoals: z.record(Id, z.string()), scopeItems: z.record(Id, z.string()), allowance: AllowanceSchema,
  constraints: z.string().max(5000), evidence: z.string().max(5000),
  approvedBy: z.string(), approvedAt: DateSchema.nullable(),
})
export type Baseline = z.infer<typeof BaselineSchema>
export const TargetSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('item'), item: ItemSchema}),
  z.object({kind: z.literal('delivery'), date: DateSchema.nullable()}),
  z.object({kind: z.literal('allowance'), config: AllowanceSchema}),
])
export type Target = z.infer<typeof TargetSchema>
export const DecisionSchema = z.object({
  duration: z.enum(['unchanged', 'changed', 'unknown']),
  durationDays: z.number().int().positive().max(36500).nullable(),
  allowance: z.enum(['yes', 'no', 'unknown']),
  allowanceKey: z.string().max(160), units: z.number().int().positive().max(10000),
  commitment: z.enum(['internal', 'needs_confirmation', 'approved']),
  reason: Text, evidence: z.string().max(5000), approvedBy: z.string().max(160),
  approvedAt: DateSchema.nullable(), relatedSources: z.string().max(5000),
  manualReview: z.boolean(), scopeAuthorized: z.boolean(),
})
export type Decision = z.infer<typeof DecisionSchema>
export const EstimateSchema = z.object({days: z.number().nullable(), end: DateSchema.nullable(), explanation: z.string()})
export const AssessmentSchema = z.object({
  deltaDays: z.number().nullable(), before: EstimateSchema, after: EstimateSchema,
  upstream: z.array(z.string()), downstream: z.array(z.string()), impacts: z.array(z.string()),
  warnings: z.array(z.string()), baseline: BaselineSchema,
  consumed: z.number(), pending: z.number(), remaining: z.number().nullable(),
})
export const ChangeSchema = z.object({
  id: Id, proposedAt: z.iso.datetime(), changedBy: Text,
  baseDataRevision: z.number().int(), original: TargetSchema.nullable(), proposed: TargetSchema,
  assessment: AssessmentSchema, decision: DecisionSchema.nullable(),
  status: z.enum(['proposed', 'pending', 'applied_internal', 'applied_baseline', 'withdrawn']),
  approvedAt: DateSchema.nullable(), outcome: z.string(),
})
export type Change = z.infer<typeof ChangeSchema>
export const EventSchema = z.object({
  id: Id, at: z.iso.datetime(), actor: Text, type: Text, summary: Text,
  before: z.unknown(), after: z.unknown(), change: ChangeSchema.nullable(),
})
export type AuditEvent = z.infer<typeof EventSchema>
export const StateSchema = z.object({
  schemaVersion: z.literal(2), revision: z.number().int().nonnegative(), dataRevision: z.number().int().nonnegative(),
  project: z.object({id: Id, name: Text, client: z.string(), start: DateSchema.nullable(), manualDurationDays: z.number().int().positive().nullable(), demo: z.boolean(), archived: z.boolean().default(false)}),
  items: z.array(ItemSchema), relations: z.array(RelationSchema), baselines: z.array(BaselineSchema).min(1),
  allowanceUses: z.array(z.object({key: Id, units: z.number().int().positive(), changeId: Id})),
  events: z.array(EventSchema),
  sources: z.array(SourceSchema).default([]), blocks: z.array(BlockSchema).default([]),
})
export type ProjectState = z.infer<typeof StateSchema>
export const phaseNames = { research: '调研与定义', concept: '概念设计', development: '设计深化', delivery: '交付与归档' }
export const kindNames = {task: '任务', milestone: '里程碑', stage: '阶段目标'}
export const statusNames = {planned: '未开始', active: '进行中', done: '已完成'}
export const relationNames = {dependency: 'Dependency · 阻塞依赖', derivation: 'Derivation · 来源派生', impact: 'Impact · 潜在影响'}
export const changeStatusNames = {proposed: '审查中', pending: '待确认', applied_internal: '已更新内部计划', applied_baseline: '已更新正式基线', withdrawn: '已撤回'}
