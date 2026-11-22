/* Éternel strands: 머리카락 수천 가닥이 ∞(무한) 모양으로 감겨 흐르는 3D 조형. 외부 라이브러리 없음(WebGL 1).
 *
 * 쓰는 법
 *   <div class="stage" id="stage" aria-hidden="true">
 *     <picture class="stage__poster">…정지 그림…</picture>   ← 스크립트 꺼짐·WebGL 없음·실패 때 그대로 보임
 *     <canvas class="stage__canvas"></canvas>
 *   </div>
 *   <script src="../assets/3d/eternel-strands.js"></script>
 *   <script>EternelStrands.mount(document.getElementById('stage'));</script>
 *
 * 색은 무대 요소의 CSS 변수 --color-paper(바탕) · --color-ink(가닥) · --color-accent(빛)에서 읽는다.
 * 첫 장면을 그리면 무대에 .is-live 를 붙인다(이때 캔버스를 보이고 정지 그림을 가리면 된다).
 * 동작 줄이기(prefers-reduced-motion)면 완성된 한 장면만 그리고 멈춘다. 화면 밖·탭 숨김이면 멈춘다.
 */
(function () {
  'use strict';

  var VERT = [
    'attribute float a_u;',
    'attribute vec4 a_seed;',
    'attribute vec2 a_span;',
    'uniform float u_time;',
    'uniform float u_intro;',
    'uniform mat4 u_proj;',
    'uniform mat4 u_view;',
    'uniform mat4 u_model;',
    'uniform vec2 u_shift;',
    'varying float v_alpha;',
    'varying float v_shine;',
    'varying float v_depth;',
    'const float TAU = 6.28318530718;',
    'vec3 loopAt(float t) {',
    '  float th = TAU * t;',
    '  float s = sin(th); float c = cos(th);',
    '  float d = 1.0 + s * s;',
    '  return vec3(1.75 * c / d, 1.75 * s * c / d, 0.42 * s);',
    '}',
    'float hash(float n) { return fract(sin(n) * 43758.5453123); }',
    'void main() {',
    '  float t = fract(a_span.x + a_u * a_span.y);',
    '  vec3 p = loopAt(t);',
    '  vec3 tng = normalize(loopAt(t + 0.0015) - loopAt(t - 0.0015));',
    '  vec3 n = normalize(cross(tng, vec3(0.0, 0.0, 1.0)));',
    '  vec3 b = cross(tng, n);',
    '  float th = TAU * t;',
    '  float lobe = abs(cos(th));',
    '  float R = (0.07 + 0.17 * lobe) * (1.0 + 0.06 * sin(u_time * 0.45 + th * 2.0));',
    '  float twist = 3.0 * th + u_time * 0.12;',
    '  float clumpA = floor(a_seed.w * 9.0) / 9.0 * TAU + twist;',
    '  vec2 clump = vec2(cos(clumpA), sin(clumpA)) * R * 0.62;',
    '  float ownA = a_seed.y * TAU + twist;',
    '  vec2 own = vec2(cos(ownA), sin(ownA)) * R * sqrt(a_seed.x);',
    '  vec2 off = mix(own, clump, 0.5);',
    '  float fly = step(0.965, a_seed.x);',
    '  off *= 1.0 + fly * (0.9 + 0.6 * sin(u_time * 0.7 + a_seed.z * 9.0));',
    '  float w1 = sin(th * 9.0 + u_time * 0.9 + a_seed.z * TAU);',
    '  float w2 = cos(th * 6.0 - u_time * 0.7 + a_seed.z * 4.0);',
    '  off += vec2(w1, w2) * (0.012 + 0.03 * fly);',
    '  vec3 side = n * off.x + b * off.y;',
    '  vec3 pos = p + side;',
    '  float st = clamp(u_intro * 1.6 - a_seed.z * 0.6, 0.0, 1.0);',
    '  st = 1.0 - pow(1.0 - st, 3.0);',
    '  vec3 scatter = vec3(hash(a_seed.z * 91.7) - 0.5, hash(a_seed.y * 37.3) - 0.5, hash(a_seed.x * 13.1) - 0.5) * 5.0;',
    '  pos = mix(pos + scatter, pos, st);',
    '  vec4 view = u_view * (u_model * vec4(pos, 1.0));',
    '  gl_Position = u_proj * view;',
    '  gl_Position.xy += u_shift * gl_Position.w;',
    '  v_depth = view.z;',
    '  float taper = smoothstep(0.0, 0.14, a_u) * smoothstep(1.0, 0.8, a_u);',
    '  v_alpha = taper * (0.55 + 0.45 * a_seed.y) * st;',
    '  float band = exp(-pow((fract(t - u_time * 0.035) - 0.5) * 7.0, 2.0));',
    '  vec3 wn = normalize((u_model * vec4(side + vec3(0.0001), 0.0)).xyz);',
    '  float facing = max(dot(wn, normalize(vec3(-0.4, 0.7, 0.6))), 0.0);',
    '  v_shine = clamp(band * 0.9 + pow(facing, 6.0) * 0.6, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'uniform vec3 u_ink;',
    'uniform vec3 u_accent;',
    'uniform float u_gain;',
    'varying float v_alpha;',
    'varying float v_shine;',
    'varying float v_depth;',
    'void main() {',
    '  float fog = smoothstep(-9.5, -4.0, v_depth);',
    '  vec3 col = mix(u_ink, u_accent, v_shine * 0.85);',
    '  float a = v_alpha * u_gain * mix(0.25, 1.0, fog) * (1.0 + v_shine * 1.4);',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  // 4×4 행렬(열 우선)
  function mul(a, b) {
    var o = new Float32Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
      var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
    return o;
  }
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  function translate(x, y, z) { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]); }

  function rand(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // CSS 색(oklch 포함)을 0~1 RGB로: 2D 캔버스에 한 점 칠해 읽는다.
  function cssRGB(value, fallback) {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 1;
      var x = c.getContext('2d');
      x.fillStyle = fallback; x.fillStyle = value || fallback; x.fillRect(0, 0, 1, 1);
      var d = x.getImageData(0, 0, 1, 1).data;
      return [d[0] / 255, d[1] / 255, d[2] / 255];
    } catch (e) { return [0.07, 0.06, 0.05]; }
  }

  function compile(gl, type, src) {
    var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  function mount(stage, opts) {
    opts = opts || {};
    var canvas = stage && stage.querySelector('canvas');
    if (!canvas) return null;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var still = reduce || !!opts.still;
    var gl;
    try { gl = canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) return null; // 정지 그림이 그대로 남는다

    var cs = getComputedStyle(stage);
    var paper = cssRGB(cs.getPropertyValue('--color-paper').trim(), '#141210');
    var ink = cssRGB(cs.getPropertyValue('--color-ink').trim(), '#ece6dc');
    var accent = cssRGB(cs.getPropertyValue('--color-accent').trim(), '#e39b3c');

    var small = Math.min(window.innerWidth, window.innerHeight) < 700;
    var N = opts.strands || (small ? 700 : 1500);
    var S = opts.segments || (small ? 110 : 140);
    var verts = N * S * 2;
    var aU = new Float32Array(verts), aSeed = new Float32Array(verts * 4), aSpan = new Float32Array(verts * 2);
    var r = rand(opts.seed || 1921), v = 0;
    for (var i = 0; i < N; i++) {
      var sd = [r(), r(), r(), r()], t0 = r(), len = 0.32 + 0.6 * r();
      for (var s = 0; s < S; s++) for (var e = 0; e < 2; e++) {
        aU[v] = (s + e) / S; aSeed.set(sd, v * 4); aSpan[v * 2] = t0; aSpan[v * 2 + 1] = len; v++;
      }
    }

    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) { if (window.console) console.warn('Éternel strands:', err); return null; }
    gl.useProgram(prog);

    function attr(name, data, size) {
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    attr('a_u', aU, 1); attr('a_seed', aSeed, 4); attr('a_span', aSpan, 2);
    var U = {};
    ['u_time', 'u_intro', 'u_proj', 'u_view', 'u_model', 'u_ink', 'u_accent', 'u_gain', 'u_shift'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
    gl.uniform3fv(U.u_ink, ink); gl.uniform3fv(U.u_accent, accent);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(paper[0], paper[1], paper[2], 1);

    var baseGain = (opts.gain || 0.05) * Math.sqrt(1500 / N) * (small ? 1.35 : 1);
    // 조형 위치 옮기기(화면 좌표 -1~1): { wide: [x, y], tall: [x, y] } — 글자 자리를 비울 때
    var shift = opts.shift || { wide: [0, 0], tall: [0, 0] };
    var W = 1, H = 1, aspect = 1, portrait = false, dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      W = Math.max(1, Math.round(stage.clientWidth * dpr)); H = Math.max(1, Math.round(stage.clientHeight * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      gl.viewport(0, 0, W, H);
      aspect = W / H;
      // ∞를 세울지(8 모양): opts.tallQuery(정지 그림 <source>와 같은 미디어 조건)가 있으면 그것으로, 없으면 화면 비율로
      portrait = opts.tallQuery && window.matchMedia ? window.matchMedia(opts.tallQuery).matches : aspect < 0.8;
      var fov = 32 * Math.PI / 180, k = 2 * Math.tan(fov / 2), fill = portrait ? (opts.fillTall || 0.86) : (opts.fill || 0.8);
      var ex = portrait ? 1.8 : 4.0, ey = portrait ? 4.0 : 1.8; // 회전 뒤 조형의 가로·세로 크기
      var dist = Math.max((ex / fill) / (k * aspect), (ey / fill) / k) + 0.4;
      gl.uniformMatrix4fv(U.u_proj, false, perspective(fov, aspect, 0.1, 40));
      gl.uniformMatrix4fv(U.u_view, false, translate(0, 0, -dist));
      var sh = portrait ? shift.tall : shift.wide;
      gl.uniform2f(U.u_shift, (sh && sh[0]) || 0, (sh && sh[1]) || 0);
      if (still) draw(performance.now());
    }

    var mx = 0, my = 0, tx = 0, ty = 0;
    window.addEventListener('pointermove', function (ev) {
      tx = (ev.clientX / window.innerWidth) * 2 - 1; ty = (ev.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    var start = performance.now(), visible = true, raf = 0, live = false, paused = false, pausedAt = 0;
    function draw(now) {
      var time = still ? 7.5 : (now - start) / 1000;
      var intro = still ? 1 : Math.min(1, (now - start) / 3200);
      mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
      var rect = stage.getBoundingClientRect();
      var away = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      var model = mul(rotX(-0.32 + my * 0.18 - away * 0.5), mul(rotY(0.42 + Math.sin(time * 0.1) * 0.22 + mx * 0.35), portrait ? rotZ(Math.PI / 2) : rotZ(0)));
      gl.uniformMatrix4fv(U.u_model, false, model);
      gl.uniform1f(U.u_time, time); gl.uniform1f(U.u_intro, intro);
      gl.uniform1f(U.u_gain, baseGain * (1 - away * 0.55));
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.LINES, 0, verts);
      if (!live) { live = true; stage.classList.add('is-live'); }
      if (intro >= 1) window.__eternelReady = true;
    }
    function loop(now) { raf = 0; if (paused || !visible || document.hidden) return; draw(now); raf = requestAnimationFrame(loop); }
    function kick() { if (!still && !paused && !raf && visible && !document.hidden) raf = requestAnimationFrame(loop); }

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; kick(); }).observe(stage);
    document.addEventListener('visibilitychange', kick);
    resize();
    if (still) { draw(performance.now()); window.__eternelReady = true; } else kick();
    return {
      still: still, strands: N,
      // 멈춤·다시 재생(접근성: 5초 넘게 움직이는 것은 멈출 수 있어야 함). 다시 재생하면 멈춘 자리에서 이어진다.
      pause: function () { if (paused || still) return; paused = true; pausedAt = performance.now(); if (raf) { cancelAnimationFrame(raf); raf = 0; } },
      resume: function () { if (!paused) return; paused = false; start += performance.now() - pausedAt; kick(); }
    };
  }

  window.EternelStrands = { mount: mount };
})();
