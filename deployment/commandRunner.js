const { spawn } = require("child_process")

/**
 * Runs an external command WITHOUT a shell (no string interpolation,
 * no injection surface). Streams output line-by-line via onLine.
 *
 * @param {string} command - executable name
 * @param {string[]} args - argument array
 * @param {object} [options] - { onLine, cwd, env }
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function run(command, args = [], options = {}) {
  const { onLine, cwd, env } = options

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: env || process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""

    function forward(chunk, isStderr) {
      const text = chunk.toString()
      if (isStderr) stderr += text
      else stdout += text
      if (onLine) {
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) onLine(line)
        }
      }
    }

    child.stdout.on("data", (chunk) => forward(chunk, false))
    child.stderr.on("data", (chunk) => forward(chunk, true))

    child.on("error", (error) => {
      reject(new Error(`Failed to start "${command}": ${error.message}`))
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr })
      } else {
        const error = new Error(`"${command} ${args.join(" ")}" exited with code ${code}`)
        error.code = code
        error.stdout = stdout
        error.stderr = stderr
        reject(error)
      }
    })
  })
}

module.exports = { run }
