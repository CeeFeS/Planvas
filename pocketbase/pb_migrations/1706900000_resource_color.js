/// <reference path="../pb_data/types.d.ts" />

/**
 * Planvas - Optional color per resource
 *
 * Adds `resources.color_hex`. When set, every allocation painted on that
 * resource uses this color instead of the brush base color. Empty = the
 * resource follows the brush.
 *
 * ADDITIVE & NON-DESTRUCTIVE: existing resources stay uncolored; the rollback
 * only removes the field. Already painted allocations keep their own color.
 */

migrate((app) => {
  let resources = null;
  try {
    resources = app.findCollectionByNameOrId("resources");
  } catch (e) {
    resources = null;
  }

  if (!resources) {
    console.log("⚠️ resources collection not found - skipping color migration");
    return;
  }

  if (resources.fields.find((f) => f.name === "color_hex")) {
    console.log("ℹ️ 'color_hex' field already exists on resources");
    return;
  }

  resources.fields.push(new Field({
    name: "color_hex",
    type: "text",
    required: false,
    max: 7,
    pattern: "^#[0-9A-Fa-f]{6}$",
  }));
  app.save(resources);
  console.log("✅ Added 'color_hex' field to resources");
}, (app) => {
  let resources = null;
  try {
    resources = app.findCollectionByNameOrId("resources");
  } catch (e) {
    resources = null;
  }
  if (resources) {
    resources.fields = resources.fields.filter((f) => f.name !== "color_hex");
    app.save(resources);
  }
});
