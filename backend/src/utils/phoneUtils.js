/**
 * Canonical Indian mobile storage: 10 digits starting with 6–9.
 * Accepts common input forms: 9876543210, +919876543210, 919876543210, 09876543210.
 */

const normalizeIndianPhone = (input) => {
  if (input === undefined || input === null) return null;
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return null;

  let candidate = digits;
  if (candidate.length === 12 && candidate.startsWith("91")) {
    candidate = candidate.slice(2);
  } else if (candidate.length === 11 && candidate.startsWith("0")) {
    candidate = candidate.slice(1);
  }

  if (candidate.length !== 10) return null;
  if (!/^[6-9]\d{9}$/.test(candidate)) return null;
  return candidate;
};

const phoneLookupVariants = (normalized) => {
  if (!normalized) return [];
  return [
    normalized,
    `+91${normalized}`,
    `91${normalized}`,
    `0${normalized}`,
  ];
};

module.exports = {
  normalizeIndianPhone,
  phoneLookupVariants,
};
