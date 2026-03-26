'use client'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Line, Environment, Float } from '@react-three/drei'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'

function FloatingCard({ position, rotation, delay, children }: any) {
  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5} position={position} rotation={rotation}>
      <Html transform distanceFactor={1.5} center zIndexRange={[100, 0]}>
        <div 
          className="bg-[#0c1f18]/80 backdrop-blur-md border border-[#143a2b] rounded-xl p-4 w-[280px] shadow-[0_0_30px_rgba(20,58,43,0.5)] flex flex-col pointer-events-none transition-transform"
          style={{ animationDelay: `${delay}s` }}
        >
          {children}
        </div>
      </Html>
    </Float>
  )
}

function EnergyPulse({ start, end, delay }: { start: [number, number, number], end: [number, number, number], delay: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  const curve = useMemo(() => {
    return new THREE.LineCurve3(
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    )
  }, [start, end])

  useFrame((state) => {
    if (!meshRef.current) return
    const time = (state.clock.elapsedTime * 0.2 + delay) % 1
    const point = curve.getPoint(time)
    meshRef.current.position.copy(point)
    const scale = 1 + Math.sin(time * Math.PI) * 0.5
    meshRef.current.scale.setScalar(scale)
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.06, 16, 16]} />
      <meshBasicMaterial color={[0.5, 2.5, 1.5]} toneMapped={false} />
      <pointLight color="#9ae5ab" intensity={2} distance={2} />
    </mesh>
  )
}

function Wire({ start, end }: { start: [number, number, number], end: [number, number, number] }) {
  return (
    <Line
      points={[start, end]}
      color="#143a2b"
      lineWidth={1.5}
      transparent
      opacity={0.6}
    />
  )
}

function Scene() {
  const centerPos: [number, number, number] = [0, -0.5, 0]
  const card1Pos: [number, number, number] = [-3.5, 1.5, -1]
  const card2Pos: [number, number, number] = [3.5, 1.5, 0]
  const card3Pos: [number, number, number] = [-1.5, -2.5, 1]
  const card4Pos: [number, number, number] = [3.0, -2.0, -1]
  
  const rupeeRef = useRef<HTMLDivElement>(null)

  useFrame((state) => {
    if (rupeeRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1
      rupeeRef.current.style.transform = `scale(${pulse})`
      rupeeRef.current.style.boxShadow = `0 0 ${20 + pulse * 20}px rgba(154,229,171,0.2)`
    }
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Environment preset="city" />

      {/* Central Block */}
      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.2} position={centerPos}>
        <Html transform center zIndexRange={[100, 0]}>
          <div 
            ref={rupeeRef}
            className="w-28 h-20 bg-[#0c1f18]/90 backdrop-blur-md border border-[#225a44] rounded-2xl flex flex-col items-center justify-center text-[#9ae5ab] shadow-[0_0_30px_rgba(20,58,43,0.8)] transition-all"
          >
            <span className="text-3xl font-bold" style={{ textShadow: '0 0 10px rgba(154,229,171,0.5)' }}>₹</span>
            <div className="flex w-full justify-between items-center px-3 mt-1 text-[10px] text-[#9ae5ab] font-mono tracking-widest">
               <span>Artha</span>
               <div className="w-1 h-1 rounded-full bg-[#9ae5ab]" />
               <span>Brain</span>
            </div>
          </div>
        </Html>
      </Float>

      {/* Floating Screens */}
      <FloatingCard position={card1Pos} rotation={[0, 0.2, 0]} delay={0}>
        <div className="flex items-center space-x-2 text-xs text-[#cbd5e1] font-semibold mb-3">
           <svg className="w-3 h-3 text-[#9ae5ab]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> 
           <span>Personal Portfolio</span>
        </div>
        <div className="h-20 flex items-end justify-between space-x-2">
          {[40, 70, 45, 90, 60, 100].map((h, i) => (
            <div key={i} className="w-full bg-[#9ae5ab]/50 rounded-sm" style={{ height: `${h}%` }} />
          ))}
        </div>
      </FloatingCard>

      <FloatingCard position={card2Pos} rotation={[0, -0.2, 0]} delay={0.3}>
        <div className="flex items-center space-x-2 text-xs text-[#cbd5e1] font-semibold mb-3">
           <svg className="w-3 h-3 text-[#9ae5ab]" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg> 
           <span>Mutual Fund Analysis</span>
        </div>
        <div className="space-y-2">
          <div className="bg-[#0f2e22]/50 rounded p-2 text-[10px] text-[#9ae5ab] border-l-2 border-[#9ae5ab]">High overlap detected</div>
          <div className="bg-[#0f2e22]/50 rounded p-2 text-[10px] text-[#9ae5ab] border-l-2 border-[#9ae5ab]">Rebalance suggested: -15% MFs</div>
        </div>
      </FloatingCard>

      <FloatingCard position={card3Pos} rotation={[-0.1, 0.1, 0.05]} delay={0.6}>
        <div className="flex items-center space-x-2 text-xs text-[#cbd5e1] font-semibold mb-3">
           <svg className="w-3 h-3 text-[#9ae5ab]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
           <span>Real-Time Trend Analysis</span>
        </div>
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center bg-[#0f2e22]/50 p-1.5 rounded">
              <span className="text-[10px] text-white font-bold tracking-wider">RELIANCE</span>
              <span className="text-[10px] text-[#9ae5ab]">+2.4%</span>
            </div>
            <div className="flex justify-between items-center bg-[#0f2e22]/50 p-1.5 rounded">
              <span className="text-[10px] text-white font-bold tracking-wider">HDFCBANK</span>
              <span className="text-[10px] text-[#9ae5ab]">+1.1%</span>
            </div>
         </div>
      </FloatingCard>

      <FloatingCard position={card4Pos} rotation={[-0.1, -0.1, -0.05]} delay={0.9}>
         <div className="flex items-center space-x-2 text-xs text-[#cbd5e1] font-semibold mb-3">
            <svg className="w-3 h-3 text-[#9ae5ab]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            <span>AI Recommendations</span>
         </div>
         <div className="space-y-2">
          <div className="bg-[#0f2e22]/50 rounded p-2 text-[10px] text-[#94a3b8] flex justify-between">
            <span>Buy Watch: TATAMOTORS</span>
            <span className="text-[#9ae5ab] font-bold">92%</span>
          </div>
          <div className="bg-[#0f2e22]/50 rounded p-2 text-[10px] text-[#94a3b8] flex justify-between">
            <span>Breakout: INFY</span>
            <span className="text-[#9ae5ab] font-bold">85%</span>
          </div>
        </div>
      </FloatingCard>

      {/* Wires */}
      <Wire start={card1Pos} end={centerPos} />
      <Wire start={card2Pos} end={centerPos} />
      <Wire start={card3Pos} end={centerPos} />
      <Wire start={card4Pos} end={centerPos} />

      {/* Energy Pulses */}
      <EnergyPulse start={card1Pos} end={centerPos} delay={0} />
      <EnergyPulse start={card1Pos} end={centerPos} delay={0.5} />
      
      <EnergyPulse start={card2Pos} end={centerPos} delay={0.2} />
      <EnergyPulse start={card2Pos} end={centerPos} delay={0.7} />
      
      <EnergyPulse start={card3Pos} end={centerPos} delay={0.4} />
      <EnergyPulse start={card3Pos} end={centerPos} delay={0.9} />

      <EnergyPulse start={card4Pos} end={centerPos} delay={0.1} />
      <EnergyPulse start={card4Pos} end={centerPos} delay={0.6} />

      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
    </>
  )
}

export default function Hero3D() {
  return (
    <div className="w-full h-full relative cursor-grab active:cursor-grabbing">
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }} dpr={[1, 2]}>
        <Scene />
      </Canvas>
    </div>
  )
}
