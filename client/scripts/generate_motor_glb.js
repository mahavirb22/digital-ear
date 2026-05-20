/**
 * generate_motor_glb.js
 * 
 * Generates a realistic DC motor 3D model as a .glb file.
 * Matches the reference images: rounded-rect body, endcaps, shaft, bearing hub, terminals.
 * 
 * Usage: node scripts/generate_motor_glb.js
 * Output: src/assets/motor.glb
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════
// GLB Binary Format Builder
// ═══════════════════════════════════════════════════════

class GLBBuilder {
  constructor() {
    this.json = {
      asset: { version: "2.0", generator: "DigitalEar-MotorGen" },
      scene: 0,
      scenes: [{ name: "MotorScene", nodes: [] }],
      nodes: [],
      meshes: [],
      accessors: [],
      bufferViews: [],
      buffers: [{ byteLength: 0 }],
      materials: []
    };
    this.binChunks = [];
    this.binOffset = 0;
  }

  addMaterial(name, baseColor, metallic, roughness, emissive = [0, 0, 0]) {
    const idx = this.json.materials.length;
    this.json.materials.push({
      name,
      pbrMetallicRoughness: {
        baseColorFactor: [...baseColor, 1.0],
        metallicFactor: metallic,
        roughnessFactor: roughness
      },
      emissiveFactor: emissive,
      doubleSided: false
    });
    return idx;
  }

  addBufferData(float32Data, type) {
    const buffer = Buffer.from(float32Data.buffer);
    // Pad to 4-byte boundary
    const pad = (4 - (buffer.length % 4)) % 4;
    const paddedBuf = pad > 0 ? Buffer.concat([buffer, Buffer.alloc(pad)]) : buffer;

    const bvIdx = this.json.bufferViews.length;
    this.json.bufferViews.push({
      buffer: 0,
      byteOffset: this.binOffset,
      byteLength: buffer.length,
      target: type === 'INDEX' ? 34963 : 34962
    });
    this.binChunks.push(paddedBuf);
    this.binOffset += paddedBuf.length;
    return bvIdx;
  }

  addAccessor(bufferView, componentType, count, type, min, max) {
    const idx = this.json.accessors.length;
    const acc = { bufferView, componentType, count, type };
    if (min) acc.min = min;
    if (max) acc.max = max;
    this.json.accessors.push(acc);
    return idx;
  }

  addMesh(name, positions, normals, indices, materialIdx) {
    // Positions accessor
    const posBV = this.addBufferData(positions, 'VERTEX');
    const posMin = [Infinity, Infinity, Infinity];
    const posMax = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        posMin[j] = Math.min(posMin[j], positions[i + j]);
        posMax[j] = Math.max(posMax[j], positions[i + j]);
      }
    }
    const posAcc = this.addAccessor(posBV, 5126, positions.length / 3, 'VEC3', posMin, posMax);

    // Normals accessor
    const normBV = this.addBufferData(normals, 'VERTEX');
    const normAcc = this.addAccessor(normBV, 5126, normals.length / 3, 'VEC3', null, null);

    // Indices accessor
    const idxBV = this.addBufferData(indices, 'INDEX');
    const useShort = indices instanceof Uint16Array;
    const idxAcc = this.addAccessor(idxBV, useShort ? 5123 : 5125, indices.length, 'SCALAR', null, null);

    const meshIdx = this.json.meshes.length;
    this.json.meshes.push({
      name,
      primitives: [{
        attributes: { POSITION: posAcc, NORMAL: normAcc },
        indices: idxAcc,
        material: materialIdx,
        mode: 4
      }]
    });
    return meshIdx;
  }

  addNode(name, meshIdx, translation = [0, 0, 0], rotation = null, scale = null) {
    const nodeIdx = this.json.nodes.length;
    const node = { name, mesh: meshIdx, translation };
    if (rotation) node.rotation = rotation;
    if (scale) node.scale = scale;
    this.json.nodes.push(node);
    this.json.scenes[0].nodes.push(nodeIdx);
    return nodeIdx;
  }

  build() {
    // Finalize buffer length
    this.json.buffers[0].byteLength = this.binOffset;

    // JSON chunk
    const jsonStr = JSON.stringify(this.json);
    const jsonPad = (4 - (jsonStr.length % 4)) % 4;
    const jsonBuf = Buffer.from(jsonStr + ' '.repeat(jsonPad), 'utf-8');

    // BIN chunk
    const binBuf = Buffer.concat(this.binChunks);

    // GLB header + chunks
    const totalLen = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
    const glb = Buffer.alloc(totalLen);
    let offset = 0;

    // Header
    glb.writeUInt32LE(0x46546C67, offset); offset += 4; // magic "glTF"
    glb.writeUInt32LE(2, offset); offset += 4;           // version
    glb.writeUInt32LE(totalLen, offset); offset += 4;    // total length

    // JSON chunk
    glb.writeUInt32LE(jsonBuf.length, offset); offset += 4;
    glb.writeUInt32LE(0x4E4F534A, offset); offset += 4;  // "JSON"
    jsonBuf.copy(glb, offset); offset += jsonBuf.length;

    // BIN chunk
    glb.writeUInt32LE(binBuf.length, offset); offset += 4;
    glb.writeUInt32LE(0x004E4942, offset); offset += 4;  // "BIN\0"
    binBuf.copy(glb, offset);

    return glb;
  }
}

// ═══════════════════════════════════════════════════════
// Geometry Generators
// ═══════════════════════════════════════════════════════

/**
 * Generate a rounded rectangle extrusion (motor body cross-section)
 * Width along X, Height along Y, Depth along Z
 */
function createRoundedRectBody(width, height, depth, cornerRadius, segments = 8) {
  // Build 2D profile points (rounded rectangle in XY plane)
  const profile = [];
  const hw = width / 2 - cornerRadius;
  const hh = height / 2 - cornerRadius;
  
  // Generate corner arcs
  const corners = [
    { cx:  hw, cy:  hh, startAngle: 0 },              // top-right
    { cx: -hw, cy:  hh, startAngle: Math.PI / 2 },     // top-left
    { cx: -hw, cy: -hh, startAngle: Math.PI },          // bottom-left
    { cx:  hw, cy: -hh, startAngle: 3 * Math.PI / 2 }, // bottom-right
  ];
  
  for (const corner of corners) {
    for (let i = 0; i <= segments; i++) {
      const angle = corner.startAngle + (i / segments) * (Math.PI / 2);
      profile.push({
        x: corner.cx + Math.cos(angle) * cornerRadius,
        y: corner.cy + Math.sin(angle) * cornerRadius,
        nx: Math.cos(angle),
        ny: Math.sin(angle)
      });
    }
  }

  const numProfilePts = profile.length;
  const positions = [];
  const normals = [];
  const indices = [];

  // Front face (z = depth/2) and Back face (z = -depth/2)
  const halfDepth = depth / 2;

  // Side walls - extrude profile along Z
  for (let i = 0; i < numProfilePts; i++) {
    const p = profile[i];
    // Front vertex
    positions.push(p.x, p.y, halfDepth);
    normals.push(p.nx, p.ny, 0);
    // Back vertex
    positions.push(p.x, p.y, -halfDepth);
    normals.push(p.nx, p.ny, 0);
  }

  // Side wall indices
  for (let i = 0; i < numProfilePts; i++) {
    const next = (i + 1) % numProfilePts;
    const a = i * 2, b = i * 2 + 1;
    const c = next * 2, d = next * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }

  // Front cap
  const frontCenterIdx = positions.length / 3;
  positions.push(0, 0, halfDepth);
  normals.push(0, 0, 1);
  for (let i = 0; i < numProfilePts; i++) {
    const p = profile[i];
    positions.push(p.x, p.y, halfDepth);
    normals.push(0, 0, 1);
  }
  for (let i = 0; i < numProfilePts; i++) {
    const next = (i + 1) % numProfilePts;
    indices.push(frontCenterIdx, frontCenterIdx + 1 + i, frontCenterIdx + 1 + next);
  }

  // Back cap
  const backCenterIdx = positions.length / 3;
  positions.push(0, 0, -halfDepth);
  normals.push(0, 0, -1);
  for (let i = 0; i < numProfilePts; i++) {
    const p = profile[i];
    positions.push(p.x, p.y, -halfDepth);
    normals.push(0, 0, -1);
  }
  for (let i = 0; i < numProfilePts; i++) {
    const next = (i + 1) % numProfilePts;
    indices.push(backCenterIdx, backCenterIdx + 1 + next, backCenterIdx + 1 + i);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices)
  };
}

/**
 * Generate a cylinder geometry
 */
function createCylinder(radiusTop, radiusBottom, height, radialSegments = 32, openEnded = false) {
  const positions = [];
  const normals = [];
  const indices = [];
  const halfHeight = height / 2;

  // Side vertices
  for (let y = 0; y <= 1; y++) {
    const v = y;
    const radius = y === 0 ? radiusBottom : radiusTop;
    const py = y === 0 ? -halfHeight : halfHeight;

    for (let i = 0; i <= radialSegments; i++) {
      const angle = (i / radialSegments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      positions.push(cos * radius, py, sin * radius);

      // Calculate slope normal for non-uniform radius
      const slope = (radiusBottom - radiusTop) / height;
      const ny = slope;
      const len = Math.sqrt(1 + ny * ny);
      normals.push(cos / len, ny / len, sin / len);
    }
  }

  // Side indices
  const stride = radialSegments + 1;
  for (let i = 0; i < radialSegments; i++) {
    const a = i, b = i + 1;
    const c = i + stride, d = i + 1 + stride;
    indices.push(a, c, b, b, c, d);
  }

  if (!openEnded) {
    // Top cap
    const topCenterIdx = positions.length / 3;
    positions.push(0, halfHeight, 0);
    normals.push(0, 1, 0);
    for (let i = 0; i <= radialSegments; i++) {
      const angle = (i / radialSegments) * Math.PI * 2;
      positions.push(Math.cos(angle) * radiusTop, halfHeight, Math.sin(angle) * radiusTop);
      normals.push(0, 1, 0);
    }
    for (let i = 0; i < radialSegments; i++) {
      indices.push(topCenterIdx, topCenterIdx + 1 + i + 1, topCenterIdx + 1 + i);
    }

    // Bottom cap
    const botCenterIdx = positions.length / 3;
    positions.push(0, -halfHeight, 0);
    normals.push(0, -1, 0);
    for (let i = 0; i <= radialSegments; i++) {
      const angle = (i / radialSegments) * Math.PI * 2;
      positions.push(Math.cos(angle) * radiusBottom, -halfHeight, Math.sin(angle) * radiusBottom);
      normals.push(0, -1, 0);
    }
    for (let i = 0; i < radialSegments; i++) {
      indices.push(botCenterIdx, botCenterIdx + 1 + i, botCenterIdx + 1 + i + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices)
  };
}

/**
 * Generate a torus / ring geometry
 */
function createTorus(majorRadius, minorRadius, majorSegments = 24, minorSegments = 12) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let j = 0; j <= majorSegments; j++) {
    const u = (j / majorSegments) * Math.PI * 2;
    const cu = Math.cos(u), su = Math.sin(u);

    for (let i = 0; i <= minorSegments; i++) {
      const v = (i / minorSegments) * Math.PI * 2;
      const cv = Math.cos(v), sv = Math.sin(v);

      const x = (majorRadius + minorRadius * cv) * cu;
      const y = minorRadius * sv;
      const z = (majorRadius + minorRadius * cv) * su;

      positions.push(x, y, z);

      const nx = cv * cu;
      const ny = sv;
      const nz = cv * su;
      normals.push(nx, ny, nz);
    }
  }

  const stride = minorSegments + 1;
  for (let j = 0; j < majorSegments; j++) {
    for (let i = 0; i < minorSegments; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices)
  };
}

/**
 * Generate a box geometry
 */
function createBox(width, height, depth) {
  const hw = width / 2, hh = height / 2, hd = depth / 2;
  
  const positions = new Float32Array([
    // Front
    -hw, -hh, hd,  hw, -hh, hd,  hw, hh, hd,  -hw, hh, hd,
    // Back
    hw, -hh, -hd,  -hw, -hh, -hd,  -hw, hh, -hd,  hw, hh, -hd,
    // Top
    -hw, hh, hd,  hw, hh, hd,  hw, hh, -hd,  -hw, hh, -hd,
    // Bottom
    -hw, -hh, -hd,  hw, -hh, -hd,  hw, -hh, hd,  -hw, -hh, hd,
    // Right
    hw, -hh, hd,  hw, -hh, -hd,  hw, hh, -hd,  hw, hh, hd,
    // Left
    -hw, -hh, -hd,  -hw, -hh, hd,  -hw, hh, hd,  -hw, hh, -hd,
  ]);
  
  const normals = new Float32Array([
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    0,1,0, 0,1,0, 0,1,0, 0,1,0,
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
    1,0,0, 1,0,0, 1,0,0, 1,0,0,
    -1,0,0, -1,0,0, -1,0,0, -1,0,0,
  ]);
  
  const indices = new Uint16Array([
    0,1,2, 0,2,3,
    4,5,6, 4,6,7,
    8,9,10, 8,10,11,
    12,13,14, 12,14,15,
    16,17,18, 16,18,19,
    20,21,22, 20,22,23,
  ]);
  
  return { positions, normals, indices };
}

/**
 * Create a disc (flat cylinder cap)
 */
function createDisc(radius, segments = 32) {
  const positions = [0, 0, 0];
  const normals = [0, 0, 1];
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    normals.push(0, 0, 1);
  }
  
  const indices = [];
  for (let i = 0; i < segments; i++) {
    indices.push(0, i + 1, i + 2);
  }
  
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices)
  };
}

// ═══════════════════════════════════════════════════════
// Motor Model Assembly
// ═══════════════════════════════════════════════════════

function buildMotor() {
  const glb = new GLBBuilder();

  // Materials - matching the reference images
  const matBrassBody = glb.addMaterial(
    'BrassBody',
    [0.76, 0.68, 0.44],  // Warm brass/gold
    0.85,                  // Highly metallic
    0.35                   // Moderate roughness
  );

  const matChromeEndcap = glb.addMaterial(
    'ChromeEndcap',
    [0.58, 0.56, 0.52],  // Silver/chrome
    0.92,
    0.25
  );

  const matSteelShaft = glb.addMaterial(
    'SteelShaft',
    [0.55, 0.55, 0.56],  // Polished steel
    0.95,
    0.2
  );

  const matDarkMetal = glb.addMaterial(
    'DarkMetal',
    [0.25, 0.24, 0.22],  // Dark gunmetal
    0.8,
    0.4
  );

  const matCopperTerminal = glb.addMaterial(
    'CopperTerminal',
    [0.72, 0.45, 0.2],   // Copper/bronze
    0.9,
    0.3
  );

  const matBearingRing = glb.addMaterial(
    'BearingRing',
    [0.4, 0.39, 0.37],   // Dark chrome
    0.92,
    0.2
  );

  // ── Motor Body ──
  // Rounded rectangle extrusion matching the reference shape
  const body = createRoundedRectBody(1.8, 1.5, 2.6, 0.55, 10);
  const bodyMesh = glb.addMesh('MotorBody', body.positions, body.normals, body.indices, matBrassBody);
  // Rotate so shaft points along Z+, body extends along Z
  glb.addNode('MotorBody', bodyMesh, [0, 0, 0]);

  // ── Front Endcap ──
  const frontCap = createCylinder(0.92, 0.92, 0.12, 36);
  const frontCapMesh = glb.addMesh('FrontEndcap', frontCap.positions, frontCap.normals, frontCap.indices, matChromeEndcap);
  glb.addNode('FrontEndcap', frontCapMesh, [0, 0, 1.36]);

  // ── Rear Endcap ──
  const rearCap = createCylinder(0.92, 0.92, 0.12, 36);
  const rearCapMesh = glb.addMesh('RearEndcap', rearCap.positions, rearCap.normals, rearCap.indices, matChromeEndcap);
  glb.addNode('RearEndcap', rearCapMesh, [0, 0, -1.36]);

  // ── Bearing Hub (front) ──
  const hub = createCylinder(0.38, 0.4, 0.2, 28);
  const hubMesh = glb.addMesh('BearingHub', hub.positions, hub.normals, hub.indices, matBearingRing);
  glb.addNode('BearingHub', hubMesh, [0, 0, 1.48]);

  // ── Bearing Ring ──
  const ring = createTorus(0.35, 0.05, 28, 10);
  const ringMesh = glb.addMesh('BearingRing', ring.positions, ring.normals, ring.indices, matDarkMetal);
  glb.addNode('BearingRing', ringMesh, [0, 0, 1.55]);

  // ── Shaft ──
  const shaft = createCylinder(0.08, 0.08, 1.6, 20);
  const shaftMesh = glb.addMesh('Shaft', shaft.positions, shaft.normals, shaft.indices, matSteelShaft);
  glb.addNode('Shaft', shaftMesh, [0, 0, 2.15]);

  // ── Shaft Tip (slightly tapered) ──
  const shaftTip = createCylinder(0.06, 0.08, 0.15, 16);
  const shaftTipMesh = glb.addMesh('ShaftTip', shaftTip.positions, shaftTip.normals, shaftTip.indices, matSteelShaft);
  glb.addNode('ShaftTip', shaftTipMesh, [0, 0, 3.02]);

  // ── Terminal Tabs (rear) ──
  const tab1 = createBox(0.08, 0.35, 0.04);
  const tab1Mesh = glb.addMesh('Terminal1', tab1.positions, tab1.normals, tab1.indices, matCopperTerminal);
  glb.addNode('Terminal1', tab1Mesh, [0.22, 0, -1.46]);

  const tab2 = createBox(0.08, 0.35, 0.04);
  const tab2Mesh = glb.addMesh('Terminal2', tab2.positions, tab2.normals, tab2.indices, matCopperTerminal);
  glb.addNode('Terminal2', tab2Mesh, [-0.22, 0, -1.46]);

  // ── Side Crimps/Tabs ──
  const crimp1 = createBox(0.06, 0.5, 1.2);
  const crimp1Mesh = glb.addMesh('SideCrimp1', crimp1.positions, crimp1.normals, crimp1.indices, matDarkMetal);
  glb.addNode('SideCrimp1', crimp1Mesh, [0.93, 0, 0]);

  const crimp2 = createBox(0.06, 0.5, 1.2);
  const crimp2Mesh = glb.addMesh('SideCrimp2', crimp2.positions, crimp2.normals, crimp2.indices, matDarkMetal);
  glb.addNode('SideCrimp2', crimp2Mesh, [-0.93, 0, 0]);

  // ── Ventilation Slots on body (small indentations) ──
  const vent1 = createBox(0.04, 0.15, 0.6);
  const vent1Mesh = glb.addMesh('VentSlot1', vent1.positions, vent1.normals, vent1.indices, matDarkMetal);
  glb.addNode('VentSlot1', vent1Mesh, [0.3, 0.77, 0.4]);

  const vent2 = createBox(0.04, 0.15, 0.6);
  const vent2Mesh = glb.addMesh('VentSlot2', vent2.positions, vent2.normals, vent2.indices, matDarkMetal);
  glb.addNode('VentSlot2', vent2Mesh, [-0.3, 0.77, 0.4]);

  // ── Rear Boss / connector housing ──
  const rearBoss = createCylinder(0.25, 0.28, 0.15, 20);
  const rearBossMesh = glb.addMesh('RearBoss', rearBoss.positions, rearBoss.normals, rearBoss.indices, matDarkMetal);
  glb.addNode('RearBoss', rearBossMesh, [0, 0, -1.48]);

  // ── Body Band / seam line ──
  const band = createTorus(0.91, 0.02, 36, 8);
  const bandMesh = glb.addMesh('BodyBand', band.positions, band.normals, band.indices, matDarkMetal);
  // Rotate 90 deg around X to align with Z axis
  glb.addNode('BodyBand', bandMesh, [0, 0, 0.6], [0.7071, 0, 0, 0.7071]);

  const band2 = createTorus(0.91, 0.02, 36, 8);
  const band2Mesh = glb.addMesh('BodyBand2', band2.positions, band2.normals, band2.indices, matDarkMetal);
  glb.addNode('BodyBand2', band2Mesh, [0, 0, -0.6], [0.7071, 0, 0, 0.7071]);

  return glb.build();
}

// ═══════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════

const outputDir = path.join(__dirname, '..', 'src', 'assets');
const outputPath = path.join(outputDir, 'motor.glb');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('⚙️  Generating DC Motor GLB model...');
console.log('   Reference: Brushed DC motor (RS-540/550 style)');
console.log('');

const glbBuffer = buildMotor();

fs.writeFileSync(outputPath, glbBuffer);

const sizeKB = (glbBuffer.length / 1024).toFixed(1);
console.log(`✅ Motor model generated successfully!`);
console.log(`   Output: ${outputPath}`);
console.log(`   Size: ${sizeKB} KB`);
console.log(`   Format: GLB (glTF Binary 2.0)`);
console.log('');
console.log('   Parts included:');
console.log('   • Rounded-rect motor body (brass)');
console.log('   • Front & rear endcaps (chrome)');
console.log('   • Bearing hub & ring');
console.log('   • Motor shaft with tapered tip (steel)');
console.log('   • Terminal tabs (copper)');
console.log('   • Side crimps & ventilation slots');
console.log('   • Body band seam lines');
console.log('   • Rear connector boss');
