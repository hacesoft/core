/** Device-local location stream. No samples are persisted or sent to a server. */
export interface LocationSample {
  readonly point: Readonly<{lat:number; lon:number}>
  readonly accuracyM:number|null; readonly altitudeM:number|null; readonly altitudeAccuracyM:number|null
  readonly headingDeg:number|null; readonly speedMps:number|null; readonly timestamp:number
}
export interface LocationError { code:'permission_denied'|'position_unavailable'|'timeout'|'unsupported'; message:string }
export interface LocationOptions {
  enableHighAccuracy?:boolean; timeoutMs?:number; maximumAgeMs?:number
  minIntervalMs?:number; minDistanceM?:number; signal?:AbortSignal
  onPosition?:(sample:LocationSample)=>void; onError?:(error:LocationError)=>void
}
export interface LocationTracker {
  getLast():LocationSample|null
  subscribe(listener:(sample:LocationSample)=>void):()=>void
  stop():void; destroy():void
}
const finite=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null
const distance=(a:LocationSample,b:LocationSample):number=>{
  const rad=Math.PI/180,dy=(b.point.lat-a.point.lat)*rad,dx=(b.point.lon-a.point.lon)*rad
  const h=Math.sin(dy/2)**2+Math.cos(a.point.lat*rad)*Math.cos(b.point.lat*rad)*Math.sin(dx/2)**2
  return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)))
}
export function watchLocation(options:LocationOptions={}):LocationTracker {
  for(const key of ['timeoutMs','maximumAgeMs','minIntervalMs','minDistanceM'] as const){
    const value=options[key];if(value!==undefined&&(!Number.isFinite(value)||value<0))throw new TypeError(key+' must be finite and non-negative')
  }
  let id:number|null=null,stopped=false,destroyed=false,last:LocationSample|null=null,lastAt=0
  const listeners=new Set<(sample:LocationSample)=>void>()
  if(options.onPosition)listeners.add(options.onPosition)
  const stop=()=>{if(stopped)return;stopped=true;if(id!==null){navigator.geolocation.clearWatch(id);id=null}options.signal?.removeEventListener('abort',stop)}
  const tracker:LocationTracker={getLast:()=>last,subscribe(fn){if(destroyed)return()=>{};listeners.add(fn);return()=>{listeners.delete(fn)}},stop,destroy(){if(destroyed)return;stop();destroyed=true;listeners.clear();last=null}}
  const fail=(code:LocationError['code'],message:string)=>{if(stopped)return;if(code==='permission_denied'||code==='unsupported')stop();options.onError?.({code,message})}
  if(options.signal?.aborted){stop();return tracker}
  options.signal?.addEventListener('abort',stop,{once:true})
  if(!navigator.geolocation){queueMicrotask(()=>fail('unsupported','Geolocation is unavailable.'));return tracker}
  try{
    id=navigator.geolocation.watchPosition(position=>{
      if(stopped)return
      const c=position.coords,lat=finite(c.latitude),lon=finite(c.longitude),timestamp=finite(position.timestamp)
      if(lat===null||lon===null||timestamp===null||Math.abs(lat)>90||Math.abs(lon)>180){fail('position_unavailable','Invalid location sample.');return}
      const sample:LocationSample=Object.freeze({point:Object.freeze({lat,lon}),accuracyM:finite(c.accuracy),altitudeM:finite(c.altitude),altitudeAccuracyM:finite(c.altitudeAccuracy),headingDeg:finite(c.heading),speedMps:finite(c.speed),timestamp})
      const now=performance.now()
      if(last&&(timestamp<=last.timestamp||now-lastAt<(options.minIntervalMs??0)||distance(last,sample)<(options.minDistanceM??0)))return
      last=sample;lastAt=now
      for(const fn of [...listeners]){if(stopped)break;try{fn(sample)}catch(error){console.error('[Core location] Subscriber failed',error)}}
    },error=>fail(error.code===1?'permission_denied':error.code===3?'timeout':'position_unavailable',error.message),{enableHighAccuracy:options.enableHighAccuracy??true,timeout:options.timeoutMs??10000,maximumAge:options.maximumAgeMs??5000})
    // Also handle test adapters that invoke callbacks synchronously during registration.
    if(stopped&&id!==null){navigator.geolocation.clearWatch(id);id=null}
  }catch(error){fail('position_unavailable',error instanceof Error?error.message:String(error));stop()}
  return tracker
}
export interface FollowMap {
  getViewport():{zoom:number}
  setCenter(point:{lat:number;lon:number},zoom?:number):void
  on(event:'manualPan'|'locationRequested'|'destroyed',listener:()=>void):()=>void
}
export function followLocation(map:FollowMap,tracker:LocationTracker,options:{keepZoom?:boolean;disableOnManualPan?:boolean;recenterOnStart?:boolean}={}){
  let enabled=true,destroyed=false
  const initialZoom=map.getViewport().zoom
  const center=(sample:LocationSample)=>{if(enabled&&!destroyed)map.setCenter(sample.point,options.keepZoom===false?initialZoom:map.getViewport().zoom)}
  const enable=()=>{if(destroyed)return;enabled=true;const last=tracker.getLast();if(last)center(last)}
  const offPosition=tracker.subscribe(center)
  const offPan=map.on('manualPan',()=>{if(options.disableOnManualPan!==false)enabled=false})
  const offLocate=map.on('locationRequested',enable)
  let offDestroy=()=>{}
  const destroy=()=>{if(destroyed)return;destroyed=true;enabled=false;offPosition();offPan();offLocate();offDestroy()}
  offDestroy=map.on('destroyed',destroy)
  if(options.recenterOnStart!==false){const last=tracker.getLast();if(last)center(last)}
  return {enable,disable(){enabled=false},isEnabled:()=>enabled&&!destroyed,destroy}
}
