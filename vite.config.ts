import { defineConfig, loadEnv } from 'vite'
import { parserPlugin } from './scripts/parser-plugin'
import { localAiPlugin } from './scripts/local-ai-plugin'
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'FRAME_')
  for(const key of ['FRAME_PARSER_PATH','FRAME_MODELS_PATH'])if(env[key])process.env[key]=env[key]
  return {plugins:[parserPlugin(env.FRAME_PYTHON),localAiPlugin()]}
})
