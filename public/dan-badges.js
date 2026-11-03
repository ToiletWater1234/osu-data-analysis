const GREEK=['alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa'];
const SEVEN=['gamma','azimuth','zenith','stellium'];
const SYMBOLS={'α':'alpha','β':'beta','γ':'gamma','δ':'delta','ε':'epsilon','ζ':'zeta','η':'eta','θ':'theta','ι':'iota','κ':'kappa'};

export function danBadge(keys,kind,tier){
  if(![4,7].includes(keys)||!['RC','LN'].includes(kind))return null;
  let text=String(tier||'').trim().toLowerCase();
  if(!text||/[<>]|\bwild\b|\bintro\b/.test(text))return null;
  if(keys===4&&kind==='LN'){
    const number=Number(text.match(/\bln\s*(\d+)\b/)?.[1]);
    if(!Number.isInteger(number)||number<1||number>15)return null;
    return {src:`/images/ln-dans/${number}.png`,alt:`4K 面条 ${tier}`};
  }
  text=text.replace(/[αβγδεζηθικ]/g,c=>SYMBOLS[c]);
  let suffix='';
  if(/(?:mid[/-]high|high[/-]mid)\b/.test(text))suffix='-mid-high';
  else if(/(?:mid[/-]low|low[/-]mid)\b/.test(text))suffix='-mid-low';
  else if(/\bhigh\b/.test(text))suffix='-high';
  else if(/\blow\b/.test(text))suffix='-low';
  const labels=keys===4?GREEK:SEVEN;
  const named=labels.find(label=>new RegExp('\\b'+label+'\\b').test(text));
  const number=text.match(/\b(?:reform|regular|rf|ln)\s*(\d+)\b/)?.[1];
  const level=named||number;
  if(!level)return null;
  if(!named&&(Number(number)<(keys===4?1:0)||Number(number)>10))return null;
  const extension=keys===4&&named?'webp':'svg';
  const relative=keys===4?`reform/${level}${suffix}.${extension}`:`7k/${kind==='LN'?'ln-':''}${level}${suffix}.svg`;
  return {src:'/vendor/mania-tracker-dans/'+relative,alt:`${keys}K ${kind==='LN'?'面条':'常规'} ${tier}`};
}
