const crypto = require("crypto");

const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);
const SERVICE = "hairone-api";

const c = {
  reset: useColor ? "\x1b[0m" : "",
  bold: useColor ? "\x1b[1m" : "",
  dim: useColor ? "\x1b[2m" : "",
  cyan: useColor ? "\x1b[36m" : "",
  green: useColor ? "\x1b[32m" : "",
  yellow: useColor ? "\x1b[33m" : "",
  magenta: useColor ? "\x1b[35m" : "",
  gray: useColor ? "\x1b[90m" : "",
  white: useColor ? "\x1b[97m" : "",
  red: useColor ? "\x1b[31m" : "",
};

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel =
  LEVELS[(process.env.LOG_LEVEL || "info").toLowerCase()] ?? LEVELS.info;

const preferPretty =
  process.env.LOG_FORMAT === "pretty" ||
  (process.env.LOG_FORMAT !== "json" &&
    process.env.NODE_ENV !== "production" &&
    Boolean(process.stdout.isTTY));

const BOX_WIDTH = 44;
const ACRONYMS = new Set(["db", "otp", "api", "id"]);

const titleWord = (word) => {
  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) return lower.toUpperCase();
  if (lower.includes("-")) {
    return lower
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("-");
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const toTitleCase = (value) => String(value).split(" ").map(titleWord).join(" ");
const toSentenceCase = (value) => {
  const text = String(value).toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const toUpper = (value) => String(value).toUpperCase();

const formatStorageLabel = (label, ok) => {
  if (ok) return "DigitalOcean Spaces";
  return toTitleCase(label);
};

const padEnd = (value, width) => {
  const text = String(value);
  return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
};

const visibleLength = (text) => text.replace(/\x1b\[[0-9;]*m/g, "").length;

const centerInBox = (content) => {
  const padding = Math.max(0, BOX_WIDTH - visibleLength(content));
  const left = Math.floor(padding / 2);
  return `${" ".repeat(left)}${content}${" ".repeat(padding - left)}`;
};

const boxLine = (content = "") => {
  const padding = Math.max(0, BOX_WIDTH - visibleLength(content));
  return `  ${c.dim}│${c.reset} ${content}${" ".repeat(padding)} ${c.dim}│${c.reset}`;
};

const sectionHeader = (title) => {
  console.log(`  ${c.dim}${c.bold}${toUpper(title)}${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(46)}${c.reset}`);
};

const formatEnvironment = (env) => {
  const normalized = env?.toLowerCase() || "development";
  if (normalized === "production") {
    return { label: "PRODUCTION", color: c.yellow };
  }
  return { label: toTitleCase(normalized), color: c.cyan };
};

const serializeError = (err) => {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
      status: err.status,
      code: err.code,
    };
  }
  return { message: String(err) };
};

const writeLog = (level, message, meta = {}) => {
  if ((LEVELS[level] ?? 20) < configuredLevel) return;

  const { err, error: errorField, ...rest } = meta;
  const entry = {
    level,
    time: new Date().toISOString(),
    service: SERVICE,
    msg: message,
    ...rest,
  };

  const serialized = serializeError(err || errorField);
  if (serialized) entry.err = serialized;

  if (preferPretty) {
    const color =
      level === "error"
        ? c.red
        : level === "warn"
          ? c.yellow
          : level === "debug"
            ? c.gray
            : c.cyan;
    const prefix =
      level === "error" ? "✕" : level === "warn" ? "!" : level === "debug" ? "·" : "›";
    const metaKeys = Object.keys(rest).filter((k) => rest[k] !== undefined);
    const metaStr =
      metaKeys.length > 0
        ? ` ${c.dim}${metaKeys.map((k) => `${k}=${JSON.stringify(rest[k])}`).join(" ")}${c.reset}`
        : "";
    const line = `  ${color}${prefix}${c.reset} ${message}${metaStr}`;
    if (level === "error") {
      console.error(line);
      if (serialized?.stack) console.error(serialized.stack);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
    return;
  }

  const payload = JSON.stringify(entry);
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
};

const logger = {
  debug: (message, meta) => writeLog("debug", message, meta),
  info: (message, meta) => writeLog("info", message, meta),
  warn: (message, meta) => writeLog("warn", message, meta),
  error: (message, meta) => writeLog("error", message, meta),
  child: (bindings = {}) => ({
    debug: (message, meta) => writeLog("debug", message, { ...bindings, ...meta }),
    info: (message, meta) => writeLog("info", message, { ...bindings, ...meta }),
    warn: (message, meta) => writeLog("warn", message, { ...bindings, ...meta }),
    error: (message, meta) => writeLog("error", message, { ...bindings, ...meta }),
  }),
};

/** @deprecated Prefer logger.info — kept for existing call sites */
const info = (message, meta) => logger.info(message, typeof meta === "object" ? meta : undefined);
/** @deprecated Prefer logger.warn */
const warn = (message, meta) => logger.warn(message, typeof meta === "object" ? meta : undefined);
/** @deprecated Prefer logger.error({ err }) */
const error = (message, err) =>
  logger.error(message, err ? { err } : undefined);

const requestLoggingMiddleware = (req, res, next) => {
  const requestId =
    (typeof req.headers["x-request-id"] === "string" &&
      req.headers["x-request-id"].trim()) ||
    crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const started = Date.now();
  res.on("finish", () => {
    const path = req.originalUrl || req.url;
    // Skip noisy health checks at debug unless failing
    if (path === "/api/ping" && res.statusCode < 400) {
      logger.debug("http_request", {
        requestId,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: Date.now() - started,
      });
      return;
    }

    logger.info("http_request", {
      requestId,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Date.now() - started,
      userId: req.user?._id?.toString(),
    });
  });

  next();
};

const printStartupBanner = ({
  port,
  env,
  dbHost,
  storage,
  mockOtp,
  jobs,
  version,
}) => {
  const title = `${c.bold}${c.magenta}HairOne${c.reset}`;
  const subtitle = `${c.dim}${toUpper("Salon Booking API")}${c.reset}`;
  const top = `  ${c.dim}╭${"─".repeat(BOX_WIDTH + 2)}╮${c.reset}`;
  const bottom = `  ${c.dim}╰${"─".repeat(BOX_WIDTH + 2)}╯${c.reset}`;

  console.log("");
  console.log(top);
  console.log(boxLine());
  console.log(boxLine(centerInBox(title)));
  console.log(boxLine(centerInBox(subtitle)));
  if (version) {
    console.log(boxLine(centerInBox(`${c.dim}v${version}${c.reset}`)));
  }
  console.log(boxLine());
  console.log(bottom);
  console.log("");

  sectionHeader("Runtime");

  const labelWidth = 14;
  const row = (label, value, valueColor = c.white) => {
    console.log(
      `  ${c.dim}${toUpper(label)}${c.reset}${" ".repeat(Math.max(1, labelWidth - toUpper(label).length))}${valueColor}${value}${c.reset}`,
    );
  };

  const environment = formatEnvironment(env);
  row("Environment", environment.label, environment.color);
  row("Server", `http://0.0.0.0:${port}`, c.green);
  row("Database", `${dbHost} · ${toTitleCase("connected")}`, c.green);
  row(
    "Storage",
    formatStorageLabel(storage.label, storage.ok),
    storage.ok ? c.green : c.yellow,
  );
  if (mockOtp) {
    row("Mock OTP", `${toTitleCase("enabled")} · Use 1234`, c.yellow);
  }

  console.log("");
  sectionHeader("Scheduled Jobs");

  jobs.forEach((job, index) => {
    const branch = index === jobs.length - 1 ? "└─" : "├─";
    console.log(
      `  ${c.dim}${branch}${c.reset} ${c.bold}${padEnd(toTitleCase(job.name), 16)}${c.reset}${c.gray}${toSentenceCase(job.schedule)}${c.reset}`,
    );
  });

  console.log("");
  console.log(
    `  ${c.green}${c.bold}●${c.reset} ${c.bold}${toUpper("Ready")}${c.reset} ${c.dim}— ${toTitleCase("accepting requests")}${c.reset}`,
  );
  console.log("");

  logger.info("server_ready", {
    port,
    env: env || "development",
    dbHost,
    version,
  });
};

module.exports = {
  logger,
  printStartupBanner,
  requestLoggingMiddleware,
  info,
  warn,
  error,
};
