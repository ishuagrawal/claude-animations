// All GLSL. Cloth space: panel units, x right, y DOWN. World space: (x, -y, z) so +z faces the camera.
const HEAD = `precision highp float; precision highp int; precision highp sampler2D;
`;
export const NOISE = `
uniform sampler2D uNoise;            // tiling: R fbm, G fine fbm, B fibre (stretched x), A white
float h11(float n){ return fract(sin(n*127.1)*43758.5453); }
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec2  h22(vec2 p){ float n=h21(p); return vec2(n,h21(p+n+7.1)); }
float nz(vec2 p){ return texture(uNoise,p).r; }
`;
// ---------------------------------------------------------------- pigment sprites
export const SPRITE_VS = HEAD + `
layout(location=0) in vec2 aQ;
uniform vec4 uRect; uniform vec3 uM0, uM1; uniform vec4 uUV;
out vec2 vUv, vP, vQ;
void main(){ vQ=aQ; vUv=mix(uUV.xy,uUV.zw,aQ); vP=vec2(dot(uM0,vec3(aQ,1.)),dot(uM1,vec3(aQ,1.))); vec2 n=(vP-uRect.xy)/uRect.zw; gl_Position=vec4(n*2.-1.,0.,1.); }`;
export const SPRITE_FS = HEAD + NOISE + `
in vec2 vUv, vP, vQ;
uniform sampler2D uMain, uAux;
uniform float uRv, uSoft, uEdge, uAlpha, uGlow, uTintA, uNoiseAmt, uGoldMul, uRaiseMul, uEmit; uniform vec3 uTint;
uniform int uRvMode; uniform vec4 uRvP; uniform vec2 uTexel; uniform float uBlur; uniform vec4 uFlat;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;
float orderAt(float baked){
  float n=(texture(uNoise,vP*.0031).g-.5)+(texture(uNoise,vP*.017).r-.5)*.5;
  float o=baked;
  if(uRvMode==1){ // weft rows: uRvP.x = row height, uRvP.y = panel top, uRvP.z = panel height, w = panel left
    float r=floor((vP.y-uRvP.y)/uRvP.x), R=uRvP.z/uRvP.x; float x=fract((vP.x-uRvP.w)/1920.); x=mod(r,2.)<.5?x:1.-x; return (r+x)/R; }
  if(uRvMode==2) o=length(vP-uRvP.xy)/uRvP.z;               // radial from point
  if(uRvMode==3) o=dot(vP-uRvP.xy,vec2(cos(uRvP.z),sin(uRvP.z)))/uRvP.w; // linear sweep
  if(uRvMode==4){ vec2 c=floor(vP/uRvP.x); o=mix(baked,h21(c),uRvP.y); }  // cells pop in random order
  if(uRvMode==5) o=mix(baked,dot(vP-uRvP.xy,vec2(cos(uRvP.z),sin(uRvP.z)))/uRvP.w,.65);
  return o+n*uNoiseAmt;
}
void main(){
  vec4 c=uFlat.a>0.?uFlat:(uBlur>0.?textureLod(uMain,vUv,uBlur):texture(uMain,vUv));
  vec3 a=texture(uAux,vUv).rgb;
  float o=orderAt(uFlat.a>0.?.5:a.r);
  float f=uRv*(1.+uSoft+.02)-o-.01;
  float vis=uRv>=1.?1.:smoothstep(0.,uSoft,f);
  float live=uRv>0.&&uRv<1.?1.:0.;
  float edge=live*vis*exp(-max(f,0.)/max(uEdge,1e-4));
  float tail=smoothstep(1.,.9,uRv); edge*=mix(1.,tail,step(.9,uRv));
  vec3 col=mix(c.rgb,uTint*c.a,uTintA);
  float al=vis*uAlpha;
  o0=vec4(col,c.a)*al;
  float cov=c.a*al;
  o1=vec4(a.g*uGoldMul*cov, a.b*uRaiseMul*cov, (edge*uGlow+uEmit*vis)*c.a*uAlpha, cov);
}`;
// flat shadow caster into the shadow buffer
export const SHADOW_FS = HEAD + `
in vec2 vUv, vP, vQ; uniform sampler2D uMain; uniform float uAlpha, uLod; out vec4 o;
void main(){ float a=textureLod(uMain,vUv,uLod).a*uAlpha; o=vec4(a,0.,0.,a); }`;
// ---------------------------------------------------------------- cloth
export const CLOTH_VS = HEAD + `
layout(location=0) in vec2 aQ;
uniform vec4 uRect; uniform mat4 uVP; uniform vec4 uWave[6]; uniform int uWaveN; uniform vec4 uBump[8]; uniform int uBumpN;
out vec2 vP; out vec3 vW; out vec3 vFold;
void main(){
  vec2 p=uRect.xy+aQ*uRect.zw; float h=0.; vec2 d=vec2(0.);
  for(int i=0;i<uWaveN;i++){ float a=dot(uWave[i].xy,p)+uWave[i].w; h+=uWave[i].z*sin(a); d+=uWave[i].z*cos(a)*uWave[i].xy; }
  for(int i=0;i<uBumpN;i++){ vec2 q=p-uBump[i].xy; float r2=uBump[i].z*uBump[i].z, e=exp(-dot(q,q)/r2)*uBump[i].w; h+=e; d+=-2.*q/r2*e; }
  vP=p; vFold=vec3(d,h); vW=vec3(p.x,-p.y,h); gl_Position=uVP*vec4(vW,1.);
}`;
export const MATERIALS = NOISE + `
// --- woven structures. Each returns height 0..1 ------------------------------------------------
float tw(float f,float r){ float x=f/r; return sqrt(max(0.,1.-x*x)); }
vec2 wob(vec2 p,float a){ vec2 n=texture(uNoise,p*.0021).rg-.5; vec2 m=texture(uNoise,p*.011).gr-.5; return (n*1.6+m*.6)*a; }
float hPlain(vec2 p,float pitch,float irr,out vec2 cell,out float warpTop){
  vec2 q=p/pitch+wob(p,irr); vec2 i=floor(q), f=fract(q)-.5; cell=i;
  float s=mod(i.x+i.y,2.)<.5?1.:-1.; warpTop=s;
  float ra=.36+.13*h11(i.x*1.7+.3), rb=.36+.13*h11(i.y*2.3+.9);
  float zw=.5+.34*s*cos(3.14159*f.y), zf=.5-.34*s*cos(3.14159*f.x);
  float a=tw(f.x,ra)*zw, b=tw(f.y,rb)*zf;
  float tws=.05*sin((q.y*2.+f.x*2.6)*6.283), tws2=.05*sin((q.x*2.+f.y*2.6)*6.283);
  return a>b? a+tws*a : b+tws2*b;
}
float hRib(vec2 p,out float row){ // weft-faced tapestry
  vec2 w=wob(p,.6); float y=p.y/2.7+w.y*.8; row=floor(y); float f=fract(y)-.5; float ph=mod(row,2.)*3.14159;
  return tw(f,.5)*(.62+.38*cos(p.x*6.2832/15.+ph+w.x)); }
float hPile(vec2 p,float c,out vec2 cell){ vec2 q=p/c; cell=floor(q); vec2 f=fract(q)-.5; float j=h21(cell); f+=(h22(cell)-.5)*.22; float r=dot(f,f)*4.; float fz=texture(uNoise,p*.06).g-.5; return clamp(1.-r*.75+fz*.55,0.,1.)*(.72+.28*j); }
float hCross(vec2 p,float c,out vec2 cell){ vec2 q=p/c; cell=floor(q); vec2 f=fract(q)-.5; vec2 g=vec2(f.x+f.y,f.x-f.y)*.7071; float e=smoothstep(.72,.58,abs(g.x))*smoothstep(.72,.58,abs(g.y));
  float a=tw(g.x,.2)*(.75-.25*abs(g.y)*2.)*smoothstep(.69,.6,abs(g.y)), b=tw(g.y,.2)*(1.02-.3*abs(g.x)*2.)*smoothstep(.69,.6,abs(g.x)); return max(a,b); }
float hBead(vec2 p,vec2 c,out vec2 cell){ vec2 q=p/c; cell=floor(q); vec2 f=(fract(q)-.5)*2.; float j=h21(cell); f*=1.04+.1*j; float r=pow(abs(f.x),2.6)+pow(abs(f.y),2.6); float hole=smoothstep(.0,.16,abs(f.x)-.82)*0.; return sqrt(max(0.,1.-r))-hole; }
float hFibre(vec2 p,float s){ return texture(uNoise,p*vec2(.6,4.)*s).b; }
float ridged(vec2 p){ float a=abs(texture(uNoise,p).r-.5)*2.; return 1.-smoothstep(0.,.05,a); }
// height field per material; id: 0 linen 1 tapestry 2 pile 3 silk 4 cross-stitch 5 beads 6 twill/sashiko
// 7 barkcloth 8 rock 9 papyrus 10 batik 11 felt 12 stucco 13 wool 14 vellum
float matH(int id,vec2 p,float dens,out vec2 cell,out float wt){
  cell=floor(p/4.); wt=1.; float d;
  if(id==0) return hPlain(p,3.3,.55,cell,wt);
  if(id==1){ float row; d=hRib(p,row); cell=vec2(floor(p.x/30.+h11(row)*1.),row); wt=-1.; return d; }
  if(id==2) return hPile(p,5.,cell);
  if(id==3){ vec2 q=vec2(p.x+p.y*.35,p.y-p.x*.35); float y=q.y/1.9+texture(uNoise,q*.004).r*2.; cell=vec2(floor(q.x/26.+h11(floor(y))),floor(y)); wt=-1.; return tw(fract(y)-.5,.52)*.75+.25*texture(uNoise,q*vec2(.004,.05)).b; }
  if(id==4){ float b=hPlain(p,5.,.3,cell,wt)*.45; vec2 c2; float x=hCross(p,10.,c2); if(dens>.35){ cell=c2; return max(b*.5,x*1.1);} return b; }
  if(id==5) return hBead(p,vec2(9.,8.),cell);
  if(id==6){ vec2 q=p/3.6+wob(p,.4); float t=q.x+q.y; cell=vec2(floor(t),floor(q.y)); return .55+.4*sin(t*6.2832)*.8*(.7+.3*sin((q.x-q.y)*6.2832*.5)); }
  if(id==7){ float a=sin(p.y*6.2832/4.2+texture(uNoise,p*.003).r*5.)*.5+.5; float b=sin(p.x*6.2832/6.+texture(uNoise,p*.0035+.3).r*5.)*.5+.5; float f=hFibre(p.yx,.007); return .25*a+.18*b+.6*f; }
  if(id==8){ float a=texture(uNoise,p*.0007).r, b=texture(uNoise,p*.006).g, c=texture(uNoise,p*.037).r; return a*.9+b*.5+c*.22-.5*ridged(p*.0009)*.3; }
  if(id==9){ float sx=p.x/46.+texture(uNoise,p*.0012).r*.5, sy=p.y/52.+texture(uNoise,p*.0013).g*.5; float a=hFibre(p.yx,.0045), b=hFibre(p,.0045); float e=smoothstep(0.,.06,abs(fract(sx)-.5))*.1+smoothstep(0.,.06,abs(fract(sy)-.5))*.06; cell=floor(vec2(sx,sy)); return a*.5+b*.32+e; }
  if(id==10) return hPlain(p,3.,.35,cell,wt);
  if(id==11){ float a=texture(uNoise,p*vec2(.02,.006)).b, b=texture(uNoise,p.yx*vec2(.018,.007)+.4).b, c=texture(uNoise,(p.xy+p.yx*vec2(1.,-1.))*vec2(.013,.006)).b; return (a+b+c)*.4; }
  if(id==12){ float a=texture(uNoise,p*.0016).r, b=texture(uNoise,p*.02).g; return a*.6+b*.35-.5*ridged(p*.0013+.2)*.6; }
  if(id==13) return hPlain(p,6.,.7,cell,wt);
  if(id==14){ float a=texture(uNoise,p*.012).g; return a*.35+.2*texture(uNoise,p*.0016).r; }
  return 0.;
}
float matAmp(int id){ if(id==5) return 2.6; if(id==2) return 1.9; if(id==4) return 2.; if(id==8) return 5.; if(id==12) return 2.2; if(id==9) return .9; if(id==14) return .5; if(id==11) return 1.3; if(id==7) return 1.; if(id==13) return 2.; return 1.45; }
float matPitch(int id){ if(id==1) return 2.7; if(id==2) return 5.; if(id==4) return 10.; if(id==5) return 9.; if(id==3) return 1.9; if(id==6) return 3.6; if(id==10) return 3.; if(id==13) return 6.; if(id>=7&&id<=9) return 7.; if(id==11||id==12||id==14) return 8.; return 3.3; }
// where to read the pigment from, so edges follow the structure (threads, knots, beads, stitches)
vec2 matSnap(int id,vec2 p){
  if(id==1){ float y=p.y/2.7+wob(p,.6).y*.8; float r=floor(y); return vec2(p.x+(h11(r)-.5)*5.,p.y+(.5-fract(y))*2.7); }
  if(id==2){ vec2 q=p/5.; return (floor(q)+.5)*5.; }
  if(id==4){ vec2 q=p/10.; return (floor(q)+.5)*10.; }
  if(id==5){ vec2 c=vec2(9.,8.); return (floor(p/c)+.5)*c; }
  if(id==3) return p+(texture(uNoise,p*.05).rg-.5)*2.2;
  if(id==8){ return p+(texture(uNoise,p*.013).rg-.5)*3.5+(texture(uNoise,p*.06).gr-.5)*2.; }
  if(id==7) return p+(texture(uNoise,p*.02).rg-.5)*2.2+(texture(uNoise,p*vec2(.004,.05)).b-.5)*vec2(0.,1.4);
  if(id==9) return p+(texture(uNoise,p*vec2(.004,.02)).bb-.5)*vec2(1.2,2.0);
  if(id==11) return p+(texture(uNoise,p*.03).rg-.5)*4.5;
  if(id==14||id==12) return p+(texture(uNoise,p*.02).rg-.5)*1.3;
  float pitch=matPitch(id); vec2 q=p/pitch+wob(p,id==10?.35:.55); vec2 i=floor(q); float s=mod(i.x+i.y,2.); float j=h21(i)-.5, k=h21(i+31.7)-.5;
  // dye creeps along the yarn that is on top
  return p+(s<.5?vec2(k*.5,j*2.1):vec2(j*2.1,k*.5))*pitch*.42+(texture(uNoise,p*.011).rg-.5)*1.6; }
`;
export const CLOTH_FS = HEAD + MATERIALS + `
in vec2 vP; in vec3 vW; in vec3 vFold;
uniform sampler2D uPig, uAuxB, uShadow;
uniform vec4 uRect; uniform vec3 uEye; uniform vec2 uPigRes;
uniform int uMat[40]; uniform vec4 uOrigin; // grid: cols, rows, cellW, cellH
uniform vec3 uClothCol; uniform vec3 uKeyP[3]; uniform vec3 uKeyC[3]; uniform float uKeyR[3]; uniform int uKeyN;
uniform vec3 uAmb, uSun, uSunC, uGlowC; uniform float uStain, uFocus, uAperture, uWear, uReliefMul, uTime, uFuzz, uGild;
uniform vec4 uBurn;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;
vec3 lin(vec3 c){ return pow(max(c,0.),vec3(2.2)); }
vec2 puv(vec2 p){ return (p-uRect.xy)/uRect.zw; }
vec4 pig(vec2 p){ return texture(uPig,puv(p)); }
int matAt(vec2 p){ vec2 c=floor(p/uOrigin.zw); if(c.x<0.||c.y<0.||c.x>=uOrigin.x||c.y>=uOrigin.y) return uMat[36]; return uMat[int(c.y)*6+int(c.x)]; }
void main(){
  vec2 p=vP; int id=matAt(p);
  float px=max(length(dFdx(p)),length(dFdy(p)));
  float pitch=matPitch(id);
  float lod=smoothstep(.75,.22,px/pitch);                 // structure visible?
  float lodS=smoothstep(.62,.30,px/pitch);
  vec4 auxB=texture(uAuxB,puv(p));
  // pigment lookup, snapped to the structure
  vec2 sp=mix(p,matSnap(id,p),lodS);
  vec4 pg=pig(sp);
  float soft=1.1; // gentle bleed
  vec4 pgB=textureLod(uPig,puv(sp),log2(max(1.,2.4/max(px,.001)))*.5);
  pg=mix(pg,pgB,.35);
  vec4 aux=texture(uAuxB,puv(sp));
  float dens=clamp(pg.a,0.,1.);
  vec3 dye=pg.rgb/max(pg.a,1e-3);
  float gold=aux.r, raise=aux.g, glow=aux.b;
  // structure height + normal
  vec2 cell; float wt; float e=max(px*.8,.28);
  float h0=matH(id,p,dens,cell,wt); vec2 cc; float ww;
  float hx=matH(id,p+vec2(e,0.),dens,cc,ww), hy=matH(id,p+vec2(0.,e),dens,cc,ww);
  float amp=matAmp(id)*uReliefMul;
  vec2 gr=vec2(hx-h0,hy-h0)/e*amp*lod;
  float hv=mix(.62,h0,lod);
  // --- satin-stitch embroidery over raised areas
  float stitch=0.; vec2 sdir=vec2(1.,0.); float thId=0.;
  if(raise>.03){
    float L=clamp(log2(7./max(px,.02)),0.,7.);
    vec2 cs=vec2(13.,13.); vec2 jit=(h22(floor(p/cs))-.5); vec2 pc=p+(texture(uNoise,p*.009).rg-.5)*9.; vec2 cq=(floor(pc/cs)+.5)*cs;
    vec2 eps=vec2(5.,0.);
    float gx=textureLod(uPig,puv(cq+eps.xy),L).a-textureLod(uPig,puv(cq-eps.xy),L).a;
    float gy=textureLod(uPig,puv(cq+eps.yx),L).a-textureLod(uPig,puv(cq-eps.yx),L).a;
    vec2 g=vec2(gx,gy); float gl=length(g); float an=gl>.015?atan(g.y,g.x):.65; an=floor(an/.39+.5)*.39; sdir=vec2(cos(an),sin(an));
    vec2 sn=vec2(-sdir.y,sdir.x); float u=dot(p,sn)/1.75+(texture(uNoise,p*.01).r-.5)*1.2; thId=floor(u)+h21(cq)*97.; float fu=fract(u)-.5;
    float v=dot(p,sdir)/(17.+9.*h11(thId))+h11(thId+3.); float fv=fract(v); float ends=smoothstep(0.,.10,fv)*smoothstep(1.,.90,fv);
    float sh=tw(fu,.5)*(.45+.55*ends);
    float sl=smoothstep(.95,.4,px/1.75);
    float dr=(1.-smoothstep(0.,.5,abs(fu)));
    stitch=raise; hv=mix(hv,mix(.75,.35+.65*sh,sl),raise);
    vec2 sgr=sn*(-fu*3.4)*sl + sdir*((fv-.5)*1.4*(1.-ends))*sl; gr=mix(gr,sgr*1.05*uReliefMul,raise);
  }
  // padded relief of embroidery (edges roll down) from blurred raise
  { float L=clamp(log2(4./max(px,.02)),0.,7.); float ee=max(px,1.)*2.; float a=textureLod(uAuxB,puv(p),L).g, b=textureLod(uAuxB,puv(p+vec2(ee,0.)),L).g, c=textureLod(uAuxB,puv(p+vec2(0.,ee)),L).g; gr+=vec2(b-a,c-a)/ee*5.5*uReliefMul; }
  vec2 gm=gr+vFold.xy;
  // stains, creases, wear (cloth space, large scale)
  float s1=texture(uNoise,p*.00031).r, s2=texture(uNoise,p*.0011+.37).r, s3=texture(uNoise,p*.0063).g, s4=texture(uNoise,p*.023).g;
  float s5=texture(uNoise,p*vec2(.0009,.006)+.7).b; float stain=(s1-.5)*1.1+(s2-.5)*.55+(s3-.5)*.2+(s5-.5)*.18;
  float cr=texture(uNoise,p*vec2(.00045,.0017)+.13).r; float crease=smoothstep(.012,0.,abs(cr-.5))*.5;
  vec3 N=normalize(vec3(-gm.x,gm.y,1.));
  // base cloth colour
  float yarn=h21(cell+floor(wt)*13.)-.5;
  vec3 base=lin(uClothCol);
  base*=1.+stain*1.15*uStain; base=mix(base,base*vec3(.78,.46,.20)*.9,clamp(stain*-1.4*uStain,0.,.75));
  base*=1.+yarn*.22*lod; base*=1.-crease*.25;
  // dye: pigment sits in the yarn, wears off the crowns, pools in the stains
  float wear=clamp(.42+ (s2-.5)*1.3+(s4-.5)*.8+(s3-.5)*.8,0.,1.);
  float d=dens*(1.-uWear*smoothstep(.42,.95,wear)*(.6+.4*hv))*.965;
  vec3 dl=lin(dye); dl=max(mix(vec3(dot(dl,vec3(.3,.6,.1))),dl,1.22),0.); dl*=1.+yarn*.30*lod+(s4-.5)*.45+(s2-.5)*.30;
  if(id==10){ float ck=ridged(p*.0034+texture(uNoise,p*.004).rg*.03)*.8+ridged(p*.0071+.4)*.4; dl=mix(dl,base*.75,0.); d*=1.; dl*=1.-.0*ck; base=mix(base,base*vec3(.42,.30,.26),clamp(ck*.55,0.,.6)*(1.-dens)); }
  if(raise>.03){ float q=h11(thId); dl*=1.+(q-.5)*.34*raise; d=mix(d,clamp(dens*1.06,0.,1.),raise); }
  vec3 alb=mix(base,dl,clamp(d,0.,1.));
  alb*=mix(1.,mix(.46,1.10,hv),lod*(id==5?.8:1.)); // cavity
  // --- lighting
  vec3 V=normalize(uEye-vW), col=vec3(0.);
  vec3 goldF=mix(vec3(1.,.72,.28),clamp(dl*2.2,0.,1.),.35);
  float metal=gold*uGild;
  float silkS=(id==3?.55:0.)+stitch*.5;
  vec3 T=normalize(vec3(sdir.x,-sdir.y,0.)); if(stitch<.03&&id==3) T=normalize(vec3(.94,.33,0.));
  float rough=id==5?.16:.45;
  float spark=h21(floor(p/1.3)+floor(thId)); 
  vec3 spec=vec3(0.), dif=vec3(0.);
  float sh=texture(uShadow,puv(p)).r;
  for(int i=0;i<uKeyN;i++){
    vec3 Lp=vec3(uKeyP[i].x,-uKeyP[i].y,uKeyP[i].z)-vW; float dist=length(Lp); vec3 L=Lp/dist;
    float at=1./(1.+pow(length(Lp.xy)/uKeyR[i],2.6)); 
    // embroidered pile and cloth relief cast small shadows
    vec2 ld=vec2(L.x,-L.y)/max(L.z,.25);
    float oc=1.; if(i==0){ float a0=textureLod(uAuxB,puv(p),0.).g; float a1=textureLod(uAuxB,puv(p+ld*3.),1.).g, a2=textureLod(uAuxB,puv(p+ld*7.),2.).g; oc=1.-.55*clamp(max(a1,a2*.8)-a0,0.,1.); oc*=1.-sh*.82; }
    float nl=dot(N,L), wrap=clamp((nl+.25)/1.25,0.,1.);
    vec3 H=normalize(L+V); float nh=max(dot(N,H),0.);
    dif+=uKeyC[i]*at*wrap*oc;
    // cloth sheen
    float sheen=pow(1.-max(dot(N,V),0.),3.)*.25*uFuzz+pow(max(1.-nh*nh,0.),1.5)*.05;
    spec+=uKeyC[i]*at*oc*sheen*(alb*.6+.05);
    // anisotropic thread highlight (Kajiya-Kay)
    float th=dot(T,H); float aniso=pow(sqrt(max(0.,1.-th*th)),26.)*clamp(nl*1.4,0.,1.);
    spec+=uKeyC[i]*at*oc*silkS*aniso*(alb*1.1+.06);
    if(metal>.01){ float g=pow(nh,18.)*.42+pow(nh,90.)*.9+aniso*.4; float gl=step(.95,spark)*pow(max(dot(normalize(N+vec3(h22(floor(p/1.3))-.5,0.)*.7),H),0.),40.)*4.; spec+=uKeyC[i]*at*oc*metal*goldF*(g+gl); }
    if(id==5){ spec+=uKeyC[i]*at*oc*(pow(nh,60.)*1.3+pow(nh,14.)*.12)*lod; }
    if(id==14||id==9) spec+=uKeyC[i]*at*oc*pow(nh,22.)*.05;
  }
  dif+=uSunC*clamp(dot(N,uSun)*.75+.25,0.,1.)*(1.-sh*.4);
  float ao=mix(1.,smoothstep(-.1,.75,hv)*.5+.5,lod);
  vec3 amb=uAmb*ao*(.75+.25*N.z);
  col=alb*(dif*(1.-metal*.55)+amb)+spec;
  col+=metal*goldF*(amb*.9)*(.5+.5*hv);
  // emissive reveal + light it spills on the cloth
  vec3 hot=mix(uGlowC*vec3(1.,.55,.18),uGlowC*vec3(1.4,1.15,.75),clamp(glow*.8,0.,1.));
  float spill=textureLod(uAuxB,puv(p),clamp(log2(26./max(px,.02)),0.,8.)).b+textureLod(uAuxB,puv(p),clamp(log2(90./max(px,.02)),0.,9.)).b*1.4;
  col+=hot*glow*(.9+1.3*hv)*mix(vec3(1.),clamp(dl*3.,0.,1.4),.55);
  col+=alb*uGlowC*vec3(1.,.60,.24)*spill*2.2;
  o0=vec4(col,1.);
  float dist=length(uEye-vW);
  float coc=uAperture*(dist-uFocus)/dist;
  o1=vec4(coc,dist,0.,1.);
}`;
// ---------------------------------------------------------------- thread ribbons
export const THREAD_VS = HEAD + `
layout(location=0) in vec3 aP; layout(location=1) in vec3 aT; layout(location=2) in vec2 aS; // side, u
uniform mat4 uVP; uniform vec3 uEye; uniform float uW; 
out vec3 vW, vN, vB, vTa; out float vV, vU;
void main(){ vec3 w=vec3(aP.x,-aP.y,aP.z), t=normalize(vec3(aT.x,-aT.y,aT.z)); vec3 V=normalize(uEye-w); vec3 b=normalize(cross(t,V)); vB=b; vN=normalize(cross(b,t)); vTa=t; vV=aS.x*1.25; vU=aS.y; vec3 q=w+b*aS.x*uW*.5*1.25; vW=q; gl_Position=uVP*vec4(q,1.); }`;
export const THREAD_FS = HEAD + NOISE + `
in vec3 vW, vN, vB, vTa; in float vV, vU;
uniform vec3 uEye, uCol, uCol2, uKeyP[3], uKeyC[3], uAmb; uniform float uKeyR[3]; uniform int uKeyN; uniform float uW, uGlow, uHeadU, uTailU, uHeadLen, uGold, uFocus, uAperture, uAlpha, uPly, uSpark;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;
void main(){
  float uu=vU/uW; float a=abs(vV);
  float fz=texture(uNoise,vec2(uu*.11,vV*.06+.3)).b, fz2=texture(uNoise,vec2(uu*.05+.5,vV*.11)).g;
  float lump=1.+(texture(uNoise,vec2(uu*.013,.2)).r-.5)*.22;
  a/=lump; float body=1.-smoothstep(.93,1.0,a+(fz-.5)*.12); float hair=(1.-smoothstep(.9,1.25,a))*smoothstep(.60,.80,fz*.6+fz2*.4)*.7;
  float cov=max(body,hair);
  cov*=smoothstep(uTailU-.5,uTailU+uW*2.,vU)*(1.-smoothstep(uHeadU-uW*.9,uHeadU+.01,vU+(fz-.5)*uW*1.5));
  if(cov<.06) discard;
  float v=clamp(vV/lump,-1.,1.); float z=sqrt(max(0.,1.-v*v));
  float tq=asin(v)/3.14159; float ph=uu/2.1+tq; float pq=ph*uPly/2.; float fp=fract(pq)-.5; float ply=sqrt(max(0.,1.-fp*fp*3.7));
  // fine fibres lie along each ply
  float fs=(fp*7.+texture(uNoise,vec2(uu*.02,tq)).r*1.6); float fid=floor(fs)+floor(pq)*13.; float ff=fract(fs)-.5; float fib=sqrt(max(0.,1.-ff*ff*3.6));
  float fj=h11(fid); float streak=texture(uNoise,vec2(uu*.16+fid*.37,fid*.21)).b;
  float pid=mod(floor(pq),2.); vec3 C=mix(uCol,uCol2,pid);
  C*=.72+.5*fj; C=mix(C,C*C*2.2,.25*(1.-streak));
  vec3 N=normalize(vB*(v*.95)+vN*z+(vTa*.5+vB*.4)*(-fp*1.7)+(vTa*.5+vB*.5)*(-ff*.9));
  vec3 V=normalize(uEye-vW); vec3 alb=C*mix(.28,1.12,ply)*mix(.62,1.06,fib)*(.8+.35*streak);
  vec3 col=alb*uAmb*1.2; vec3 T=normalize(vTa+vB*.75);
  for(int i=0;i<uKeyN;i++){ vec3 Lp=vec3(uKeyP[i].x,-uKeyP[i].y,uKeyP[i].z)-vW; float d=length(Lp); vec3 L=Lp/d; float at=1./(1.+pow(length(Lp.xy)/uKeyR[i],2.6)); float nl=clamp((dot(N,L)+.15)/1.15,0.,1.); vec3 H=normalize(L+V); float th=dot(T,H); float an=pow(sqrt(max(0.,1.-th*th)),18.); float nh=max(dot(N,H),0.);
    float metal=uGold*pid;
    col+=uKeyC[i]*at*(alb*nl*(1.-metal*.35)+(an*(.10+.5*metal)+pow(nh,36.)*1.1*metal)*(C+.04)*clamp(nl*2.,0.,1.)*ply);
    col+=uKeyC[i]*at*pow(1.-max(dot(N,V),0.),3.)*.14*C; }
  float hd=uHeadU-vU; float hg=exp(-max(hd,0.)/uHeadLen); 
  col+=C*(C*2.4+.12)*uGlow*(.25+.75*ply*ply)*(.35+.65*z)*(.7+.3*fib) + vec3(1.,.66,.28)*hg*uSpark*(.8+1.8*z);
  cov*=uAlpha; o0=vec4(col*cov,cov); float dist=length(uEye-vW); float coc=uAperture*(dist-uFocus)/dist; o1=vec4(coc,dist,0.,1.)*cov;
}`;
export const THREAD_SH_VS = HEAD + `
layout(location=0) in vec3 aP; layout(location=1) in vec3 aT; layout(location=2) in vec2 aS;
uniform vec4 uRect; uniform float uW; uniform vec2 uLd; out float vV,vU,vH,vZ;
void main(){ vec2 t=normalize(aT.xy+1e-5); vec2 n=vec2(-t.y,t.x); float h=max(aP.z,0.); float g=1.+h/(uW*1.6); vec2 p=aP.xy-uLd*(h+uW*.35)+n*aS.x*uW*.55*g; vV=aS.x; vU=aS.y; vH=g; vZ=aP.z; vec2 q=(p-uRect.xy)/uRect.zw; gl_Position=vec4(q*2.-1.,0.,1.); }`;
export const THREAD_SH_FS = HEAD + `
in float vV,vU,vH,vZ; uniform float uHeadU,uTailU,uA; out vec4 o;
void main(){ float a=(1.-smoothstep(.2,1.,abs(vV)))*uA/pow(vH,.8)*smoothstep(-3.,1.,vZ); a*=step(vU,uHeadU)*step(uTailU,vU); o=vec4(a,0.,0.,a); }`;
// ---------------------------------------------------------------- particles
export const PART_VS = HEAD + `
layout(location=0) in vec2 aQ; layout(location=1) in vec4 aPS; layout(location=2) in vec4 aC; layout(location=3) in vec4 aX; // x: kind, y: stretch angle, z: stretch, w: additive
uniform mat4 uVP; uniform vec3 uEye, uRight, uUp; uniform float uFocus, uAperture, uPxScale;
out vec2 vQ; out vec4 vC; flat out vec4 vX; out float vBlur;
void main(){ vec3 w=vec3(aPS.x,-aPS.y,aPS.z); float d=length(uEye-w); float coc=abs(uAperture*(d-uFocus)/d); float wpp=d*uPxScale; float s=aPS.w+coc*wpp*1.0; vBlur=clamp(coc*wpp/max(s,1e-3),0.,1.);
  vec2 q=(aQ-.5)*2.; float c=cos(aX.y), n=sin(aX.y); vec2 e=q*vec2(1.+aX.z,1.); e=vec2(e.x*c-e.y*n,e.x*n+e.y*c); vQ=q; vC=aC; float k=aPS.w/s; vC.rgb*=mix(1.,k*k,.85); vC.a*=mix(1.,k*k,.85); vX=aX; gl_Position=uVP*vec4(w+(uRight*e.x+uUp*e.y)*s,1.); }`;
export const PART_FS = HEAD + NOISE + `
in vec2 vQ; in vec4 vC; flat in vec4 vX; in float vBlur; out vec4 o;
void main(){ float r=length(vQ); float a;
  if(vX.x<.5){ a=exp(-r*r*mix(4.5,1.2,vBlur))*smoothstep(1.,.6,r); }          // soft glow / spark
  else if(vX.x<1.5){ a=smoothstep(1.,mix(.75,.4,vBlur),r); }                     // disc (pigment grain, snow)
  else if(vX.x<2.5){ vec2 q=vQ*vec2(1.,1.9); float t=q.x*.5+.5; float w=sin(clamp(t,0.,1.)*3.14159); a=smoothstep(w,w*.6,abs(q.y)*1.1)*step(abs(q.x),1.); a*=.85+.15*texture(uNoise,vQ*.1).r; } // petal / leaf
  else { float n=texture(uNoise,vQ*.12+vX.yw).r; a=smoothstep(1.,.0,r)*smoothstep(.25,.75,n+.25*(1.-r)); } // smoke puff
  a*=vC.a; o=vec4(vC.rgb*a, a*(1.-vX.w)); }`;
// ---------------------------------------------------------------- post
export const BLUR1_FS = HEAD + `in vec2 vUv; uniform sampler2D uT; uniform vec2 uD; out vec4 o; void main(){ vec4 s=texture(uT,vUv)*.2270270270; s+=(texture(uT,vUv+uD*1.3846153846)+texture(uT,vUv-uD*1.3846153846))*.3162162162; s+=(texture(uT,vUv+uD*3.2307692308)+texture(uT,vUv-uD*3.2307692308))*.0702702703; o=s; }`;
export const DOF_FS = HEAD + `
in vec2 vUv; uniform sampler2D uT,uC; uniform vec2 uPx; uniform float uMax; out vec4 o;
void main(){ float c0=texture(uC,vUv).r; float R=clamp(abs(c0),0.,uMax); 
  vec3 acc=texture(uT,vUv).rgb; float tw=1.;
  // also look for near blur spilling over
  float m=R; for(int i=0;i<8;i++){ float a=float(i)*.7854; float c=texture(uC,vUv+vec2(cos(a),sin(a))*uPx*uMax*.6).r; if(c<0.) m=max(m,min(-c,uMax)*.8); }
  if(m<.6){ o=vec4(acc,1.); return; }
  float ga=2.39996; for(int i=1;i<56;i++){ float r=sqrt(float(i)/56.)*m; float a=float(i)*ga; vec2 uv=vUv+vec2(cos(a),sin(a))*r*uPx; vec3 s=texture(uT,uv).rgb; float c=abs(texture(uC,uv).r); float w=smoothstep(r-1.2,r+.8,max(c,R*.98)); float l=max(s.r,max(s.g,s.b)); w*=1.+smoothstep(.8,4.,l)*1.2; acc+=s*w; tw+=w; }
  o=vec4(acc/tw,1.); }`;
export const BLOOM_DN_FS = HEAD + `in vec2 vUv; uniform sampler2D uT; uniform vec2 uPx; uniform float uThr; out vec4 o; vec3 s(vec2 d){ return min(texture(uT,vUv+d*uPx).rgb,vec3(30.)); }
void main(){ vec3 c=(s(vec2(-1,-1))+s(vec2(1,-1))+s(vec2(-1,1))+s(vec2(1,1)))*.125+(s(vec2(0,0)))*.5; if(uThr>0.){ float l=max(c.r,max(c.g,c.b)); c*=smoothstep(uThr,uThr*2.6,l); } o=vec4(c,1.); }`;
export const BLOOM_UP_FS = HEAD + `in vec2 vUv; uniform sampler2D uT,uB; uniform vec2 uPx; uniform float uK; out vec4 o; void main(){ vec3 a=vec3(0.); for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ float w=(x==0?2.:1.)*(y==0?2.:1.)/16.; a+=texture(uB,vUv+vec2(x,y)*uPx).rgb*w; } o=vec4(texture(uT,vUv).rgb+a*uK,1.); }`;
export const FINAL_FS = HEAD + NOISE + `
in vec2 vUv; uniform sampler2D uT,uBloom,uOver; uniform vec2 uRes; uniform float uBloomK,uExp,uVig,uGrain,uSeed,uSat,uCon,uCA,uFade,uOverA,uScorch,uFlash; uniform vec3 uTint,uLift,uFlashC; uniform vec2 uMB; out vec4 o;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
void main(){
  vec2 q=vUv-.5; float r2=dot(q*vec2(1.,.82),q*vec2(1.,.82)); vec2 ca=q*r2*uCA*.01;
  vec3 c=vec3(texture(uT,vUv+ca).r,texture(uT,vUv).g,texture(uT,vUv-ca).b);
  if(dot(uMB,uMB)>1e-8){ vec3 m=vec3(0.); float j=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+uSeed)*43758.5453); for(int i=0;i<14;i++){ m+=texture(uT,vUv+uMB*((float(i)+j)/14.-.5)).rgb; } c=m/14.; }
  c+=texture(uBloom,vUv).rgb*uBloomK; c*=uExp;
  float n=texture(uNoise,vUv*vec2(.55,.31)*1.3).r, n2=texture(uNoise,vUv*vec2(1.6,.9)*1.7+.3).g; float ed=length(q*vec2(1.02,1.12))*1.36; ed+=(n-.5)*.42+(n2-.5)*.16;
  float v=1.-uVig*smoothstep(.52,1.12,ed); c*=mix(1.,v,1.); 
  float sc=uScorch*smoothstep(.62,1.02,ed); c=mix(c,c*vec3(.55,.28,.12),sc);
  c*=uTint; { float L=max(dot(c,vec3(.2126,.7152,.0722)),1e-4); vec3 a=aces(c*.72); float La=aces(vec3(L*.72)).x; vec3 b=c*(La/L); vec3 wt=mix(vec3(1.),vec3(1.12,.94,.55),smoothstep(0.,.25,(c.r-c.b)/(L+.05)))*La; b=mix(b,wt,clamp((max(b.r,max(b.g,b.b))-1.15)*.42,0.,.75)); a=mix(a,a*vec3(1.,.97,.86),smoothstep(.1,.5,(c.r-c.b)/(L+.05))*.6); c=mix(a,clamp(b,0.,1.),.66); }
  float l=dot(c,vec3(.2126,.7152,.0722)); c=max(mix(vec3(l),c,uSat),0.);
  c=mix(c,uFlashC,uFlash);
  c=pow(c,vec3(1./2.2)); c=mix(c,c*c*(3.-2.*c),clamp(uCon-1.,0.,1.)*1.6); c=max(c+uLift*(1.-c),0.);
  vec4 ov=texture(uOver,vec2(vUv.x,1.-vUv.y)); c=c*(1.-ov.a*uOverA)+ov.rgb*uOverA;
  float g=fract(sin(dot(gl_FragCoord.xy+uSeed*17.13,vec2(12.9898,78.233)))*43758.5453)-.5; float g2=fract(sin(dot(gl_FragCoord.yx+uSeed*31.7,vec2(39.346,11.135)))*24634.6345)-.5; c+=(g+g2)*uGrain*(.35+.65*(1.-l)); c*=1.-uFade; o=vec4(c,1.); }`;
