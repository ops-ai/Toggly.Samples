import { createApp } from './app.js'
import { startFixture } from './fixture.js'
const fixture=process.argv.includes('--offline')?await startFixture():undefined
const app=await createApp({appKey:process.env.TOGGLY_APP_KEY,environment:process.env.TOGGLY_ENVIRONMENT,fixtureUrl:fixture?.baseUrl})
await app.listen(Number(process.env.PORT || 3000),'127.0.0.1')
console.log(`NestJS SDK Sample: ${await app.getUrl()} (${fixture?'offline fixture':'configured/default mode'})`)
if(fixture){const close=app.close.bind(app);app.close=async()=>{await close();await fixture.close()}}
