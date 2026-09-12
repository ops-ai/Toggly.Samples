import {requireFeature} from '@ops-ai/toggly-sveltekit/server';
import type {Actions,PageServerLoad} from './$types';
export const actions:Actions={submit:async event=>{
 // A server action must check again: hiding a button is not authorization or an action guard.
 await requireFeature(event,'enhanced-submit');
 return {message:'The enhanced-submit server gate allowed this action.'};
}};

// A server load can gate a route before any protected feature content is returned.
export const load:PageServerLoad=async event=>{
 if(event.params.section==='framework')await requireFeature(event,'beta-access');
 return {};
};
