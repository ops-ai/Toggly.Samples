import {expect,it} from 'vitest';
import {createTogglyClient} from '@ops-ai/toggly-sveltekit/server';
import {filters,preset,vip,standard} from '../src/lib/catalog';
it('runs shared filter presets through the actual Node evaluator',async()=>{
 const client=createTogglyClient();await client.init();for(const f of filters)client.state.definitions.set(f.featureKey,f);
 for(const f of filters){
  const matching=await client.isFeatureOn(f.featureKey,preset(true),vip);
  const nonmatching=await client.isFeatureOn(f.featureKey,preset(false),standard);
  if(f.featureKey==='filter-percentage')continue;
  expect(matching,f.featureKey).toBe(true);
  expect(nonmatching,f.featureKey).toBe(['filter-always-on','filter-time-window'].includes(f.featureKey));
 }await client.close();
});
