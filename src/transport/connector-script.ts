export function getConnectorScript(httpPort: number, wsPort: number): string {
  return `(function(){
if(window.__MCP_BROWSER_LENS__){console.log('[BrowserLens] Already active.');return}
window.__MCP_BROWSER_LENS__=true;
var WS_URL='ws://localhost:'+${wsPort};
var HTTP_URL='http://localhost:'+${httpPort}+'/ingest';
var ws=null,mutQueue=[],sendQueue=[];
var SKIP_TAGS={SCRIPT:1,STYLE:1,META:1,LINK:1,NOSCRIPT:1,BR:1,TEMPLATE:1};
var CSS_PROPS=['color','backgroundColor','fontSize','fontFamily','fontWeight','fontStyle','lineHeight','letterSpacing','textAlign','textDecoration','textTransform','display','position','top','right','bottom','left','width','height','minWidth','minHeight','maxWidth','maxHeight','margin','marginTop','marginRight','marginBottom','marginLeft','padding','paddingTop','paddingRight','paddingBottom','paddingLeft','borderWidth','borderStyle','borderColor','borderRadius','borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius','overflow','overflowX','overflowY','opacity','visibility','zIndex','transform','transition','animation','boxShadow','cursor','flexDirection','flexWrap','justifyContent','alignItems','alignSelf','flexGrow','flexShrink','flexBasis','gap','gridTemplateColumns','gridTemplateRows','gridColumn','gridRow','whiteSpace','wordBreak','textOverflow','outline','backgroundImage','backgroundSize','backgroundPosition','backgroundRepeat','float','clear','verticalAlign','listStyleType','boxSizing'];

function log(msg){console.log('[BrowserLens] '+msg);}
function err(msg,e){console.error('[BrowserLens] '+msg,e||'');}

function buildSelector(el){
  if(!el||!el.tagName)return'unknown';
  if(el.id)return'#'+el.id;
  var s=el.tagName.toLowerCase();
  if(el.className&&typeof el.className==='string'){
    var cls=el.className.trim().split(/\\s+/).filter(Boolean).slice(0,3).join('.');
    if(cls)s+='.'+cls;
  }
  var p=el.parentElement;
  if(p&&p!==document.documentElement&&p!==document.body){
    var siblings=Array.from(p.children).filter(function(c){return c.tagName===el.tagName});
    if(siblings.length>1){
      var idx=siblings.indexOf(el);
      if(idx>=0)s+=':nth-child('+(idx+1)+')';
    }
  }
  return s;
}

function captureDomNode(el,depth,maxDepth){
  if(!el||!el.tagName||depth>maxDepth)return null;
  var tag=el.tagName;
  if(SKIP_TAGS[tag])return null;
  var attrs={};
  try{for(var i=0;i<Math.min(el.attributes.length,20);i++){var a=el.attributes[i];attrs[a.name]=a.value.slice(0,200);}}catch(e){}
  var children=[];
  if(depth<maxDepth){
    var ch=el.children;
    for(var j=0;j<Math.min(ch.length,40);j++){
      var c=captureDomNode(ch[j],depth+1,maxDepth);
      if(c)children.push(c);
    }
  }
  var text='';
  try{text=el.textContent||'';if(text.length>200)text=text.slice(0,200)+'...';if(children.length>0)text='';}catch(e){}
  return{
    selector:buildSelector(el),tagName:tag.toLowerCase(),id:el.id||'',
    classNames:el.className&&typeof el.className==='string'?el.className.trim().split(/\\s+/).filter(Boolean):[],
    attributes:attrs,textContent:text,innerHTML:'',outerHTML:'',
    childCount:el.children.length,children:children,depth:depth
  };
}

function captureDom(){
  try{
    var root=captureDomNode(document.documentElement,0,8);
    if(!root)return null;
    var total=document.querySelectorAll('*').length;
    var semantic=[];
    ['header','nav','main','aside','footer','section','article','form'].forEach(function(tag){
      document.querySelectorAll(tag).forEach(function(el){
        semantic.push({tag:tag,role:el.getAttribute('role')||'',label:el.getAttribute('aria-label')||'',selector:buildSelector(el),children:[]});
      });
    });
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(el){
      semantic.push({tag:el.tagName.toLowerCase(),level:parseInt(el.tagName[1]),label:(el.textContent||'').slice(0,100),selector:buildSelector(el),children:[]});
    });
    log('DOM captured: '+total+' elements');
    return{timestamp:Date.now(),url:location.href,title:document.title,doctype:'html',charset:document.characterSet,
      viewport:{width:window.innerWidth,height:window.innerHeight,scrollX:window.scrollX,scrollY:window.scrollY,devicePixelRatio:window.devicePixelRatio,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},
      rootElement:root,totalElements:total,semanticStructure:semantic};
  }catch(e){err('DOM capture failed',e);return null;}
}

function captureElementDetail(el){
  try{
    var sel=buildSelector(el);
    var cs=getComputedStyle(el);
    var styles={};
    CSS_PROPS.forEach(function(p){try{styles[p]=cs.getPropertyValue(p.replace(/[A-Z]/g,function(m){return'-'+m.toLowerCase()}))||cs[p]||'';}catch(e){styles[p]='';}});
    var rect=el.getBoundingClientRect();
    var layout={
      selector:sel,tagName:el.tagName.toLowerCase(),
      box:{width:rect.width,height:rect.height,padding:{top:parseFloat(cs.paddingTop)||0,right:parseFloat(cs.paddingRight)||0,bottom:parseFloat(cs.paddingBottom)||0,left:parseFloat(cs.paddingLeft)||0},margin:{top:parseFloat(cs.marginTop)||0,right:parseFloat(cs.marginRight)||0,bottom:parseFloat(cs.marginBottom)||0,left:parseFloat(cs.marginLeft)||0},border:{top:parseFloat(cs.borderTopWidth)||0,right:parseFloat(cs.borderRightWidth)||0,bottom:parseFloat(cs.borderBottomWidth)||0,left:parseFloat(cs.borderLeftWidth)||0},contentWidth:Math.max(0,rect.width-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0)-(parseFloat(cs.borderLeftWidth)||0)-(parseFloat(cs.borderRightWidth)||0)),contentHeight:Math.max(0,rect.height-(parseFloat(cs.paddingTop)||0)-(parseFloat(cs.paddingBottom)||0)-(parseFloat(cs.borderTopWidth)||0)-(parseFloat(cs.borderBottomWidth)||0))},
      position:{type:cs.position,top:rect.top,left:rect.left,right:rect.right,bottom:rect.bottom,offsetParent:el.offsetParent?buildSelector(el.offsetParent):'',boundingRect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}},
      display:cs.display,overflow:{x:cs.overflowX,y:cs.overflowY},zIndex:cs.zIndex,transform:cs.transform,opacity:cs.opacity,visibility:cs.visibility
    };
    if(cs.display==='flex'||cs.display==='inline-flex')layout.flexInfo={direction:cs.flexDirection,wrap:cs.flexWrap,justifyContent:cs.justifyContent,alignItems:cs.alignItems,gap:cs.gap,children:[]};
    if(cs.display==='grid'||cs.display==='inline-grid')layout.gridInfo={templateColumns:cs.gridTemplateColumns,templateRows:cs.gridTemplateRows,gap:cs.gap,areas:cs.gridTemplateAreas,children:[]};
    var snap=captureDomNode(el,0,2);
    var acc=null;
    if(el.getAttribute('role')||el.getAttribute('aria-label')||el.tabIndex>=0){
      acc={selector:sel,tagName:el.tagName.toLowerCase(),role:el.getAttribute('role')||undefined,ariaLabel:el.getAttribute('aria-label')||undefined,ariaDescribedBy:el.getAttribute('aria-describedby')||undefined,ariaHidden:el.getAttribute('aria-hidden')==='true',tabIndex:el.tabIndex,altText:el.getAttribute('alt')||undefined,hasLabel:!!(el.getAttribute('aria-label')||el.getAttribute('title')),issues:[]};
    }
    return{snapshot:snap,computedStyle:{selector:sel,tagName:el.tagName.toLowerCase(),styles:styles,appliedClasses:el.className&&typeof el.className==='string'?el.className.trim().split(/\\s+/).filter(Boolean):[],matchedRules:[]},layout:layout,accessibility:acc};
  }catch(e){err('Element detail failed for '+buildSelector(el),e);return null;}
}

function captureTopElements(){
  var elements={};
  try{
    var els=document.querySelectorAll('body > *');
    var count=0;
    function addEl(el){
      if(count>=30||SKIP_TAGS[el.tagName])return;
      var d=captureElementDetail(el);
      if(d){elements[buildSelector(el)]=d;count++;}
      var ch=el.children;
      for(var i=0;i<Math.min(ch.length,5)&&count<30;i++){
        if(!SKIP_TAGS[ch[i].tagName]){var cd=captureElementDetail(ch[i]);if(cd){elements[buildSelector(ch[i])]=cd;count++;}}
      }
    }
    for(var i=0;i<els.length;i++)addEl(els[i]);
    log('Elements captured: '+count);
  }catch(e){err('Top elements capture failed',e);}
  return elements;
}

function captureCssVars(){
  var vars={},count=0;
  try{
    var cs=getComputedStyle(document.documentElement);
    for(var i=0;i<cs.length;i++){
      if(cs[i].startsWith('--')){vars[cs[i]]=cs.getPropertyValue(cs[i]).trim();count++;}
    }
    try{
      var sheets=document.styleSheets;
      for(var s=0;s<sheets.length;s++){
        try{var rules=sheets[s].cssRules;if(!rules)continue;
          for(var r=0;r<rules.length;r++){if(rules[r].style){for(var p=0;p<rules[r].style.length;p++){var prop=rules[r].style[p];if(prop.startsWith('--')&&!vars[prop]){vars[prop]=rules[r].style.getPropertyValue(prop).trim();count++;}}}}
        }catch(e){}
      }
    }catch(e){}
    log('CSS vars captured: '+count);
  }catch(e){err('CSS vars failed',e);}
  return{timestamp:Date.now(),variables:vars,totalCount:count};
}

function captureTypography(){
  var fontMap={};
  try{
    var textEls=document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,span,a,li,td,th,label,button,input,textarea,div');
    for(var i=0;i<Math.min(textEls.length,200);i++){
      var el=textEls[i];
      if(!el.textContent||!el.textContent.trim())continue;
      var cs=getComputedStyle(el);
      var key=cs.fontFamily+'|'+cs.fontSize+'|'+cs.fontWeight+'|'+cs.lineHeight;
      if(!fontMap[key])fontMap[key]={family:cs.fontFamily,size:cs.fontSize,weight:cs.fontWeight,lineHeight:cs.lineHeight,color:cs.color,selector:buildSelector(el),count:0};
      fontMap[key].count++;
    }
  }catch(e){err('Typography failed',e);}
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
  try{
    var els=document.querySelectorAll('*');
    for(var i=0;i<Math.min(els.length,300);i++){
      var cs=getComputedStyle(els[i]);
      var sel=buildSelector(els[i]);
      function addC(map,val){if(!val||val==='transparent'||val==='rgba(0, 0, 0, 0)')return;var hex=rgbToHex(val);if(!map[hex])map[hex]={value:val,hex:hex,count:0,elements:[]};map[hex].count++;if(map[hex].elements.length<5)map[hex].elements.push(sel);}
      addC(colorMap,cs.color);addC(bgMap,cs.backgroundColor);addC(borderMap,cs.borderColor);
    }
  }catch(e){err('Colors failed',e);}
  var all=Object.assign({},colorMap,bgMap,borderMap);
  return{timestamp:Date.now(),colors:Object.values(colorMap).sort(function(a,b){return b.count-a.count}),backgroundColors:Object.values(bgMap).sort(function(a,b){return b.count-a.count}),borderColors:Object.values(borderMap).sort(function(a,b){return b.count-a.count}),totalUniqueColors:Object.keys(all).length};
}

function captureAccessibility(){
  var elements=[];
  var summary={totalInteractive:0,withLabels:0,withoutLabels:0,imagesWithAlt:0,imagesWithoutAlt:0,headingLevels:{},landmarks:[],issues:[]};
  try{
    var interactive=document.querySelectorAll('a,button,input,select,textarea,[tabindex],[role]');
    summary.totalInteractive=interactive.length;
    for(var i=0;i<Math.min(interactive.length,100);i++){
      var el=interactive[i];
      var hasLabel=!!(el.getAttribute('aria-label')||el.getAttribute('title')||(el.textContent||'').trim());
      if(hasLabel)summary.withLabels++;else{summary.withoutLabels++;summary.issues.push('Missing label: '+buildSelector(el));}
      elements.push({selector:buildSelector(el),tagName:el.tagName.toLowerCase(),role:el.getAttribute('role')||undefined,ariaLabel:el.getAttribute('aria-label')||undefined,tabIndex:el.tabIndex,hasLabel:hasLabel,issues:hasLabel?[]:['Missing accessible label']});
    }
    document.querySelectorAll('img').forEach(function(img){if(img.alt)summary.imagesWithAlt++;else{summary.imagesWithoutAlt++;summary.issues.push('Image without alt: '+buildSelector(img));}});
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h){var lv=h.tagName;summary.headingLevels[lv]=(summary.headingLevels[lv]||0)+1;});
    ['banner','navigation','main','complementary','contentinfo'].forEach(function(r){if(document.querySelector('[role="'+r+'"]'))summary.landmarks.push(r);});
  }catch(e){err('Accessibility failed',e);}
  return{timestamp:Date.now(),elements:elements.slice(0,100),summary:summary};
}

function captureResponsive(){
  var bps=[{q:'(max-width: 319px)',matches:false},{q:'(min-width: 320px) and (max-width: 374px)',matches:false},{q:'(min-width: 375px) and (max-width: 767px)',matches:false},{q:'(min-width: 768px) and (max-width: 1023px)',matches:false},{q:'(min-width: 1024px) and (max-width: 1279px)',matches:false},{q:'(min-width: 1280px) and (max-width: 1439px)',matches:false},{q:'(min-width: 1440px)',matches:false}];
  var active=[];
  bps.forEach(function(bp){bp.matches=window.matchMedia(bp.q).matches;if(bp.matches)active.push(bp.q);});
  return{viewport:{width:window.innerWidth,height:window.innerHeight,scrollX:window.scrollX,scrollY:window.scrollY,devicePixelRatio:window.devicePixelRatio,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},activeMediaQueries:active,breakpoints:bps};
}

function captureSpacing(){
  var entries=[],vals={margin:{},padding:{}};
  try{
    var els=document.querySelectorAll('body *');
    for(var i=0;i<Math.min(els.length,50);i++){
      var el=els[i];if(SKIP_TAGS[el.tagName])continue;
      var cs=getComputedStyle(el);
      var m={top:parseFloat(cs.marginTop)||0,right:parseFloat(cs.marginRight)||0,bottom:parseFloat(cs.marginBottom)||0,left:parseFloat(cs.marginLeft)||0};
      var p={top:parseFloat(cs.paddingTop)||0,right:parseFloat(cs.paddingRight)||0,bottom:parseFloat(cs.paddingBottom)||0,left:parseFloat(cs.paddingLeft)||0};
      entries.push({selector:buildSelector(el),margin:m,padding:p,gap:cs.gap||undefined});
      [m.top,m.right,m.bottom,m.left].forEach(function(v){if(v>0)vals.margin[v+'px']=(vals.margin[v+'px']||0)+1;});
      [p.top,p.right,p.bottom,p.left].forEach(function(v){if(v>0)vals.padding[v+'px']=(vals.padding[v+'px']||0)+1;});
    }
  }catch(e){err('Spacing failed',e);}
  return{timestamp:Date.now(),elements:entries,inconsistencies:[],spacingScale:Object.keys(Object.assign({},vals.margin,vals.padding)).sort(function(a,b){return parseFloat(a)-parseFloat(b)})};
}

function captureScreenshot(){
  return new Promise(function(resolve){
    try{
      if(typeof html2canvas==='function'){
        html2canvas(document.body,{useCORS:true,allowTaint:true,scale:1,width:Math.min(window.innerWidth,1440),height:Math.min(window.innerHeight,900),logging:false}).then(function(canvas){
          try{var dataUrl=canvas.toDataURL('image/png');log('Screenshot captured via html2canvas: '+canvas.width+'x'+canvas.height);resolve({timestamp:Date.now(),type:'viewport',width:canvas.width,height:canvas.height,dataUrl:dataUrl,format:'png'});}
          catch(e){err('Canvas toDataURL failed',e);resolve(null);}
        }).catch(function(e){err('html2canvas failed',e);resolve(null);});
      }else{
        log('html2canvas not available, loading from CDN...');
        var script=document.createElement('script');
        script.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload=function(){
          log('html2canvas loaded, capturing...');
          html2canvas(document.body,{useCORS:true,allowTaint:true,scale:1,width:Math.min(window.innerWidth,1440),height:Math.min(window.innerHeight,900),logging:false}).then(function(canvas){
            try{var dataUrl=canvas.toDataURL('image/png');log('Screenshot captured: '+canvas.width+'x'+canvas.height);resolve({timestamp:Date.now(),type:'viewport',width:canvas.width,height:canvas.height,dataUrl:dataUrl,format:'png'});}
            catch(e){err('Canvas toDataURL failed',e);resolve(null);}
          }).catch(function(e){err('html2canvas render failed',e);resolve(null);});
        };
        script.onerror=function(){err('Failed to load html2canvas from CDN');resolve(null);};
        document.head.appendChild(script);
      }
    }catch(e){err('Screenshot capture error',e);resolve(null);}
  });
}

function send(data){
  var payload=typeof data==='string'?data:JSON.stringify(data);
  var size=payload.length;
  if(ws&&ws.readyState===1){
    try{ws.send(payload);return true;}catch(e){err('WS send failed ('+size+' bytes)',e);}
  }
  try{
    return fetch(HTTP_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:size<60000}).then(function(r){
      if(!r.ok)err('HTTP send failed: '+r.status);
      return r.ok;
    }).catch(function(e){err('HTTP send error',e);return false;});
  }catch(e){err('Send failed completely',e);return false;}
}

function fullSync(){
  try{
    log('Syncing...');
    var dom=captureDom();
    var elements=captureTopElements();
    var cssVars=captureCssVars();
    var typo=captureTypography();
    var colors=captureColors();
    var acc=captureAccessibility();
    var resp=captureResponsive();
    var spacing=captureSpacing();
    var muts=mutQueue.splice(0);
    var payload={timestamp:Date.now(),url:location.href,userAgent:navigator.userAgent,dom:dom,elements:elements,cssVariables:cssVars,typography:typo,colors:colors,accessibility:acc,responsive:resp,spacing:spacing};
    if(muts.length)payload.mutations=muts;
    send(payload);
    captureScreenshot().then(function(shot){
      if(shot){
        log('Sending screenshot ('+shot.width+'x'+shot.height+')...');
        send({timestamp:Date.now(),screenshots:[shot]});
      }else{
        err('Screenshot was null - check browser console for html2canvas errors');
      }
    });
    log('Sync complete');
  }catch(e){err('fullSync failed',e);}
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
}catch(e){err('MutationObserver failed',e);}

function connectWs(){
  try{
    ws=new WebSocket(WS_URL);
    ws.onopen=function(){log('WebSocket connected to '+WS_URL);fullSync();};
    ws.onclose=function(){ws=null;log('WebSocket closed, reconnecting in 5s...');setTimeout(connectWs,5000);};
    ws.onerror=function(e){err('WebSocket error',e);try{ws.close();}catch(ex){}};
  }catch(e){err('WebSocket connect failed',e);setTimeout(connectWs,5000);}
}
connectWs();
setInterval(fullSync,15000);
window.addEventListener('beforeunload',function(){try{var payload=JSON.stringify({timestamp:Date.now(),url:location.href});if(navigator.sendBeacon)navigator.sendBeacon(HTTP_URL,payload);}catch(e){}});
log('Initialized! Connecting to '+WS_URL+'...');
})()`;
}
