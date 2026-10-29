import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Code2, Database, Palette, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import './landing.css';

type Vec3 = [number, number, number];

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, n: number): Vec3 => [a[0] * n, a[1] * n, a[2] * n];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: Vec3): Vec3 => {
  const length = Math.hypot(...a) || 1;
  return scale(a, 1 / length);
};

function makeSculptureMesh() {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const joint = (center: Vec3, radius: number) => {
    const latitudes = 10, longitudes = 16, base = positions.length / 3;
    for (let i = 0; i <= latitudes; i += 1) {
      const phi = Math.PI * i / latitudes;
      for (let j = 0; j <= longitudes; j += 1) {
        const theta = Math.PI * 2 * j / longitudes;
        const normal: Vec3 = [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
        positions.push(...add(center, scale(normal, radius)));
        normals.push(...normal);
        if (i < latitudes && j < longitudes) {
          const a = base + i * (longitudes + 1) + j, b = a + longitudes + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
  };
  const rod = (start: Vec3, end: Vec3, radius = 0.035) => {
    const axis = normalize(subtract(end, start));
    const reference: Vec3 = Math.abs(axis[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    const u = normalize(cross(axis, reference)), v = normalize(cross(axis, u));
    const segments = 12, base = positions.length / 3;
    for (const point of [start, end]) for (let j = 0; j <= segments; j += 1) {
      const theta = 2 * Math.PI * j / segments;
      const normal = normalize(add(scale(u, Math.cos(theta)), scale(v, Math.sin(theta))));
      positions.push(...add(point, scale(normal, radius))); normals.push(...normal);
    }
    for (let j = 0; j < segments; j += 1) {
      const a = base + j, b = base + segments + 1 + j;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  };

  // A career hub connected directly to four catalog-backed skill joints.
  const joints: Vec3[] = [[0, .08, .12], [-.92, .56, -.12], [.92, .56, -.12], [-.92, -.52, -.12], [.92, -.52, -.12]];
  const connections: [number, number][] = [[0,1],[0,2],[0,3],[0,4]];
  for (const [a, b] of connections) rod(joints[a], joints[b], a === 0 || b === 0 ? .038 : .025);
  for (let i = 0; i < joints.length; i += 1) joint(joints[i], i === 0 ? .16 : .09);
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create a WebGL shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'WebGL shader compilation failed.';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

const vertexShader = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uMvp;
uniform mat4 uModel;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vPosition = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uMvp * vec4(aPosition, 1.0);
}`;

const fragmentShader = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vec3 n = normalize(vNormal);
  vec3 light = normalize(vec3(-0.48, 0.76, 0.62));
  float diffuse = max(dot(n, light), 0.0);
  float fill = max(dot(n, normalize(vec3(0.62, 0.1, -0.7))), 0.0);
  float occlusion = 0.84 + 0.16 * smoothstep(-0.8, 0.9, n.y);
  float grain = sin(vPosition.x * 31.0 + sin(vPosition.z * 22.0)) * 0.012;
  vec3 stone = vec3(0.68, 0.61, 0.50) + grain;
  float hub = 1.0 - smoothstep(0.105, 0.19, length(vPosition - vec3(0.0, 0.08, 0.12)));
  stone = mix(stone, vec3(0.27, 0.43, 0.34), hub);
  vec3 color = stone * (0.48 + 0.42 * diffuse + 0.16 * fill) * occlusion;
  vec3 viewDirection = normalize(vec3(0.0, 0.0, 4.5) - vPosition);
  float softHighlight = pow(max(dot(reflect(-light, n), viewDirection), 0.0), 20.0) * 0.10;
  color += vec3(0.95, 0.84, 0.68) * softHighlight;
  gl_FragColor = vec4(color, 1.0);
}`;

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * range, -1,
    0, 0, near * far * 2 * range, 0,
  ]);
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function rotation(x: number, y: number, z: number) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  const rx = new Float32Array([1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]);
  const ry = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
  const rz = new Float32Array([cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return multiply(multiply(rz, ry), rx);
}

function modelViewProjection(model: Float32Array, projection: Float32Array) {
  const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -4.1, 1]);
  return multiply(multiply(projection, view), model);
}

type PreviewSkill = { id: string; name: string; description: string };
type SculptureProps = { careerName: string; careerDescription: string; skills: PreviewSkill[]; sourceLabel: string };

export function SculptureCanvas({ careerName, careerDescription, skills, sourceLabel }: SculptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selected, setSelected] = useState(-1);
  const previewSkills = skills.slice(0, 4);
  const skillIcons = [Database, Code2, Palette, Users];

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffers: WebGLBuffer[] = [];
    let frameId = 0;
    let visible = true;
    let inViewport = true;
    let renderFrame: ((time: number) => void) | null = null;
    let lastTime = 0;
    let rotationY = -0.24;
    let rotationX = 0.08;
    let targetX = rotationX;
    let targetY = rotationY;
    let dragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let failed = false;
    const onContextLost = (event: Event) => { event.preventDefault(); failed = true; setStatus('fallback'); };

    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
      if (!gl) throw new Error('WebGL is unavailable.');
      const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
      program = gl.createProgram();
      if (!program) throw new Error('Could not create a WebGL program.');
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'WebGL program linking failed.');

      const mesh = makeSculptureMesh();
      const upload = (data: BufferSource, target: number) => {
        const buffer = gl!.createBuffer();
        if (!buffer) throw new Error('Could not allocate sculpture geometry.');
        buffers.push(buffer);
        gl!.bindBuffer(target, buffer);
        gl!.bufferData(target, data, gl!.STATIC_DRAW);
      };
      upload(mesh.positions, gl.ARRAY_BUFFER);
      upload(mesh.normals, gl.ARRAY_BUFFER);
      upload(mesh.indices, gl.ELEMENT_ARRAY_BUFFER);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.clearColor(0, 0, 0, 0);
      setStatus('ready');

      const resize = () => {
        const bounds = host.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const width = Math.max(1, Math.round(bounds.width * dpr));
        const height = Math.max(1, Math.round(bounds.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl!.viewport(0, 0, width, height);
        }
        projection = perspective(Math.PI / 4.1, width / Math.max(1, height), 0.1, 30);
        if (reducedMotion && visible && renderFrame && !frameId) frameId = requestAnimationFrame(renderFrame);
      };
      let projection = perspective(Math.PI / 4.1, 1, 0.1, 30);
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      const intersection = new IntersectionObserver(([entry]) => {
        inViewport = entry.isIntersecting;
        visible = inViewport && !document.hidden;
        if (visible && renderFrame && !frameId) frameId = requestAnimationFrame(renderFrame);
        if (!visible && frameId) { cancelAnimationFrame(frameId); frameId = 0; }
      });
      intersection.observe(host);
      const onVisibilityChange = () => {
        visible = inViewport && !document.hidden;
        if (visible && renderFrame && !frameId) frameId = requestAnimationFrame(renderFrame);
        if (!visible && frameId) { cancelAnimationFrame(frameId); frameId = 0; }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      const positionBuffer = buffers[0];
      const normalBuffer = buffers[1];
      const indexBuffer = buffers[2];
      const positionLocation = gl.getAttribLocation(program, 'aPosition');
      const normalLocation = gl.getAttribLocation(program, 'aNormal');
      const modelLocation = gl.getUniformLocation(program, 'uModel');
      const mvpLocation = gl.getUniformLocation(program, 'uMvp');
      const draw = (time: number) => {
        frameId = 0;
        if (!visible || failed) return;
        const elapsed = Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
        lastTime = time;
        if (!reducedMotion && !dragging) targetY += elapsed * 0.075;
        if (reducedMotion) { rotationX = targetX; rotationY = targetY; }
        else {
          rotationX += (targetX - rotationX) * 0.045;
          rotationY += (targetY - rotationY) * 0.045;
        }
        const model = rotation(rotationX, rotationY, reducedMotion ? 0 : 0.04 * Math.sin(time * 0.00024));
        gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
        gl!.useProgram(program);
        gl!.bindBuffer(gl!.ARRAY_BUFFER, positionBuffer);
        gl!.enableVertexAttribArray(positionLocation);
        gl!.vertexAttribPointer(positionLocation, 3, gl!.FLOAT, false, 0, 0);
        gl!.bindBuffer(gl!.ARRAY_BUFFER, normalBuffer);
        gl!.enableVertexAttribArray(normalLocation);
        gl!.vertexAttribPointer(normalLocation, 3, gl!.FLOAT, false, 0, 0);
        gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl!.uniformMatrix4fv(modelLocation, false, model);
        gl!.uniformMatrix4fv(mvpLocation, false, modelViewProjection(model, projection));
        gl!.drawElements(gl!.TRIANGLES, mesh.indices.length, gl!.UNSIGNED_SHORT, 0);
        if (!reducedMotion) frameId = requestAnimationFrame(draw);
      };
      renderFrame = draw;
      frameId = requestAnimationFrame(draw);

      const pointerDown = (event: PointerEvent) => {
        dragging = true;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
      };
      const pointerMove = (event: PointerEvent) => {
        const bounds = canvas.getBoundingClientRect();
        if (dragging) {
          const dx = event.clientX - lastPointerX;
          const dy = event.clientY - lastPointerY;
          targetY += dx * 0.006;
          targetX = Math.max(-0.75, Math.min(0.75, targetX + dy * 0.004));
          lastPointerX = event.clientX;
          lastPointerY = event.clientY;
        } else if (!reducedMotion) {
          targetY = -0.24 + ((event.clientX - bounds.left - bounds.width / 2) / bounds.width) * 0.3;
          targetX = Math.max(-0.55, Math.min(0.55, 0.08 + ((event.clientY - bounds.top - bounds.height / 2) / bounds.height) * 0.1));
        }
        if (reducedMotion && visible && !frameId && renderFrame) frameId = requestAnimationFrame(renderFrame);
      };
      const pointerUp = () => { dragging = false; };
      const pointerLeave = () => { if (!dragging) { targetX = 0.08; targetY = -0.24; if (reducedMotion && visible && !frameId && renderFrame) frameId = requestAnimationFrame(renderFrame); } };
      const keyDown = (event: KeyboardEvent) => {
        const step = event.shiftKey ? 0.16 : 0.08;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'ArrowLeft') targetY -= step;
        if (event.key === 'ArrowRight') targetY += step;
        if (event.key === 'ArrowUp') targetX = Math.max(-0.75, targetX - step);
        if (event.key === 'ArrowDown') targetX = Math.min(0.75, targetX + step);
        if (reducedMotion) { if (visible && !frameId && renderFrame) frameId = requestAnimationFrame(renderFrame); }
      };
      canvas.addEventListener('pointerdown', pointerDown);
      canvas.addEventListener('pointermove', pointerMove);
      canvas.addEventListener('pointerup', pointerUp);
      canvas.addEventListener('pointercancel', pointerUp);
      canvas.addEventListener('pointerleave', pointerLeave);
      canvas.addEventListener('keydown', keyDown);
      canvas.addEventListener('webglcontextlost', onContextLost);

      return () => {
        cancelAnimationFrame(frameId);
        observer.disconnect();
        intersection.disconnect();
        document.removeEventListener('visibilitychange', onVisibilityChange);
        canvas.removeEventListener('pointerdown', pointerDown);
        canvas.removeEventListener('pointermove', pointerMove);
        canvas.removeEventListener('pointerup', pointerUp);
        canvas.removeEventListener('pointercancel', pointerUp);
        canvas.removeEventListener('pointerleave', pointerLeave);
        canvas.removeEventListener('keydown', keyDown);
        canvas.removeEventListener('webglcontextlost', onContextLost);
        buffers.forEach(buffer => gl?.deleteBuffer(buffer));
        if (program) gl?.deleteProgram(program);
      };
    } catch {
      setStatus('fallback');
      if (program && gl) gl.deleteProgram(program);
      buffers.forEach(buffer => gl?.deleteBuffer(buffer));
      return () => cancelAnimationFrame(frameId);
    }
  }, [reducedMotion]);

  const selectedSkill = selected >= 0 ? previewSkills[selected] : null;
  return <div className={`sculpture-stage ${status === 'ready' ? 'is-ready' : ''}`}>
    <div className="sculpture-light" aria-hidden="true" />
    <div className="sculpture-shadow" aria-hidden="true" />
    <canvas ref={canvasRef} className="sculpture-canvas" aria-label="Interactive three-dimensional career map. Drag to rotate or use the arrow keys." role="application" tabIndex={0} />
    {status === 'loading' && <div className="sculpture-loading" role="status">Preparing the mechanical model…</div>}
    {status === 'fallback' && <div className="sculpture-fallback mechanical-fallback" role="img" aria-label={`Static illustration showing ${careerName} connected to required skills`}><div className="mechanical-diagram"><i/><i/><i/><i/><i/><b/><b/><b/><b/></div><small>Interactive 3D is unavailable in this browser.</small></div>}
    <div className="preview-nodes" aria-label="Explore this career preview">
      <button className={`preview-node career-node ${selected === -1 ? 'active' : ''}`} onClick={() => setSelected(-1)} aria-pressed={selected === -1}><BriefcaseBusiness size={16}/><span>{careerName}</span></button>
      {previewSkills.map((skill, index) => { const Icon = skillIcons[index % skillIcons.length]; return <button key={skill.id} className={`preview-node skill-node skill-node-${index + 1} ${selected === index ? 'active' : ''}`} onClick={() => setSelected(index)} aria-pressed={selected === index}><Icon size={14}/><span>{skill.name}</span></button>; })}
      <div className="preview-insight" aria-live="polite"><span className="preview-source">{sourceLabel}</span><b>{selectedSkill?.name || careerName}</b><p>{selectedSkill?.description || careerDescription}</p><Link to="/career-universe">Explore the full career map <ArrowRight size={13}/></Link></div>
    </div>
    <div className="sculpture-caption" aria-hidden="true"><span>CAREER</span><i /><span>REQUIRED SKILLS</span></div>
    {!reducedMotion && <span className="sculpture-hint" aria-hidden="true">DRAG TO EXPLORE</span>}
  </div>;
}
