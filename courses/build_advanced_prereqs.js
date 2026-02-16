const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");

const courses = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "courses.json"), "utf-8"));

// Find courses whose description says they are an advanced/enriched version of another course
const versionPattern = /(?:advanced-level version|enriched version|advanced level version) of ([A-Z]{1,10}\d{3}[A-Z]*)/i;

let updated = 0;

for (const [id, course] of Object.entries(courses)) {
  const match = (course.description || "").match(versionPattern);
  if (!match) continue;

  const normalId = match[1];
  const normalCourse = courses[normalId];
  if (!normalCourse) {
    console.log(`${id} -> ${normalId}: normal version not found, skipping`);
    continue;
  }

  const normalPrereqs = normalCourse.prerequisites || [];
  if (normalPrereqs.length === 0) continue;

  const existing = new Set(course.prerequisites || []);
  const added = normalPrereqs.filter(p => !existing.has(p));

  if (added.length === 0) {
    console.log(`${id} -> ${normalId}: already has all prerequisites`);
    continue;
  }

  course.prerequisites = [...existing, ...added];
  updated++;
  console.log(`${id} -> ${normalId}: added ${added.join(", ")}`);
}

fs.writeFileSync(path.join(DATA_DIR, "courses.json"), JSON.stringify(courses, null, 2));
console.log(`\nDone! Updated ${updated} courses`);
