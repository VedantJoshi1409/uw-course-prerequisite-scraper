const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");

// Load all data sources
const prerequisites = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "course_prerequisites.json"), "utf-8"));
const courseExtras = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "course_descriptions.json"), "utf-8"));
const facultiesArchive = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "subject_faculties.json"), "utf-8"));

// Create a map from subject code to faculty
const facultyMap = {};
for (const entry of facultiesArchive) {
  facultyMap[entry.subjectCode] = entry.faculty;
}

// Extract subject code from course ID (e.g., "CS" from "CS349", "AMATH" from "AMATH231")
function getSubjectCode(courseId) {
  const match = courseId.match(/^([A-Z]+)/);
  return match ? match[1] : null;
}

// Extract level from course ID (e.g., 300 from "CS349", 200 from "AMATH231")
function getLevel(courseId) {
  const match = courseId.match(/(\d)\d{2}[A-Z]*$/);
  return match ? parseInt(match[1]) * 100 : null;
}

// Combine all courses
const courses = {};

// Get all unique course IDs from both sources
const allCourseIds = new Set([
  ...Object.keys(prerequisites),
  ...Object.keys(courseExtras)
]);

for (const courseId of allCourseIds) {
  const prereqData = prerequisites[courseId] || {};
  const extraData = courseExtras[courseId] || {};

  const subjectCode = getSubjectCode(courseId);
  const faculty = subjectCode ? facultyMap[subjectCode] : null;
  const level = getLevel(courseId);

  // Get title from either source (prefer extras as it's more recent)
  const title = extraData.title || prereqData.name || courseId;

  // Get subject from either source
  const subject = extraData.subject || prereqData.subject || null;

  courses[courseId] = {
    id: courseId,
    title: title,
    subject: subject,
    description: extraData.description || "",
    faculty: faculty,
    level: level,
    prerequisites: prereqData.prerequisites || []
  };
}

// Save combined courses
fs.writeFileSync(path.join(DATA_DIR, "courses.json"), JSON.stringify(courses, null, 2));

console.log(`Combined ${Object.keys(courses).length} courses into courses.json`);
console.log(`- From prerequisites.json: ${Object.keys(prerequisites).length} courses`);
console.log(`- From course_extras.json: ${Object.keys(courseExtras).length} courses`);
console.log(`- Faculty mappings: ${Object.keys(facultyMap).length} subjects`);
