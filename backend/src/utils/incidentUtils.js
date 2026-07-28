const User = require("../models/User");
const SystemConfig = require("../models/SystemConfig");
const { getISTTime } = require("./dateUtils");

const getIncidentLimit = async () => {
  const config = await SystemConfig.findOne({ key: "global" });
  if (!config) return 12;
  if (typeof config.yearlyCancellationLimit === "number") {
    return config.yearlyCancellationLimit;
  }
  if (typeof config.lifetimeCancellationLimit === "number") {
    return config.lifetimeCancellationLimit;
  }
  return 12;
};

const getCurrentIncidentYear = () => {
  const { date: istDate } = getISTTime();
  return Number(istDate.split("-")[0]);
};

const resetIncidentCountsIfNewYear = async (userId, session = null) => {
  const currentYear = getCurrentIncidentYear();
  let query = User.findById(userId);
  if (session) query = query.session(session);
  const user = await query;
  if (!user) return null;

  if ((user.incidentCountsYear || 0) !== currentYear) {
    user.cancellationCount = 0;
    user.noShowCount = 0;
    user.incidentCountsYear = currentYear;
    user.isFlagged = false;
    await user.save(session ? { session } : undefined);
  }

  return user;
};

const maybeFlagUser = async (user, session = null) => {
  const limit = await getIncidentLimit();
  const totalIncidents = (user.cancellationCount || 0) + (user.noShowCount || 0);
  if (totalIncidents > limit && !user.isFlagged) {
    const opts = session ? { session } : undefined;
    await User.findByIdAndUpdate(user._id, { isFlagged: true }, opts);
  }
};

const incrementCancellationCount = async (userId, session = null) => {
  await resetIncidentCountsIfNewYear(userId, session);
  const updateOpts = { new: true };
  if (session) updateOpts.session = session;
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { cancellationCount: 1 } },
    updateOpts,
  );
  if (user) await maybeFlagUser(user, session);
  return user;
};

const incrementNoShowCount = async (userId, session = null) => {
  await resetIncidentCountsIfNewYear(userId, session);
  const updateOpts = { new: true };
  if (session) updateOpts.session = session;
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { noShowCount: 1 } },
    updateOpts,
  );
  if (user) await maybeFlagUser(user, session);
  return user;
};

module.exports = {
  getIncidentLimit,
  resetIncidentCountsIfNewYear,
  incrementCancellationCount,
  incrementNoShowCount,
};
