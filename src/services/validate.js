function isNumber(v) {
  return typeof v === "number" && !Number.isNaN(v) && Number.isFinite(v);
}

function isInteger(v) {
  return isNumber(v) && Number.isInteger(v);
}

function validateMetrics(data) {
  const errors = [];
  const result = {};

  if (data.login_frequency == null) {
    errors.push("login_frequency is required");
  } else if (!isNumber(data.login_frequency) || data.login_frequency < 0) {
    errors.push("login_frequency must be a non-negative number (≥ 0)");
  } else {
    result.login_frequency = data.login_frequency;
  }

  if (data.feature_adoption == null) {
    errors.push("feature_adoption is required");
  } else if (!isNumber(data.feature_adoption) || data.feature_adoption < 0 || data.feature_adoption > 100) {
    errors.push("feature_adoption must be a number between 0 and 100");
  } else {
    result.feature_adoption = data.feature_adoption;
  }

  if (data.support_ticket_count != null) {
    if (!isInteger(data.support_ticket_count) || data.support_ticket_count < 0) {
      errors.push("support_ticket_count must be a non-negative integer (≥ 0)");
    } else {
      result.support_ticket_count = data.support_ticket_count;
    }
  } else {
    result.support_ticket_count = 0;
  }

  if (data.nps_score != null) {
    if (!isNumber(data.nps_score) || data.nps_score < -100 || data.nps_score > 100) {
      errors.push("nps_score must be a number between -100 and 100");
    } else {
      result.nps_score = data.nps_score;
    }
  } else {
    result.nps_score = null;
  }

  if (data.usage_time_minutes != null) {
    if (!isNumber(data.usage_time_minutes) || data.usage_time_minutes < 0) {
      errors.push("usage_time_minutes must be a non-negative number (≥ 0)");
    } else {
      result.usage_time_minutes = data.usage_time_minutes;
    }
  } else {
    result.usage_time_minutes = 0;
  }

  return { errors, data: result };
}

module.exports = { validateMetrics };
