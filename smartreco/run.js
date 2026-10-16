#!/usr/bin/env node
/**
 * SmartReco one-command launcher.
 *   node run.js     (or: npm start)
 * First run: creates the Python venv, installs backend + frontend dependencies, creates .env.local.
 * Then starts the API (http://localhost:8000) and the web app (http://localhost:3000) together.
 * Press Ctrl+C once to stop both.
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const isWin = process.platform === "win32";
const root = __dirname;
const backend = path.join(root, "backend");
const frontend = path.join(root, "frontend");
const venvDir = path.join(backend, ".venv");
const venvPython = path.join(venvDir, isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python");
const stamp = path.join(venvDir, ".deps-installed");
const npmCmd = isWin ? "npm.cmd" : "npm";

// npm can export a persistent `allow-scripts` setting from your user .npmrc into scripts started via
// `npm start`; the nested `npm install` then fails with EALLOWSCRIPTS. Strip it for child processes.
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !/^npm_config_allow[_-]scripts$/i.test(k))
);

const log = (msg) => console.log(`\x1b[35m[smartreco]\x1b[0m ${msg}`);
const fail = (msg) => { console.error(`\x1b[31m[smartreco] ${msg}\x1b[0m`); process.exit(1); };

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, env: cleanEnv, stdio: "inherit", shell: isWin && cmd.endsWith(".cmd") });
  if (r.status !== 0) fail(`Command failed: ${cmd} ${args.join(" ")}`);
}

function findPython() {
  for (const c of isWin ? ["python", "py", "python3"] : ["python3", "python"]) {
    const r = spawnSync(c, ["--version"], { stdio: "ignore", shell: isWin });
    if (r.status === 0) return c;
  }
  return fail("Python 3.10+ was not found. Install it from https://www.python.org and try again.");
}

// 1) Backend environment
if (!fs.existsSync(venvPython)) {
  log("Creating Python virtual environment...");
  run(findPython(), ["-m", "venv", ".venv"], backend);
}
const req = path.join(backend, "requirements.txt");
if (!fs.existsSync(stamp) || fs.statSync(stamp).mtimeMs < fs.statSync(req).mtimeMs) {
  log("Installing backend dependencies (first run takes a minute)...");
  run(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"], backend);
  fs.writeFileSync(stamp, new Date().toISOString());
}

// 2) Frontend environment
const envLocal = path.join(frontend, ".env.local");
if (!fs.existsSync(envLocal)) fs.copyFileSync(path.join(frontend, ".env.local.example"), envLocal);
if (!fs.existsSync(path.join(frontend, "node_modules"))) {
  log("Installing frontend dependencies...");
  run(npmCmd, ["install"], frontend);
}

// 3) Start both servers
const children = [];
let stopping = false;

function start(label, color, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, shell: isWin && cmd.endsWith(".cmd"), env: { ...cleanEnv, FORCE_COLOR: "1", PYTHONUNBUFFERED: "1" } });
  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const l of lines) out.write(`\x1b[${color}m[${label}]\x1b[0m ${l}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stdout);
  child.on("exit", (code) => {
    if (!stopping) { log(`${label} stopped (exit code ${code}). Shutting down.`); stop(code || 1); }
  });
  children.push(child);
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    try {
      if (isWin) spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
      else c.kill("SIGTERM");
    } catch { /* already gone */ }
  }
  setTimeout(() => process.exit(code), 300);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

log("Starting SmartReco...");
log("Web app: http://localhost:3000   API: http://localhost:8000/docs   (Ctrl+C to stop)");
start("api", "36", venvPython, ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"], backend);
start("web", "32", npmCmd, ["run", "dev"], frontend);
