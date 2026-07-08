import { motion } from "framer-motion"

/**
 * Segmented control with an animated sliding pill (framer-motion layoutId).
 */
export default function Segmented({ label, options, value, onChange, group }) {
  return (
    <div className="seg-field">
      <span className="seg-label">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value || "any"}
              type="button"
              role="radio"
              aria-checked={active}
              className={"seg-btn" + (active ? " active" : "")}
              onClick={() => onChange(option.value)}
            >
              {active && (
                <motion.span
                  layoutId={`pill-${group}`}
                  className="seg-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
