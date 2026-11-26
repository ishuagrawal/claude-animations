// WebGL2 finish: accumulates motion-blur subframes in float, then wide soft bloom, gentle halation, grade, vignette, fine grain.
const VS = `#version 300 es
out vec2 u; void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); u=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;
const H = `#version 300 es
precision highp float; in vec2 u; out vec4 o; `;
const LIN = `vec3 lin(vec3 c){ return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c)); } vec3 enc(vec3 c){ return mix(c*12.92,1.055*pow(max(c,vec3(1e-5)),vec3(1./2.4))-.055,step(.0031308,c)); }`;
export class Post {
  constructor(w, h) {
    this.w = w; this.h = h; const c = this.canvas = document.createElement('canvas'); c.width = w; c.height = h;
    const g = this.g = c.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false }); g.getExtension('EXT_color_buffer_float'); g.getExtension('EXT_float_blend'); g.getExtension('OES_texture_float_linear');
    const prog = fs => { const p = g.createProgram(); [[g.VERTEX_SHADER, VS], [g.FRAGMENT_SHADER, H + fs]].forEach(([t, s]) => { const x = g.createShader(t); g.shaderSource(x, s); g.compileShader(x); if (!g.getShaderParameter(x, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(x) + s); g.attachShader(p, x); }); g.linkProgram(p); const U = {}; return { p, u: n => (U[n] ??= g.getUniformLocation(p, n)) }; };
    this.pAdd = prog(`uniform sampler2D t; uniform float k; ${LIN} void main(){ o=vec4(lin(texture(t,vec2(u.x,1.-u.y)).rgb)*k,1.); }`);
    this.pDown = prog(`uniform sampler2D t; uniform vec2 px; uniform float f,th; vec3 s(vec2 d){return texture(t,u+d*px).rgb;} void main(){ vec3 q=s(vec2(0))*.125+(s(vec2(-2,2))+s(vec2(2,2))+s(vec2(-2,-2))+s(vec2(2,-2)))*.03125+(s(vec2(0,2))+s(vec2(-2,0))+s(vec2(2,0))+s(vec2(0,-2)))*.0625+(s(vec2(-1,1))+s(vec2(1,1))+s(vec2(-1,-1))+s(vec2(1,-1)))*.125; if(f>.5){ float b=max(q.r,max(q.g,q.b)); float s2=smoothstep(th*.55,th+.25,b); q*=s2; } o=vec4(q,1.); }`);
    this.pUp = prog(`uniform sampler2D t,b; uniform vec2 px; uniform float k; void main(){ vec3 q=vec3(0.); float w[3]=float[3](1.,2.,1.); for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++) q+=texture(t,u+vec2(x,y)*px).rgb*w[x+1]*w[y+1]; o=vec4(texture(b,u).rgb+q/16.*k,1.); }`);
    this.pOut = prog(`uniform sampler2D t,b; uniform vec2 res; uniform float bloom,vig,grain,seed,sat,con,ca,fade; uniform vec3 tint,fadeC; ${LIN} float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+seed)*43758.5453);}
      void main(){ vec2 d=u-.5; float a=res.x/res.y; float r2=dot(d*vec2(a,1.),d*vec2(a,1.)); vec3 c; if(ca>0.){ vec2 q=d*r2*ca; c=vec3(texture(t,u+q).r,texture(t,u).g,texture(t,u-q).b);} else c=texture(t,u).rgb;
        vec3 bl=texture(b,u).rgb; c=c+bl*bloom*(1.-c*.55); c*=tint; c*=1.-vig*smoothstep(.1,1.05,r2); float l=dot(c,vec3(.2126,.7152,.0722)); c=max(mix(vec3(l),c,sat),0.);
        vec3 x=max(c-.82,0.); c=min(c,.82)+.18*(1.-exp(-x/.18)); c=enc(c); c=(c-.5)*con+.5; float g=h(floor(gl_FragCoord.xy))+h(floor(gl_FragCoord.xy)+17.3)-1.; float lum=dot(c,vec3(.3,.6,.1)); c+=g*grain*(.35+.65*(1.-abs(lum*2.-1.))); c=mix(c,fadeC,fade); c+=(h(gl_FragCoord.yx)-.5)/255.; o=vec4(clamp(c,0.,1.),1.); }`);
    this.src = this.tex(g.RGBA8, 2, 2, g.UNSIGNED_BYTE); this.acc = this.rt(w, h, g.RGBA32F, g.FLOAT); this.mips = []; for (let i = 0, a = w >> 1, b = h >> 1; i < 7; i++, a = Math.max(2, a >> 1), b = Math.max(2, b >> 1)) this.mips.push([this.rt(a, b, g.RGBA16F, g.HALF_FLOAT), this.rt(a, b, g.RGBA16F, g.HALF_FLOAT)]);
  }
  tex(f, w, h, type) { const g = this.g, t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t); g.texImage2D(g.TEXTURE_2D, 0, f, w, h, 0, g.RGBA, type, null); [[g.TEXTURE_MIN_FILTER, g.LINEAR], [g.TEXTURE_MAG_FILTER, g.LINEAR], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]].forEach(a => g.texParameteri(g.TEXTURE_2D, ...a)); return t; }
  rt(w, h, f, type) { const g = this.g, t = this.tex(f, w, h, type), fb = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, fb); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0); return { t, fb, w, h }; }
  draw(P, dst, set, tex) { const g = this.g; g.bindFramebuffer(g.FRAMEBUFFER, dst ? dst.fb : null); g.viewport(0, 0, dst ? dst.w : this.w, dst ? dst.h : this.h); g.useProgram(P.p); Object.entries(tex).forEach(([n, t], i) => { g.activeTexture(g.TEXTURE0 + i); g.bindTexture(g.TEXTURE_2D, t); g.uniform1i(P.u(n), i); }); Object.entries(set).forEach(([n, v]) => (Array.isArray(v) ? g['uniform' + v.length + 'f'](P.u(n), ...v) : g.uniform1f(P.u(n), v))); g.drawArrays(g.TRIANGLES, 0, 3); }
  begin() { const g = this.g; g.bindFramebuffer(g.FRAMEBUFFER, this.acc.fb); g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT); }
  add(canvas, k) { const g = this.g; g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, this.src); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, g.RGBA, g.UNSIGNED_BYTE, canvas); g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE); this.draw(this.pAdd, this.acc, { k }, { t: this.src }); g.disable(g.BLEND); }
  end({ bloom = 0.35, thresh = 0.5, spread = 0.9, vig = 0.3, grain = 0.035, seed = 0, sat = 1.04, con = 1.03, ca = 0.003, fade = 0, fadeC = [0.02, 0.01, 0.07], tint = [1, 1, 1] } = {}) {
    let s = this.acc; this.mips.forEach(([m], i) => { this.draw(this.pDown, m, { px: [1 / s.w, 1 / s.h], f: i ? 0 : 1, th: thresh }, { t: s.t }); s = m; });
    let up = this.mips[6][0]; for (let i = 5; i >= 0; i--) { this.draw(this.pUp, this.mips[i][1], { px: [1 / up.w, 1 / up.h], k: spread }, { t: up.t, b: this.mips[i][0].t }); up = this.mips[i][1]; }
    this.draw(this.pOut, null, { res: [this.w, this.h], bloom: bloom * 0.22, vig, grain, seed, sat, con, ca, fade, fadeC, tint }, { t: this.acc.t, b: up.t }); return this.canvas;
  }
}
