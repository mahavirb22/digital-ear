import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { 
  OrbitControls, 
  Environment, 
  ContactShadows, 
  Stage,
  Center
} from '@react-three/drei';
import * as THREE from 'three';
import MotorModel from './MotorModel';

/**
 * Loading fallback — 3D spinning ring
 */
const LoadingFallback = () => (
  <mesh rotation={[Math.PI / 2, 0, 0]}>
    <torusGeometry args={[0.5, 0.05, 16, 48]} />
    <meshStandardMaterial color="#adc6ff" emissive="#adc6ff" emissiveIntensity={0.5} />
  </mesh>
);

/**
 * Industrial ground grid
 */
const GroundGrid = () => (
  <group position={[0, -1.5, 0]}>
    <gridHelper 
      args={[20, 40, '#1a2744', '#0d1a2e']} 
    />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial 
        color="#060a14" 
        transparent 
        opacity={0.8}
        roughness={0.9}
      />
    </mesh>
  </group>
);

/**
 * MotorViewer — The complete R3F Canvas with lighting, 
 * controls, environment, and the motor model.
 * 
 * Props:
 * - motorData: object from useMotorData hook
 */
const MotorViewer = ({ motorData = {} }) => {
  const isFailure = motorData.isFailurePredicted;
  const isOverheating = motorData.isOverheating;
  
  return (
    <div className="motor-canvas-wrapper" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ 
          position: [3, 2, 4], 
          fov: 42,
          near: 0.1,
          far: 100
        }}
        gl={{ 
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          outputColorSpace: THREE.SRGBColorSpace
        }}
        style={{ background: 'transparent' }}
      >
        {/* Ambient light — soft base illumination */}
        <ambientLight intensity={0.35} color="#b8c4e0" />
        
        {/* Main directional light — key light with shadows */}
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
          shadow-bias={-0.0001}
        />
        
        {/* Fill light — softer, from the left */}
        <directionalLight
          position={[-4, 3, -2]}
          intensity={0.4}
          color="#8fa8d4"
        />
        
        {/* Rim light — backlight for edge definition */}
        <directionalLight
          position={[-2, 2, -5]}
          intensity={0.6}
          color="#6b8ec4"
        />
        
        {/* Spot light — focused highlight on the motor */}
        <spotLight
          position={[0, 6, 3]}
          angle={0.4}
          penumbra={0.6}
          intensity={0.8}
          color="#e0e8ff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        
        {/* Secondary spot — accent from below-side */}
        <spotLight
          position={[3, -1, 2]}
          angle={0.5}
          penumbra={0.8}
          intensity={0.3}
          color="#adc6ff"
        />

        {/* Warning/failure ambient pulse */}
        {isFailure && (
          <pointLight
            position={[0, 2, 0]}
            intensity={2}
            color="#ff2200"
            distance={8}
            decay={2}
          />
        )}
        {isOverheating && !isFailure && (
          <pointLight
            position={[0, 2, 0]}
            intensity={1}
            color="#ff6600"
            distance={6}
            decay={2}
          />
        )}

        {/* Environment map for realistic reflections */}
        <Environment 
          preset="warehouse" 
          environmentIntensity={0.6}
        />

        {/* Motor model with Suspense */}
        <Suspense fallback={<LoadingFallback />}>
          <Center>
            <MotorModel motorData={motorData} />
          </Center>
        </Suspense>

        {/* Contact shadows for grounded look */}
        <ContactShadows
          position={[0, -1.2, 0]}
          opacity={0.5}
          scale={8}
          blur={2.5}
          far={4}
          color="#000510"
        />

        {/* Ground grid */}
        <GroundGrid />

        {/* Orbit Controls */}
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={10}
          minPolarAngle={Math.PI * 0.15}
          maxPolarAngle={Math.PI * 0.75}
          autoRotate={false}
          autoRotateSpeed={0.5}
          dampingFactor={0.08}
          enableDamping={true}
          target={[0, 0, 0]}
        />
      </Canvas>

      {/* Canvas overlay — viewer controls hint */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '16px',
        padding: '6px 16px',
        background: 'rgba(10, 14, 26, 0.7)',
        backdropFilter: 'blur(8px)',
        borderRadius: '20px',
        border: '1px solid rgba(173, 198, 255, 0.1)',
        fontSize: '11px',
        color: '#8c909f',
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.04em',
        pointerEvents: 'none',
        userSelect: 'none'
      }}>
        <span>🖱️ Drag to rotate</span>
        <span>⚙️ Scroll to zoom</span>
      </div>
    </div>
  );
};

export default MotorViewer;
