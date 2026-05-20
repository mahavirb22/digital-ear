import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Preload the motor model
useGLTF.preload('/motor.glb');

/**
 * MotorModel — The core 3D motor with RPM-driven rotation 
 * and predictive maintenance visual effects.
 * 
 * Props:
 * - motorData: { rpm, temperature, vibration, status, isOverheating, isHighVibration, isFailurePredicted }
 */
const MotorModel = ({ motorData = {} }) => {
  const groupRef = useRef();
  const shaftRef = useRef();
  const bodyMaterialRef = useRef();
  const glowLightRef = useRef();
  
  const {
    rpm = 0,
    temperature = 25,
    vibration = 0,
    status = 'normal',
    isOverheating = false,
    isHighVibration = false,
    isFailurePredicted = false
  } = motorData;

  // Load the GLB model
  const { scene } = useGLTF('/motor.glb');
  
  // Clone the scene for independent material manipulation
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    
    // Traverse and make materials unique so we can modify them per-instance
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = child.material.clone();
        
        // Enhance materials for better PBR rendering
        child.material.envMapIntensity = 1.2;
        child.material.needsUpdate = true;
      }
    });
    
    return clone;
  }, [scene]);

  // Extract body materials for effect manipulation
  const bodyMaterials = useMemo(() => {
    const mats = [];
    clonedScene.traverse((child) => {
      if (child.isMesh && child.name.includes('MotorBody')) {
        mats.push(child.material);
      }
    });
    return mats;
  }, [clonedScene]);

  // Animation loop — only for visual effects, NOT for rotation
  useFrame((state) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime;

    // ═══════════════════════════════════════
    // Vibration shaking effect (only when high vibration detected)
    // ═══════════════════════════════════════
    if (isHighVibration) {
      const shakeIntensity = vibration * 0.015;
      const shakeFreq = 30;
      groupRef.current.position.x = Math.sin(time * shakeFreq) * shakeIntensity;
      groupRef.current.position.y = Math.cos(time * shakeFreq * 1.3) * shakeIntensity * 0.7;
      groupRef.current.position.z = Math.sin(time * shakeFreq * 0.7) * shakeIntensity * 0.5;
    } else {
      // Keep motor perfectly still
      groupRef.current.position.x = 0;
      groupRef.current.position.y = 0;
      groupRef.current.position.z = 0;
    }

    // ═══════════════════════════════════════
    // Overheating red glow
    // ═══════════════════════════════════════
    bodyMaterials.forEach((mat) => {
      if (isOverheating) {
        const heatIntensity = Math.min((temperature - 85) / 35, 1.0);
        const pulse = 0.5 + 0.5 * Math.sin(time * 3);
        const emissiveStrength = heatIntensity * pulse * 0.6;
        mat.emissive = new THREE.Color(1.0, 0.15, 0.05);
        mat.emissiveIntensity = emissiveStrength;
      } else {
        mat.emissive = new THREE.Color(0, 0, 0);
        mat.emissiveIntensity = 0;
      }
    });

    // ═══════════════════════════════════════
    // Failure prediction - warning blink
    // ═══════════════════════════════════════
    if (glowLightRef.current) {
      if (isFailurePredicted) {
        const blink = Math.sin(time * 8) > 0 ? 1.0 : 0.1;
        glowLightRef.current.intensity = blink * 3;
        glowLightRef.current.color.setRGB(1, 0.1, 0.05);
      } else if (isOverheating) {
        const pulse = 0.4 + 0.6 * Math.sin(time * 2);
        glowLightRef.current.intensity = pulse * 1.5;
        glowLightRef.current.color.setRGB(1, 0.3, 0.1);
      } else {
        glowLightRef.current.intensity = 0;
      }
    }
  });

  return (
    <group ref={groupRef} dispose={null}>
      {/* Motor model from GLB */}
      <primitive 
        object={clonedScene} 
        scale={0.6}
        rotation={[Math.PI / 2, 0, 0]}
      />
      
      {/* Warning/failure glow light */}
      <pointLight
        ref={glowLightRef}
        position={[0, 0, 0]}
        intensity={0}
        distance={5}
        decay={2}
        color="#ff1a05"
      />
    </group>
  );
};

export default MotorModel;
