import { createTogglyClient, createTogglyRequest } from '@ops-ai/solid-feature-flags-toggly/server';
import { getRequestEvent } from 'solid-js/web';
import { keys, defaults, presets } from '../catalog';
// Backend rules/key remain in this server module. Only the client's definition cache is
// shared; identity, claims and entity context are passed for each evaluation below.
const backend=createTogglyClient({appKey:process.env.TOGGLY_BACKEND_APP_KEY,environment:process.env.TOGGLY_ENVIRONMENT??'Production',baseUrl:process.env.TOGGLY_BASE_URL,featureDefaults:defaults,verifySignatures:true,enableFileCache:false,enableUsageTracking:false,enableMetrics:false,registerContextsOnStartup:false});
const initialized=backend.init();
// The process owner closes the shared client; disposing a request never closes it.
const close=()=>{void backend.close();};
process.once('SIGTERM',close);
// Development HMR also owns a lifecycle: release the replaced client's resources.
import.meta.hot?.dispose(()=>{process.off('SIGTERM',close);close();});
export async function requestScope(matching:boolean,request=getRequestEvent()!.request){
 await initialized;
 // These UI-selected presets demonstrate targeting, not authentication. Replace with
 // your verified session principal before using this pattern for real protected work.
 const principal=matching?presets.Matching:presets['Non-matching'];
 return createTogglyRequest({client:backend,request,context:principal,
  // Deliberate public projection. Never serialize session tokens or private claims.
  clientContext:principal,
  frontend:{appKey:process.env.VITE_TOGGLY_APP_KEY,environment:process.env.VITE_TOGGLY_ENVIRONMENT??'Production',baseURI:process.env.VITE_TOGGLY_BASE_URL,expose:keys,flagDefaults:defaults}});
}
export async function loadFlags(matching:boolean){const scope=await requestScope(matching);try{return {snapshot:await scope.snapshot(),backendConfigured:Boolean(process.env.TOGGLY_BACKEND_APP_KEY)};}finally{scope.dispose();}}
