export const MAX_ANALYSIS_SEGMENTS=10;
// Merge adjacent ranges with the least duration-weighted difficulty change.
// Returned merged ranges omit cached RC/LN results, forcing a fresh estimate.
export function limitSegments(input,limit=MAX_ANALYSIS_SEGMENTS){
  if(!Number.isInteger(limit)||limit<1)throw Error('分段上限无效。');
  const ranges=input.map(range=>({...range}));
  const value=(s,key,fallback=0)=>Number.isFinite(s[key])?s[key]:fallback;
  const duration=s=>Math.max(1,s.to-s.from);
  while(ranges.length>limit){
    let best=0,cost=Infinity;
    for(let i=0;i<ranges.length-1;i++){
      const a=ranges[i],b=ranges[i+1],wa=duration(a),wb=duration(b);
      const rc=value(a,'rc',value(a,'level'))-value(b,'rc',value(b,'level'));
      const ln=value(a,'ln')-value(b,'ln');
      const ratio=value(a,'lnRatio')-value(b,'lnRatio');
      const next=(1+rc*rc+ln*ln+16*ratio*ratio)*wa*wb/(wa+wb);
      if(next<cost){cost=next;best=i;}
    }
    const a=ranges[best],b=ranges[best+1],wa=duration(a),wb=duration(b);
    ranges.splice(best,2,{from:a.from,to:b.to,
      level:(value(a,'level',value(a,'rc'))*wa+value(b,'level',value(b,'rc'))*wb)/(wa+wb),
      lnRatio:(value(a,'lnRatio')*wa+value(b,'lnRatio')*wb)/(wa+wb),
      mergedCount:(a.mergedCount||1)+(b.mergedCount||1)});
  }
  return ranges;
}
