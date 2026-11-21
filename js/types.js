/**
 * Shared data shapes, as JSDoc typedefs.
 *
 * Why JSDoc instead of TypeScript: the project is plain JavaScript by choice
 * (no build-time types), but editors still read these, so every module can say
 * `@param {import('./types.js').Medicine} med` and get autocomplete and checks.
 * The database columns and CHECK constraints live in supabase/schema.sql.
 */

/**
 * One person whose medicines are tracked.
 * @typedef {object} Profile
 * @property {string} id
 * @property {string} name
 * @property {number | null} [age]
 * @property {'en' | 'hi'} language            voice language
 * @property {string} [blood_group]
 * @property {string} [allergies]
 * @property {string} [conditions]
 * @property {string} [emergency_name]
 * @property {string} [emergency_phone]
 * @property {string} [wake_time]               "HH:MM", routine anchors
 * @property {string} [breakfast_time]
 * @property {string} [lunch_time]
 * @property {string} [dinner_time]
 * @property {string} [bed_time]
 */

/**
 * A medicine and its schedule. `times` and `slots` are parallel arrays.
 * @typedef {object} Medicine
 * @property {string} [id]
 * @property {string} [profile_id]
 * @property {string} name
 * @property {string} generic_name
 * @property {string} dosage                    e.g. "500 mg"
 * @property {'tablet'|'capsule'|'syrup'|'injection'|'drops'|'inhaler'|'other'} form
 * @property {string} color
 * @property {string} shape
 * @property {'before'|'after'|'with'|'any'} meal
 * @property {string[]} times                   "HH:MM", sorted
 * @property {string[] | null} slots            wake | breakfast | lunch | dinner | bed | custom
 * @property {number[]} days                    0 = Sunday
 * @property {number} dose_qty
 * @property {number | null} stock              null = not tracked
 * @property {number} refill_at                 warn when this many days are left
 * @property {string} start_date                "YYYY-MM-DD"
 * @property {string | null} end_date
 * @property {boolean} active
 * @property {string} notes
 * @property {string} kept_at                   place cue, e.g. "blue box, dining table"
 * @property {string} doctor
 * @property {string | null} photo              small data URL or /demo/<name>.jpg
 */

/**
 * A logged dose. UNIQUE(medicine_id, scheduled_for) is the double-dose guard.
 * @typedef {object} DoseLog
 * @property {string} id
 * @property {string} medicine_id
 * @property {string} scheduled_for             ISO time of the scheduled dose
 * @property {'taken' | 'skipped'} status
 * @property {string} logged_at
 */

/**
 * One scheduled dose on one day (computed, not stored).
 * @typedef {object} Dose
 * @property {Medicine} med
 * @property {string} time                      "HH:MM"
 * @property {string} slot
 * @property {Date} at
 * @property {string} iso
 * @property {string} key                       medicine id + time, for log lookup
 */

/**
 * @typedef {'taken' | 'skipped' | 'missed' | 'due' | 'upcoming'} DoseStatus
 */

export {};
