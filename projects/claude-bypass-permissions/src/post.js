// WebGL post: barrel "fisheye" lens (the reference's curved horizons), vignette, flash, and a fine
// screenprint grain that holds for two frames like the animation.
const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;
const FS = `precision highp float;
varying vec2 uv;
uniform sampler2D tex;
uniform float k;        // barrel strength
uniform float aspect;
uniform float vig;      // vignette strength
uniform float grain;    // grain amount
uniform float seed;
uniform vec3 flashCol;
uniform float flash;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed) * 43758.5453); }
void main(){
  vec2 c = uv - 0.5;
  c.x *= aspect;
  float r2 = dot(c,c);
  float maxr2 = 0.25*aspect*aspect + 0.25;
  // barrel: sample farther out near the edges, normalized so the frame stays filled
  float f = (1.0 + k*r2) / (1.0 + k*maxr2*0.92);
  vec2 s = c * f;
  s.x /= aspect;
  vec2 st = s + 0.5;
  vec4 col = texture2D(tex, vec2(st.x, 1.0 - st.y));
  float v = 1.0 - vig * smoothstep(0.25, 1.05, r2 / maxr2 * 1.15);
  col.rgb *= v;
  float g = (h(floor(gl_FragCoord.xy*0.5)) - 0.5) * grain;
  col.rgb += g;
  col.rgb = mix(col.rgb, flashCol, flash);
  gl_FragColor = vec4(col.rgb, 1.0);
}`;

export class Post {
  constructor(w, h) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    const gl = this.gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL unavailable');
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = this.pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    gl.useProgram(pr);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.u = n => gl.getUniformLocation(pr, n);
  }
  run(src, { k = 0, vig = 0.25, grain = 0.03, seed = 0, flash = 0, flashCol = [1, 1, 1] } = {}) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.uniform1f(this.u('k'), k);
    gl.uniform1f(this.u('aspect'), this.canvas.width / this.canvas.height);
    gl.uniform1f(this.u('vig'), vig);
    gl.uniform1f(this.u('grain'), grain);
    gl.uniform1f(this.u('seed'), seed);
    gl.uniform1f(this.u('flash'), flash);
    gl.uniform3fv(this.u('flashCol'), flashCol);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}
