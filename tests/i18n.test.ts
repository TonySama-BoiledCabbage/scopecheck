import {test} from 'node:test'
import assert from 'node:assert/strict'
import {translate} from '../src/i18n.ts'
test('英文覆盖接入层动作与动态提示，最长匹配不发生二次翻译',()=>{
  assert.equal(translate('保存原件并解析（规则整理）','en'),'Save & Parse (Rules)')
  assert.equal(translate('确认内容','en'),'Confirm Content')
  assert.equal(translate('Ollama 可用 · 1 个本地模型','en'),'Ollama available · 1 local model(s)')
  assert.equal(translate('正式变更审查','en'),'Formal Change Review')
  assert.equal(translate('Ollama 本地 AI 候选','en'),'Ollama Local AI Suggestion')
  assert.equal(translate('QUICK CAPTURE','zh'),'快速捕捉')
  assert.equal(translate('Please add a 9:16 version.','en'),'Please add a 9:16 version.')
  assert.equal(translate('文字 · 第 1 行','en'),'Text · Line 1')
})
