import { motion } from "framer-motion"

/**
 * React-Bits-style split text: characters cascade in with a spring.
 */
export default function SplitText({ text, className = "", delay = 0, as: Tag = "span" }) {
  const chars = Array.from(text)

  return (
    <Tag className={className} aria-label={text}>
      {chars.map((char, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          style={{ display: "inline-block", whiteSpace: "pre" }}
          initial={{ opacity: 0, y: 26, rotateX: -60 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{
            delay: delay + i * 0.035,
            type: "spring",
            stiffness: 380,
            damping: 26
          }}
        >
          {char}
        </motion.span>
      ))}
    </Tag>
  )
}
