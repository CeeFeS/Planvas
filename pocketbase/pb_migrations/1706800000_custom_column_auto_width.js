/// <reference path="../pb_data/types.d.ts" />

/**
 * Planvas - Automatic (content-based) width for custom columns
 *
 * `custom_columns.width` now means "manual width". 0 / empty = the grid sizes
 * the column to its content. Every column still sitting on the old default of
 * 180 px (never resized, or backfilled by 1706300000_add_custom_column_width)
 * is switched to automatic. Columns a user dragged to another width keep it.
 *
 * ADDITIVE & NON-DESTRUCTIVE: only touches the `width` value; the rollback
 * restores 180 px for automatic columns.
 */

migrate((app) => {
  let records = []
  try {
    records = app.findAllRecords("custom_columns")
  } catch (e) {
    console.log("ℹ️ custom_columns not found - skipping auto-width migration")
    return
  }

  let switched = 0
  for (const record of records) {
    if (record.get("width") === 180) {
      record.set("width", 0)
      app.save(record)
      switched++
    }
  }
  console.log(`✅ Switched ${switched} custom column(s) to automatic width`)
}, (app) => {
  let records = []
  try {
    records = app.findAllRecords("custom_columns")
  } catch (e) {
    return
  }
  for (const record of records) {
    if (!record.get("width")) {
      record.set("width", 180)
      app.save(record)
    }
  }
})
