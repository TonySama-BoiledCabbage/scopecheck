import { z } from 'zod'

const Phase = z.enum(['research', 'concept', 'development', 'delivery'])
export const PlacementSchema = z.object({
  itemId: z.string().nullable(), phase: Phase.nullable(), date: z.iso.date().nullable(),
  origin: z.enum(['system', 'user']), reason: z.string().max(2000), revision: z.number().int().nonnegative(),
})
export type Placement = z.infer<typeof PlacementSchema>
export const SourceSchema = z.object({
  id: z.string().min(1), hash: z.string().regex(/^[a-f0-9]{64}$/), batchId: z.string(),
  name: z.string().max(500), aliases: z.array(z.string()), mime: z.string(), size: z.number().int().nonnegative(),
  importedAt: z.iso.datetime(), status: z.enum(['queued', 'processing', 'ready', 'error']),
  error: z.string(), parser: z.string(), warnings: z.array(z.string()),
})
export type Source = z.infer<typeof SourceSchema>
export const ExtractedUnitSchema = z.object({
  text: z.string().trim().min(1).max(10000), locator: z.string().max(1000),
  page: z.number().int().positive().nullable(),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
  startSeconds: z.number().nonnegative().nullable(), endSeconds: z.number().nonnegative().nullable(),
  eventTimeRaw: z.string().nullable(), occurredAt: z.iso.datetime({offset:true}).nullable(),
  author: z.string().nullable(),
})
export type ExtractedUnit = z.infer<typeof ExtractedUnitSchema>
export const ExtractionSchema = z.object({
  parser: z.string().min(1), warnings: z.array(z.string()).max(200), units: z.array(ExtractedUnitSchema).min(1).max(1000),
})
export type Extraction = z.infer<typeof ExtractionSchema>
export function uncertaintiesFor(text:string) {
  return [
    /下周|明天|后天|next week|tomorrow|asap/i.test(text)?'相对日期需核对发生时间和时区。':'',
    /修改次数|一轮|几轮|revision|allowance/i.test(text)?'修改额度及合同归属尚需人工确认。':'',
    /批准|同意|approved|sign.?off/i.test(text)?'批准身份及依据未验证，不代表合同授权。':'',
    /加长|长一点|短一点|longer|shorter/i.test(text)&&!/[0-9]/.test(text)?'未提供具体尺寸。':'',
  ].filter(Boolean)
}
export const ReviewSchema = z.object({
  status:z.enum(['unreviewed','confirmed','dismissed']).default('unreviewed'),
  revision:z.number().int().nonnegative().default(0),at:z.iso.datetime().nullable().default(null),
  acknowledged:z.boolean().default(false),
})
export const AiSuggestionsSchema=z.object({suggestions:z.array(z.object({
  evidenceIndex:z.number().int().nonnegative(),quote:z.string().trim().min(1).max(10000),
  title:z.string().trim().min(1).max(160),description:z.string().trim().min(1).max(5000),
  uncertainties:z.array(z.string().trim().min(1).max(500)).max(10),
  dateHint:z.object({quote:z.string().min(1).max(500),date:z.iso.date()}).strict().optional(),
}).strict()).max(40)}).strict()
export type AiSuggestions=z.infer<typeof AiSuggestionsSchema>
export const BlockSchema = z.object({
  id: z.string(), sourceId: z.string(), unitKey: z.string(), title: z.string().max(160),
  evidence: ExtractedUnitSchema, placement: PlacementSchema, createdAt: z.iso.datetime(),
  quote:z.string().max(10000).default(''),engine:z.enum(['rules','ollama','manual']).default('rules'),description:z.string().max(5000).default(''),
  uncertainties:z.array(z.string().max(500)).default([]),
  review:ReviewSchema.default({status:'unreviewed',revision:0,at:null,acknowledged:false}),
  commit:z.object({itemId:z.string(),changeId:z.string().nullable()}).nullable().default(null),
}).transform(b=>({...b,uncertainties:[...new Set([...b.uncertainties,...uncertaintiesFor(b.evidence.text+' '+b.title+' '+b.description)])]}))
export type InformationBlock = z.infer<typeof BlockSchema>
