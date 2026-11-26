// A little WebGL2 of our own: the illustrated planet (turning continents, city webs, clouds, dawn rim).
import { W, H } from '../core.js';
const SS = 1.5; let G = null;
const FS = `#version 300 es
precision highp float; in vec2 u; out vec4 o; uniform vec2 c; uniform float R,t,b,rot;
float h3(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);} vec3 hv(vec3 p){return vec3(h3(p),h3(p+17.1),h3(p+41.7));}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fb(vec3 p){float a=.5,s=0.;for(int i=0;i<6;i++){s+=a*n3(p);p=p*2.03+vec3(7.1,3.7,5.3);a*=.5;}return s;}
vec2 wor(vec3 p){vec3 i=floor(p);float a=9.,d=9.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=i+vec3(x,y,z);float q=length(g+hv(g)-p);if(q<a){d=a;a=q;}else if(q<d)d=q;}return vec2(a,d);}
float land(vec3 p){vec3 w=vec3(fb(p*1.9),fb(p*1.9+5.),fb(p*1.9+9.));return fb(p*1.55+w*.9+2.6)-.52;}
void main(){ vec2 px=vec2(u.x*1920.,(1.-u.y)*1080.); vec2 d=(px-c)/R; float r=length(d); vec2 S=normalize(vec2(.76,-.65)); vec2 dn=d/max(r,1e-4); float sd=dot(dn,S); vec3 cy=vec3(.33,.86,1.), co=vec3(1.,.56,.26); float top=smoothstep(-.35,1.,-dn.y*.75+dn.x*.35); vec3 rimC=mix(cy,co,smoothstep(.25,.98,sd)); float rimA=.12+.95*top*top;
  vec4 col=vec4(0.);
  if(r<1.){ float z=sqrt(1.-r*r); vec3 N=vec3(d.x,-d.y,z); float ca=cos(.42),sa=sin(.42); vec3 q=vec3(N.x*ca-N.y*sa,N.x*sa+N.y*ca,N.z); float cr=cos(rot),sr=sin(rot); vec3 P=vec3(q.x*cr+q.z*sr,q.y,-q.x*sr+q.z*cr);
    vec3 L=normalize(vec3(.8,.66,-.34)); float lit=dot(N,L), day=smoothstep(-.12,.72,lit), dawn=smoothstep(-.1,.2,lit)*(1.-smoothstep(.3,.8,lit));
    float e=land(P), e2=land(P+vec3(.018,.02,.006)); float lm=smoothstep(0.,.008,e); float relief=clamp((e-e2)*16.+.5,0.,1.);
    vec3 oc=mix(vec3(.028,.022,.20),vec3(.075,.07,.46),smoothstep(-.22,-.02,e)); oc=mix(oc,vec3(.18,.28,.85),smoothstep(-.035,-.004,e)*.75); float gl=pow(max(0.,dot(reflect(-L,N),vec3(0,0,1))),8.); oc+=vec3(.10,.12,.5)*pow(z,3.)*.35;
    vec3 ln=mix(vec3(.16,.085,.46),vec3(.40,.22,.80),smoothstep(0.,.2,e)); ln=mix(ln*.62,ln*1.5+vec3(.05,.02,.08),smoothstep(.35,.65,relief)); ln=mix(ln,vec3(.56,.40,.95),smoothstep(.16,.24,e)*.7);
    vec3 g=mix(oc,ln,lm); g+=vec3(.45,.5,1.)*smoothstep(.012,.0,abs(e))*.28;
    float dens=smoothstep(.34,.6,n3(P*3.1+4.)), n1=n3(P*30.); vec2 w1=wor(P*11.), w2=wor(P*31.); float lights=smoothstep(.13,.0,w1.x)*1.4+smoothstep(.05,.0,w1.y-w1.x)*.55*smoothstep(.5,.1,w1.x)+smoothstep(.2,.02,w2.x)*.9*step(.45,n1); lights*=lm*dens*(1.-day); vec3 lc=mix(vec3(1.,.70,.28),vec3(.45,.9,1.),smoothstep(.55,.7,n3(P*2.2+11.))); g+=lc*lights*2.6+lc*lm*dens*(1.-day)*.2;
    vec3 dc=mix(mix(vec3(.95,.36,.28),vec3(1.,.62,.30),smoothstep(-.1,.02,e)),mix(vec3(1.,.66,.34),vec3(1.,.87,.60),relief),lm); g=mix(g,dc*(.45+.75*day),day*.95); g+=vec3(.95,.18,.34)*dawn*.4;
    vec3 cp=P+vec3(t*.006,0.,0.); float cw=fb(cp*vec3(2.3,5.2,2.3)+fb(cp*3.)*1.2), cl=smoothstep(.50,.66,cw), cs=smoothstep(.50,.66,fb((cp+vec3(.02,.02,0.))*vec3(2.3,5.2,2.3)+fb(cp*3.)*1.2)); g*=1.-cs*.35; vec3 cc=mix(vec3(.42,.36,.86),vec3(1.,.84,.66),day); g=mix(g,cc,cl*(.22+.3*day)); g+=cc*smoothstep(.04,.0,abs(cw-.52))*.07;
    float f=pow(1.-z,2.4); float shade=mix(.34,1.,smoothstep(-1.05,.4,dot(N,normalize(vec3(.35,.55,.75))))); g*=shade; g+=rimC*f*(.10+1.15*rimA)+cy*pow(1.-z,7.)*rimA; g+=co*pow(max(0.,sd),6.)*pow(1.-z,1.4)*.9;
    float aa=smoothstep(1.,1.-1.6/R,r); col=vec4(g,1.)*aa; }
  float q=max(r-1.,0.)*max(1.,R/760.); float halo=exp(-q*9.)*.34+exp(-q*34.)*.75+exp(-max(r-1.,0.)*R*.22)*.8; vec3 hc=mix(rimC,vec3(1.),exp(-max(r-1.,0.)*R*.22)*.6)*halo*rimA*(r<1.?0.:1.); col.rgb+=hc*(1.-col.a); o=vec4(col.rgb*b,col.a*b); }`;
function init() { const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; const g = c.getContext('webgl2', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false }), p = g.createProgram(); [[g.VERTEX_SHADER, `#version 300 es
out vec2 u; void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); u=p; gl_Position=vec4(p*2.-1.,0.,1.); }`], [g.FRAGMENT_SHADER, FS]].forEach(([k, s]) => { const q = g.createShader(k); g.shaderSource(q, s); g.compileShader(q); if (!g.getShaderParameter(q, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(q)); g.attachShader(p, q); }); g.linkProgram(p); G = { c, g, p, u: n => g.getUniformLocation(p, n) }; }
export function planetGL(x, cx, cy, R, t, rot, b) { if (!G) init(); const { g, p, u } = G; g.viewport(0, 0, G.c.width, G.c.height); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.disable(g.BLEND); g.useProgram(p); g.uniform2f(u('c'), cx, cy); g.uniform1f(u('R'), R); g.uniform1f(u('t'), t); g.uniform1f(u('rot'), rot); g.uniform1f(u('b'), b); g.drawArrays(g.TRIANGLES, 0, 3); x.save(); x.drawImage(G.c, 0, 0, W, H); x.restore(); }
