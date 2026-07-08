import { motion } from "framer-motion"

/**
 * React-Bits-style blur text: words de-blur into place one by one.
 */
export default function BlurText({ text, className = "", delay = 0 }) {
  const words = text.split(" ")

  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          style={{ display: "inline-block", whiteSpace: "pre" }}
          initial={{ opacity: 0, filter: "blur(9px)", y: 8 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ delay: delay + i * 0.05, duration: 0.5, ease: "easeOut" }}
        >
          {word}{i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  )
}
