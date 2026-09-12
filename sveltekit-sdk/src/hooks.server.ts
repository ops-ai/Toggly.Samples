import {env} from '$env/dynamic/private';
import {env as publicEnv} from '$env/dynamic/public';
import {createTogglyClient,createTogglyHandle} from '@ops-ai/toggly-sveltekit/server';
import {defaults,filters,preset} from '$lib/catalog';
// Definitions are shared; identity is supplied per request below, never assigned to this client.
const client=createTogglyClient({appKey:env.TOGGLY_APP_KEY,environment:env.TOGGLY_ENVIRONMENT??'Production',verifySignatures:true,featureDefaults:defaults,enableUsageTracking:false,enableMetrics:false});
await client.init();
if(!env.TOGGLY_APP_KEY) {
 // Offline fixtures exercise the actual evaluator without pretending to be dashboard configuration.
 for(const definition of filters)client.state.definitions.set(definition.featureKey,definition);
 client.state.definitions.set('ExpressCheckout',{...filters[10],featureKey:'ExpressCheckout'});
}
process.once('SIGTERM',()=>{void client.close();});
export const handle=createTogglyHandle({
 client,
 // These demo presets are not authentication. Real apps derive claims from their authenticated session.
 context:event=>preset(event.url.searchParams.get('preset')!=='non-matching'),
 // Only demo identity/groups/role are intentionally made public; private session claims stay server-side.
 clientContext:(_event,context)=>({identity:context.identity,groups:context.groups,claims:context.claims}),
 frontend:{appKey:publicEnv.PUBLIC_TOGGLY_APP_KEY,environment:publicEnv.PUBLIC_TOGGLY_ENVIRONMENT??'Production',expose:[...Object.keys(defaults),'ExpressCheckout'],featureDefaults:defaults,onError:error=>console.error('Frontend snapshot unavailable',error)},
});
