import { useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

const CLOUDS = [
  { key: "aws", color: "#ff9900", angle: 0 },
  { key: "azure", color: "#38a6ff", angle: (Math.PI * 2) / 3 },
  { key: "gcp", color: "#34d97b", angle: (Math.PI * 4) / 3 }
]
const ORBIT_RADIUS = 2.6

/** Core: wireframe icosahedron shell around a glowing, gently "breathing" sphere. */
function PolicyCore() {
  const shell = useRef()
  const inner = useRef()

  useFrame((state, delta) => {
    shell.current.rotation.y += delta * 0.25
    shell.current.rotation.x += delta * 0.08
    const s = 1 + Math.sin(state.clock.elapsedTime * 1.6) * 0.045
    inner.current.scale.setScalar(s)
  })

  return (
    <group>
      <mesh ref={shell}>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshBasicMaterial color="#4f8dff" wireframe transparent opacity={0.55} />
      </mesh>
      <mesh ref={inner}>
        <sphereGeometry args={[0.62, 48, 48]} />
        <meshStandardMaterial
          color="#153a7a"
          emissive="#2f7bff"
          emissiveIntensity={1.6}
          roughness={0.25}
          metalness={0.4}
        />
      </mesh>
    </group>
  )
}

/** One orbiting provider node with a glowing halo ring. */
function CloudNode({ color, angle, speed = 0.22 }) {
  const group = useRef()
  const halo = useRef()

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime * speed + angle
    group.current.position.set(
      Math.cos(t) * ORBIT_RADIUS,
      Math.sin(t * 1.7) * 0.35,
      Math.sin(t) * ORBIT_RADIUS
    )
    halo.current.rotation.x += delta * 1.2
    halo.current.rotation.y += delta * 0.8
  })

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.9}
          roughness={0.3}
          metalness={0.3}
        />
      </mesh>
      <mesh ref={halo}>
        <torusGeometry args={[0.48, 0.018, 12, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} />
      </mesh>
    </group>
  )
}

/** Beams from the core to each orbiting node, updated every frame. */
function Links() {
  const lines = useRef([])

  const materials = useMemo(
    () => CLOUDS.map((c) => new THREE.LineBasicMaterial({ color: c.color, transparent: true, opacity: 0.35 })),
    []
  )
  const geometries = useMemo(
    () =>
      CLOUDS.map(() => {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3))
        return geometry
      }),
    []
  )

  useFrame((state) => {
    CLOUDS.forEach((cloud, i) => {
      const t = state.clock.elapsedTime * 0.22 + cloud.angle
      const positions = geometries[i].attributes.position.array
      positions[0] = 0
      positions[1] = 0
      positions[2] = 0
      positions[3] = Math.cos(t) * ORBIT_RADIUS
      positions[4] = Math.sin(t * 1.7) * 0.35
      positions[5] = Math.sin(t) * ORBIT_RADIUS
      geometries[i].attributes.position.needsUpdate = true
    })
  })

  return (
    <group>
      {CLOUDS.map((cloud, i) => (
        <line key={cloud.key} ref={(el) => (lines.current[i] = el)} geometry={geometries[i]} material={materials[i]} />
      ))}
    </group>
  )
}

/** Slowly swirling particle field. */
function Particles({ count = 1200 }) {
  const points = useRef()

  const positions = useMemo(() => {
    const array = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const radius = 4.5 + Math.random() * 5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      array[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      array[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6
      array[i * 3 + 2] = radius * Math.cos(phi)
    }
    return array
  }, [count])

  useFrame((_state, delta) => {
    points.current.rotation.y -= delta * 0.012
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#7aa4e8" size={0.03} transparent opacity={0.7} sizeAttenuation />
    </points>
  )
}

/** Orbit ring guide. */
function OrbitRing() {
  return (
    <mesh rotation-x={Math.PI / 2}>
      <torusGeometry args={[ORBIT_RADIUS, 0.006, 8, 128]} />
      <meshBasicMaterial color="#5882c1" transparent opacity={0.3} />
    </mesh>
  )
}

/** Pointer parallax + idle drift for the whole scene. */
function Rig({ children }) {
  const group = useRef()

  useFrame((state, delta) => {
    const targetX = state.pointer.y * 0.25
    const targetY = state.pointer.x * 0.45
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetX + 0.18, 2.4, delta)
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetY, 2.4, delta)
  })

  return <group ref={group}>{children}</group>
}

export default function Hero3D() {
  return (
    <div className="hero-canvas" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 1.1, 6.4], fov: 46 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.55} />
        <pointLight position={[6, 6, 6]} intensity={60} color="#8ab4ff" />
        <pointLight position={[-6, -4, -6]} intensity={35} color="#22e0a8" />
        <Rig>
          <PolicyCore />
          <OrbitRing />
          {CLOUDS.map((cloud) => (
            <CloudNode key={cloud.key} color={cloud.color} angle={cloud.angle} />
          ))}
          <Links />
          <Particles />
        </Rig>
      </Canvas>
    </div>
  )
}
