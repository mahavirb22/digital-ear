import { useEffect, useRef, useState } from "react";

function loadThree() {
  return new Promise((resolve) => {
    if (window.THREE) return resolve(window.THREE);

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

    script.onload = () => resolve(window.THREE);

    document.head.appendChild(script);
  });
}

export default function DCMotorTwin() {
  const canvasRef = useRef(null);

  const stateRef = useRef({
    speed: 0.62,
    fault: null,

    drag: false,

    lastX: 0,
    lastY: 0,

    theta: Math.PI * 0.25,
    phi: 0.38,
    radius: 12,

    targetTheta: Math.PI * 0.25,
    targetPhi: 0.38,
    targetRadius: 12,

    time: 0,
  });

  const threeRef = useRef({});

  const [rpm, setRpm] = useState(1850);
  const [current, setCurrent] = useState("4.2");
  const [temp, setTemp] = useState(38);
  const [vibration, setVibration] = useState("0.30");

  const [speedPercent, setSpeedPercent] = useState(62);

  const [statusText, setStatusText] = useState("RUNNING");
  const [statusColor, setStatusColor] = useState("#4ade80");

  const [faultVisible, setFaultVisible] = useState(false);

  const [activeView, setActiveView] = useState("iso");

  useEffect(() => {
    const canvas = canvasRef.current;

    let animationFrame;

    loadThree().then((THREE) => {
      const getWidth = () => canvas.clientWidth;
      const getHeight = () => canvas.clientHeight;

      // ======================================================
      // RENDERER
      // ======================================================

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
      });

      renderer.setSize(getWidth(), getHeight());

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      renderer.shadowMap.enabled = true;

      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      renderer.outputEncoding = THREE.sRGBEncoding;

      renderer.physicallyCorrectLights = true;

      renderer.setClearColor(0x0a0b10, 1);

      // ======================================================
      // SCENE
      // ======================================================

      const scene = new THREE.Scene();

      scene.fog = new THREE.FogExp2(0x0a0b10, 0.045);

      // ======================================================
      // CAMERA
      // ======================================================

      const camera = new THREE.PerspectiveCamera(
        42,
        getWidth() / getHeight(),
        0.01,
        200,
      );

      camera.position.set(7, 4, 7);

      // ======================================================
      // LIGHTS
      // ======================================================

      const ambient = new THREE.AmbientLight(0xffffff, 0.38);

      scene.add(ambient);

      const sun = new THREE.DirectionalLight(0xffffff, 1.5);

      sun.position.set(8, 12, 6);

      sun.castShadow = true;

      sun.shadow.mapSize.set(2048, 2048);

      scene.add(sun);

      const rim = new THREE.PointLight(0x3366ff, 1.1, 30);

      rim.position.set(-6, 4, -5);

      scene.add(rim);

      const orangeFill = new THREE.PointLight(0xff5500, 0.4, 18);

      orangeFill.position.set(4, -3, 6);

      scene.add(orangeFill);

      const hemi = new THREE.HemisphereLight(0x223355, 0x111122, 0.4);

      scene.add(hemi);

      // ======================================================
      // GRID
      // ======================================================

      const grid = new THREE.GridHelper(30, 60, 0x141820, 0x0e1218);

      grid.position.y = -2.1;

      scene.add(grid);

      // ======================================================
      // MATERIALS
      // ======================================================

      const materials = {
        body: new THREE.MeshStandardMaterial({
          color: 0xc9d0d8,
          metalness: 0.8,
          roughness: 0.15,
        }),

        dark: new THREE.MeshStandardMaterial({
          color: 0x293140,
          metalness: 0.82,
          roughness: 0.14,
        }),

        shaft: new THREE.MeshStandardMaterial({
          color: 0xb7c6d6,
          metalness: 1,
          roughness: 0.08,
        }),

        rotor: new THREE.MeshStandardMaterial({
          color: 0x1a1d25,
          metalness: 0.55,
          roughness: 0.55,
        }),

        copper: new THREE.MeshStandardMaterial({
          color: 0xcc5500,
          metalness: 0.18,
          roughness: 0.55,
        }),

        fan: new THREE.MeshStandardMaterial({
          color: 0x383f4d,
          metalness: 0.6,
          roughness: 0.4,
        }),

        feet: new THREE.MeshStandardMaterial({
          color: 0x1d2230,
          metalness: 0.45,
          roughness: 0.7,
        }),

        terminal: new THREE.MeshStandardMaterial({
          color: 0x181c26,
          metalness: 0.35,
          roughness: 0.75,
        }),

        bearing: new THREE.MeshStandardMaterial({
          color: 0x727982,
          metalness: 0.88,
          roughness: 0.16,
        }),

        commutator: new THREE.MeshStandardMaterial({
          color: 0xe0a030,
          metalness: 0.92,
          roughness: 0.12,
        }),

        brush: new THREE.MeshStandardMaterial({
          color: 0x2b2b2b,
          metalness: 0.2,
          roughness: 0.85,
        }),
      };

      // ======================================================
      // MAIN GROUP
      // ======================================================

      const motorGroup = new THREE.Group();

      scene.add(motorGroup);

      motorGroup.position.y = 0.15;

      // ======================================================
      // ROTOR GROUP
      // ======================================================

      const rotorGroup = new THREE.Group();

      motorGroup.add(rotorGroup);

      // ======================================================
      // DIMENSIONS
      // ======================================================

      const BODY_RADIUS = 1.05;

      const BODY_LENGTH = 3.3;

      const SHAFT_RADIUS = 0.09;

      const SHAFT_EXTRA = 0.9;

      // ======================================================
      // MAIN BODY
      // ======================================================

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, BODY_LENGTH, 64),
        materials.body,
      );

      body.rotation.x = Math.PI / 2;

      body.castShadow = true;

      body.receiveShadow = true;

      motorGroup.add(body);

      // ======================================================
      // COOLING FINS
      // ======================================================

      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;

        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, BODY_LENGTH * 0.84, 0.1),
          materials.body,
        );

        fin.position.set(
          Math.cos(angle) * (BODY_RADIUS + 0.05),
          0,
          Math.sin(angle) * (BODY_RADIUS + 0.05),
        );

        fin.rotation.y = Math.PI / 2;

        fin.rotation.z = angle + Math.PI / 2;

        motorGroup.add(fin);
      }

      // ======================================================
      // END CAPS
      // ======================================================

      function createEndCap(zPosition, front = true) {
        const group = new THREE.Group();

        const outer = new THREE.Mesh(
          new THREE.CylinderGeometry(
            BODY_RADIUS + 0.05,
            BODY_RADIUS + 0.05,
            0.28,
            64,
          ),
          materials.dark,
        );

        outer.rotation.x = Math.PI / 2;

        group.add(outer);

        const face = new THREE.Mesh(
          new THREE.CircleGeometry(BODY_RADIUS + 0.05, 64),
          materials.dark,
        );

        face.rotation.x = front ? -Math.PI / 2 : Math.PI / 2;

        face.position.z = front ? 0.14 : -0.14;

        group.add(face);

        const bearing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 0.24, 32),
          materials.bearing,
        );

        bearing.rotation.x = Math.PI / 2;

        group.add(bearing);

        group.position.z = zPosition;

        return group;
      }

      motorGroup.add(createEndCap(BODY_LENGTH / 2 + 0.14, true));

      motorGroup.add(createEndCap(-(BODY_LENGTH / 2 + 0.14), false));

      // ======================================================
      // SHAFT
      // ======================================================

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(
          SHAFT_RADIUS,
          SHAFT_RADIUS,
          BODY_LENGTH + SHAFT_EXTRA * 2,
          32,
        ),
        materials.shaft,
      );

      shaft.rotation.x = Math.PI / 2;

      shaft.castShadow = true;

      rotorGroup.add(shaft);

      // ======================================================
      // ROTOR CORE
      // ======================================================

      const rotor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.68, BODY_LENGTH * 0.76, 48),
        materials.rotor,
      );

      rotor.rotation.x = Math.PI / 2;

      rotorGroup.add(rotor);

      // ======================================================
      // ROTOR SLOTS
      // ======================================================

      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;

        const slot = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, BODY_LENGTH * 0.7, 0.12),
          materials.dark,
        );

        slot.position.set(Math.cos(angle) * 0.7, 0, Math.sin(angle) * 0.7);

        slot.rotation.z = angle;

        slot.rotation.y = Math.PI / 2;

        rotorGroup.add(slot);
      }

      // ======================================================
      // COPPER COILS
      // ======================================================

      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;

        const coilFront = new THREE.Mesh(
          new THREE.TorusGeometry(0.38, 0.04, 12, 24, Math.PI),
          materials.copper,
        );

        coilFront.position.set(Math.cos(angle) * 0.25, 0, BODY_LENGTH * 0.38);

        coilFront.rotation.x = Math.PI / 2;

        coilFront.rotation.y = angle;

        rotorGroup.add(coilFront);

        const coilBack = coilFront.clone();

        coilBack.position.z = -BODY_LENGTH * 0.38;

        rotorGroup.add(coilBack);
      }

      // ======================================================
      // COMMUTATOR
      // ======================================================

      const commutatorGroup = new THREE.Group();

      commutatorGroup.position.z = -1.1;

      rotorGroup.add(commutatorGroup);

      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;

        const segment = new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.31,
            0.31,
            0.35,
            1,
            1,
            false,
            angle,
            0.28,
          ),
          materials.commutator,
        );

        segment.rotation.x = Math.PI / 2;

        commutatorGroup.add(segment);
      }

      // ======================================================
      // BRUSH HOLDERS
      // ======================================================

      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;

        const holder = new THREE.Mesh(
          new THREE.BoxGeometry(0.13, 0.35, 0.15),
          materials.dark,
        );

        holder.position.set(Math.cos(angle) * 0.52, 0, -1.08);

        holder.rotation.z = angle;

        motorGroup.add(holder);

        const brush = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.18, 0.1),
          materials.brush,
        );

        brush.position.set(Math.cos(angle) * 0.42, 0, -1.08);

        brush.rotation.z = angle;

        motorGroup.add(brush);
      }

      // ======================================================
      // FAN
      // ======================================================

      const fanGroup = new THREE.Group();

      fanGroup.position.z = -BODY_LENGTH / 2 - 0.36;

      rotorGroup.add(fanGroup);

      const fanHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.12, 24),
        materials.dark,
      );

      fanHub.rotation.x = Math.PI / 2;

      fanGroup.add(fanHub);

      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;

        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.4, 0.05),
          materials.fan,
        );

        blade.position.set(Math.cos(angle) * 0.26, 0, Math.sin(angle) * 0.26);

        blade.rotation.z = angle;

        blade.rotation.y = Math.PI / 2;

        blade.rotation.x = 0.22;

        fanGroup.add(blade);
      }

      // ======================================================
      // TERMINAL BOX
      // ======================================================

      const terminal = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.4, 0.4),
        materials.terminal,
      );

      terminal.position.set(0, BODY_RADIUS + 0.22, -BODY_LENGTH * 0.18);

      motorGroup.add(terminal);

      // ======================================================
      // MOTOR FEET
      // ======================================================

      function createFoot(x, z) {
        const foot = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.14, 0.3),
          materials.feet,
        );

        foot.position.set(x, -(BODY_RADIUS + 0.08), z);

        foot.castShadow = true;

        motorGroup.add(foot);
      }

      createFoot(-(BODY_RADIUS + 0.02), 0.8);
      createFoot(BODY_RADIUS + 0.02, 0.8);
      createFoot(-(BODY_RADIUS + 0.02), -0.8);
      createFoot(BODY_RADIUS + 0.02, -0.8);

      // ======================================================
      // ANIMATION
      // ======================================================

      function animate() {
        animationFrame = requestAnimationFrame(animate);

        const state = stateRef.current;

        state.time += 0.016;

        rotorGroup.rotation.z -= state.speed * 0.09;

        fanGroup.rotation.z += state.speed * 0.2;

        const rpmValue = Math.round(state.speed * 2980);

        const currentValue = (state.speed * 8.5 + 0.8).toFixed(1);

        const tempValue = Math.round(25 + state.speed * 42);

        const vibValue = (0.2 + state.speed * 0.5).toFixed(2);

        setRpm(rpmValue);
        setCurrent(currentValue);
        setTemp(tempValue);
        setVibration(vibValue);

        state.theta += (state.targetTheta - state.theta) * 0.08;

        state.phi += (state.targetPhi - state.phi) * 0.08;

        state.radius += (state.targetRadius - state.radius) * 0.08;

        camera.position.set(
          Math.sin(state.theta) * Math.cos(state.phi) * state.radius,

          Math.sin(state.phi) * state.radius,

          Math.cos(state.theta) * Math.cos(state.phi) * state.radius,
        );

        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
      }

      animate();

      // ======================================================
      // RESIZE
      // ======================================================

      function handleResize() {
        camera.aspect = getWidth() / getHeight();

        camera.updateProjectionMatrix();

        renderer.setSize(getWidth(), getHeight());
      }

      window.addEventListener("resize", handleResize);

      threeRef.current.cleanup = () => {
        window.removeEventListener("resize", handleResize);

        cancelAnimationFrame(animationFrame);

        renderer.dispose();
      };
    });

    return () => {
      if (threeRef.current.cleanup) {
        threeRef.current.cleanup();
      }
    };
  }, []);

  // ======================================================
  // MOUSE CONTROLS
  // ======================================================

  const onMouseDown = (e) => {
    const state = stateRef.current;

    state.drag = true;

    state.lastX = e.clientX;
    state.lastY = e.clientY;
  };

  const onMouseUp = () => {
    stateRef.current.drag = false;
  };

  const onMouseMove = (e) => {
    const state = stateRef.current;

    if (!state.drag) return;

    state.targetTheta -= (e.clientX - state.lastX) * 0.007;

    state.targetPhi = Math.max(
      0.05,
      Math.min(
        Math.PI * 0.47,
        state.targetPhi - (e.clientY - state.lastY) * 0.007,
      ),
    );

    state.lastX = e.clientX;
    state.lastY = e.clientY;
  };

  const onWheel = (e) => {
    e.preventDefault();

    const state = stateRef.current;

    state.targetRadius = Math.max(
      3,
      Math.min(20, state.targetRadius + e.deltaY * 0.013),
    );
  };

  return (
    <div
      style={{
        width: "100%",
        height: "680px",
        position: "relative",
        background: "#0a0b10",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "grab",
        }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      />

      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: 160,
        }}
      >
        <div style={panel}>
          <div style={label}>STATUS</div>

          <div
            style={{
              color: statusColor,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            ● {statusText}
          </div>
        </div>

        <Metric label="RPM" value={rpm} color="#60a5fa" />

        <Metric label="CURRENT" value={current} color="#fb923c" />

        <Metric label="TEMP" value={temp} color="#a78bfa" />

        <Metric label="VIBRATION" value={vibration} color="#34d399" />
      </div>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={panel}>
      <div style={labelStyle}>{label}</div>

      <div
        style={{
          color,
          fontWeight: 700,
          fontSize: 22,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const panel = {
  background: "rgba(10,12,20,0.88)",
  border: "1px solid rgba(80,120,200,0.18)",
  borderRadius: 8,
  padding: "12px 14px",
};

const label = {
  color: "rgba(120,170,255,0.55)",
  fontSize: 10,
  marginBottom: 4,
  letterSpacing: "0.12em",
};

const labelStyle = {
  color: "rgba(120,170,255,0.55)",
  fontSize: 10,
  marginBottom: 4,
  letterSpacing: "0.12em",
};
