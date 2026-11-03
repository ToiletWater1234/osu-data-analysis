// Names supplied by the site owner; shared by both the trial and legacy UI.
const NAMES = Object.freeze({
  RC:'常规',LN:'面条',Stream:'单乱',Chordstream:'复合流',Jacks:'叠键',Jack:'叠键',
  Coordination:'协调',Density:'面切',Wildcard:'面条综合',Rolls:'楼梯',Trills:'交互',
  Minitrills:'短交互',Jumptrill:'对拍',Jumpstream:'双押切',Handstream:'三押切',
  Longjacks:'纵叠',Chordjacks:'大叠',Minijacks:'小叠',Quadstream:'四押切',Gluts:'叠技',
  'Column Lock':'锁手',Release:'放手',Shield:'盾',Inverse:'反键',
  'JS Density':'双押面切','HS Density':'三押面切','DS Density':'双流面切',
  'DCS Density':'高密复合面切','LCS Density':'轻复合面切',
  'Jacky WC':'叠键型面条综合','Speedy WC':'速度型面条综合',
  'Split Trill':'对切',SplitTrill:'对切',Brackets:'括号','Double Stream':'双流',
  'Dense Chordstream':'高密复合流','Light Chordstream':'轻复合流','Chord Rolls':'和弦楼梯',
});
export function maniaName(name) { return NAMES[name] || String(name || '未分类'); }
export function maniaCategoryName(name) {
  let result=String(name||'未分类');
  for(const [key,value] of Object.entries(NAMES).sort((a,b)=>b[0].length-a[0].length))result=result.replaceAll(key,value);
  return result.replaceAll('Uncategorised','未分类').replaceAll('Hybrid','混合型').replaceAll('Tech','技术型');
}
