export function getConnectorScript(httpPort: number, wsPort: number): string {
  return `(function(){
if(window.__MCP_BROWSER_LENS__){console.log('[Browser Lens] Already connected.');return}
window.__MCP_BROWSER_LENS__=true;
var WS_URL='ws://localhost:'+${wsPort};
var HTTP_URL='http://localhost:'+${httpPort}+'/ingest';
var ws=null,mutQueue=[],timer=null;
var SKIP_TAGS={SCRIPT:1,STYLE:1,META:1,LINK:1,NOSCRIPT:1,BR:1};
var CSS_PROPS=['color','backgroundColor','fontSize','fontFamily','fontWeight','fontStyle','lineHeight','letterSpacing','textAlign','textDecoration','textTransform','display','position','top','right','bottom','left','width','height','minWidth','minHeight','maxWidth','maxHeight','margin','marginTop','marginRight','marginBottom','marginLeft','padding','paddingTop','paddingRight','paddingBottom','paddingLeft','border','borderWidth','borderStyle','borderColor','borderRadius','borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius','overflow','overflowX','overflowY','opacity','visibility','zIndex','transform','transition','animation','boxShadow','cursor','flexDirection','flexWrap','justifyContent','alignItems','alignSelf','flexGrow','flexShrink','flexBasis','gap','gridTemplateColumns','gridTemplateRows','gridColumn','gridRow','whiteSpace','wordBreak','textOverflow','outline','backgroundImage','backgroundSize','backgroundPosition','backgroundRepeat','float','clear','verticalAlign','listStyleType','boxSizing'];

function buildSelector(el){
  if(el.id)return'#'+el.id;
  var s=el.tagName.toLowerCase();
  if(el.className&&typeof el.className==='string'){
    var cls=el.className.trim().split(/\\s+/).slice(0,3).join('.');
    if(cls)s+='.'+cls;
  }
  var p=el.parentElement;
  if(p&&p!==document.documentElement&&p!==document.body){
    var children=Array.from(p.children).filter(function(c){return c.tagName===el.tagName});
    if(children.length>1){
      var idx=children.indexOf(el);
      s+=':nth-child('+(idx+1)+')';
    }
  }
  return s;
}

function captureDomNode(el,depth,maxDepth){
  if(!el||!el.tagName||depth>maxDepth)return null;
  var tag=el.tagName;
  if(SKIP_TAGS[tag])return null;
  var attrs={};
  for(var i=0;i<el.attributes.length;i++){
    var a=el.attributes[i];
    attrs[a.name]=a.value.slice(0,200);
  }
  var children=[];
  if(depth<maxDepth){
    var ch=el.children;
    for(var j=0;j<Math.min(ch.length,50);j++){
      var c=captureDomNode(ch[j],depth+1,maxDepth);
      if(c)children.push(c);
    }
  }
  var text=el.textContent||'';
  if(text.length>200)text=text.slice(0,200)+'...';
  if(children.length>0)text='';
  return{
    selector:buildSelector(el),
    tagName:tag.toLowerCase(),
    id:el.id||'',
    classNames:el.className&&typeof el.className==='string'?el.className.trim().split(/\\s+/).filter(Boolean):[],
    attributes:attrs,
    textContent:text,
    innerHTML:'',
    outerHTML:'',
    childCount:el.children.length,
    children:children,
    depth:depth
  };
}

function captureDom(){
  var root=captureDomNode(document.documentElement,0,10);
  if(!root)return null;
  var total=document.querySelectorAll('*').length;
  var semantic=[];
  var landmarks=['header','nav','main','aside','footer','section','article','form'];
  landmarks.forEach(function(tag){
    document.querySelectorAll(tag).forEach(function(el){
      semantic.push({tag:tag,role:el.getAttribute('role')||'',label:el.getAttribute('aria-label')||'',selector:buildSelector(el),children:[]});
    });
  });
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(el){
    semantic.push({tag:el.tagName.toLowerCase(),level:parseInt(el.tagName[1]),label:el.textContent.slice(0,100),selector:buildSelector(el),children:[]});
  });
  return{
    timestamp:Date.now(),
    url:location.href,
    title:document.title,
    doctype:document.doctype?document.doctype.name:'html',
    charset:document.characterSet,
    viewport:{width:window.innerWidth,height:window.innerHeight,scrollX:window.scrollX,scrollY:window.scrollY,devicePixelRatio:window.devicePixelRatio,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},
    rootElement:root,
    totalElements:total,
    semanticStructure:semantic
  };
}

function captureElementDetail(el){
  var sel=buildSelector(el);
  var cs=getComputedStyle(el);
  var styles={};
  CSS_PROPS.forEach(function(p){styles[p]=cs.getPropertyValue(p.replace(/[A-Z]/g,function(m){return'-'+m.toLowerCase()}))||cs[p]||'';});
  var rect=el.getBoundingClientRect();
  var layout={
    selector:sel,tagName:el.tagName.toLowerCase(),
    box:{width:rect.width,height:rect.height,padding:{top:parseFloat(cs.paddingTop)||0,right:parseFloat(cs.paddingRight)||0,bottom:parseFloat(cs.paddingBottom)||0,left:parseFloat(cs.paddingLeft)||0},margin:{top:parseFloat(cs.marginTop)||0,right:parseFloat(cs.marginRight)||0,bottom:parseFloat(cs.marginBottom)||0,left:parseFloat(cs.marginLeft)||0},border:{top:parseFloat(cs.borderTopWidth)||0,right:parseFloat(cs.borderRightWidth)||0,bottom:parseFloat(cs.borderBottomWidth)||0,left:parseFloat(cs.borderLeftWidth)||0},contentWidth:rect.width-parseFloat(cs.paddingLeft||'0')-parseFloat(cs.paddingRight||'0')-parseFloat(cs.borderLeftWidth||'0')-parseFloat(cs.borderRightWidth||'0'),contentHeight:rect.height-parseFloat(cs.paddingTop||'0')-parseFloat(cs.paddingBottom||'0')-parseFloat(cs.borderTopWidth||'0')-parseFloat(cs.borderBottomWidth||'0')},
    position:{type:cs.position,top:rect.top,left:rect.left,right:rect.right,bottom:rect.bottom,offsetParent:el.offsetParent?buildSelector(el.offsetParent):'',boundingRect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}},
    display:cs.display,overflow:{x:cs.overflowX,y:cs.overflowY},zIndex:cs.zIndex,transform:cs.transform,opacity:cs.opacity,visibility:cs.visibility
  };
  if(cs.display==='flex'||cs.display==='inline-flex'){
    layout.flexInfo={direction:cs.flexDirection,wrap:cs.flexWrap,justifyContent:cs.justifyContent,alignItems:cs.alignItems,gap:cs.gap,children:[]};
  }
  if(cs.display==='grid'||cs.display==='inline-grid'){
    layout.gridInfo={templateColumns:cs.gridTemplateColumns,templateRows:cs.gridTemplateRows,gap:cs.gap,areas:cs.gridTemplateAreas,children:[]};
  }
  var snap=captureDomNode(el,0,2);
  var acc=null;
  if(el.getAttribute('role')||el.getAttribute('aria-label')||el.tabIndex>=0){
    acc={selector:sel,tagName:el.tagName.toLowerCase(),role:el.getAttribute('role')||undefined,ariaLabel:el.getAttribute('aria-label')||undefined,ariaDescribedBy:el.getAttribute('aria-describedby')||undefined,ariaHidden:el.getAttribute('aria-hidden')==='true',tabIndex:el.tabIndex,altText:el.getAttribute('alt')||undefined,hasLabel:!!(el.getAttribute('aria-label')||el.getAttribute('title')),issues:[]};
  }
  return{snapshot:snap,computedStyle:{selector:sel,tagName:el.tagName.toLowerCase(),styles:styles,appliedClasses:el.className&&typeof el.className==='string'?el.className.trim().split(/\\s+/).filter(Boolean):[],matchedRules:[]},layout:layout,accessibility:acc};
}

function captureTopElements(){
  var elements={};
  var els=document.querySelectorAll('body > *');
  var count=0;
  function addEl(el){
    if(count>=30)return;
    if(SKIP_TAGS[el.tagName])return;
    var sel=buildSelector(el);
    elements[sel]=captureElementDetail(el);
    count++;
    var ch=el.children;
    for(var i=0;i<Math.min(ch.length,5);i++){
      if(count>=30)break;
      if(!SKIP_TAGS[ch[i].tagName]){
        var csel=buildSelector(ch[i]);
        elements[csel]=captureElementDetail(ch[i]);
        count++;
      }
    }
  }
  for(var i=0;i<els.length;i++)addEl(els[i]);
  return elements;
}

function captureCssVars(){
  var vars={},count=0;
  var cs=getComputedStyle(document.documentElement);
  for(var i=0;i<cs.length;i++){
    if(cs[i].startsWith('--')){vars[cs[i]]=cs.getPropertyValue(cs[i]).trim();count++;}
  }
  var sheets=document.styleSheets;
  try{
    for(var s=0;s<sheets.length;s++){
      try{
        var rules=sheets[s].cssRules;
        for(var r=0;r<rules.length;r++){
          if(rules[r].style){
            for(var p=0;p<rules[r].style.length;p++){
              var prop=rules[r].style[p];
              if(prop.startsWith('--')&&!vars[prop]){vars[prop]=rules[r].style.getPropertyValue(prop).trim();count++;}
            }
          }
        }
      }catch(e){}
    }
  }catch(e){}
  return{timestamp:Date.now(),variables:vars,totalCount:count};
}

function captureTypography(){
  var fonts={},fontMap={};
  var textEls=document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,span,a,li,td,th,label,button,input,textarea,div');
  for(var i=0;i<Math.min(textEls.length,200);i++){
    var el=textEls[i];
    if(!el.textContent||!el.textContent.trim())continue;
    var cs=getComputedStyle(el);
    var key=cs.fontFamily+'|'+cs.fontSize+'|'+cs.fontWeight+'|'+cs.lineHeight;
    if(!fontMap[key]){fontMap[key]={family:cs.fontFamily,size:cs.fontSize,weight:cs.fontWeight,lineHeight:cs.lineHeight,color:cs.color,selector:buildSelector(el),count:0};}
    fontMap[key].count++;
  }
  return{timestamp:Date.now(),fonts:Object.values(fontMap).sort(function(a,b){return b.count-a.count}),fontFaces:[]};
}

function rgbToHex(rgb){
  if(!rgb||rgb==='transparent')return'transparent';
  if(rgb.startsWith('#'))return rgb;
  var m=rgb.match(/\\d+/g);
  if(!m||m.length<3)return rgb;
  return'#'+((1<<24)+(parseInt(m[0])<<16)+(parseInt(m[1])<<8)+parseInt(m[2])).toString(16).slice(1);
}

function captureColors(){
  var colorMap={},bgMap={},borderMap={};
  var els=document.querySelectorAll('*');
  for(var i=0;i<Math.min(els.length,300);i++){
    var cs=getComputedStyle(els[i]);
    var sel=buildSelector(els[i]);
    function addColor(map,val){
      if(!val||val==='transparent'||val==='rgba(0, 0, 0, 0)')return;
      var hex=rgbToHex(val);
      if(!map[hex])map[hex]={value:val,hex:hex,count:0,elements:[]};
      map[hex].count++;
      if(map[hex].elements.length<5)map[hex].elements.push(sel);
    }
    addColor(colorMap,cs.color);
    addColor(bgMap,cs.backgroundColor);
    addColor(borderMap,cs.borderColor);
  }
  var all=Object.assign({},colorMap,bgMap,borderMap);
  return{timestamp:Date.now(),colors:Object.values(colorMap).sort(function(a,b){return b.count-a.count}),backgroundColors:Object.values(bgMap).sort(function(a,b){return b.count-a.count}),borderColors:Object.values(borderMap).sort(function(a,b){return b.count-a.count}),totalUniqueColors:Object.keys(all).length};
}

function captureAccessibility(){
  var elements=[];
  var summary={totalInteractive:0,withLabels:0,withoutLabels:0,imagesWithAlt:0,imagesWithoutAlt:0,headingLevels:{},landmarks:[],issues:[]};
  var interactive=document.querySelectorAll('a,button,input,select,textarea,[tabindex],[role]');
  summary.totalInteractive=interactive.length;
  for(var i=0;i<interactive.length;i++){
    var el=interactive[i];
    var hasLabel=!!(el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent.trim());
    if(hasLabel)summary.withLabels++;else{summary.withoutLabels++;summary.issues.push('Missing label: '+buildSelector(el));}
    elements.push({selector:buildSelector(el),tagName:el.tagName.toLowerCase(),role:el.getAttribute('role')||undefined,ariaLabel:el.getAttribute('aria-label')||undefined,tabIndex:el.tabIndex,hasLabel:hasLabel,issues:hasLabel?[]:['Missing accessible label']});
  }
  document.querySelectorAll('img').forEach(function(img){
    if(img.alt)summary.imagesWithAlt++;else{summary.imagesWithoutAlt++;summary.issues.push('Image without alt: '+buildSelector(img));}
  });
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h){
    var lv=h.tagName;
    summary.headingLevels[lv]=(summary.headingLevels[lv]||0)+1;
  });
  ['banner','navigation','main','complementary','contentinfo'].forEach(function(r){
    var el=document.querySelector('[role="'+r+'"]');
    if(el)summary.landmarks.push(r);
  });
  return{timestamp:Date.now(),elements:elements.slice(0,100),summary:summary};
}

function captureResponsive(){
  var bps=[{q:'(max-width: 319px)',matches:false},{q:'(min-width: 320px) and (max-width: 374px)',matches:false},{q:'(min-width: 375px) and (max-width: 767px)',matches:false},{q:'(min-width: 768px) and (max-width: 1023px)',matches:false},{q:'(min-width: 1024px) and (max-width: 1279px)',matches:false},{q:'(min-width: 1280px) and (max-width: 1439px)',matches:false},{q:'(min-width: 1440px)',matches:false}];
  var active=[];
  bps.forEach(function(bp){
    bp.matches=window.matchMedia(bp.q).matches;
    if(bp.matches)active.push(bp.q);
  });
  return{viewport:{width:window.innerWidth,height:window.innerHeight,scrollX:window.scrollX,scrollY:window.scrollY,devicePixelRatio:window.devicePixelRatio,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},activeMediaQueries:active,breakpoints:bps};
}

function captureSpacing(){
  var entries=[];
  var vals={margin:{},padding:{}};
  var els=document.querySelectorAll('body *');
  for(var i=0;i<Math.min(els.length,50);i++){
    var el=els[i];
    if(SKIP_TAGS[el.tagName])continue;
    var cs=getComputedStyle(el);
    var m={top:parseFloat(cs.marginTop)||0,right:parseFloat(cs.marginRight)||0,bottom:parseFloat(cs.marginBottom)||0,left:parseFloat(cs.marginLeft)||0};
    var p={top:parseFloat(cs.paddingTop)||0,right:parseFloat(cs.paddingRight)||0,bottom:parseFloat(cs.paddingBottom)||0,left:parseFloat(cs.paddingLeft)||0};
    entries.push({selector:buildSelector(el),margin:m,padding:p,gap:cs.gap||undefined});
    [m.top,m.right,m.bottom,m.left].forEach(function(v){if(v>0)vals.margin[v+'px']=(vals.margin[v+'px']||0)+1;});
    [p.top,p.right,p.bottom,p.left].forEach(function(v){if(v>0)vals.padding[v+'px']=(vals.padding[v+'px']||0)+1;});
  }
  var scale=Object.keys(Object.assign({},vals.margin,vals.padding)).sort(function(a,b){return parseFloat(a)-parseFloat(b)});
  return{timestamp:Date.now(),elements:entries,inconsistencies:[],spacingScale:scale};
}

function captureScreenshot(){
  try{
    var w=Math.min(window.innerWidth,1200);
    var h=Math.min(window.innerHeight,900);
    var canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    var ctx=canvas.getContext('2d');
    var data='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:12px">'+new XMLSerializer().serializeToString(document.documentElement)+'</div></foreignObject></svg>';
    var img=new Image();
    var blob=new Blob([data],{type:'image/svg+xml;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    return new Promise(function(resolve){
      img.onload=function(){
        ctx.drawImage(img,0,0,w,h);
        URL.revokeObjectURL(url);
        resolve({timestamp:Date.now(),type:'viewport',width:w,height:h,dataUrl:canvas.toDataURL('image/png'),format:'png'});
      };
      img.onerror=function(){URL.revokeObjectURL(url);resolve(null);};
      img.src=url;
    });
  }catch(e){return Promise.resolve(null);}
}

function fullSync(){
  var dom=captureDom();
  var elements=captureTopElements();
  var cssVars=captureCssVars();
  var typo=captureTypography();
  var colors=captureColors();
  var acc=captureAccessibility();
  var resp=captureResponsive();
  var spacing=captureSpacing();
  var muts=mutQueue.splice(0);
  var payload={timestamp:Date.now(),url:location.href,userAgent:navigator.userAgent,dom:dom,elements:elements,cssVariables:cssVars,typography:typo,colors:colors,accessibility:acc,responsive:resp,spacing:spacing,mutations:muts.length?muts:undefined};
  send(JSON.stringify(payload));
  captureScreenshot().then(function(shot){
    if(shot)send(JSON.stringify({timestamp:Date.now(),screenshots:[shot]}));
  });
}

function send(payload){
  if(ws&&ws.readyState===1){ws.send(payload);return;}
  try{navigator.sendBeacon?navigator.sendBeacon(HTTP_URL,payload):fetch(HTTP_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:payload}).catch(function(){});}catch(e){}
}

try{
  var observer=new MutationObserver(function(muts){
    muts.forEach(function(m){
      var entry={timestamp:Date.now(),type:m.type,target:buildSelector(m.target)};
      if(m.type==='attributes'){entry.attributeName=m.attributeName;entry.oldValue=m.oldValue;}
      if(m.type==='childList'){
        entry.addedNodes=Array.from(m.addedNodes).filter(function(n){return n.nodeType===1}).map(function(n){return buildSelector(n)}).slice(0,5);
        entry.removedNodes=Array.from(m.removedNodes).filter(function(n){return n.nodeType===1}).map(function(n){return n.nodeName.toLowerCase()}).slice(0,5);
      }
      mutQueue.push(entry);
    });
  });
  observer.observe(document.documentElement,{childList:true,attributes:true,subtree:true,attributeOldValue:true});
}catch(e){}

function connectWs(){
  try{
    ws=new WebSocket(WS_URL);
    ws.onopen=function(){console.log('[Browser Lens] WebSocket connected');fullSync();};
    ws.onclose=function(){ws=null;setTimeout(connectWs,5000);};
    ws.onerror=function(){try{ws.close();}catch(e){}};
  }catch(e){setTimeout(connectWs,5000);}
}
connectWs();
setInterval(fullSync,15000);
window.addEventListener('beforeunload',function(){fullSync();});
console.log('[Browser Lens] Connected! DOM, CSS, layout, and visual data streaming to IDE.');
})()`;
}
