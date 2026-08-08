export const buildTicketQrValue = (
  bookingId?: string | null,
  bookingKey?: string | null,
): string => {
  const id = (bookingId || "").toString().trim();
  const pin = (bookingKey || "").toString().trim();

  if (id && pin) return `HAIRONE|${id}|${pin}`;
  if (pin) return pin;
  if (id) return `HAIRONE|${id}`;
  return "HAIRONE";
};

export const getBookingId = (booking: unknown): string | null => {
  if (!booking || typeof booking !== "object") return null;
  const record = booking as { _id?: string; id?: string };
  return record._id || record.id || null;
};
