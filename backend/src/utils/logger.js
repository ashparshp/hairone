const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

const c = {
  reset: useColor ? '\x1b[0m' : '',
  bold: useColor ? '\x1b[1m' : '',
  dim: useColor ? '\x1b[2m' : '',
  cyan: useColor ? '\x1b[36m' : '',
  green: useColor ? '\x1b[32m' : '',
  yellow: useColor ? '\x1b[33m' : '',
  magenta: useColor ? '\x1b[35m' : '',
  gray: useColor ? '\x1b[90m' : '',
  white: useColor ? '\x1b[97m' : '',
};

const BOX_WIDTH = 44;

const ACRONYMS = new Set(['db', 'otp', 'api', 'id']);

const titleWord = (word) => {
  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) return lower.toUpperCase();
  if (lower.includes('-')) {
    return lower
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('-');
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const toTitleCase = (value) => String(value).split(' ').map(titleWord).join(' ');

const toSentenceCase = (value) => {
  const text = String(value).toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const toUpper = (value) => String(value).toUpperCase();

const formatStorageLabel = (label, ok) => {
  if (ok) return 'DigitalOcean Spaces';
  return toTitleCase(label);
};

const padEnd = (value, width) => {
  const text = String(value);
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
};

const visibleLength = (text) => text.replace(/\x1b\[[0-9;]*m/g, '').length;

const centerInBox = (content) => {
  const padding = Math.max(0, BOX_WIDTH - visibleLength(content));
  const left = Math.floor(padding / 2);
  return `${' '.repeat(left)}${content}${' '.repeat(padding - left)}`;
};

const boxLine = (content = '') => {
  const padding = Math.max(0, BOX_WIDTH - visibleLength(content));
  return `  ${c.dim}│${c.reset} ${content}${' '.repeat(padding)} ${c.dim}│${c.reset}`;
};

const sectionHeader = (title) => {
  console.log(`  ${c.dim}${c.bold}${toUpper(title)}${c.reset}`);
  console.log(`  ${c.dim}${'─'.repeat(46)}${c.reset}`);
};

const formatEnvironment = (env) => {
  const normalized = env?.toLowerCase() || 'development';
  if (normalized === 'production') {
    return { label: 'PRODUCTION', color: c.yellow };
  }
  return { label: toTitleCase(normalized), color: c.cyan };
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
  const subtitle = `${c.dim}${toUpper('Salon Booking API')}${c.reset}`;
  const top = `  ${c.dim}╭${'─'.repeat(BOX_WIDTH + 2)}╮${c.reset}`;
  const bottom = `  ${c.dim}╰${'─'.repeat(BOX_WIDTH + 2)}╯${c.reset}`;

  console.log('');
  console.log(top);
  console.log(boxLine());
  console.log(boxLine(centerInBox(title)));
  console.log(boxLine(centerInBox(subtitle)));
  if (version) {
    console.log(boxLine(centerInBox(`${c.dim}v${version}${c.reset}`)));
  }
  console.log(boxLine());
  console.log(bottom);
  console.log('');

  sectionHeader('Runtime');

  const labelWidth = 14;
  const row = (label, value, valueColor = c.white) => {
    console.log(
      `  ${c.dim}${toUpper(label)}${c.reset}${' '.repeat(Math.max(1, labelWidth - toUpper(label).length))}${valueColor}${value}${c.reset}`,
    );
  };

  const environment = formatEnvironment(env);
  row('Environment', environment.label, environment.color);
  row('Server', `http://0.0.0.0:${port}`, c.green);
  row('Database', `${dbHost} · ${toTitleCase('connected')}`, c.green);
  row(
    'Storage',
    formatStorageLabel(storage.label, storage.ok),
    storage.ok ? c.green : c.yellow,
  );
  if (mockOtp) {
    row('Mock OTP', `${toTitleCase('enabled')} · Use 1234`, c.yellow);
  }

  console.log('');
  sectionHeader('Scheduled Jobs');

  jobs.forEach((job, index) => {
    const branch = index === jobs.length - 1 ? '└─' : '├─';
    console.log(
      `  ${c.dim}${branch}${c.reset} ${c.bold}${padEnd(toTitleCase(job.name), 16)}${c.reset}${c.gray}${toSentenceCase(job.schedule)}${c.reset}`,
    );
  });

  console.log('');
  console.log(
    `  ${c.green}${c.bold}●${c.reset} ${c.bold}${toUpper('Ready')}${c.reset} ${c.dim}— ${toTitleCase('accepting requests')}${c.reset}`,
  );
  console.log('');
};

const info = (message) => {
  console.log(`  ${c.cyan}›${c.reset} ${message}`);
};

const warn = (message) => {
  console.warn(`  ${c.yellow}!${c.reset} ${message}`);
};

const error = (message, err) => {
  console.error(`  ${c.bold}✕${c.reset} ${message}`);
  if (err) console.error(err);
};

module.exports = {
  printStartupBanner,
  info,
  warn,
  error,
};
