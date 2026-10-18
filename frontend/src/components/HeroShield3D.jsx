import { useRef, useMemo, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ─────────────────────────────────────────
// Builds the shield outline as an extruded 3D
// shape, matching the flat SVG shield's silhouette.
// ─────────────────────────────────────────
function useShieldGeometry() {
    return useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 1.06);
        shape.lineTo(0.84, 0.86);
        shape.lineTo(0.84, 0.32);
        shape.bezierCurveTo(0.84, -0.28, 0.48, -0.68, 0, -1.06);
        shape.bezierCurveTo(-0.48, -0.68, -0.84, -0.28, -0.84, 0.32);
        shape.lineTo(-0.84, 0.86);
        shape.closePath();

        const extrudeSettings = { depth: 0.18, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 24 };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.center();
        return geometry;
    }, []);
}

// ─────────────────────────────────────────
// Checkmark — a thin tube-like stroke sitting
// just in front of the shield face.
// ─────────────────────────────────────────
function CheckMark() {
    const points = useMemo(() => [
        new THREE.Vector3(-0.32, -0.02, 0.14),
        new THREE.Vector3(-0.08, -0.26, 0.14),
        new THREE.Vector3(0.36, 0.22, 0.14),
    ], []);

    const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
    const tubeGeometry = useMemo(() => new THREE.TubeGeometry(curve, 20, 0.035, 8, false), [curve]);

    return (
        <mesh geometry={tubeGeometry}>
            <meshStandardMaterial color="#d6ff3f" emissive="#d6ff3f" emissiveIntensity={0.6} roughness={0.3} />
        </mesh>
    );
}

// ─────────────────────────────────────────
// Orbiting particle field around the shield
// ─────────────────────────────────────────
function ParticleField() {
    const pointsRef = useRef(null);
    const count = 140;

    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const radius = 1.8 + Math.random() * 1.2;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            arr[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
            arr[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            arr[i * 3 + 2] = radius * Math.cos(phi);
        }
        return arr;
    }, []);

    useFrame((_, delta) => {
        if (pointsRef.current) {
            pointsRef.current.rotation.y += delta * 0.06;
            pointsRef.current.rotation.x += delta * 0.02;
        }
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial color="#8b6bff" size={0.035} sizeAttenuation transparent opacity={0.75} />
        </points>
    );
}

// ─────────────────────────────────────────
// The shield mesh — auto-rotates slowly and
// tilts toward the cursor position.
// ─────────────────────────────────────────
function ShieldMesh() {
    const groupRef = useRef(null);
    const geometry = useShieldGeometry();
    const { viewport } = useThree();
    const target = useRef({ x: 0, y: 0 });

    useFrame((state, delta) => {
        const { pointer } = state;
        target.current.x = pointer.y * 0.35;
        target.current.y = pointer.x * 0.5;

        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.25;
            groupRef.current.rotation.x += (target.current.x - groupRef.current.rotation.x) * 0.04;
            // Gentle bob
            groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.06;
        }
    });

    return (
        <group ref={groupRef} scale={Math.min(viewport.width, viewport.height) * 0.42}>
            <mesh geometry={geometry}>
                <meshPhysicalMaterial
                    color="#5b3fe0"
                    emissive="#8b6bff"
                    emissiveIntensity={0.25}
                    metalness={0.6}
                    roughness={0.25}
                    clearcoat={0.6}
                    transparent
                    opacity={0.92}
                />
            </mesh>
            <CheckMark />
        </group>
    );
}

function Scene() {
    return (
        <>
            <ambientLight intensity={0.5} />
            <pointLight position={[3, 3, 4]} intensity={40} color="#8b6bff" />
            <pointLight position={[-3, -2, 2]} intensity={20} color="#d6ff3f" />
            <ShieldMesh />
            <ParticleField />
        </>
    );
}

// ─────────────────────────────────────────
// Public component — a contained WebGL canvas
// that fills its parent (the hero visual panel).
// Falls back to nothing (parent keeps its flat
// background) if WebGL context creation fails.
// ─────────────────────────────────────────
export default function HeroShield3D() {
    const [failed, setFailed] = useState(false);
    if (failed) return null;

    return (
        <Canvas
            className="hero-shield-canvas"
            camera={{ position: [0, 0, 4.2], fov: 42 }}
            dpr={[1, 1.75]}
            onCreated={({ gl }) => {
                gl.domElement.addEventListener("webglcontextlost", () => setFailed(true), { once: true });
            }}
            onError={() => setFailed(true)}
        >
            <Suspense fallback={null}>
                <Scene />
            </Suspense>
        </Canvas>
    );
}
