import { useRef } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"

/**
 * React-Bits-style 3D tilt card: tracks the pointer and tilts in perspective.
 */
export default function TiltCard({ children, className = "", style = {}, max = 10 }) {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [max, -max]), { stiffness: 260, damping: 22 })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-max, max]), { stiffness: 260, damping: 22 })

  function onMove(event) {
    const rect = ref.current.getBoundingClientRect()
    x.set((event.clientX - rect.left) / rect.width - 0.5)
    y.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  function onLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      whileHover={{ scale: 1.02 }}
    >
      {children}
    </motion.div>
  )
}
