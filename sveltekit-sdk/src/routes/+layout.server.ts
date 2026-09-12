import {loadToggly} from '@ops-ai/toggly-sveltekit/server';
import {env} from '$env/dynamic/private';
import {env as publicEnv} from '$env/dynamic/public';
import {filters,preset,vip,standard} from '$lib/catalog';
import type {LayoutServerLoad} from './$types';
export const load:LayoutServerLoad=async event=>{
 // Reading this query parameter makes SvelteKit rerun the layout when demo identity changes.
 const matching=event.url.searchParams.get('preset')!=='non-matching';
 const entity=matching?vip:standard;
 return {toggly:await loadToggly(event),publicKey:publicEnv.PUBLIC_TOGGLY_APP_KEY??'',environment:publicEnv.PUBLIC_TOGGLY_ENVIRONMENT??'Production',offline:!env.TOGGLY_APP_KEY||!publicEnv.PUBLIC_TOGGLY_APP_KEY,matching,context:preset(matching),matrix:await Promise.all(filters.map(async flag=>({key:flag.featureKey,enabled:await event.locals.toggly.isEnabled(flag.featureKey,{entity})}))),vipEnabled:await event.locals.toggly.isEnabled('ExpressCheckout',{entity:vip}),standardEnabled:await event.locals.toggly.isEnabled('ExpressCheckout',{entity:standard})};
};
