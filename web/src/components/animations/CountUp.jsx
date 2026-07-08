import { useEffect, useRef } from "react"
import { useInView, useMotionValue, useSpring } from "framer-motion"

/**
 * React-Bits-style count-up: springs from 0 to the target when scrolled into view.
 */
export default function CountUp({ to, decimals = 0, suffix = "", duration = 1.6 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const value = useMotionValue(0)
  const spring = useSpring(value, { duration: duration * 1000, bounce: 0 })

  useEffect(() => {
    if (inView) value.set(to)
  }, [inView, to, value])

  useEffect(() => {
    return spring.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = latest.toFixed(decimals) + suffix
      }
    })
  }, [spring, decimals, suffix])

  return <span ref={ref}>0{suffix}</span>
}
